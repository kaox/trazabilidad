const environment = process.env.NODE_ENV || 'development';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

let get, all, run;

if (environment === 'production') {
    // --- Configuración para Producción (PostgreSQL con Neon) ---
    const { Pool } = require('@neondatabase/serverless');
    const pool = new Pool({ connectionString: process.env.POSTGRES_URL });

    const queryAdapter = (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        return pool.query(pgSql, params);
    };
    
    get = async (sql, params = []) => (await queryAdapter(sql, params)).rows[0];
    all = async (sql, params = []) => (await queryAdapter(sql, params)).rows;
    run = async (sql, params = []) => {
        const isInsert = sql.trim().toUpperCase().startsWith('INSERT');
        const sqlToRun = isInsert ? `${sql} RETURNING id` : sql;
        try {
            const result = await queryAdapter(sqlToRun, params);
            return { 
                changes: result.rowCount, 
                lastID: result.rows[0] ? result.rows[0].id : null 
            };
        } catch(e) {
            if (isInsert) {
                 const result = await queryAdapter(sql, params);
                 return { changes: result.rowCount, lastID: null };
            }
            throw e;
        }
    };
    console.log("Conectado a PostgreSQL para producción.");

} else {
    // --- Configuración para Desarrollo (SQLite) ---
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database("./database.db", err => {
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
        if (err.message.includes('UNIQUE') || (err.code && err.code === '23505')) {
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
    try {
        await run('UPDATE users SET nombre = ?, apellido = ?, dni = ?, ruc = ?, empresa = ?, celular = ?, correo = ? WHERE id = ?', [nombre, apellido, dni, ruc, empresa, celular, correo, userId]);
        res.status(200).json({ message: "Perfil actualizado." });
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
        res.status(200).json({ message: "Contraseña actualizada." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getFincas = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all('SELECT * FROM fincas WHERE user_id = ? ORDER BY nombre_finca', [userId]);
        const fincas = rows.map(f => ({ ...f, coordenadas: typeof f.coordenadas === 'string' ? JSON.parse(f.coordenadas || 'null') : f.coordenadas }));
        res.status(200).json(fincas);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const createFinca = async (req, res) => {
    const userId = req.user.id;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas } = req.body;
    const id = require('crypto').randomUUID();
    try {
        await run('INSERT INTO fincas (id, user_id, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, userId, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas)]);
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
const getProcesadoras = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all('SELECT * FROM procesadoras WHERE user_id = ? ORDER BY nombre_comercial', [userId]);
        res.status(200).json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const createProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono } = req.body;
    const id = require('crypto').randomUUID();
    const sql = 'INSERT INTO procesadoras (id, user_id, ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    try {
        await run(sql, [id, userId, ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono]);
        res.status(201).json({ message: "Procesadora creada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
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
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const deleteProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM procesadoras WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: "Procesadora no encontrada o no tienes permiso." });
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getPerfiles = async (req, res) => {
    const userId = req.user.id;
    try {
        let perfiles = await all('SELECT * FROM perfiles_cacao WHERE user_id = ? ORDER BY nombre', [userId]);
        if (perfiles.length === 0) {
            const defaultPerfiles = require('./default-templates.json').defaultPerfiles;
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
    try {
        const result = await run('INSERT INTO perfiles_cacao (user_id, nombre, perfil_data) VALUES (?, ?, ?)', [userId, nombre, JSON.stringify(perfil_data)]);
        res.status(201).json({ id: result.lastID, user_id: userId, nombre, perfil_data });
    } catch (err) {
        if (err.message.includes('UNIQUE constraint failed')) res.status(409).json({ error: "Ya existe un perfil con ese nombre." });
        else res.status(500).json({ error: err.message });
    }
};
const getTemplates = async (req, res) => {
    const userId = req.user.id;
    try {
        let templates = await all('SELECT * FROM plantillas_proceso WHERE user_id = ? ORDER BY nombre_producto', [userId]);
        if (templates.length === 0) {
            const defaultTemplates = require('./default-templates.json').templates;
            for (const template of defaultTemplates) {
                const templateResult = await run('INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion) VALUES (?, ?, ?)', [userId, template.nombre_producto, template.descripcion]);
                const templateId = templateResult.lastID;
                for (const stage of template.etapas) {
                    await run('INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, orden, campos_json) VALUES (?, ?, ?, ?)', [templateId, stage.nombre_etapa, stage.orden, JSON.stringify(stage.campos_json)]);
                }
            }
            templates = await all('SELECT * FROM plantillas_proceso WHERE user_id = ? ORDER BY nombre_producto', [userId]);
        }
        res.status(200).json(templates);
    } catch (err) {
        console.error("Error en getTemplates:", err);
        res.status(500).json({ error: err.message });
    }
};
const createTemplate = async (req, res) => {
    const userId = req.user.id;
    const { nombre_producto, descripcion } = req.body;
    try {
        const result = await run('INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion) VALUES (?, ?, ?)', [userId, nombre_producto, descripcion || '']);
        res.status(201).json({ id: result.lastID, user_id: userId, nombre_producto, descripcion });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const updateTemplate = async (req, res) => {
    const userId = req.user.id;
    const { templateId } = req.params;
    const { nombre_producto, descripcion } = req.body;
    try {
        const result = await run('UPDATE plantillas_proceso SET nombre_producto = ?, descripcion = ? WHERE id = ? AND user_id = ?', [nombre_producto, descripcion, templateId, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Plantilla no encontrada.' });
        res.status(200).json({ message: 'Plantilla actualizada.' });
    } catch (err) {
         if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una plantilla con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const deleteTemplate = async (req, res) => {
    const userId = req.user.id;
    const { templateId } = req.params;
    try {
        await run('DELETE FROM plantillas_proceso WHERE id = ? AND user_id = ?', [templateId, userId]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getStagesForTemplate = async (req, res) => {
    const { templateId } = req.params;
    try {
        const template = await get('SELECT user_id FROM plantillas_proceso WHERE id = ?', [templateId]);
        if (!template || template.user_id !== req.user.id) {
            return res.status(403).json({ error: "No tienes permiso para ver estas etapas." });
        }
        const stages = await all('SELECT * FROM etapas_plantilla WHERE plantilla_id = ? ORDER BY orden', [templateId]);
        const parsedStages = stages.map(s => ({...s, campos_json: JSON.parse(s.campos_json)}));
        res.status(200).json(parsedStages);
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const createStage = async (req, res) => {
    const { templateId } = req.params;
    const { nombre_etapa, campos_json } = req.body;
    try {
        const lastOrderResult = await get('SELECT MAX(orden) as max_orden FROM etapas_plantilla WHERE plantilla_id = ?', [templateId]);
        const newOrder = (lastOrderResult.max_orden || 0) + 1;
        await run('INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, orden, campos_json) VALUES (?, ?, ?, ?)', [templateId, nombre_etapa, newOrder, JSON.stringify(campos_json)]);
        res.status(201).json({ message: "Etapa creada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const updateStage = async (req, res) => {
    const userId = req.user.id;
    const { stageId } = req.params;
    const { nombre_etapa, campos_json } = req.body;
    try {
        const stage = await get('SELECT plantilla_id FROM etapas_plantilla WHERE id = ?', [stageId]);
        if (!stage) return res.status(404).json({ error: 'Etapa no encontrada.' });
        const template = await get('SELECT id FROM plantillas_proceso WHERE id = ? AND user_id = ?', [stage.plantilla_id, userId]);
        if (!template) return res.status(403).json({ error: 'No tienes permiso para modificar esta etapa.' });
        await run('UPDATE etapas_plantilla SET nombre_etapa = ?, campos_json = ? WHERE id = ?', [nombre_etapa, JSON.stringify(campos_json), stageId]);
        res.status(200).json({ message: "Etapa actualizada." });
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const deleteStage = async (req, res) => {
    const userId = req.user.id;
    const { stageId } = req.params;
    try {
        const stage = await get('SELECT plantilla_id, orden FROM etapas_plantilla WHERE id = ?', [stageId]);
        if (!stage) return res.status(404).json({ error: 'Etapa no encontrada.' });
        const template = await get('SELECT id FROM plantillas_proceso WHERE id = ? AND user_id = ?', [stage.plantilla_id, userId]);
        if (!template) return res.status(403).json({ error: 'No tienes permiso para eliminar esta etapa.' });
        await run('DELETE FROM etapas_plantilla WHERE id = ?', [stageId]);
        await run('UPDATE etapas_plantilla SET orden = orden - 1 WHERE plantilla_id = ? AND orden > ?', [stage.plantilla_id, stage.orden]);
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};
const getBatchesTree = async (req, res) => {
    const userId = req.user.id;
    try {
        const [templates, allStages, allLotes] = await Promise.all([
            all('SELECT * FROM plantillas_proceso WHERE user_id = ?', [userId]),
            all('SELECT * FROM etapas_plantilla WHERE plantilla_id IN (SELECT id FROM plantillas_proceso WHERE user_id = ?)', [userId]),
            all('SELECT * FROM lotes WHERE user_id = ? OR id IN (SELECT id FROM lotes WHERE parent_id IN (SELECT id FROM lotes WHERE user_id = ?))', [userId, userId])
        ]);
        
        const stagesByTemplate = allStages.reduce((acc, stage) => {
            if (!acc[stage.plantilla_id]) acc[stage.plantilla_id] = [];
            acc[stage.plantilla_id].push(stage);
            return acc;
        }, {});
        
        const lotes = allLotes.map(lote => ({ ...lote, data: JSON.parse(lote.data) }));
        const lotesById = lotes.reduce((acc, lote) => {
            acc[lote.id] = lote;
            return acc;
        }, {});

        const roots = [];
        lotes.forEach(lote => {
            if (lote.parent_id) {
                const parent = lotesById[lote.parent_id];
                if (parent) {
                    const parentTemplateId = parent.plantilla_id;
                    const stagesForTemplate = stagesByTemplate[parentTemplateId];
                    if (stagesForTemplate) {
                        const parentStage = stagesForTemplate.find(s => s.id === parent.etapa_id);
                        if (parentStage) {
                            const nextStage = stagesForTemplate.find(s => s.orden === parentStage.orden + 1);
                            if (nextStage) {
                                const childKey = nextStage.nombre_etapa.toLowerCase().replace(/ & /g, '_and_');
                                if (!parent.data[childKey]) parent.data[childKey] = [];
                                parent.data[childKey].push(lote.data);
                            }
                        }
                    }
                }
            } else {
                const rootData = { ...lote.data, plantilla_id: lote.plantilla_id, etapa_id: lote.etapa_id };
                roots.push(rootData);
            }
        });
        
        res.status(200).json(roots);
    } catch (error) {
        console.error("Error en getBatchesTree:", error);
        res.status(500).json({ error: "Error interno del servidor al construir el árbol de lotes." });
    }
};
const checkBatchOwnership = async (batchId, userId) => {
    const owner = await get(`
        WITH RECURSIVE ancestry AS (
            SELECT id, parent_id, user_id FROM lotes WHERE id = ?
            UNION ALL
            SELECT l.id, l.parent_id, l.user_id FROM lotes l JOIN ancestry a ON l.id = a.parent_id
        )
        SELECT user_id FROM ancestry WHERE user_id IS NOT NULL`, [batchId]);
    return owner && owner.user_id == userId;
};
const createBatch = async (req, res) => {
    const userId = req.user.id;
    const { plantilla_id, etapa_id, parent_id, data } = req.body;
    let sql, params;
    if (!parent_id) {
        sql = 'INSERT INTO lotes (id, user_id, plantilla_id, etapa_id, parent_id, data) VALUES (?, ?, ?, ?, ?, ?)';
        params = [data.id, userId, plantilla_id, etapa_id, null, JSON.stringify(data)];
    } else {
        const isOwner = await checkBatchOwnership(parent_id, userId);
        if (!isOwner) return res.status(403).json({ error: "No tienes permiso para añadir a este lote." });
        
        const parentLote = await get('SELECT plantilla_id FROM lotes WHERE id = ?', [parent_id]);
        if (!parentLote) return res.status(404).json({ error: "Lote padre no encontrado." });

        sql = 'INSERT INTO lotes (id, plantilla_id, etapa_id, parent_id, data) VALUES (?, ?, ?, ?, ?)';
        params = [data.id, parentLote.plantilla_id, etapa_id, parent_id, JSON.stringify(data)];
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
                SELECT id, parent_id, data, user_id, etapa_id, plantilla_id FROM lotes WHERE id = ?
                UNION ALL
                SELECT l.id, l.parent_id, l.data, l.user_id, l.etapa_id, l.plantilla_id FROM lotes l
                INNER JOIN trazabilidad_completa tc ON l.id = tc.parent_id
            )
            SELECT * FROM trazabilidad_completa;
        `, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });
        
        const loteRaiz = rows.find(r => !r.parent_id);
        if (!loteRaiz || !loteRaiz.user_id) return res.status(404).json({ error: 'Trazabilidad incompleta.' });
        
        const ownerId = loteRaiz.user_id;
        const plantillaId = loteRaiz.plantilla_id;

        const allStages = await all('SELECT id, nombre_etapa FROM etapas_plantilla WHERE plantilla_id = ?', [plantillaId]);
        const stageMap = allStages.reduce((acc, stage) => {
            acc[stage.id] = stage.nombre_etapa.toLowerCase().replace(/ & /g, '_and_');
            return acc;
        }, {});

        const history = {};
        rows.forEach(row => {
            const key = stageMap[row.etapa_id];
            if (key) {
                history[key] = JSON.parse(row.data);
            }
        });
        
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

module.exports = {
    registerUser, loginUser, logoutUser,
    getFincas, createFinca, updateFinca, deleteFinca,
    getProcesadoras, createProcesadora, updateProcesadora, deleteProcesadora,
    getPerfiles, createPerfil,
    getTemplates, createTemplate, updateTemplate, deleteTemplate, 
    getStagesForTemplate, createStage, updateStage, deleteStage,
    getBatchesTree, createBatch, updateBatch, deleteBatch,
    getTrazabilidad,
    getUserProfile, updateUserProfile, updateUserPassword,
};

