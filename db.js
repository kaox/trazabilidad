const environment = process.env.NODE_ENV || 'development';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const defaultProfilesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'default-profiles.json'), 'utf8'));
const maridajesVinoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'maridajes_vino.json'), 'utf8'));
const maridajesQuesoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'maridajes_quesos.json'), 'utf8'));


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

// --- Helper para parsear JSON de forma segura ---
const safeJSONParse = (data) => typeof data === 'string' ? JSON.parse(data) : data;

// --- Lógica de la API (usa las funciones adaptadoras) ---
const registerUser = async (req, res) => {
    const { usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        // Establecer la fecha de fin de la prueba para 30 días en el futuro
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);
        
        await run(
            'INSERT INTO users (usuario, password, nombre, apellido, dni, ruc, empresa, celular, correo, subscription_tier, trial_ends_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)', 
            [usuario, hashedPassword, nombre, apellido, dni, ruc, empresa, celular, correo, 'artesano', trialEndDate.toISOString()]
        );
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
        const user = await get('SELECT * FROM users WHERE LOWER(usuario) = LOWER(?)', [usuario]);
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
        let user = await get('SELECT id, usuario, nombre, apellido, dni, ruc, empresa, celular, correo, subscription_tier, trial_ends_at FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

        // Si el usuario no tiene fecha de prueba (cuenta antigua), se le asigna una.
        if (!user.trial_ends_at) {
            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);
            user.trial_ends_at = trialEndDate.toISOString();
            
            await run('UPDATE users SET trial_ends_at = ? WHERE id = ?', [user.trial_ends_at, userId]);
        }

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
// --- Fincas (Actualizado) ---
const getFincas = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all('SELECT * FROM fincas WHERE user_id = ? ORDER BY nombre_finca', [userId]);
        const fincas = rows.map(f => ({ 
            ...f, 
            coordenadas: safeJSONParse(f.coordenadas || 'null'),
            imagenes_json: safeJSONParse(f.imagenes_json || '[]'),
            certificaciones_json: safeJSONParse(f.certificaciones_json || '[]'),
            premios_json: safeJSONParse(f.premios_json || '[]')
        }));
        res.status(200).json(fincas);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createFinca = async (req, res) => {
    const userId = req.user.id;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, certificaciones_json, premios_json, foto_productor } = req.body;
    const id = require('crypto').randomUUID();
    try {
        await run('INSERT INTO fincas (id, user_id, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, certificaciones_json, premios_json, foto_productor) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [id, userId, propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas), telefono, historia, JSON.stringify(imagenes_json || []), JSON.stringify(certificaciones_json || []), JSON.stringify(premios_json || []), foto_productor]);
        res.status(201).json({ message: "Finca creada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, certificaciones_json, premios_json, foto_productor } = req.body;
    const sql = 'UPDATE fincas SET propietario = ?, dni_ruc = ?, nombre_finca = ?, pais = ?, ciudad = ?, altura = ?, superficie = ?, coordenadas = ?, telefono = ?, historia = ?, imagenes_json = ?, certificaciones_json = ?, premios_json = ?, foto_productor = ? WHERE id = ? AND user_id = ?';
    try {
        const result = await run(sql, [propietario, dni_ruc, nombre_finca, pais, ciudad, altura, superficie, JSON.stringify(coordenadas), telefono, historia, JSON.stringify(imagenes_json || []), JSON.stringify(certificaciones_json || []), JSON.stringify(premios_json || []), foto_productor, id, userId]);
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
        const procesadoras = rows.map(p => ({ 
            ...p, 
            premios_json: safeJSONParse(p.premios_json || '[]'),
            certificaciones_json: safeJSONParse(p.certificaciones_json || '[]'),
            coordenadas: safeJSONParse(p.coordenadas || 'null')
        }));
        res.status(200).json(procesadoras);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono, premios_json, certificaciones_json, coordenadas } = req.body;
    const id = require('crypto').randomUUID();
    const sql = 'INSERT INTO procesadoras (id, user_id, ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono, premios_json, certificaciones_json, coordenadas) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    try {
        await run(sql, [id, userId, ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono, JSON.stringify(premios_json || []), JSON.stringify(certificaciones_json || []), coordenadas]);
        res.status(201).json({ message: "Procesadora creada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono, premios_json, certificaciones_json, coordenadas } = req.body;
    const sql = 'UPDATE procesadoras SET ruc = ?, razon_social = ?, nombre_comercial = ?, tipo_empresa = ?, pais = ?, ciudad = ?, direccion = ?, telefono = ?, premios_json = ?, certificaciones_json = ?, coordenadas = ? WHERE id = ? AND user_id = ?';
    try {
        const result = await run(sql, [ruc, razon_social, nombre_comercial, tipo_empresa, pais, ciudad, direccion, telefono, JSON.stringify(premios_json || []), JSON.stringify(certificaciones_json || []), coordenadas, id, userId]);
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
            const defaultProfiles = require('./default-profiles.json');
            const defaultPerfiles = defaultProfiles.defaultPerfilesCacao;
            const insertSql = 'INSERT INTO perfiles_cacao (user_id, nombre, perfil_data) VALUES (?, ?, ?)';
            for (const perfil of defaultPerfiles) {
                await run(insertSql, [userId, perfil.nombre, JSON.stringify(perfil.perfil_data)]);
            }
            perfiles = await all('SELECT * FROM perfiles_cacao WHERE user_id = ? ORDER BY nombre', [userId]);
        }
        const parsedPerfiles = perfiles.map(p => ({ ...p, perfil_data: safeJSONParse(p.perfil_data) }));
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
const updatePerfil = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre, perfil_data } = req.body;
    try {
        const result = await run('UPDATE perfiles_cacao SET nombre = ?, perfil_data = ? WHERE id = ? AND user_id = ?', [nombre, JSON.stringify(perfil_data), id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Perfil no encontrado o sin permiso.' });
        res.status(200).json({ message: 'Perfil de cacao actualizado.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un perfil de cacao con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const deletePerfil = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM perfiles_cacao WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Perfil no encontrado o sin permiso.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        const parsedStages = stages.map(s => ({...s, campos_json: safeJSONParse(s.campos_json)}));
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
        const allLotes = await all(`
            SELECT l.id, l.parent_id, l.data, l.plantilla_id, l.etapa_id
            FROM lotes l
            WHERE l.user_id = ? OR l.id IN (
                WITH RECURSIVE descendents AS (
                    SELECT id FROM lotes WHERE user_id = ?
                    UNION ALL
                    SELECT l.id FROM lotes l JOIN descendents d ON l.parent_id = d.id
                )
                SELECT id FROM descendents WHERE user_id IS NULL
            )
        `, [userId, userId]);

        const lotes = allLotes.map(lote => ({...lote, data: safeJSONParse(lote.data), children: []}));
        const lotesById = lotes.reduce((acc, lote) => { acc[lote.id] = lote; return acc; }, {});

        const roots = [];
        lotes.forEach(lote => {
            if (lote.parent_id && lotesById[lote.parent_id]) {
                lotesById[lote.parent_id].children.push(lote);
            } else {
                roots.push(lote);
            }
        });
        
        const buildClientTree = (loteNode, allStages, allTemplates) => {
            const template = allTemplates.find(t => t.id === loteNode.plantilla_id);
            const stage = allStages.find(s => s.id === loteNode.etapa_id);
            const loteData = { ...loteNode.data, plantilla_id: loteNode.plantilla_id, etapa_id: loteNode.etapa_id };

            if (loteNode.children.length > 0 && template) {
                const nextStageOrder = stage.orden + 1;
                const nextStage = allStages.find(s => s.plantilla_id === template.id && s.orden === nextStageOrder);
                if (nextStage) {
                    const childKey = nextStage.nombre_etapa.toLowerCase().replace(/ & /g, '_and_');
                    loteData[childKey] = loteNode.children.map(childNode => buildClientTree(childNode, allStages, allTemplates));
                }
            }
            return loteData;
        };

        const [templates, allStages] = await Promise.all([
            all('SELECT * FROM plantillas_proceso WHERE user_id = ?', [userId]),
            all('SELECT * FROM etapas_plantilla WHERE plantilla_id IN (SELECT id FROM plantillas_proceso WHERE user_id = ?)', [userId]),
        ]);

        const finalTree = roots.map(rootNode => buildClientTree(rootNode, allStages, templates));

        res.status(200).json(finalTree);
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

// --- Lotes (con Generación de ID en Backend) ---
const generateUniqueLoteId = async (prefix) => {
    let id;
    let isUnique = false;
    while (!isUnique) {
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        id = `${prefix}-${randomPart}`;
        const existing = await get('SELECT id FROM lotes WHERE id = ?', [id]);
        if (!existing) {
            isUnique = true;
        }
    }
    return id;
};

const createBatch = async (req, res) => {
    const userId = req.user.id;
    const { plantilla_id, etapa_id, parent_id, data } = req.body;
    
    try {
        const stage = await get('SELECT nombre_etapa FROM etapas_plantilla WHERE id = ?', [etapa_id]);
        if (!stage) return res.status(404).json({ error: "Etapa no encontrada." });
        
        const prefix = stage.nombre_etapa.substring(0, 3).toUpperCase();
        const newId = await generateUniqueLoteId(prefix);
        data.id = newId;

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
        await run(sql, params);
        res.status(201).json({ message: "Lote creado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
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
                SELECT * FROM lotes WHERE UPPER(id) = UPPER(?)
                UNION ALL
                SELECT l.* FROM lotes l
                INNER JOIN trazabilidad_completa tc ON l.id = tc.parent_id
            )
            SELECT * FROM trazabilidad_completa;
        `, [id]);
        
        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });
        
        const loteRaiz = rows.find(r => !r.parent_id);
        if (!loteRaiz || !loteRaiz.user_id) return res.status(404).json({ error: 'Trazabilidad incompleta.' });
        
        const ownerId = loteRaiz.user_id;
        const plantillaId = loteRaiz.plantilla_id;

        const allStages = await all('SELECT id, nombre_etapa, orden FROM etapas_plantilla WHERE plantilla_id = ? ORDER BY orden', [plantillaId]);
        
        const history = {
            stages: [],
            fincaData: null,
            procesadorasData: [],
            perfilSensorialData: null,
            maridajesRecomendados: {}
        };
        
        const sortedRows = rows.sort((a, b) => {
            const stageA = allStages.find(s => s.id === a.etapa_id)?.orden || 0;
            const stageB = allStages.find(s => s.id === b.etapa_id)?.orden || 0;
            return stageA - stageB;
        });

        sortedRows.forEach(row => {
            const stageInfo = allStages.find(s => s.id === row.etapa_id);
            if(stageInfo) {
                history.stages.push({
                    nombre_etapa: stageInfo.nombre_etapa,
                    data: safeJSONParse(row.data)
                });
            }
        });

        const cosechaData = history.stages[0]?.data;
        if (cosechaData && cosechaData.finca) {
            const finca = await get('SELECT * FROM fincas WHERE nombre_finca = ? AND user_id = ?', [cosechaData.finca.value, ownerId]);
            if (finca) {
                history.fincaData = { 
                    ...finca, 
                    coordenadas: safeJSONParse(finca.coordenadas || 'null'),
                    imagenes_json: safeJSONParse(finca.imagenes_json || '[]'),
                    certificaciones_json: safeJSONParse(finca.certificaciones_json || '[]'),
                    premios_json: safeJSONParse(finca.premios_json || '[]')
                };
            }
        }
        const procesadoras = await all('SELECT * FROM procesadoras WHERE user_id = ?', [ownerId]);
        history.procesadorasData = procesadoras.map(p => ({
            ...p,
            premios_json: safeJSONParse(p.premios_json || '[]'),
            certificaciones_json: safeJSONParse(p.certificaciones_json || '[]')
        }));
        
        const tostadoData = history.stages.find(s => s.nombre_etapa.toLowerCase().includes('tostado'))?.data;
        if (tostadoData && tostadoData.tipoPerfil) {
            const perfilCacao = await get('SELECT * FROM perfiles_cacao WHERE nombre = ? AND user_id = ?', [tostadoData.tipoPerfil, ownerId]);
            if (perfilCacao) {
                perfilCacao.perfil_data = safeJSONParse(perfilCacao.perfil_data);
                history.perfilSensorialData = perfilCacao.perfil_data;

                const allCafes = await all('SELECT * FROM perfiles_cafe WHERE user_id = ?', [ownerId]);
                const allVinos = maridajesVinoData.defaultPerfilesVino;
                const allQuesos = maridajesQuesoData;

                const recCafe = allCafes.map(cafe => ({
                    producto: { ...cafe, perfil_data: safeJSONParse(cafe.perfil_data) },
                    puntuacion: calcularMaridajeCacaoCafe(perfilCacao, { ...cafe, perfil_data: safeJSONParse(cafe.perfil_data) })
                })).sort((a, b) => b.puntuacion - a.puntuacion);

                const recVino = allVinos.map(vino => ({
                    producto: vino,
                    puntuacion: calcularMaridajeCacaoVino(perfilCacao, vino)
                })).sort((a, b) => b.puntuacion - a.puntuacion);
                
                const recQueso = allQuesos.map(queso => ({
                    producto: queso,
                    puntuacion: calcularMaridajeCacaoQueso(perfilCacao, queso)
                })).sort((a, b) => b.puntuacion - a.puntuacion);
                
                history.maridajesRecomendados = { cafe: recCafe, vino: recVino, queso: recQueso };
            }
        }
        
        res.status(200).json(history);
    } catch (error) { 
        console.error(`Error en getTrazabilidad para el lote ${id}:`, error.message);
        res.status(500).json({ error: "Error interno del servidor." }); 
    }
};

// --- Lógica de Maridaje (Backend) ---
function calcularMaridajeCacaoCafe(cacao, cafe) {
    const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (cafe.perfil_data.sabor || 0)) / 10);
    const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (cafe.perfil_data.acidez || 0)) / 10);
    const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (cafe.perfil_data.dulzura || 0)) / 10);
    const pComp = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0))/2 - ((cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0))/2) / 10);
    return ((pInt * 0.4) + (((pAcid + pDulz + pComp) / 3) * 0.6)) * 100;
}

function calcularMaridajeCacaoVino(cacao, vino) {
    const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (vino.perfil_data.intensidad || 0)) / 10);
    const pEst = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.astringencia || 0))/2 - (vino.perfil_data.taninos || 0)) / 10);
    const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (vino.perfil_data.acidez || 0)) / 10);
    const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (vino.perfil_data.dulzura || 0)) / 10);
    const bonusDulzura = (vino.perfil_data.dulzura || 0) >= (cacao.perfil_data.caramelo || 0) ? 1.1 : 1;
    const pArmonia = ((pAcid + pDulz) / 2) * bonusDulzura;
    return ((pInt * 0.3) + (pEst * 0.3) + (pArmonia * 0.4)) * 100;
}

function calcularMaridajeCacaoQueso(cacao, queso) {
    const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (queso.perfil_data.intensidad || 0)) / 10);
    const contraste = ((queso.perfil_data.cremosidad || 0) + (queso.perfil_data.salinidad || 0)) * ((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.astringencia || 0));
    const pContraste = Math.min(1, contraste / 200);
    let pArmonia = 0;
    if(queso.perfil_data.notas_sabor.includes('nuez') && (cacao.perfil_data.nuez || 0) > 5) pArmonia += 0.5;
    if(queso.perfil_data.notas_sabor.includes('caramelo') && (cacao.perfil_data.caramelo || 0) > 5) pArmonia += 0.5;
    return ((pInt * 0.4) + (pContraste * 0.4) + (pArmonia * 0.2)) * 100;
}

const getPerfilesCafe = async (req, res) => {
    const userId = req.user.id;
    try {
        let perfiles = await all('SELECT * FROM perfiles_cafe WHERE user_id = ? ORDER BY nombre_perfil', [userId]);
        if (perfiles.length === 0) {
            const defaultProfiles = require('./default-profiles.json');
            const defaultPerfilesCafe = defaultProfiles.defaultPerfilesCafe;
            const insertSql = 'INSERT INTO perfiles_cafe (user_id, nombre_perfil, perfil_data) VALUES (?, ?, ?)';
            for (const perfil of defaultPerfilesCafe) {
                await run(insertSql, [userId, perfil.nombre_perfil, JSON.stringify(perfil.perfil_data)]);
            }
            perfiles = await all('SELECT * FROM perfiles_cafe WHERE user_id = ? ORDER BY nombre_perfil', [userId]);
        }
        const parsedPerfiles = perfiles.map(p => ({ ...p, perfil_data: safeJSONParse(p.perfil_data) }));
        res.status(200).json(parsedPerfiles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const createPerfilCafe = async (req, res) => {
    const userId = req.user.id;
    const { nombre_perfil, perfil_data } = req.body;
    try {
        const result = await run('INSERT INTO perfiles_cafe (user_id, nombre_perfil, perfil_data) VALUES (?, ?, ?)', [userId, nombre_perfil, JSON.stringify(perfil_data)]);
        res.status(201).json({ id: result.lastID, user_id: userId, nombre_perfil, perfil_data });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un perfil de café con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const updatePerfilCafe = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre_perfil, perfil_data } = req.body;
    try {
        const result = await run('UPDATE perfiles_cafe SET nombre_perfil = ?, perfil_data = ? WHERE id = ? AND user_id = ?', [nombre_perfil, JSON.stringify(perfil_data), id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Perfil no encontrado o sin permiso.' });
        res.status(200).json({ message: 'Perfil de café actualizado.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un perfil de café con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const deletePerfilCafe = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM perfiles_cafe WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Perfil no encontrado o sin permiso.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const getRuedasSabores = async (req, res) => {
    const userId = req.user.id;
    try {
        const ruedas = await all('SELECT * FROM ruedas_sabores WHERE user_id = ? ORDER BY nombre_rueda', [userId]);
        const parsedRuedas = ruedas.map(r => ({ ...r, notas_json: safeJSONParse(r.notas_json) }));
        res.status(200).json(parsedRuedas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
const createRuedaSabores = async (req, res) => {
    const userId = req.user.id;
    const { nombre_rueda, notas_json } = req.body;
    try {
        const result = await run('INSERT INTO ruedas_sabores (user_id, nombre_rueda, notas_json) VALUES (?, ?, ?)', [userId, nombre_rueda, JSON.stringify(notas_json)]);
        res.status(201).json({ id: result.lastID, user_id: userId, nombre_rueda, notas_json });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una rueda con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const updateRuedaSabores = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre_rueda, notas_json } = req.body;
    try {
        const result = await run('UPDATE ruedas_sabores SET nombre_rueda = ?, notas_json = ? WHERE id = ? AND user_id = ?', [nombre_rueda, JSON.stringify(notas_json), id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Rueda no encontrada o sin permiso.' });
        res.status(200).json({ message: 'Rueda actualizada.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una rueda con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const deleteRuedaSabores = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM ruedas_sabores WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Rueda no encontrada o sin permiso.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Blends ---
const getBlends = async (req, res) => {
    const userId = req.user.id;
    try {
        const blends = await all('SELECT * FROM blends WHERE user_id = ? ORDER BY nombre_blend', [userId]);
        const parsedBlends = blends.map(b => ({
            ...b,
            componentes_json: safeJSONParse(b.componentes_json),
            perfil_final_json: safeJSONParse(b.perfil_final_json)
        }));
        res.status(200).json(parsedBlends);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createBlend = async (req, res) => {
    const userId = req.user.id;
    const { nombre_blend, tipo_producto, componentes_json, perfil_final_json } = req.body;
    const id = require('crypto').randomUUID(); // Generar ID aquí
    try {
        await run(
            'INSERT INTO blends (id, user_id, nombre_blend, tipo_producto, componentes_json, perfil_final_json) VALUES (?, ?, ?, ?, ?, ?)',
            [id, userId, nombre_blend, tipo_producto, JSON.stringify(componentes_json), JSON.stringify(perfil_final_json)]
        );
        res.status(201).json({ id: id, message: 'Blend guardado' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe un blend con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};

const deleteBlend = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM blends WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Blend no encontrado.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Recetas de Chocolate ---
const getRecetas = async (req, res) => {
    const userId = req.user.id;
    try {
        const recetas = await all('SELECT * FROM recetas_chocolate WHERE user_id = ? ORDER BY nombre_receta', [userId]);
        const parsedRecetas = recetas.map(r => ({
            ...r,
            componentes_json: safeJSONParse(r.componentes_json),
            perfil_final_json: safeJSONParse(r.perfil_final_json)
        }));
        res.status(200).json(parsedRecetas);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createReceta = async (req, res) => {
    const userId = req.user.id;
    const { nombre_receta, componentes_json, perfil_final_json, tiempo_conchado } = req.body;
    const id = require('crypto').randomUUID();
    try {
        await run(
            'INSERT INTO recetas_chocolate (id, user_id, nombre_receta, componentes_json, perfil_final_json, tiempo_conchado) VALUES (?, ?, ?, ?, ?, ?)',
            [id, userId, nombre_receta, JSON.stringify(componentes_json), JSON.stringify(perfil_final_json), tiempo_conchado]
        );
        res.status(201).json({ id, message: 'Receta guardada' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una receta con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const updateReceta = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre_receta, componentes_json, perfil_final_json, tiempo_conchado } = req.body;
    try {
        const result = await run(
            'UPDATE recetas_chocolate SET nombre_receta = ?, componentes_json = ?, perfil_final_json = ?, tiempo_conchado = ? WHERE id = ? AND user_id = ?',
            [nombre_receta, JSON.stringify(componentes_json), JSON.stringify(perfil_final_json), tiempo_conchado, id, userId]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Receta no encontrada.' });
        res.status(200).json({ message: 'Receta actualizada.' });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una receta con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};

const deleteReceta = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM recetas_chocolate WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Receta no encontrada.' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Nueva función para obtener el estado de la suscripción
const getUserSubscriptionStatus = async (userId) => {
    return await get('SELECT subscription_tier, trial_ends_at FROM users WHERE id = ?', [userId]);
};

module.exports = {
    registerUser, loginUser, logoutUser,
    getFincas, createFinca, updateFinca, deleteFinca,
    getProcesadoras, createProcesadora, updateProcesadora, deleteProcesadora,
    getPerfiles, createPerfil, updatePerfil, deletePerfil,
    getTemplates, createTemplate, updateTemplate, deleteTemplate, 
    getStagesForTemplate, createStage, updateStage, deleteStage,
    getBatchesTree, createBatch, updateBatch, deleteBatch,
    getTrazabilidad,
    getUserProfile, updateUserProfile, updateUserPassword,
    getPerfilesCafe, createPerfilCafe, updatePerfilCafe, deletePerfilCafe,
    getRuedasSabores, createRuedaSabores, updateRuedaSabores, deleteRuedaSabores,
    getBlends, createBlend, deleteBlend,
    getRecetas, createReceta, deleteReceta, updateReceta,
    getUserSubscriptionStatus, // Exportar la nueva función
};

