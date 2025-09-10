const environment = process.env.NODE_ENV || 'development';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let get, all, run;

if (environment === 'production') {
    // --- Configuración para Producción (PostgreSQL con Neon) ---
    const { Pool } = require('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

    const queryAdapter = async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        return await pool.query(pgSql, params);
    };
    
    get = async (sql, params = []) => {
        const result = await queryAdapter(sql, params);
        return result.rows[0];
    };
    all = async (sql, params = []) => {
        const result = await queryAdapter(sql, params);
        return result.rows;
    };
    run = async (sql, params = []) => {
        const result = await queryAdapter(sql, params);
        // En PostgreSQL, para obtener el ID, se suele usar RETURNING id, pero para ser compatible
        // con SQLite, asumimos que no se devuelve y simplemente retornamos los cambios.
        return { changes: result.rowCount };
    };

} else {
    // --- Configuración para Desarrollo (SQLite) ---
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database("./database.db", (err) => {
        if (err) console.error("SQLite connection error:", err.message);
        else console.log("Conectado a la base de datos SQLite para desarrollo.");
        db.run('PRAGMA foreign_keys = ON;');
    });

    all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
    get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
    run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve({ changes: this.changes, lastID: this.lastID }); }));
}

// --- Lógica de la API (usa las funciones adaptadoras) ---

const registerUser = async (req, res) => {
    const { usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await run('INSERT INTO users (usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo) VALUES (?,?,?,?,?,?,?,?,?)', [usuario, hashedPassword, nombre, apellido, dni, ruc, empresa, celular, correo]);
        res.status(201).json({ message: "Usuario registrado exitosamente." });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: "El nombre de usuario ya existe." });
        } else {
            console.error(err);
            res.status(500).json({ error: "Ocurrió un error al registrar el usuario." });
        }
    }
};

const loginUser = async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const user = await get('SELECT * FROM users WHERE usuario = ?', [usuario]);
        if (!user) return res.status(401).json({ error: "Credenciales inválidas." });
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const tokenPayload = { id: user.id, username: user.usuario };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
            res.status(200).json({ message: "Inicio de sesión exitoso.", token });
        } else {
            res.status(401).json({ error: "Credenciales inválidas." });
        }
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};

const logoutUser = (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(200).json({ message: 'Cierre de sesión exitoso.' });
};

const getUserProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        const user = await get('SELECT id, usuario, nombre, apellido, dni, ruc, empresa, celular, correo FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
        res.status(200).json(user);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateUserProfile = async (req, res) => {
    const userId = req.user.id;
    const { nombre, apellido, dni, ruc, empresa, celular, correo } = req.body;
    const sql = 'UPDATE users SET nombre = ?, apellido = ?, dni = ?, ruc = ?, empresa = ?, celular = ?, correo = ? WHERE id = ?';
    try {
        await run(sql, [nombre, apellido, dni, ruc, empresa, celular, correo, userId]);
        res.status(200).json({ message: "Perfil actualizado exitosamente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateUserPassword = async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: "Todos los campos son requeridos." });
    try {
        const user = await get('SELECT password FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) return res.status(401).json({ error: "La contraseña actual es incorrecta." });
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await run('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);
        res.status(200).json({ message: "Contraseña actualizada exitosamente." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getFincas = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all('SELECT * FROM fincas WHERE user_id = ? ORDER BY nombre_finca', [userId]);
        const fincas = rows.map(f => ({ ...f, coordenadas: JSON.parse(f.coordenadas || 'null') }));
        res.status(200).json(fincas);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const createFinca = async (req, res) => {
    const userId = req.user.id;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas } = req.body;
    const sql = 'INSERT INTO fincas (user_id, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    try {
        await run(sql, [userId, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas)]);
        res.status(201).json({ message: "Finca creada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const updateFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas } = req.body;
    const sql = 'UPDATE fincas SET propietario = ?, dni_ruc = ?, nombre_finca = ?, pais = ?, ciudad = ?, altura = ?, superficie = ?, coordenadas = ? WHERE id = ? AND user_id = ?';
    try {
        const result = await run(sql, [propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas), id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });
        res.status(200).json({ message: "Finca actualizada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const deleteFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM fincas WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getBatchesTree = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all(`
            WITH RECURSIVE lotes_arbol AS (
                SELECT id, tipo, parent_id, data FROM lotes WHERE parent_id IS NULL AND user_id = ?
                UNION ALL
                SELECT l.id, l.tipo, l.parent_id, l.data FROM lotes l JOIN lotes_arbol la ON l.parent_id = la.id
            )
            SELECT * FROM lotes_arbol;
        `, [userId]);
        const lotes = rows.map(lote => ({ ...lote, data: JSON.parse(lote.data) }));
        const map = {};
        const roots = [];
        lotes.forEach(lote => {
            map[lote.id] = lote;
            const loteData = lote.data;
            if (lote.tipo === 'cosecha') loteData.fermentaciones = [];
            if (lote.tipo === 'fermentacion') loteData.secados = [];
            if (lote.tipo === 'secado') loteData.tostados = [];
            if (lote.tipo === 'tostado') loteData.moliendas = [];
        });
        lotes.forEach(lote => {
            if (lote.parent_id && map[lote.parent_id]) {
                const parent = map[lote.parent_id];
                if (parent.tipo === 'cosecha') parent.data.fermentaciones.push(lote.data);
                else if (parent.tipo === 'fermentacion') parent.data.secados.push(lote.data);
                else if (parent.tipo === 'secado') parent.data.tostados.push(lote.data);
                else if (parent.tipo === 'tostado') parent.data.moliendas.push(lote.data);
            } else if (!lote.parent_id) {
                roots.push(lote.data);
            }
        });
        roots.sort((a, b) => new Date(b.fechaCosecha) - new Date(a.fechaCosecha));
        res.status(200).json(roots);
    } catch (error) { res.status(500).json({ error: error.message }); }
};
const checkBatchOwnership = async (batchId, userId) => {
    const owner = await get(`
        WITH RECURSIVE ancestry AS (
            SELECT id, parent_id, user_id FROM lotes WHERE id = ?
            UNION ALL
            SELECT l.id, l.parent_id, l.user_id FROM lotes l JOIN ancestry a ON l.id = a.parent_id
        )
        SELECT user_id FROM ancestry WHERE user_id IS NOT NULL`, [batchId]);
    return owner && owner.user_id === userId;
};
const createBatch = async (req, res) => {
    const userId = req.user.id;
    const { tipo, parent_id, data } = req.body;
    let sql;
    let params;
    if (tipo === 'cosecha') {
        sql = 'INSERT INTO lotes (id, user_id, tipo, parent_id, data) VALUES (?, ?, ?, ?, ?)';
        params = [data.id, userId, tipo, null, JSON.stringify(data)];
    } else {
        const isOwner = await checkBatchOwnership(parent_id, userId);
        if (!isOwner) return res.status(403).json({ error: "No tienes permiso para añadir a este lote." });
        sql = 'INSERT INTO lotes (id, tipo, parent_id, data) VALUES (?, ?, ?, ?)';
        params = [data.id, tipo, parent_id, JSON.stringify(data)];
    }
    try {
        await run(sql, params);
        res.status(201).json({ message: "Lote creado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const updateBatch = async (req, res) => {
    const { id } = req.params;
    const { data } = req.body;
    const isOwner = await checkBatchOwnership(id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: "No tienes permiso para modificar este lote." });
    try {
        await run('UPDATE lotes SET data = ? WHERE id = ?', [JSON.stringify(data), id]);
        res.status(200).json({ message: "Lote actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const deleteBatch = async (req, res) => {
    const { id } = req.params;
    const isOwner = await checkBatchOwnership(id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: "No tienes permiso para eliminar este lote." });
    try {
        await run('DELETE FROM lotes WHERE id = ?', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getTrazabilidad = async (req, res) => {
    const { id } = req.params;
    try {
        const rows = await all(`
            WITH RECURSIVE trazabilidad_completa AS (
                SELECT id, tipo, parent_id, data, user_id FROM lotes WHERE id = ?
                UNION ALL
                SELECT l.id, l.tipo, l.parent_id, l.data, l.user_id FROM lotes l
                INNER JOIN trazabilidad_completa tc ON l.id = tc.parent_id
            )
            SELECT * FROM trazabilidad_completa;
        `, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });
        const history = {};
        const cosechaLot = rows.find(row => row.tipo === 'cosecha');
        if (!cosechaLot || !cosechaLot.user_id) return res.status(404).json({ error: 'Trazabilidad incompleta: no se encontró propietario.' });
        const ownerId = cosechaLot.user_id;
        rows.forEach(row => { history[row.tipo] = JSON.parse(row.data); });
        if (history.cosecha && history.cosecha.finca) {
            const finca = await get('SELECT * FROM fincas WHERE nombre_finca = ? AND user_id = ?', [history.cosecha.finca, ownerId]);
            if (finca) history.fincaData = { ...finca, coordenadas: JSON.parse(finca.coordenadas || 'null') };
        }
        if (history.tostado && history.tostado.tipoPerfil) {
            const perfil = await get('SELECT perfil_data FROM perfiles_cacao WHERE nombre = ? AND user_id = ?', [history.tostado.tipoPerfil, ownerId]);
            if (perfil) history.tostado.perfilSensorialData = JSON.parse(perfil.perfil_data);
        }
        res.status(200).json(history);
    } catch (error) { 
        console.error(`Error en getTrazabilidad para el lote ${id}:`, error.message);
        res.status(500).json({ error: "Error interno del servidor." }); 
    }
};
const getPerfiles = async (req, res) => {
    const userId = req.user.id;
    try {
        let perfiles = await all('SELECT * FROM perfiles_cacao WHERE user_id = ? ORDER BY nombre', [userId]);
        if (perfiles.length === 0) {
            const defaultPerfiles = [
                { nombre: 'VRAE-99', perfil_data: { cacao: 8, acidez: 3, amargor: 7, astringencia: 6, frutaFresca: 2, frutaMarron: 5, vegetal: 3, floral: 1, madera: 6, especia: 2, nuez: 7, caramelo: 4 } },
                { nombre: 'VRAE-15', perfil_data: { cacao: 7, acidez: 8, amargor: 4, astringencia: 3, frutaFresca: 9, frutaMarron: 3, vegetal: 2, floral: 4, madera: 2, especia: 3, nuez: 2, caramelo: 5 } }
            ];
            const insertSql = 'INSERT INTO perfiles_cacao (user_id, nombre, perfil_data) VALUES (?, ?, ?)';
            for (const perfil of defaultPerfiles) {
                await run(insertSql, [userId, perfil.nombre, JSON.stringify(perfil.perfil_data)]);
            }
            perfiles = await all('SELECT * FROM perfiles_cacao WHERE user_id = ? ORDER BY nombre', [userId]);
        }
        const parsedPerfiles = perfiles.map(p => ({ ...p, perfil_data: JSON.parse(p.perfil_data) }));
        res.status(200).json(parsedPerfiles);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const createPerfil = async (req, res) => {
    const userId = req.user.id;
    const { nombre, perfil_data } = req.body;
    const sql = 'INSERT INTO perfiles_cacao (user_id, nombre, perfil_data) VALUES (?, ?, ?)';
    try {
        const result = await run(sql, [userId, nombre, JSON.stringify(perfil_data)]);
        res.status(201).json({ id: result.lastID, user_id: userId, nombre, perfil_data });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) res.status(409).json({ error: "Ya existe un perfil con ese nombre." });
        else res.status(500).json({ error: err.message });
    }
};

const getProcesadoras = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all('SELECT * FROM procesadoras WHERE user_id = ? ORDER BY nombre_comercial', [userId]);
        res.status(200).json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono } = req.body;
    const id = require('crypto').randomUUID();
    const sql = 'INSERT INTO procesadoras (id, user_id, ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    try {
        await run(sql, [id, userId, ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono]);
        res.status(201).json({ message: "Procesadora creada" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono } = req.body;
    const sql = 'UPDATE procesadoras SET ruc = ?, razon_social = ?, nombre_comercial = ?, tipo_empresa = ?, pais = ?, ciudad = ?, direccion = ?, telefono = ? WHERE id = ? AND user_id = ?';
    try {
        const result = await run(sql, [ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono, id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: "Procesadora no encontrada o no tienes permiso." });
        res.status(200).json({ message: "Procesadora actualizada" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM procesadoras WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: "Procesadora no encontrada o no tienes permiso." });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    registerUser, loginUser, logoutUser,
    getFincas, createFinca, updateFinca, deleteFinca,
    getBatchesTree, createBatch, updateBatch, deleteBatch,
    getTrazabilidad,
    getPerfiles, createPerfil,
    getProcesadoras, createProcesadora, updateProcesadora, deleteProcesadora,
    getUserProfile, updateUserProfile, updateUserPassword
};

