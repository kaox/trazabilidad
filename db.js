const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const DB_SOURCE = "database.db";

const db = new sqlite3.Database(DB_SOURCE, (err) => {
  if (err) { console.error(err.message); throw err; }
  console.log('Conectado a la base de datos SQLite.');
  db.run('PRAGMA foreign_keys = ON;');
});

// Promisify DB methods
const dbAll = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
const dbGet = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbRun = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve(this); }));

// --- Users ---
const registerUser = async (req, res) => {
    const { usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo } = req.body;
    if (!usuario || !password) {
        return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
    }
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const sql = 'INSERT INTO users (usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo) VALUES (?,?,?,?,?,?,?,?,?)';
        await dbRun(sql, [usuario, hashedPassword, nombre, apellido, dni, ruc, empresa, celular, correo]);
        res.status(201).json({ message: "Usuario registrado exitosamente." });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
            res.status(409).json({ error: "El nombre de usuario ya existe." });
        } else {
            console.error("Error en el registro:", err.message);
            res.status(500).json({ error: "Ocurrió un error al registrar el usuario." });
        }
    }
};

const loginUser = async (req, res) => {
    const { usuario, password } = req.body;
    try {
        const user = await dbGet('SELECT * FROM users WHERE usuario = ?', [usuario]);
        if (!user) {
            return res.status(401).json({ error: "Credenciales inválidas." });
        }
        const match = await bcrypt.compare(password, user.password);
        if (match) {
            const token = jwt.sign({ username: user.usuario }, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1h' });
            
            // 1. Se establece la cookie como método principal
            res.cookie('token', token, { 
                httpOnly: true, 
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax', 
                path: '/' 
            });

            // 2. Se devuelve el token en el cuerpo para que el cliente lo guarde como respaldo
            res.status(200).json({ 
                message: "Inicio de sesión exitoso.",
                token: token 
            });
        } else {
            res.status(401).json({ error: "Credenciales inválidas." });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const logoutUser = (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(200).json({ message: 'Cierre de sesión exitoso.' });
};


// --- Fincas ---
const getFincas = async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM fincas ORDER BY nombre_finca');
        const fincas = rows.map(f => ({ ...f, coordenadas: JSON.parse(f.coordenadas || 'null') }));
        res.status(200).json(fincas);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createFinca = async (req, res) => {
    const { propietario, dni_ruc, nombre_finca, superficie, coordenadas } = req.body;
    const id = require('crypto').randomUUID();
    const sql = 'INSERT INTO fincas (id, propietario, dni_ruc, nombre_finca, superficie, coordenadas) VALUES (?, ?, ?, ?, ?, ?)';
    try {
        await dbRun(sql, [id, propietario, dni_ruc, nombre_finca, superficie, JSON.stringify(coordenadas)]);
        const newFinca = await dbGet('SELECT * FROM fincas WHERE id = ?', [id]);
        res.status(201).json({ ...newFinca, coordenadas: JSON.parse(newFinca.coordenadas) });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateFinca = async (req, res) => {
    const { id } = req.params;
    const { propietario, dni_ruc, nombre_finca, superficie, coordenadas } = req.body;
    const sql = 'UPDATE fincas SET propietario = ?, dni_ruc = ?, nombre_finca = ?, superficie = ?, coordenadas = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    try {
        await dbRun(sql, [propietario, dni_ruc, nombre_finca, superficie, JSON.stringify(coordenadas), id]);
        const updatedFinca = await dbGet('SELECT * FROM fincas WHERE id = ?', [id]);
        res.status(200).json({ ...updatedFinca, coordenadas: JSON.parse(updatedFinca.coordenadas) });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteFinca = async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM fincas WHERE id = ?', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// --- Lotes ---
const getBatchesTree = async (req, res) => {
    try {
        const rows = await dbAll(`
            WITH RECURSIVE lotes_arbol AS (
                SELECT id, tipo, parent_id, data, 1 as nivel, created_at FROM lotes WHERE parent_id IS NULL
                UNION ALL
                SELECT l.id, l.tipo, l.parent_id, l.data, la.nivel + 1, l.created_at FROM lotes l
                JOIN lotes_arbol la ON l.parent_id = la.id
            )
            SELECT * FROM lotes_arbol ORDER BY nivel, created_at DESC;
        `);
        
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
                const parentData = parent.data;
                if (parent.tipo === 'cosecha') parentData.fermentaciones.push(lote.data);
                else if (parent.tipo === 'fermentacion') parentData.secados.push(lote.data);
                else if (parent.tipo === 'secado') parentData.tostados.push(lote.data);
                else if (parent.tipo === 'tostado') parentData.moliendas.push(lote.data);
            } else if (!lote.parent_id) {
                roots.push(lote.data);
            }
        });
        
        roots.sort((a, b) => new Date(b.fechaCosecha) - new Date(a.fechaCosecha));
        res.status(200).json(roots);
    } catch (error) { res.status(500).json({ error: error.message }); }
};

const createBatch = async (req, res) => {
    const { tipo, parent_id, data } = req.body;
    const sql = 'INSERT INTO lotes (id, tipo, parent_id, data) VALUES (?, ?, ?, ?)';
    try {
        await dbRun(sql, [data.id, tipo, parent_id, JSON.stringify(data)]);
        const newBatch = await dbGet('SELECT * FROM lotes WHERE id = ?', [data.id]);
        res.status(201).json({ ...newBatch, data: JSON.parse(newBatch.data) });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateBatch = async (req, res) => {
    const { id } = req.params;
    const { data } = req.body;
    const sql = 'UPDATE lotes SET data = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    try {
        await dbRun(sql, [JSON.stringify(data), id]);
        const updatedBatch = await dbGet('SELECT * FROM lotes WHERE id = ?', [id]);
        res.status(200).json({ ...updatedBatch, data: JSON.parse(updatedBatch.data) });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteBatch = async (req, res) => {
    const { id } = req.params;
    try {
        await dbRun('DELETE FROM lotes WHERE id = ?', [id]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getTrazabilidad = async (req, res) => {
    const { id } = req.params;
    try {
        const rows = await dbAll(`
            WITH RECURSIVE trazabilidad_completa AS (
                SELECT id, tipo, parent_id, data FROM lotes WHERE id = ?
                UNION
                SELECT l.id, l.tipo, l.parent_id, l.data FROM lotes l
                INNER JOIN trazabilidad_completa tc ON l.id = tc.parent_id
            )
            SELECT * FROM trazabilidad_completa;
        `, [id]);
        
        if (rows.length === 0) {
            return res.status(404).json({ error: 'Lote no encontrado' });
        }

        const history = {};
        rows.forEach(row => {
            history[row.tipo] = JSON.parse(row.data);
        });

        if (history.cosecha && history.cosecha.finca) {
            const finca = await dbGet('SELECT * FROM fincas WHERE nombre_finca = ?', [history.cosecha.finca]);
            if (finca) {
                history.fincaData = { ...finca, coordenadas: JSON.parse(finca.coordenadas) };
            }
        }

        res.status(200).json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    registerUser, loginUser, logoutUser,
    getFincas, createFinca, updateFinca, deleteFinca,
    getBatchesTree, createBatch, updateBatch, deleteBatch,
    getTrazabilidad
};

