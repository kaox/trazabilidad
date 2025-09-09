const { Pool } = require('@neondatabase/serverless');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// Vercel inyectará la variable de entorno POSTGRES_URL automáticamente
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

// --- Users ---
const registerUser = async (req, res) => {
    const { usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = `
            INSERT INTO users (usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `;
        await pool.query(sql, [usuario, hashedPassword, nombre, apellido, dni, ruc, empresa, celular, correo]);
        res.status(201).json({ message: "Usuario registrado exitosamente." });
    } catch (err) {
        if (err.code === '23505') {
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
        const result = await pool.query('SELECT * FROM users WHERE usuario = $1', [usuario]);
        const user = result.rows[0];
        if (!user) return res.status(401).json({ error: "Credenciales inválidas." });
        
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const tokenPayload = { id: user.id, username: user.usuario };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
            res.status(200).json({ message: "Inicio de sesión exitoso.", token });
        } else {
            res.status(401).json({ error: "Credenciales inválidas." });
        }
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
};

const logoutUser = (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(200).json({ message: 'Cierre de sesión exitoso.' });
};

const getUserProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT id, usuario, nombre, apellido, dni, ruc, empresa, celular, correo FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
        res.status(200).json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateUserProfile = async (req, res) => {
    const userId = req.user.id;
    const { nombre, apellido, dni, ruc, empresa, celular, correo } = req.body;
    const sql = 'UPDATE users SET nombre = $1, apellido = $2, dni = $3, ruc = $4, empresa = $5, celular = $6, correo = $7 WHERE id = $8';
    try {
        await pool.query(sql, [nombre, apellido, dni, ruc, empresa, celular, correo, userId]);
        res.status(200).json({ message: "Perfil actualizado exitosamente." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateUserPassword = async (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ error: "Todos los campos son requeridos." });
    try {
        const result = await pool.query('SELECT password FROM users WHERE id = $1', [userId]);
        const user = result.rows[0];
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) return res.status(401).json({ error: "La contraseña actual es incorrecta." });
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hashedNewPassword, userId]);
        res.status(200).json({ message: "Contraseña actualizada exitosamente." });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

// --- Fincas ---
const getFincas = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query('SELECT * FROM fincas WHERE user_id = $1 ORDER BY nombre_finca', [userId]);
        res.status(200).json(result.rows);
    } catch (err) { 
        console.error(err);
        res.status(500).json({ error: err.message }); 
    }
};

const createFinca = async (req, res) => {
    const userId = req.user.id;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas } = req.body;
    const sql = 'INSERT INTO fincas (user_id, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *';
    try {
        const result = await pool.query(sql, [userId, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas)]);
        res.status(201).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas } = req.body;
    const sql = 'UPDATE fincas SET propietario = $1, dni_ruc = $2, nombre_finca = $3, pais = $4, ciudad = $5, altura = $6, superficie = $7, coordenadas = $8 WHERE id = $9 AND user_id = $10 RETURNING *';
    try {
        const result = await pool.query(sql, [propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas), id, userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });
        res.status(200).json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await pool.query('DELETE FROM fincas WHERE id = $1 AND user_id = $2', [id, userId]);
        if (result.rowCount === 0) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Lotes ---
const getBatchesTree = async (req, res) => {
    const userId = req.user.id;
    try {
        const result = await pool.query(`
            WITH RECURSIVE lotes_arbol AS (
                SELECT id, tipo, parent_id, data FROM lotes WHERE parent_id IS NULL AND user_id = $1
                UNION ALL
                SELECT l.id, l.tipo, l.parent_id, l.data FROM lotes l
                JOIN lotes_arbol la ON l.parent_id = la.id
            )
            SELECT * FROM lotes_arbol;
        `, [userId]);
        
        const lotes = result.rows;
        const map = {};
        const roots = [];
        lotes.forEach(lote => {
            map[lote.id] = lote;
            if (lote.tipo === 'cosecha') lote.data.fermentaciones = [];
            if (lote.tipo === 'fermentacion') lote.data.secados = [];
            if (lote.tipo === 'secado') lote.data.tostados = [];
            if (lote.tipo === 'tostado') lote.data.moliendas = [];
        });
        lotes.forEach(lote => {
            if (lote.parent_id && map[lote.parent_id]) {
                const parent = map[lote.parent_id];
                if(parent.tipo === 'cosecha') parent.data.fermentaciones.push(lote.data);
                else if(parent.tipo === 'fermentacion') parent.data.secados.push(lote.data);
                else if(parent.tipo === 'secado') parent.data.tostados.push(lote.data);
                else if(parent.tipo === 'tostado') parent.data.moliendas.push(lote.data);
            } else if (!lote.parent_id) {
                roots.push(lote.data);
            }
        });
        roots.sort((a, b) => new Date(b.fechaCosecha) - new Date(a.fechaCosecha));
        res.status(200).json(roots);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const checkBatchOwnership = async (batchId, userId) => {
    const result = await pool.query(`
        WITH RECURSIVE ancestry AS (
            SELECT id, parent_id, user_id FROM lotes WHERE id = $1
            UNION ALL
            SELECT l.id, l.parent_id, l.user_id FROM lotes l JOIN ancestry a ON l.id = a.parent_id
        )
        SELECT user_id FROM ancestry WHERE user_id IS NOT NULL`, [batchId]);
    const owner = result.rows[0];
    return owner && owner.user_id === userId;
};

const createBatch = async (req, res) => {
    const userId = req.user.id;
    const { tipo, parent_id, data } = req.body;
    let sql;
    let params;
    if (tipo === 'cosecha') {
        sql = 'INSERT INTO lotes (id, user_id, tipo, parent_id, data) VALUES ($1, $2, $3, $4, $5)';
        params = [data.id, userId, tipo, null, JSON.stringify(data)];
    } else {
        const isOwner = await checkBatchOwnership(parent_id, userId);
        if (!isOwner) {
            return res.status(403).json({ error: "No tienes permiso para añadir a este lote." });
        }
        sql = 'INSERT INTO lotes (id, tipo, parent_id, data) VALUES ($1, $2, $3, $4)';
        params = [data.id, tipo, parent_id, JSON.stringify(data)];
    }

    try {
        await pool.query(sql, params);
        res.status(201).json({ message: "Lote creado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateBatch = async (req, res) => {
    const { id } = req.params;
    const { data } = req.body;
    const isOwner = await checkBatchOwnership(id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: "No tienes permiso para modificar este lote." });

    try {
        await pool.query('UPDATE lotes SET data = $1 WHERE id = $2', [JSON.stringify(data), id]);
        res.status(200).json({ message: "Lote actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteBatch = async (req, res) => {
    const { id } = req.params;
    const isOwner = await checkBatchOwnership(id, req.user.id);
    if (!isOwner) return res.status(403).json({ error: "No tienes permiso para eliminar este lote." });

    try {
        await pool.query('DELETE FROM lotes WHERE id = $1', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getTrazabilidad = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await pool.query(`
            WITH RECURSIVE trazabilidad_completa AS (
                SELECT id, tipo, parent_id, data, user_id FROM lotes WHERE id = $1
                UNION ALL
                SELECT l.id, l.tipo, l.parent_id, l.data, l.user_id FROM lotes l
                INNER JOIN trazabilidad_completa tc ON l.id = tc.parent_id
            )
            SELECT * FROM trazabilidad_completa;
        `, [id]);
        
        const rows = result.rows;
        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });
        
        const history = {};
        const cosechaLot = rows.find(row => row.tipo === 'cosecha');

        if (!cosechaLot || !cosechaLot.user_id) {
            return res.status(404).json({ error: 'Trazabilidad incompleta: no se encontró propietario.' });
        }
        const ownerId = cosechaLot.user_id;
        
        rows.forEach(row => { history[row.tipo] = row.data; });

        if (history.cosecha && history.cosecha.finca) {
            const fincaResult = await pool.query('SELECT * FROM fincas WHERE nombre_finca = $1 AND user_id = $2', [history.cosecha.finca, ownerId]);
            if (fincaResult.rows[0]) history.fincaData = fincaResult.rows[0];
        }
        
        if (history.tostado && history.tostado.tipoPerfil) {
            const perfilResult = await pool.query('SELECT perfil_data FROM perfiles_cacao WHERE nombre = $1 AND user_id = $2', [history.tostado.tipoPerfil, ownerId]);
            if (perfilResult.rows[0]) history.tostado.perfilSensorialData = perfilResult.rows[0].perfil_data;
        }

        res.status(200).json(history);
    } catch (error) { 
        console.error(`Error en getTrazabilidad para el lote ${id}:`, error.message);
        res.status(500).json({ error: "Error interno del servidor." }); 
    }
};

// --- Perfiles Sensoriales ---
const getPerfiles = async (req, res) => {
    const userId = req.user.id;
    try {
        let result = await pool.query('SELECT * FROM perfiles_cacao WHERE user_id = $1 ORDER BY nombre', [userId]);
        let perfiles = result.rows;

        if (perfiles.length === 0) {
            const defaultPerfiles = [
                { nombre: 'VRAE-99', perfil_data: { cacao: 8, acidez: 3, amargor: 7, astringencia: 6, frutaFresca: 2, frutaMarron: 5, vegetal: 3, floral: 1, madera: 6, especia: 2, nuez: 7, caramelo: 4 } },
                { nombre: 'VRAE-15', perfil_data: { cacao: 7, acidez: 8, amargor: 4, astringencia: 3, frutaFresca: 9, frutaMarron: 3, vegetal: 2, floral: 4, madera: 2, especia: 3, nuez: 2, caramelo: 5 } }
            ];
            const insertSql = 'INSERT INTO perfiles_cacao (user_id, nombre, perfil_data) VALUES ($1, $2, $3)';
            for (const perfil of defaultPerfiles) {
                await pool.query(insertSql, [userId, perfil.nombre, JSON.stringify(perfil.perfil_data)]);
            }
            result = await pool.query('SELECT * FROM perfiles_cacao WHERE user_id = $1 ORDER BY nombre', [userId]);
            perfiles = result.rows;
        }
        res.status(200).json(perfiles);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createPerfil = async (req, res) => {
    const userId = req.user.id;
    const { nombre, perfil_data } = req.body;
    const sql = 'INSERT INTO perfiles_cacao (user_id, nombre, perfil_data) VALUES ($1, $2, $3) RETURNING *';
    try {
        const result = await pool.query(sql, [userId, nombre, JSON.stringify(perfil_data)]);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        if (err.code === '23505') res.status(409).json({ error: "Ya existe un perfil con ese nombre." });
        else res.status(500).json({ error: err.message });
    }
};

module.exports = {
    registerUser, loginUser, logoutUser,
    getFincas, createFinca, updateFinca, deleteFinca,
    getBatchesTree, createBatch, updateBatch, deleteBatch,
    getTrazabilidad,
    getPerfiles, createPerfil,
    getUserProfile, updateUserProfile, updateUserPassword
};

