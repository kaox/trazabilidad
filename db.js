const environment = process.env.NODE_ENV || 'development';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const ee = require('@google/earthengine');

// --- Importación de Helpers (Utilidades) ---
const {
    safeJSONParse,
    sanitizeNumber,
    createSlug,
    toCamelCase
} = require('./src/utils/helpers.js');


// Importar las clases necesarias del SDK v3 de Mercado Pago
const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

// Configurar el cliente de Mercado Pago
const mpClient = new MercadoPagoConfig({
    access_token: process.env.MP_ACCESS_TOKEN,
    options: { timeout: 5000 }
});

const { OAuth2Client } = require('google-auth-library');
const crypto = require('crypto');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const maridajesVinoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'maridajes_vino.json'), 'utf8'));
const maridajesQuesoData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'data', 'maridajes_quesos.json'), 'utf8'));

const { get, all, run } = require('./src/config/db.js');

// --- Helper para Generar ID de Lote/Batch Único ---
const generateUniqueBatchId = async (prefix) => {
    let id;
    let isUnique = false;
    while (!isUnique) {
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        id = `${prefix}-${randomPart}`;
        const existing = await get('SELECT id FROM batches WHERE id = ?', [id]);
        if (!existing) {
            isUnique = true;
        }
    }
    return id;
};

// --- Lógica de la API (usa las funciones adaptadoras) ---
const registerUser = async (req, res) => {
    const { usuario, password, nombre, apellido, dni, ruc, empresa, company_logo, celular, correo } = req.body;
    if (!usuario || !password) return res.status(400).json({ error: "Usuario y contraseña son requeridos." });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const trialEndDate = new Date();
        trialEndDate.setDate(trialEndDate.getDate() + 30);

        await run(
            'INSERT INTO users (usuario, password, nombre, apellido, dni, ruc, empresa, company_logo, celular, correo, subscription_tier, trial_ends_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
            [usuario, hashedPassword, nombre, apellido, dni, ruc, empresa, company_logo, celular, correo, 'artesano', trialEndDate.toISOString()]
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
            const tokenPayload = { id: user.id, username: user.usuario, role: user.role };
            const token = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1h' });
            res.cookie('token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });

            let nextStep = '/app/dashboard';

            if (!user.company_type && user.role !== 'admin') {
                nextStep = '/onboarding.html';
            }

            res.status(200).json({ message: "Inicio de sesión exitoso.", token, redirect: nextStep });
        } else {
            res.status(401).json({ error: "Credenciales inválidas." });
        }
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};

const handleGoogleLogin = async (req, res) => {
    const { token } = req.body;
    try {
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        const { email, given_name, family_name } = payload;

        let user = await get('SELECT * FROM users WHERE correo = ?', [email]);

        if (!user) {
            const randomPassword = crypto.randomBytes(16).toString('hex');
            const hashedPassword = await bcrypt.hash(randomPassword, 10);
            const username = email.split('@')[0];

            const trialEndDate = new Date();
            trialEndDate.setDate(trialEndDate.getDate() + 30);

            await run(
                'INSERT INTO users (usuario, password, nombre, apellido, correo, subscription_tier, trial_ends_at, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                [username, hashedPassword, given_name, family_name, email, 'artesano', trialEndDate.toISOString(), 'user']
            );
            user = await get('SELECT * FROM users WHERE correo = ?', [email]);
        }

        const appTokenPayload = { id: user.id, username: user.usuario, role: user.role };
        const appToken = jwt.sign(appTokenPayload, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '1h' });

        res.cookie('token', appToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' });
        res.status(200).json({ message: "Inicio de sesión con Google exitoso." });

    } catch (error) {
        console.error("Error en la autenticación con Google:", error);
        res.status(400).json({ error: "Token de Google inválido." });
    }
};

const logoutUser = (req, res) => {
    res.clearCookie('token', { path: '/' });
    res.status(200).json({ message: 'Cierre de sesión exitoso.' });
};

const getUserProfile = async (req, res) => {
    const userId = req.user.id;
    try {
        // AGREGADOS: social_instagram, social_facebook
        let user = await get('SELECT id, usuario, nombre, apellido, dni, ruc, empresa, company_logo, celular, correo, role, subscription_tier, trial_ends_at, default_currency, default_unit, company_type, company_id, social_instagram, social_facebook FROM users WHERE id = ?', [userId]);
        if (!user) return res.status(404).json({ error: "Usuario no encontrado." });

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
    // 1. Agregamos 'usuario' y 'password' a la extracción de datos
    const {
        nombre, apellido, dni, ruc, empresa, company_logo, celular, correo,
        default_currency, default_unit, company_type, company_id,
        social_instagram, social_facebook,
        usuario, password // <--- Campos nuevos del onboarding
    } = req.body;

    try {
        // 2. Preparamos la consulta base
        let sql = `UPDATE users SET 
            nombre = ?, apellido = ?, dni = ?, ruc = ?, empresa = ?, 
            company_logo = ?, celular = ?, correo = ?, default_currency = ?, 
            default_unit = ?, company_type = ?, company_id = ?, 
            social_instagram = ?, social_facebook = ?`;

        const params = [
            nombre, apellido, dni, ruc, empresa,
            company_logo, celular, correo, default_currency,
            default_unit, company_type, company_id,
            social_instagram, social_facebook
        ];

        // 3. Inyectamos usuario si existe
        if (usuario) {
            sql += `, usuario = ?`;
            params.push(usuario);
        }

        // 4. Inyectamos contraseña si existe (La hasheamos aquí mismo)
        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            sql += `, password = ?`;
            params.push(hashedPassword);
        }

        sql += ` WHERE id = ?`;
        params.push(userId);

        await run(sql, params);
        res.status(200).json({ message: "Perfil actualizado correctamente." });

    } catch (err) {
        // Manejo de error por usuario duplicado
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: "El nombre de usuario ya está en uso." });
        }
        res.status(500).json({ error: err.message });
    }
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

// --- Sucursales de Procesadora ---
const getSucursales = async (req, res) => {
    const userId = req.user.id;
    const { procesadoraId } = req.params;
    try {
        // Verificar propiedad de la procesadora
        const procesadora = await get('SELECT id FROM procesadoras WHERE id = ? AND user_id = ?', [procesadoraId, userId]);
        if (!procesadora) return res.status(403).json({ error: 'No tienes permiso para ver estas sucursales.' });
        const rows = await all('SELECT * FROM procesadora_sucursales WHERE procesadora_id = ? ORDER BY nombre_sucursal', [procesadoraId]);
        const sucursales = rows.map(s => ({
            ...s,
            coordenadas: safeJSONParse(s.coordenadas || 'null')
        }));
        res.status(200).json(sucursales);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createSucursal = async (req, res) => {
    const userId = req.user.id;
    const { procesadoraId } = req.params;
    const { nombre_sucursal, tipo_sucursal, direccion, ciudad, distrito, coordenadas, telefono } = req.body;
    const id = require('crypto').randomUUID();
    try {
        const procesadora = await get('SELECT id FROM procesadoras WHERE id = ? AND user_id = ?', [procesadoraId, userId]);
        if (!procesadora) return res.status(403).json({ error: 'No tienes permiso.' });
        await run(
            'INSERT INTO procesadora_sucursales (id, procesadora_id, nombre_sucursal, tipo_sucursal, direccion, ciudad, distrito, coordenadas, telefono) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, procesadoraId, nombre_sucursal, tipo_sucursal || null, direccion || null, ciudad || null, distrito || null, coordenadas ? JSON.stringify(coordenadas) : null, telefono || null]
        );
        res.status(201).json({ message: 'Sucursal creada', id });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateSucursal = async (req, res) => {
    const userId = req.user.id;
    const { procesadoraId, sucursalId } = req.params;
    const { nombre_sucursal, tipo_sucursal, direccion, ciudad, distrito, coordenadas, telefono } = req.body;
    try {
        const procesadora = await get('SELECT id FROM procesadoras WHERE id = ? AND user_id = ?', [procesadoraId, userId]);
        if (!procesadora) return res.status(403).json({ error: 'No tienes permiso.' });
        const result = await run(
            'UPDATE procesadora_sucursales SET nombre_sucursal = ?, tipo_sucursal = ?, direccion = ?, ciudad = ?, distrito = ?, coordenadas = ?, telefono = ? WHERE id = ? AND procesadora_id = ?',
            [nombre_sucursal, tipo_sucursal || null, direccion || null, ciudad || null, distrito || null, coordenadas ? JSON.stringify(coordenadas) : null, telefono || null, sucursalId, procesadoraId]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Sucursal no encontrada.' });
        res.status(200).json({ message: 'Sucursal actualizada' });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteSucursal = async (req, res) => {
    const userId = req.user.id;
    const { procesadoraId, sucursalId } = req.params;
    try {
        const procesadora = await get('SELECT id FROM procesadoras WHERE id = ? AND user_id = ?', [procesadoraId, userId]);
        if (!procesadora) return res.status(403).json({ error: 'No tienes permiso.' });
        const result = await run('DELETE FROM procesadora_sucursales WHERE id = ? AND procesadora_id = ?', [sucursalId, procesadoraId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Sucursal no encontrada.' });
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getPerfiles = async (req, res) => {
    const userId = req.user.id;
    const { tipo } = req.query;

    try {
        let sql = 'SELECT * FROM perfiles WHERE user_id = ?';
        const params = [userId];

        if (tipo) {
            sql += ' AND tipo = ?';
            params.push(tipo);
        }

        sql += ' ORDER BY created_at DESC';

        const rows = await all(sql, params);
        const perfiles = rows.map(p => ({
            ...p,
            perfil_data: safeJSONParse(p.perfil_data)
        }));
        res.status(200).json(perfiles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createPerfil = async (req, res) => {
    const userId = req.user.id;
    const { nombre, tipo, perfil_data } = req.body;

    if (!tipo) return res.status(400).json({ error: "El tipo de perfil es requerido." });

    try {
        const result = await run(
            'INSERT INTO perfiles (user_id, nombre, tipo, perfil_data) VALUES (?, ?, ?, ?)',
            [userId, nombre, tipo, JSON.stringify(perfil_data)]
        );
        res.status(201).json({ id: result.lastID, message: "Perfil creado exitosamente." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePerfil = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { nombre, perfil_data } = req.body;

    try {
        const result = await run(
            'UPDATE perfiles SET nombre = ?, perfil_data = ? WHERE id = ? AND user_id = ?',
            [nombre, JSON.stringify(perfil_data), id, userId]
        );
        if (result.changes === 0) return res.status(404).json({ error: 'Perfil no encontrado.' });
        res.status(200).json({ message: 'Perfil actualizado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deletePerfil = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    try {
        const result = await run('DELETE FROM perfiles WHERE id = ? AND user_id = ?', [id, userId]);
        if (result.changes === 0) return res.status(404).json({ error: 'Perfil no encontrado.' });
        res.status(200).json({ message: 'Perfil eliminado.' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- Plantillas (Modificado: Lazy Loading / Catálogo) ---

// 1. Obtener solo las plantillas guardadas por el usuario en DB
const getTemplates = async (req, res) => {
    const userId = req.user.id;
    try {
        // Se elimina la lógica de auto-sembrado. Solo devuelve lo que existe.
        const templates = await all('SELECT * FROM plantillas_proceso WHERE user_id = ? ORDER BY nombre_producto', [userId]);
        res.status(200).json(templates);
    } catch (err) {
        console.error("Error en getTemplates:", err);
        res.status(500).json({ error: err.message });
    }
};

// 2. Obtener el Catálogo del Sistema (JSON)
const getSystemTemplates = (req, res) => {
    try {
        // Lee el archivo JSON siempre fresco
        const catalog = require('./public/data/procesos_config.json').templates;
        res.status(200).json(catalog);
    } catch (err) {
        console.error("Error al leer el catálogo de plantillas:", err);
        res.status(500).json({ error: "Error interno al cargar el catálogo." });
    }
};

// 3. Clonar una plantilla del Catálogo a la DB del Usuario
const cloneTemplate = async (req, res) => {
    const userId = req.user.id;
    const { nombre_producto_sistema } = req.body;

    if (!nombre_producto_sistema) return res.status(400).json({ error: "Falta el nombre de la plantilla del sistema." });

    try {
        const catalog = require('./public/data/procesos_config.json').templates;
        const templateToClone = catalog.find(t => t.nombre_producto === nombre_producto_sistema);

        if (!templateToClone) return res.status(404).json({ error: "Plantilla no encontrada en el catálogo." });

        // VERIFICAR SI YA EXISTE (Lógica Upsert)
        let templateId;
        const existingTemplate = await get('SELECT id FROM plantillas_proceso WHERE user_id = ? AND nombre_producto = ?', [userId, templateToClone.nombre_producto]);

        if (existingTemplate) {
            templateId = existingTemplate.id;
            await run('UPDATE plantillas_proceso SET descripcion = ? WHERE id = ?', [templateToClone.descripcion, templateId]);
        } else {
            const templateResult = await run(
                'INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion) VALUES (?, ?, ?)',
                [userId, templateToClone.nombre_producto, templateToClone.descripcion]
            );
            templateId = templateResult.lastID;
        }

        // Helper para insertar/actualizar etapas
        const upsertStage = async (stage, fase) => {
            const existingStage = await get('SELECT id FROM etapas_plantilla WHERE plantilla_id = ? AND nombre_etapa = ?', [templateId, stage.nombre_etapa]);
            if (existingStage) {
                await run(
                    'UPDATE etapas_plantilla SET descripcion = ?, orden = ?, campos_json = ?, fase = ? WHERE id = ?',
                    [stage.descripcion, stage.orden, JSON.stringify(stage.campos_json), fase, existingStage.id]
                );
            } else {
                await run(
                    'INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, descripcion, orden, campos_json, fase) VALUES (?, ?, ?, ?, ?, ?)',
                    [templateId, stage.nombre_etapa, stage.descripcion, stage.orden, JSON.stringify(stage.campos_json), fase]
                );
            }
        };

        // 1. Procesar etapas de ACOPIO (si existen en el JSON)
        if (templateToClone.acopio) {
            for (const stage of templateToClone.acopio) {
                await upsertStage(stage, 'acopio');
            }
        }

        // 2. Procesar etapas de TRANSFORMACIÓN (si existen en el JSON)
        if (templateToClone.etapas) {
            for (const stage of templateToClone.etapas) {
                await upsertStage(stage, 'procesamiento');
            }
        }

        res.status(201).json({
            message: "Plantilla importada/actualizada correctamente.",
            id: templateId,
            nombre_producto: templateToClone.nombre_producto
        });

    } catch (err) {
        console.error("Error en cloneTemplate:", err);
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
        const parsedStages = stages.map(s => ({ ...s, campos_json: safeJSONParse(s.campos_json) }));
        res.status(200).json(parsedStages);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createStage = async (req, res) => {
    const { templateId } = req.params;
    const { nombre_etapa, descripcion, campos_json } = req.body;
    try {
        const lastOrderResult = await get('SELECT MAX(orden) as max_orden FROM etapas_plantilla WHERE plantilla_id = ?', [templateId]);
        const newOrder = (lastOrderResult.max_orden || 0) + 1;
        await run('INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, orden, descripcion, campos_json) VALUES (?, ?, ?, ?, ?)', [templateId, nombre_etapa, newOrder, descripcion, JSON.stringify(campos_json)]);
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

const getTrazabilidad = async (req, res) => {
    const { id } = req.params;
    try {
        const record = await get('SELECT snapshot_data, views FROM traceability_registry WHERE id = ?', [id]);
        if (record) {
            run('UPDATE traceability_registry SET views = views + 1 WHERE id = ?', [id]).catch(() => { });
            //return res.status(200).json(safeJSONParse(record.snapshot_data));
        }

        run('UPDATE batches SET views = COALESCE(views, 0) + 1 WHERE id = ?', [id]).catch(() => { });
        const rows = await all(`WITH RECURSIVE trace AS (SELECT * FROM batches WHERE id = ? UNION ALL SELECT b.* FROM batches b INNER JOIN trace t ON b.id = t.parent_id) SELECT * FROM trace;`, [id]);

        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });

        const rootBatch = rows.find(r => !r.parent_id);
        const ownerId = rootBatch.user_id;
        const plantillaId = rootBatch.plantilla_id;

        const [templateInfo, allStages, ownerInfo, acopioData, productoInfo] = await Promise.all([
            get('SELECT nombre_producto FROM plantillas_proceso WHERE id = ?', [plantillaId]),
            all('SELECT id, nombre_etapa, descripcion, orden, campos_json, fase FROM etapas_plantilla WHERE plantilla_id = ? ORDER BY orden', [plantillaId]),
            get('SELECT empresa, company_logo, subscription_tier, trial_ends_at FROM users WHERE id = ?', [ownerId]),
            rootBatch.acquisition_id ? get('SELECT * FROM acquisitions WHERE id = ?', [rootBatch.acquisition_id]) : null,
            // Buscar producto en lote final o raíz
            rows[0].producto_id ? get('SELECT * FROM productos WHERE id = ?', [rows[0].producto_id]) : (rootBatch.producto_id ? get('SELECT * FROM productos WHERE id = ?', [rootBatch.producto_id]) : null)
        ]);

        // CORRECCIÓN: Obtener procesadoras para renderizar ruta en tiempo real
        const procesadorasList = await all('SELECT * FROM procesadoras WHERE user_id = ?', [ownerId]);
        const procesadorasData = procesadorasList.map(p => ({ ...p, coordenadas: safeJSONParse(p.coordenadas || 'null'), imagenes_json: safeJSONParse(p.imagenes_json || '[]'), premios_json: safeJSONParse(p.premios_json || '[]'), certificaciones_json: safeJSONParse(p.certificaciones_json || '[]') }));

        const history = {
            productName: templateInfo.nombre_producto, ownerInfo, stages: [], fincaData: null, procesadorasData: procesadorasData,
            acopioData: acopioData ? { ...acopioData, data_adicional: safeJSONParse(acopioData.data_adicional) } : null,
            productoFinal: null, nutritionalData: null, perfilSensorialData: null, ruedaSaborData: null, maridajesRecomendados: {}
        };

        if (productoInfo) {
            history.productoFinal = { ...productoInfo, imagenes_json: safeJSONParse(productoInfo.imagenes_json), premios_json: safeJSONParse(productoInfo.premios_json) };
            if (productoInfo.receta_nutricional_id) {
                const receta = await get('SELECT * FROM recetas_nutricionales WHERE id = ?', [productoInfo.receta_nutricional_id]);
                if (receta) { const ing = await all('SELECT * FROM ingredientes_receta WHERE receta_id = ?', [receta.id]); history.nutritionalData = { ...receta, ingredientes: ing.map(i => ({ ...i, nutrientes_base_json: safeJSONParse(i.nutrientes_base_json) })) }; }
            }
        }

        // --- DESGLOSE ACOPIO ---
        if (history.acopioData) {
            const ad = history.acopioData.data_adicional || {};
            const imgs = safeJSONParse(acopioData.imagenes_json || '{}');

            if (acopioData.finca_origen) {
                const finca = await get('SELECT * FROM fincas WHERE nombre_finca = ? AND user_id = ?', [acopioData.finca_origen, ownerId]);
                if (finca) history.fincaData = { ...finca, coordenadas: safeJSONParse(finca.coordenadas), imagenes_json: safeJSONParse(finca.imagenes_json), certificaciones_json: safeJSONParse(finca.certificaciones_json), premios_json: safeJSONParse(finca.premios_json) };
            }
            const acopioStagesDef = allStages;
            acopioStagesDef.forEach(stageDef => {
                const suffix = `__${stageDef.orden}`;
                let stageData = {}; let dataFound = false;
                Object.keys(ad).forEach(key => { if (key.endsWith(suffix)) { stageData[key.split('__')[0]] = ad[key]; dataFound = true; } });
                const fields = safeJSONParse(stageDef.campos_json);
                [...(fields.entradas || []), ...(fields.variables || []), ...(fields.salidas || [])].map(f => f.name).forEach(fname => { if (!stageData[fname] && ad[fname]) { stageData[fname] = ad[fname]; dataFound = true; } });

                // INYECTAR IMAGEN
                Object.keys(imgs).forEach(key => {
                    if (key.endsWith(suffix)) {
                        stageData['imageUrl'] = { value: imgs[key], visible: true, nombre: 'Foto' };
                        dataFound = true;
                    }
                });

                if (dataFound) {
                    history.stages.push({
                        id: `${acopioData.id}_S${stageDef.orden}`,
                        nombre_etapa: stageDef.nombre_etapa,
                        descripcion: stageDef.descripcion,
                        campos_json: fields,
                        data: stageData,
                        blockchain_hash: null,
                        is_locked: true,
                        timestamp: acopioData.fecha_acopio
                    });
                }
            });
        }

        // --- RECUPERAR PERFIL SENSORIAL Y RUEDA (COPIADO A GETTRAZABILIDAD) ---
        let perfilId = null, ruedaId = null;
        const rootData = safeJSONParse(rootBatch.data);
        if (rootData.target_profile_id?.value) perfilId = rootData.target_profile_id.value;
        if (rootData.target_wheel_id?.value) ruedaId = rootData.target_wheel_id.value;

        if (!perfilId || !ruedaId) {
            for (const row of rows) {
                const rd = safeJSONParse(row.data);
                if (!perfilId && rd.tipoPerfil?.value) perfilId = rd.tipoPerfil.value;
                if (!ruedaId && rd.tipoRuedaSabor?.value) ruedaId = rd.tipoRuedaSabor.value;
            }
        }

        if (perfilId) {
            let perfil = await get('SELECT * FROM perfiles WHERE id = ?', [perfilId]);
            if (!perfil && isNaN(perfilId)) perfil = await get('SELECT * FROM perfiles WHERE nombre = ? AND user_id = ?', [perfilId, ownerId]);
            if (perfil) {
                history.perfilSensorialData = safeJSONParse(perfil.perfil_data);
                // CALCULAR MARIDAJES
                if (perfil.tipo === 'cacao') {
                    //const allCafes = await all("SELECT * FROM perfiles WHERE tipo = 'cafe' AND user_id = ?", [ownerId]);
                    const allVinos = maridajesVinoData.defaultPerfilesVino;
                    const allQuesos = maridajesQuesoData;

                    const recCafe = [];
                    //const recCafe = allCafes.map(cafe => ({ producto: { ...cafe, perfil_data: safeJSONParse(cafe.perfil_data) }, puntuacion: calcularMaridajeCacaoCafe(history.perfilSensorialData, safeJSONParse(cafe.perfil_data)) })).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 3);
                    const recVino = allVinos.map(vino => ({
                        producto: vino,
                        puntuacion: calcularMaridajeCacaoVino(perfil, vino)
                    })).sort((a, b) => b.puntuacion - a.puntuacion);

                    const recQueso = allQuesos.map(queso => ({
                        producto: queso,
                        puntuacion: calcularMaridajeCacaoQueso(perfil, queso)
                    })).sort((a, b) => b.puntuacion - a.puntuacion);

                    history.maridajesRecomendados = { cafe: recCafe, vino: recVino, queso: recQueso };
                }
            }
        }
        if (ruedaId) {
            const rueda = await get('SELECT * FROM ruedas_sabores WHERE id = ?', [ruedaId]);
            if (rueda) history.ruedaSaborData = { ...rueda, notas_json: safeJSONParse(rueda.notas_json) };
        }

        rows.sort((a, b) => {
            const sA = allStages.find(s => s.id === a.etapa_id)?.orden || 0;
            const sB = allStages.find(s => s.id === b.etapa_id)?.orden || 0;
            return sA - sB;
        }).forEach(row => {
            const sInfo = allStages.find(s => s.id === row.etapa_id);
            if (sInfo) history.stages.push({ id: row.id, nombre_etapa: sInfo.nombre_etapa, descripcion: sInfo.descripcion, campos_json: safeJSONParse(sInfo.campos_json), data: safeJSONParse(row.data), blockchain_hash: row.blockchain_hash, is_locked: row.is_locked, timestamp: row.created_at });
        });

        res.status(200).json(history);

    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "Error interno." });
    }
};

const getBatchMetadata = async (batchId) => {
    try {
        const batch = await get('SELECT id, producto_id, parent_id, data FROM batches WHERE id = ?', [batchId]);
        if (!batch) return null;

        let productId = batch.producto_id;

        if (!productId) {
            const rootBatch = await get(`
                WITH RECURSIVE ancestry AS (
                    SELECT id, parent_id, producto_id FROM batches WHERE id = ?
                    UNION ALL
                    SELECT b.id, b.parent_id, b.producto_id 
                    FROM batches b 
                    JOIN ancestry a ON b.id = a.parent_id
                )
                SELECT producto_id FROM ancestry WHERE producto_id IS NOT NULL LIMIT 1
             `, [batchId]);
            if (rootBatch) productId = rootBatch.producto_id;
        }

        if (productId) {
            // CORRECCIÓN: Seleccionamos también el ID para poder generar la URL de la imagen
            const product = await get('SELECT id, nombre, imagenes_json, descripcion FROM productos WHERE id = ?', [productId]);
            if (product) {
                const images = safeJSONParse(product.imagenes_json || '[]');
                return {
                    id: product.id, // <--- Importante para la ruta de imagen
                    title: product.nombre,
                    image: images.length > 0 ? images[0] : null,
                    description: product.descripcion
                };
            }
        }
        return null;
    } catch (err) {
        console.error("Error getBatchMetadata:", err);
        return null;
    }
};

const serveProductImage = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await get('SELECT imagenes_json FROM productos WHERE id = ?', [id]);

        if (!product || !product.imagenes_json) {
            return res.redirect('https://rurulab.com/images/banner_1.png');
        }

        const images = safeJSONParse(product.imagenes_json || '[]');
        const imageData = images.length > 0 ? images[0] : null;

        if (!imageData) {
            return res.redirect('https://rurulab.com/images/banner_1.png');
        }

        // 1. Si es Base64, convertir a Buffer y servir
        if (imageData.startsWith('data:image')) {
            const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.redirect('https://rurulab.com/images/banner_1.png');
            }

            const type = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');

            res.writeHead(200, {
                'Content-Type': type,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=86400' // Cache 24h
            });
            res.end(buffer);

            // 2. Si ya es URL, redirigir
        } else if (imageData.startsWith('http')) {
            res.redirect(imageData);
        } else {
            res.redirect('https://rurulab.com/images/banner_1.png');
        }

    } catch (err) {
        console.error("Error serving product image:", err);
        res.redirect('https://rurulab.com/images/banner_1.png');
    }
};

function calcularMaridajeCacaoCafe(cacao, cafe) {
    const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (cafe.perfil_data.sabor || 0)) / 10);
    const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (cafe.perfil_data.acidez || 0)) / 10);
    const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (cafe.perfil_data.dulzura || 0)) / 10);
    const pComp = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0)) / 2 - ((cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0)) / 2) / 10);
    return ((pInt * 0.4) + (((pAcid + pDulz + pComp) / 3) * 0.6)) * 100;
}

function calcularMaridajeCacaoVino(cacao, vino) {
    const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (vino.perfil_data.intensidad || 0)) / 10);
    const pEst = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.astringencia || 0)) / 2 - (vino.perfil_data.taninos || 0)) / 10);
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
    if (queso.perfil_data.notas_sabor.includes('nuez') && (cacao.perfil_data.nuez || 0) > 5) pArmonia += 0.5;
    if (queso.perfil_data.notas_sabor.includes('caramelo') && (cacao.perfil_data.caramelo || 0) > 5) pArmonia += 0.5;
    return ((pInt * 0.4) + (pContraste * 0.4) + (pArmonia * 0.2)) * 100;
}

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
    const { nombre_rueda, notas_json, tipo } = req.body;
    try {
        const result = await run('INSERT INTO ruedas_sabores (user_id, nombre_rueda, notas_json, tipo) VALUES (?, ?, ?, ?)', [userId, nombre_rueda, JSON.stringify(notas_json), tipo]);
        res.status(201).json({ id: result.lastID, user_id: userId, nombre_rueda, notas_json });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'Ya existe una rueda con ese nombre.' });
        res.status(500).json({ error: err.message });
    }
};
const updateRuedaSabores = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre_rueda, notas_json, tipo } = req.body;
    try {
        const result = await run('UPDATE ruedas_sabores SET nombre_rueda = ?, notas_json = ?, tipo = ? WHERE id = ? AND user_id = ?', [nombre_rueda, JSON.stringify(notas_json), tipo, id, userId]);
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
    const id = require('crypto').randomUUID();
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

const getUserSubscriptionStatus = async (userId) => {
    return await get('SELECT subscription_tier, trial_ends_at FROM users WHERE id = ?', [userId]);
};

const getAdminDashboardData = async (req, res) => {
    try {
        const users = await all('SELECT id, usuario, correo, created_at, subscription_tier, trial_ends_at FROM users');

        const dashboardData = await Promise.all(users.map(async (user) => {
            const [fincaCount, procesadoraCount, processes] = await Promise.all([
                get('SELECT COUNT(*) as count FROM fincas WHERE user_id = ?', [user.id]),
                get('SELECT COUNT(*) as count FROM procesadoras WHERE user_id = ?', [user.id]),
                all(`
                    SELECT DISTINCT pt.nombre_producto
                    FROM batches l
                    JOIN plantillas_proceso pt ON l.plantilla_id = pt.id
                    WHERE l.user_id = ? AND l.parent_id IS NULL
                `, [user.id])
            ]);

            return {
                ...user,
                finca_count: fincaCount.count,
                procesadora_count: procesadoraCount.count,
                process_count: processes.length,
                process_types: processes.map(p => p.nombre_producto)
            };
        }));

        res.status(200).json(dashboardData);
    } catch (error) {
        console.error("Error en getAdminDashboardData:", error);
        res.status(500).json({ error: 'Error interno del servidor.' });
    }
};

const getLoteCosts = async (req, res) => {
    const { lote_id } = req.params;
    try {
        const costs = await get('SELECT cost_data FROM lote_costs WHERE batch_id = ?', [lote_id]);
        if (!costs) return res.status(404).json({ message: "No se encontraron costos para este lote." });
        res.status(200).json(safeJSONParse(costs.cost_data));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const saveLoteCosts = async (req, res) => {
    const { lote_id } = req.params;
    const { cost_data } = req.body;
    try {
        const existing = await get('SELECT batch_id FROM lote_costs WHERE batch_id = ?', [lote_id]);
        if (existing) {
            await run('UPDATE lote_costs SET cost_data = ? WHERE batch_id = ?', [JSON.stringify(cost_data), lote_id]);
        } else {
            await run('INSERT INTO lote_costs (batch_id, user_id, cost_data) VALUES (?, ?, ?)', [lote_id, req.user.id, JSON.stringify(cost_data)]);
        }
        res.status(200).json({ message: "Costos guardados exitosamente." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getDashboardData = async (req, res) => {
    const userId = req.user.id;
    try {
        const [
            allLotes,
            templates,
            allStagesRaw,
            fincas,
            procesadoras,
            costs
        ] = await Promise.all([
            all('SELECT * FROM batches WHERE user_id = ?', [userId]),
            all('SELECT * FROM plantillas_proceso WHERE user_id = ?', [userId]),
            all('SELECT * FROM etapas_plantilla WHERE plantilla_id IN (SELECT id FROM plantillas_proceso WHERE user_id = ?)', [userId]),
            all('SELECT * FROM fincas WHERE user_id = ?', [userId]),
            all('SELECT * FROM procesadoras WHERE user_id = ?', [userId]),
            all('SELECT * FROM lote_costs WHERE user_id = ?', [userId])
        ]);

        const lotesProcesados = allLotes.map(lote => ({
            ...lote,
            data: safeJSONParse(lote.data),
            children: []
        }));
        const loteMap = {};
        lotesProcesados.forEach(lote => { loteMap[lote.id] = lote; });
        const batchTrees = [];
        lotesProcesados.forEach(lote => {
            if (lote.parent_id && loteMap[lote.parent_id]) {
                loteMap[lote.parent_id].children.push(lote);
            } else {
                batchTrees.push(lote);
            }
        });

        const stages = allStagesRaw.reduce((acc, stage) => {
            if (!acc[stage.plantilla_id]) {
                acc[stage.plantilla_id] = [];
            }
            acc[stage.plantilla_id].push({
                ...stage,
                campos_json: safeJSONParse(stage.campos_json)
            });
            return acc;
        }, {});

        res.status(200).json({
            batchTrees,
            templates,
            stages,
            fincas,
            procesadoras,
            costs: costs.map(c => ({ ...c, cost_data: safeJSONParse(c.cost_data) }))
        });

    } catch (err) {
        console.error("Error en getDashboardData:", err);
        res.status(500).json({ error: "Error interno del servidor al obtener los datos del dashboard." });
    }
};

const createPaymentPreference = async (req, res, client) => {
    const userId = req.user.id;
    const host = req.get('host');
    const protocol = req.protocol;

    const preferenceData = {
        items: [
            {
                title: 'Suscripción Rurulab - Plan Profesional',
                description: 'Acceso completo a todos los módulos de I+D y trazabilidad ilimitada.',
                quantity: 1,
                unit_price: 19.00,
                currency_id: 'USD'
            }
        ],
        back_urls: {
            success: `${protocol}://${host}/app/payment-success`,
            failure: `${protocol}://${host}/app/payment-failure`,
            pending: `${protocol}://${host}/app/payment-failure`
        },
        auto_return: 'approved',
        notification_url: `${protocol}://${host}/api/payments/webhook?userId=${userId}`,
        external_reference: userId.toString()
    };

    try {
        const preference = new Preference(mpClient);
        const response = await preference.create({ body: preferenceData });

        res.json({
            id: response.id,
            init_point: response.init_point
        });
    } catch (error) {
        console.error("Error al crear preferencia de Mercado Pago:", error);
        res.status(500).json({ error: 'No se pudo generar el enlace de pago.' });
    }
};

const handlePaymentWebhook = async (req, res) => {
    const { query } = req;
    const body = JSON.parse(req.body.toString());

    const topic = query.type || body.type;

    if (topic === 'payment') {
        const paymentId = query['data.id'] || body.data?.id;
        if (!paymentId) return res.sendStatus(400);

        try {
            const payment = new Payment(mpClient);
            const paymentInfo = await payment.get({ id: Number(paymentId) });

            if (paymentInfo && paymentInfo.status === 'approved') {
                const userId = paymentInfo.external_reference;
                if (userId) {
                    await run(
                        "UPDATE users SET subscription_tier = 'profesional', trial_ends_at = NULL WHERE id = ?",
                        [userId]
                    );
                    console.log(`Usuario ${userId} actualizado a Profesional.`);
                }
            }
            res.sendStatus(200);
        } catch (error) {
            console.error('Error en webhook de Mercado Pago:', error);
            res.sendStatus(500);
        }
    } else {
        res.sendStatus(200);
    }
};

const getReviews = async (req, res) => {
    const { lote_id } = req.params;
    try {
        const reviews = await all(
            'SELECT * FROM product_reviews WHERE batch_id = ? ORDER BY created_at DESC',
            [lote_id]
        );
        res.status(200).json(reviews);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const submitReview = async (req, res) => {
    const { idToken, lote_id, rating, comment } = req.body;

    if (!idToken || !lote_id || !rating) {
        return res.status(400).json({ error: 'Faltan datos requeridos (token, lote, rating).' });
    }

    let user_email;
    try {
        const ticket = await client.verifyIdToken({
            idToken: idToken,
            audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        user_email = payload.email;

        if (!user_email) {
            throw new Error('No se pudo obtener el email de Google.');
        }

    } catch (error) {
        console.error("Error en la verificación del token de Google:", error);
        return res.status(401).json({ error: "Token de Google inválido o caducado." });
    }

    try {
        await run(
            'INSERT INTO product_reviews (batch_id, user_email, rating, comment) VALUES (?, ?, ?, ?)',
            [lote_id, user_email, rating, comment]
        );
        res.status(201).json({ message: 'Reseña guardada con éxito.' });

    } catch (err) {
        if (err.message.includes('UNIQUE') || (err.code && err.code.includes('23505'))) {
            res.status(409).json({ error: 'Ya has enviado una reseña para este producto.' });
        } else {
            console.error("Error al guardar la reseña:", err);
            res.status(500).json({ error: 'Error interno al guardar la reseña.' });
        }
    }
};

// --- BLOG SYSTEM ---

// Obtener posts (Público, Paginado)
const getBlogPosts = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    try {
        // Obtenemos solo los publicados
        const posts = await all(
            'SELECT id, title, slug, summary, cover_image, created_at FROM blog_posts WHERE is_published = TRUE ORDER BY created_at DESC LIMIT ? OFFSET ?',
            [limit, offset]
        );

        // Contamos total para la paginación
        const countResult = await get('SELECT COUNT(*) as count FROM blog_posts WHERE is_published = TRUE');
        const totalPosts = parseInt(countResult.count);
        const totalPages = Math.ceil(totalPosts / limit);

        res.status(200).json({
            data: posts,
            pagination: {
                page,
                limit,
                totalPosts,
                totalPages
            }
        });
    } catch (err) {
        console.error("Error getting blog posts:", err);
        res.status(500).json({ error: err.message });
    }
};

// Obtener un post por Slug (Público)
const getBlogPostBySlug = async (req, res) => {
    const { slug } = req.params;
    try {
        const post = await get('SELECT * FROM blog_posts WHERE slug = ? AND is_published = TRUE', [slug]);
        if (!post) return res.status(404).json({ error: "Artículo no encontrado." });
        res.status(200).json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear Post (Admin)
const createBlogPost = async (req, res) => {
    const { title, content, summary, cover_image, is_published } = req.body;
    const userId = req.user.id;
    const id = require('crypto').randomUUID();
    const slug = createSlug(title);

    try {
        await run(
            'INSERT INTO blog_posts (id, title, slug, content, summary, cover_image, author_id, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [id, title, slug, content, summary, cover_image, userId, is_published]
        );
        res.status(201).json({ message: "Artículo creado", slug });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: "Ya existe un artículo con título similar." });
        res.status(500).json({ error: err.message });
    }
};

// Actualizar Post (Admin)
const updateBlogPost = async (req, res) => {
    const { id } = req.params;
    const { title, content, summary, cover_image, is_published } = req.body;
    // Si cambia el título, podríamos querer actualizar el slug, pero para mantener SEO, a veces es mejor no hacerlo.
    // Aquí actualizaremos el slug solo si se envía explícitamente o generaremos uno nuevo si cambia el título significativamente (opcional).
    // Por simplicidad, regeneramos el slug si cambia el título.
    const slug = createSlug(title);

    try {
        const result = await run(
            'UPDATE blog_posts SET title = ?, slug = ?, content = ?, summary = ?, cover_image = ?, is_published = ? WHERE id = ?',
            [title, slug, content, summary, cover_image, is_published, id]
        );
        if (result.changes === 0) return res.status(404).json({ error: "Artículo no encontrado." });
        res.status(200).json({ message: "Artículo actualizado", slug });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Eliminar Post (Admin)
const deleteBlogPost = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await run('DELETE FROM blog_posts WHERE id = ?', [id]);
        if (result.changes === 0) return res.status(404).json({ error: "Artículo no encontrado." });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Obtener todos los posts para el admin (incluso borradores)
const getAdminBlogPosts = async (req, res) => {
    try {
        const posts = await all('SELECT id, title, slug, is_published, created_at, cover_image FROM blog_posts ORDER BY created_at DESC');
        res.status(200).json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getBlogPostById = async (req, res) => {
    const { id } = req.params;
    try {
        const post = await get('SELECT * FROM blog_posts WHERE id = ?', [id]);
        if (!post) return res.status(404).json({ error: "Artículo no encontrado." });
        res.status(200).json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const validateDeforestation = async (req, res) => {
    const { coordinates } = req.body; // Espera un GeoJSON Polygon coordinates

    if (!coordinates) {
        return res.status(400).json({
            error: "Coordenadas inválidas."
        });
    }

    // Diagnóstico seguro para logs de producción
    if (!process.env.GEE_PRIVATE_KEY) {
        console.error("GEE_PRIVATE_KEY está vacía o indefinida en el entorno.");
        return res.status(500).json({
            error: "Configuración de GEE faltante en el servidor."
        });
    }

    try {
        // Intento robusto de parseo para Vercel
        let privateKey;
        try {
            privateKey = JSON.parse(process.env.GEE_PRIVATE_KEY);
        } catch (jsonError) {
            // A veces Vercel convierte los \n en saltos de línea reales que rompen el JSON.parse
            // O el usuario copió el JSON con saltos de línea.
            // Intentamos limpiarlo.
            console.warn("Fallo el parseo directo de GEE_PRIVATE_KEY, intentando sanitización...");
            try {
                // Reemplaza saltos de línea literales que podrían haber roto el JSON string
                // Primero intentamos eliminar saltos de línea reales y luego parsear
                const sanitizedKey = process.env.GEE_PRIVATE_KEY.replace(/(\r\n|\n|\r)/gm, "");
                privateKey = JSON.parse(sanitizedKey);
            } catch (e2) {
                console.error("Error de formato en GEE_PRIVATE_KEY:", jsonError.message);
                return res.status(500).json({
                    error: "El formato de GEE_PRIVATE_KEY no es un JSON válido. Asegúrate de que esté en una sola línea sin espacios extra."
                });
            }
        }

        await new Promise((resolve, reject) => {
            ee.data.authenticateViaPrivateKey(
                privateKey,
                () => ee.initialize(null, null, resolve, reject),
                (e) => reject(e)
            );
        });

        // 2. Definir la Geometría (Polígono de la Finca)
        // GEE espera: geometry = ee.Geometry.Polygon(coords)
        const polygon = ee.Geometry.Polygon(coordinates);

        // 3. Cargar Dataset Global Forest Change (Hansen/UMD)
        // Versión v1_11 incluye datos hasta 2023
        const gfc = ee.Image('UMD/hansen/global_forest_change_2023_v1_11');

        // 4. Definir Criterios EUDR (Reglamento UE)
        // Fecha de corte: 31 Dic 2020.
        // La banda 'lossyear' tiene valores 1 (2001) a 23 (2023).
        // Pérdida relevante: año > 20 (es decir, 2021, 2022, 2023).
        const lossYear = gfc.select(['lossyear']);
        const lossAfter2020 = lossYear.gt(20); // 1 si hubo pérdida después de 2020, 0 si no.
        const maskedLoss = lossAfter2020.updateMask(lossAfter2020); // Máscara para contar solo píxeles de pérdida

        // 5. Calcular el Área Afectada (en metros cuadrados)
        const areaImage = maskedLoss.multiply(ee.Image.pixelArea());

        // Reducir la región para sumar el área de pérdida dentro del polígono
        // Usamos scale: 30 (resolución nativa de Landsat ~30m)
        const stats = areaImage.reduceRegion({
            reducer: ee.Reducer.sum(),
            geometry: polygon,
            scale: 30,
            maxPixels: 1e9
        });

        // 6. Obtener Área Total del Polígono para calcular porcentaje
        const polygonArea = polygon.area();

        // 7. Ejecutar análisis asíncrono (evaluate)
        // GEE funciona con "Lazy Evaluation", necesitamos pedir los datos explícitamente
        const result = await new Promise((resolve, reject) => {
            // Evaluamos un diccionario con ambos valores
            ee.Dictionary({
                lossArea: stats.get('lossyear'),
                totalArea: polygonArea
            }).evaluate((data, error) => {
                if (error) reject(error);
                else resolve(data);
            });
        });

        const lossAreaM2 = result.lossArea || 0;
        const totalAreaM2 = result.totalArea || 1; // Evitar división por cero
        const lossPercentage = (lossAreaM2 / totalAreaM2) * 100;

        // 8. Determinar Cumplimiento
        // Umbral de tolerancia: < 0.1% (para descartar ruido de píxeles de borde)
        const isCompliant = lossPercentage < 0.1;

        res.json({
            compliant: isCompliant,
            loss_percentage: lossPercentage,
            loss_area_hectares: (lossAreaM2 / 10000).toFixed(4),
            details: isCompliant
                ? "Certificado Automático: Sin pérdida de cobertura arbórea detectada post-2020."
                : `Alerta: Se detectó deforestación en ${lossPercentage.toFixed(2)}% del área.`
        });

    } catch (error) {
        console.error("Error en análisis GEE:", error);
        res.status(500).json({ error: "Fallo en el servicio de análisis satelital: " + error.message });
    }
};

// --- NUEVA FUNCIÓN PARA GS1 RESOLVER ---
const getBatchByGtinAndLot = async (gtin, loteId) => {
    try {
        // 1. Verificar si el lote existe
        const batchExists = await get('SELECT id FROM batches WHERE id = ?', [loteId]);
        if (!batchExists) return null;

        // 2. Búsqueda Recursiva hacia arriba (Ancestros)
        // Buscamos si ALGÚN lote en la cadena (el actual o sus padres) tiene el producto asociado a este GTIN.
        // Esto soluciona el problema de que el producto_id solo esté en el lote raíz.
        const row = await get(`
            WITH RECURSIVE ancestry AS (
                -- Lote inicial (Hijo)
                SELECT b.id, b.parent_id, b.producto_id 
                FROM batches b 
                WHERE b.id = ?
                
                UNION ALL
                
                -- Buscar padres
                SELECT parent.id, parent.parent_id, parent.producto_id
                FROM batches parent
                INNER JOIN ancestry child ON parent.id = child.parent_id
            )
            -- Seleccionar si encontramos el producto en algún nivel
            SELECT a.id 
            FROM ancestry a
            JOIN productos p ON a.producto_id = p.id
            WHERE p.gtin = ?
            LIMIT 1;
        `, [loteId, gtin]);

        // Si row tiene datos, significa que la cadena es válida para ese GTIN
        return row ? { id: loteId } : null;

    } catch (error) {
        console.error("Error en getBatchByGtinAndLot:", error);
        return null;
    }
};

// --- MÓDULO DE NUTRICIÓN ---
const getRecetasNutricionales = async (req, res) => {
    const userId = req.user.id;
    try {
        // FILTRO: deleted_at IS NULL
        const recetas = await all('SELECT * FROM recetas_nutricionales WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [userId]);
        const recetasCompletas = await Promise.all(recetas.map(async (r) => {
            const ingredientes = await all('SELECT * FROM ingredientes_receta WHERE receta_id = ?', [r.id]);
            return {
                ...r,
                ingredientes: ingredientes.map(i => ({
                    ...i,
                    nutrientes_base_json: safeJSONParse(i.nutrientes_base_json)
                }))
            };
        }));
        res.status(200).json(recetasCompletas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2. Crear Receta
const createRecetaNutricional = async (req, res) => {
    const userId = req.user.id;
    const { nombre, descripcion, peso_porcion_gramos, porciones_envase } = req.body;
    const id = require('crypto').randomUUID();

    try {
        await run(
            'INSERT INTO recetas_nutricionales (id, user_id, nombre, descripcion, peso_porcion_gramos, porciones_envase) VALUES (?, ?, ?, ?, ?, ?)',
            [id, userId, nombre, descripcion, peso_porcion_gramos || 100, porciones_envase || 1]
        );
        res.status(201).json({ message: "Receta creada", id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 2.1 Actualizar Receta (Nuevo para CRUD completo)
const updateRecetaNutricional = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre, descripcion, peso_porcion_gramos, porciones_envase } = req.body;

    try {
        const result = await run(
            'UPDATE recetas_nutricionales SET nombre = ?, descripcion = ?, peso_porcion_gramos = ?, porciones_envase = ? WHERE id = ? AND user_id = ?',
            [nombre, descripcion, peso_porcion_gramos, porciones_envase, id, userId]
        );
        if (result.changes === 0) return res.status(404).json({ error: "Receta no encontrada" });
        res.status(200).json({ message: "Receta actualizada" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 3. Agregar Ingrediente a Receta (con Auto-Cache)
const addIngredienteReceta = async (req, res) => {
    const { receta_id } = req.params;
    const { usda_id, nombre, peso_gramos, nutrientes_base_json } = req.body;
    const id = require('crypto').randomUUID();

    try {
        await run(
            'INSERT INTO ingredientes_receta (id, receta_id, usda_id, nombre, peso_gramos, nutrientes_base_json) VALUES (?, ?, ?, ?, ?, ?)',
            [id, receta_id, usda_id, nombre, peso_gramos, JSON.stringify(nutrientes_base_json)]
        );
        res.status(201).json({ message: "Ingrediente agregado", id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 4. Actualizar Peso de Ingrediente
const updateIngredientePeso = async (req, res) => {
    const { id } = req.params;
    const { peso_gramos } = req.body;
    try {
        await run('UPDATE ingredientes_receta SET peso_gramos = ? WHERE id = ?', [peso_gramos, id]);
        res.status(200).json({ message: "Peso actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 5. Eliminar Ingrediente
const deleteIngrediente = async (req, res) => {
    const { id } = req.params;
    try {
        await run('DELETE FROM ingredientes_receta WHERE id = ?', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// 6. Eliminar Receta Completa
const deleteRecetaNutricional = async (req, res) => {
    const { id } = req.params;
    try {
        await run('DELETE FROM recetas_nutricionales WHERE id = ?', [id]);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// --- PROXY USDA API ---
const searchUSDA = async (req, res) => {
    const { query } = req.query;
    const apiKey = process.env.USDA_API_KEY; // Asegúrate de tener esto en tu .env

    if (!apiKey) return res.status(500).json({ error: "API Key de USDA no configurada en el servidor." });

    try {
        // USDA FoodData Central Search
        const response = await fetch(`https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}&query=${encodeURIComponent(query)}&pageSize=20&dataType=Foundation,SR Legacy,Branded`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error USDA Search:", error);
        res.status(500).json({ error: "Error conectando con USDA" });
    }
};

const getUSDADetails = async (req, res) => {
    const { fdcId } = req.params;
    const apiKey = process.env.USDA_API_KEY;

    try {
        const response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${fdcId}?api_key=${apiKey}`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error("Error USDA Details:", error);
        res.status(500).json({ error: "Error obteniendo detalles del alimento" });
    }
};

// --- HELPER INTERNO: Garantizar existencia de Plantilla ---
const ensureTemplateAndStageExists = async (userId, systemTemplateName, stageName, stageOrder) => {
    try {
        // 1. Buscar si la plantilla ya existe para el usuario
        let template = await get('SELECT id FROM plantillas_proceso WHERE user_id = ? AND nombre_producto = ?', [userId, systemTemplateName]);

        let templateId;

        if (template) {
            templateId = template.id;
        } else {
            // 2. Si no existe, CLONAR desde el JSON (Lógica JIT)            
            const catalogPath = path.join(__dirname, 'data/procesos_config.json');
            const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
            const templateToClone = catalogData.templates.find(t => t.nombre_producto === systemTemplateName);

            if (!templateToClone) throw new Error(`Plantilla del sistema '${systemTemplateName}' no encontrada.`);

            const templateResult = await run(
                'INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion) VALUES (?, ?, ?)',
                [userId, templateToClone.nombre_producto, templateToClone.descripcion]
            );
            templateId = templateResult.lastID;

            // Insertar etapas (Acopio + Proceso)
            const allStages = [...(templateToClone.acopio || []), ...(templateToClone.etapas || [])];

            for (const stage of allStages) {
                // Determinar fase
                const fase = (templateToClone.acopio && templateToClone.acopio.includes(stage)) ? 'acopio' : 'procesamiento';

                await run(
                    'INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, descripcion, orden, campos_json, fase) VALUES (?, ?, ?, ?, ?, ?)',
                    [templateId, stage.nombre_etapa, stage.descripcion, stage.orden, JSON.stringify(stage.campos_json), fase]
                );
            }
        }

        // 3. Buscar el ID de la etapa específica
        // Buscamos por nombre Y orden para ser precisos (ya que Cosecha podría repetirse en otro contexto, aunque no debería)
        let stageSql = 'SELECT id FROM etapas_plantilla WHERE plantilla_id = ? AND nombre_etapa = ?';
        let stageParams = [templateId, stageName];

        if (stageOrder) {
            stageSql += ' AND orden = ?';
            stageParams.push(stageOrder);
        }

        const stage = await get(stageSql, stageParams);

        if (!stage) throw new Error(`Etapa '${stageName}' no encontrada en la plantilla '${systemTemplateName}'.`);

        return { plantilla_id: templateId, etapa_id: stage.id };

    } catch (error) {
        console.error("Error en ensureTemplateAndStageExists:", error);
        throw error;
    }
};

// 3. Listar Lotes Inmutables de un Producto específico
const getPublicBatchesForProduct = async (req, res) => {
    const { productId } = req.params;
    try {
        // Obtenemos lotes, unimos con acquisitions para saber la finca origen si existe
        const sql = `
            WITH RECURSIVE BatchLineage AS (
                -- 1. Ancla: Empezamos con los lotes que tienen certificado (en traceability_registry)
                SELECT 
                    b.id as target_batch_id, 
                    b.id as ancestor_id, 
                    b.parent_id, 
                    b.producto_id, 
                    b.acquisition_id
                FROM batches b
                JOIN traceability_registry tr ON CAST(b.id AS TEXT) = CAST(tr.batch_id AS TEXT)
                
                UNION ALL
                
                -- 2. Recursión: Vamos subiendo hacia los padres
                SELECT 
                    bl.target_batch_id, 
                    parent.id, 
                    parent.parent_id, 
                    parent.producto_id, 
                    parent.acquisition_id
                FROM batches parent
                JOIN BatchLineage bl ON CAST(bl.parent_id AS TEXT) = CAST(parent.id AS TEXT)
            ),
            -- 3. Consolidación: Para cada lote certificado, tomamos el primer producto_id y acquisition_id que encontremos en su historia
            BatchSummary AS (
                SELECT 
                    target_batch_id,
                    MAX(producto_id) as resolved_product_id,
                    MAX(acquisition_id) as resolved_acquisition_id
                FROM BatchLineage
                GROUP BY target_batch_id
            )
            -- 4. Consulta Final
            SELECT 
                b.id, 
                b.created_at, 
                tr.blockchain_hash, 
                b.data,
                acq.finca_origen, 
                f.ciudad, 
                f.pais,
                f.departamento, -- Agregamos departamento
                f.distrito,     -- Agregamos distrito
                pp.nombre_producto as tipo_proceso
            FROM traceability_registry tr
            JOIN batches b ON CAST(tr.batch_id AS TEXT) = CAST(b.id AS TEXT)
            JOIN BatchSummary bs ON CAST(b.id AS TEXT) = CAST(bs.target_batch_id AS TEXT)
            LEFT JOIN plantillas_proceso pp ON b.plantilla_id = pp.id
            LEFT JOIN acquisitions acq ON bs.resolved_acquisition_id = acq.id
            LEFT JOIN fincas f ON acq.finca_origen = f.nombre_finca AND CAST(f.user_id AS TEXT) = CAST(acq.user_id AS TEXT)
            WHERE CAST(bs.resolved_product_id AS TEXT) = ?
            ORDER BY b.created_at DESC
        `;

        const rows = await all(sql, [productId]);

        const batches = rows.map(row => {
            const dataObj = safeJSONParse(row.data);

            // Normalizar ubicación
            let origen = row.finca_origen || dataObj.finca?.value || 'Origen registrado';

            // Construir detalle de ubicación: Distrito, Departamento, País
            const locationParts = [];
            if (row.distrito) locationParts.push(row.distrito);
            if (row.departamento) locationParts.push(row.departamento);
            if (row.pais) locationParts.push(row.pais);

            // Si no hay datos detallados, intentar usar ciudad
            if (locationParts.length === 0 && row.ciudad) {
                locationParts.push(row.ciudad);
            }

            if (locationParts.length > 0) {
                origen += `, ${locationParts.join(', ')}`;
            }

            return {
                id: row.id,
                fecha: row.created_at,
                hash: row.blockchain_hash,
                origen: origen,
                tipo: row.tipo_proceso,
                rating: 5
            };
        });

        res.status(200).json(batches);
    } catch (err) {
        console.error("Error getPublicBatchesForProduct:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- CONFIGURACIÓN DEL SISTEMA (NUEVO) ---
const getCurrencies = async (req, res) => {
    try {
        const rows = await all('SELECT * FROM currencies ORDER BY code');
        res.status(200).json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getUnits = async (req, res) => {
    try {
        const rows = await all('SELECT * FROM units_of_measure ORDER BY type, code');
        res.status(200).json(rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createSuggestion = async (req, res) => {
    const { type, name, logo, instagram, facebook } = req.body;
    const id = `SUG-${require('crypto').randomUUID().substring(0, 8).toUpperCase()}`;

    try {
        await run(`
            INSERT INTO suggested_companies (
                id, type, name, logo, social_instagram, social_facebook
            ) VALUES (?, ?, ?, ?, ?, ?)
        `, [
            id, type, name, logo, instagram, facebook
        ]);

        res.status(201).json({ message: "Sugerencia enviada", id });
    } catch (err) {
        console.error("Error createSuggestion:", err);
        res.status(500).json({ error: err.message });
    }
};

const trackAnalyticsEvent = async (req, res) => {
    const { event_type, target_user_id, target_product_id, meta_data } = req.body;

    try {
        await run(
            'INSERT INTO analytics_events (event_type, target_user_id, target_product_id, meta_data) VALUES (?, ?, ?, ?)',
            [
                event_type,
                target_user_id,
                target_product_id || null,
                JSON.stringify(meta_data || {})
            ]
        );
        // Respondemos 201 Created (silenciosamente exitoso)
        res.status(201).json({ status: 'ok' });
    } catch (err) {
        // Logueamos el error pero no rompemos la app del cliente
        console.error("Error Analytics:", err);
        res.status(200).json({ status: 'error_logged' });
    }
};

const getCompanyLandingDataInternal = async (userId) => {
    try {
        const isSuggested = String(userId).startsWith('SUG-');

        if (isSuggested) {
            const suggestion = await get('SELECT * FROM suggested_companies WHERE id = ?', [userId]);
            if (!suggestion) return null;
            return {
                user: {
                    id: suggestion.id, name: suggestion.name, logo: suggestion.logo,
                    type: suggestion.type, is_suggested: true, celular: null,
                    instagram: suggestion.social_instagram, facebook: suggestion.social_facebook
                },
                entity: {
                    nombre_finca: suggestion.type === 'finca' ? suggestion.name : null,
                    nombre_comercial: suggestion.type === 'procesadora' ? suggestion.name : null,
                    pais: suggestion.pais, departamento: suggestion.departamento,
                    provincia: suggestion.provincia, distrito: suggestion.distrito,
                    coordenadas: safeJSONParse(suggestion.coordenadas),
                    imagenes: [], certificaciones: [], premios: [], historia: null,
                    social_instagram: suggestion.social_instagram, social_facebook: suggestion.social_facebook
                },
                products: []
            };
        }

        const userRow = await get(`
            SELECT 
                u.id as u_id, u.empresa as u_empresa, u.company_type as u_type, u.company_id as u_company_id,
                u.company_logo as u_logo, u.celular as u_phone, u.correo as u_email,
                u.social_instagram as u_ig, u.social_facebook as u_fb,
                cp.name as cp_name, cp.company_type as cp_type, cp.company_id as cp_company_id,
                cp.logo_url, cp.cover_image_url, cp.history_text, cp.contact_email,
                cp.contact_phone, cp.social_instagram as cp_ig, cp.social_facebook as cp_fb,
                cp.website_url
            FROM users u
            LEFT JOIN company_profiles cp ON u.id = cp.user_id
            WHERE u.id = ?
        `, [userId]);

        if (!userRow) return null;

        const companyData = {
            id: userId,
            name: userRow.cp_name || userRow.u_empresa,
            type: userRow.cp_type || userRow.u_type,
            logo: userRow.logo_url || userRow.u_logo,
            cover: userRow.cover_image_url || null,
            history: userRow.history_text || '',
            celular: userRow.contact_phone || userRow.u_phone || '',
            email: userRow.contact_email || userRow.u_email || '',
            instagram: userRow.cp_ig || userRow.u_ig || '',
            facebook: userRow.cp_fb || userRow.u_fb || '',
            is_suggested: false
        };

        const actualCompanyId = userRow.cp_company_id || userRow.u_company_id;

        let entityPromise = Promise.resolve({});
        if (companyData.type === 'finca' && actualCompanyId) {
            entityPromise = get('SELECT * FROM fincas WHERE id = ?', [actualCompanyId]);
        } else if (companyData.type === 'procesadora' && actualCompanyId) {
            entityPromise = get('SELECT * FROM procesadoras WHERE id = ?', [actualCompanyId]);
        }

        const productsPromise = all(`
            SELECT p.id, p.nombre, p.descripcion, p.imagenes_json, p.tipo_producto,
            p.variedad, p.proceso, p.nivel_tueste, p.puntaje_sca
            FROM productos p
            WHERE p.user_id = ? AND p.deleted_at IS NULL
              AND (p.is_published IS TRUE OR p.is_published IS NULL)
            ORDER BY p.nombre ASC
        `, [userId]);

        const [entityData, products] = await Promise.all([entityPromise, productsPromise]);

        if (entityData && entityData.id) {
            entityData.imagenes = safeJSONParse(entityData.imagenes_json || '[]');
            entityData.certificaciones = safeJSONParse(entityData.certificaciones_json || '[]');
            entityData.premios = safeJSONParse(entityData.premios_json || '[]');
            entityData.coordenadas = safeJSONParse(entityData.coordenadas || 'null');
        }

        const productsFormatted = products.map(p => ({
            ...p,
            imagenes: safeJSONParse(p.imagenes_json || '[]')
        }));

        return { user: companyData, entity: entityData || {}, products: productsFormatted };

    } catch (e) {
        console.error('Error getCompanyLandingDataInternal:', e);
        return null;
    }
};

const getPublicCompaniesDataInternal = async () => {
    try {
        // 1. Obtener empresas verificadas (tabla users)
        const users = await all(`
            SELECT 
                cp.user_id AS id, 
                cp.name AS empresa, 
                cp.logo_url AS company_logo,
                COALESCE(f.provincia, p.provincia) AS provincia,
                COALESCE(f.departamento, p.departamento) AS departamento,
                COALESCE(f.pais, p.pais) AS pais
            FROM 
                company_profiles cp
            LEFT JOIN 
                fincas f ON cp.company_id = f.id AND cp.company_type = 'finca'
            LEFT JOIN 
                procesadoras p ON cp.company_id = p.id AND cp.company_type = 'procesadora'
            WHERE 
                cp.name IS NOT NULL 
                AND cp.name != '';
        `);

        // 2. Obtener empresas sugeridas (tabla suggested_companies)
        // Mapeamos los campos para que coincidan con la estructura de 'users'
        const suggestions = await all(`
            SELECT id, name as empresa, logo as company_logo, provincia, departamento, pais
            FROM suggested_companies
        `);

        // 3. Combinar ambos resultados
        return [...users, ...suggestions];

    } catch (err) {
        console.error("Error interno fetching companies:", err);
        return [];
    }
};

const getSuggestionById = async (req, res) => {
    const { id } = req.params;
    try {
        const suggestion = await get('SELECT * FROM suggested_companies WHERE id = ?', [id]);
        if (!suggestion) return res.status(404).json({ error: "Sugerencia no encontrada" });

        res.json(suggestion);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const claimSuggestion = async (req, res) => {
    const { id } = req.params;
    try {
        await run("UPDATE suggested_companies SET status = 'claimed' WHERE id = ?", [id]);
        res.json({ message: "Sugerencia marcada como reclamada." });
    } catch (err) {
        console.error("Error claimSuggestion:", err);
        res.status(500).json({ error: err.message });
    }
};

const serveCompanyLogo = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Buscar en usuarios verificados
        let user = await get('SELECT company_logo FROM users WHERE id = ?', [id]);

        // 2. Si no, buscar en empresas sugeridas
        if (!user) {
            user = await get('SELECT logo as company_logo FROM suggested_companies WHERE id = ?', [id]);
        }

        if (!user || !user.company_logo) {
            // Si no tiene logo, redirigir a imagen por defecto
            return res.redirect('https://rurulab.com/images/banner_1.png');
        }

        const logoData = user.company_logo;

        // 3. Procesar Base64
        if (logoData.startsWith('data:image')) {
            const matches = logoData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return res.redirect('https://rurulab.com/images/banner_1.png');
            }

            const type = matches[1]; // ej: image/png
            const buffer = Buffer.from(matches[2], 'base64'); // Convertir a binario

            res.writeHead(200, {
                'Content-Type': type,
                'Content-Length': buffer.length,
                'Cache-Control': 'public, max-age=86400' // Cachear por 1 día
            });
            res.end(buffer);
        } else if (logoData.startsWith('http')) {
            // Si ya es URL externa, redirigir
            res.redirect(logoData);
        } else {
            res.redirect('https://rurulab.com/images/banner_1.png');
        }

    } catch (err) {
        console.error("Error fetching logo:", err);
        // Fallback a imagen por defecto en caso de error
        res.redirect('https://rurulab.com/images/banner_1.png');
    }
};

module.exports = {
    registerUser, loginUser, logoutUser, handleGoogleLogin,
    getSucursales, createSucursal, updateSucursal, deleteSucursal,
    getPerfiles, createPerfil, updatePerfil, deletePerfil,
    getTemplates, createTemplate, updateTemplate, deleteTemplate,
    getSystemTemplates, cloneTemplate, // <-- NUEVAS FUNCIONES EXPORTADAS
    getStagesForTemplate, createStage, updateStage, deleteStage,
    getTrazabilidad, getBatchMetadata, serveProductImage,
    getUserProfile, updateUserProfile, updateUserPassword,
    getRuedasSabores, createRuedaSabores, updateRuedaSabores, deleteRuedaSabores,
    getBlends, createBlend, deleteBlend,
    getRecetas, createReceta, deleteReceta, updateReceta,
    getUserSubscriptionStatus,
    getAdminDashboardData,
    getLoteCosts, saveLoteCosts,
    getDashboardData,
    createPaymentPreference, handlePaymentWebhook,
    getReviews, submitReview,
    getBlogPosts, getBlogPostBySlug, createBlogPost, updateBlogPost, deleteBlogPost, getAdminBlogPosts, getBlogPostById,
    validateDeforestation, getBatchByGtinAndLot,
    addIngredienteReceta, updateIngredientePeso, deleteIngrediente,
    getRecetasNutricionales, createRecetaNutricional, deleteRecetaNutricional, updateRecetaNutricional,
    searchUSDA, getUSDADetails,
    getPublicBatchesForProduct,
    getCurrencies, getUnits,
    trackAnalyticsEvent,
    getPublicCompaniesDataInternal,
    getCompanyLandingDataInternal,
    createSuggestion, getSuggestionById, claimSuggestion,
    serveCompanyLogo
};