const environment = process.env.NODE_ENV || 'development';
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const ee = require('@google/earthengine'); 

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

let get, all, run;

if (environment === 'production') {
    // --- Configuración para Producción (PostgreSQL con Neon) ---
    const { Pool } = require('@neondatabase/serverless');
    const pool = new Pool({ 
        connectionString: process.env.POSTGRES_URL,
        connectionTimeoutMillis: 10000, // 1. Si no conecta en 5s, FALLA (entra al catch)
        idleTimeoutMillis: 1000,       // 2. Cierra conexiones inactivas rápido para no reusar conexiones rotas
        max: 1
    });

    // Helper para pausar la ejecución (wait)
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // ADAPTADOR CON LÓGICA DE REINTENTO (RETRY)
    const queryAdapter = async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        
        const MAX_RETRIES = 3;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                // Intentamos ejecutar la consulta
                const result = await pool.query(pgSql, params);
                return result; // Si funciona, retornamos y salimos del loop
            } catch (err) {
                // Analizamos si es un error de conexión/timeout
                const isConnectionError = err.message.includes('timeout') || 
                                          err.message.includes('connect') || 
                                          err.message.includes('closed');

                if (isConnectionError && attempt < MAX_RETRIES) {
                    console.warn(`--> [DB WARNING] Intento ${attempt} falló (${err.message}). Reintentando en 1.5s...`);
                    // Esperamos 1.5 segundos antes de reintentar
                    await wait(1500);
                    continue; // Pasamos al siguiente intento
                }
                
                // Si no es error de conexión o ya agotamos intentos, lanzamos el error
                console.error(`--> [DB FATAL] Falló definitivamente tras ${attempt} intentos.`);
                throw err;
            }
        }
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

// --- Helper para sanitizar números (CORRECCIÓN DEL ERROR) ---
// Convierte "" (string vacío) o undefined a null, para que Postgres no falle con tipos INTEGER/REAL
const sanitizeNumber = (val) => {
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
};

// --- Helper para crear Slugs ---
const createSlug = (text) => {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')     // Reemplazar espacios con -
        .replace(/[^\w\-]+/g, '') // Eliminar caracteres no palabras
        .replace(/\-\-+/g, '-')   // Reemplazar múltiples - con uno solo
        + '-' + Math.floor(Math.random() * 1000); // Añadir sufijo aleatorio para unicidad
};

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
            res.status(200).json({ message: "Inicio de sesión exitoso.", token });
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
        let user = await get('SELECT id, usuario, nombre, apellido, dni, ruc, empresa, company_logo, celular, correo, role, subscription_tier, trial_ends_at FROM users WHERE id = ?', [userId]);
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
    const { nombre, apellido, dni, ruc, empresa, company_logo, celular, correo } = req.body;
    try {
        await run('UPDATE users SET nombre = ?, apellido = ?, dni = ?, ruc = ?, empresa = ?, company_logo = ?, celular = ?, correo = ? WHERE id = ?', [nombre, apellido, dni, ruc, empresa, company_logo, celular, correo, userId]);
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

// --- Fincas ---
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
    console.log("--> [START] Intentando crear finca...");
    const userId = req.user.id;
    // Agregamos departamento, provincia, distrito
    let { propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, certificaciones_json, premios_json, foto_productor, numero_trabajadores } = req.body;
    const id = require('crypto').randomUUID();

    // LOG 2: Ver tamaño del payload que llegó al servidor
    const payloadSize = JSON.stringify(req.body).length;
    console.log(`--> [PAYLOAD] Tamaño recibido: ${(payloadSize/1024/1024).toFixed(2)} MB`);
    
    altura = sanitizeNumber(altura);
    superficie = sanitizeNumber(superficie);
    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const safeParam = (val) => (val === undefined ? null : val);

    const params = [
        safeParam(id),
        safeParam(userId),
        safeParam(propietario),
        safeParam(dni_ruc),
        safeParam(nombre_finca),
        safeParam(pais),
        safeParam(departamento),
        safeParam(provincia),
        safeParam(distrito),
        safeParam(ciudad),
        safeParam(altura),
        safeParam(superficie),
        JSON.stringify(coordenadas || null), // JSON nunca debe ser undefined
        safeParam(telefono),
        safeParam(historia),
        JSON.stringify(imagenes_json || []),
        JSON.stringify(certificaciones_json || []),
        JSON.stringify(premios_json || []),
        safeParam(foto_productor),
        safeParam(numero_trabajadores)
    ];

    try {
        console.log("--> [DB] Conectando para insertar...");
        await run(
            'INSERT INTO fincas (id, user_id, propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, certificaciones_json, premios_json, foto_productor, numero_trabajadores) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', 
            [id, userId, propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, JSON.stringify(coordenadas), telefono, historia, JSON.stringify(imagenes_json || []), JSON.stringify(certificaciones_json || []), JSON.stringify(premios_json || []), foto_productor, numero_trabajadores]
        );
        console.log("--> [SUCCESS] Finca guardada en DB");
        res.status(201).json({ message: "Finca creada" });
    } catch (err) { 
        console.error("--> [ERROR] Falló la inserción en DB:", err);
        console.error("--> Detalle completo:", JSON.stringify(err, Object.getOwnPropertyNames(err)));
        res.status(500).json({ error: err.message }); 
    }
};

const updateFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    // Agregamos departamento, provincia, distrito
    let { propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, certificaciones_json, premios_json, foto_productor, numero_trabajadores } = req.body;
    
    altura = sanitizeNumber(altura);
    superficie = sanitizeNumber(superficie);
    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const sql = 'UPDATE fincas SET propietario = ?, dni_ruc = ?, nombre_finca = ?, pais = ?, departamento = ?, provincia = ?, distrito = ?, ciudad = ?, altura = ?, superficie = ?, coordenadas = ?, telefono = ?, historia = ?, imagenes_json = ?, certificaciones_json = ?, premios_json = ?, foto_productor = ?, numero_trabajadores = ? WHERE id = ? AND user_id = ?';
    try {
        const result = await run(sql, [propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, JSON.stringify(coordenadas), telefono, historia, JSON.stringify(imagenes_json || []), JSON.stringify(certificaciones_json || []), JSON.stringify(premios_json || []), foto_productor, numero_trabajadores, id, userId]);
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

// --- Procesadoras ---
const getProcesadoras = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await all('SELECT * FROM procesadoras WHERE user_id = ? ORDER BY nombre_comercial', [userId]);
        const procesadoras = rows.map(p => ({ 
            ...p, 
            premios_json: safeJSONParse(p.premios_json || '[]'),
            certificaciones_json: safeJSONParse(p.certificaciones_json || '[]'),
            coordenadas: safeJSONParse(p.coordenadas || 'null'),
            imagenes_json: safeJSONParse(p.imagenes_json || '[]')
        }));
        res.status(200).json(procesadoras);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createProcesadora = async (req, res) => {
    const userId = req.user.id;
    // CAMBIO: Quitamos tipo_empresa, agregamos departamento, provincia, distrito
    let { ruc, razon_social, nombre_comercial, pais, ciudad, departamento, provincia, distrito, direccion, telefono, premios_json, certificaciones_json, coordenadas, imagenes_json, numero_trabajadores } = req.body;
    const id = require('crypto').randomUUID();
    
    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const sql = 'INSERT INTO procesadoras (id, user_id, ruc, razon_social, nombre_comercial, pais, ciudad, departamento, provincia, distrito, direccion, telefono, premios_json, certificaciones_json, coordenadas, imagenes_json, numero_trabajadores) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    try {
        await run(sql, [id, userId, ruc, razon_social, nombre_comercial, pais, ciudad, departamento, provincia, distrito, direccion, telefono, JSON.stringify(premios_json || []), JSON.stringify(certificaciones_json || []), coordenadas, JSON.stringify(imagenes_json || []), numero_trabajadores]);
        res.status(201).json({ message: "Procesadora creada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    // CAMBIO: Quitamos tipo_empresa, agregamos departamento, provincia, distrito
    let { ruc, razon_social, nombre_comercial, pais, ciudad, departamento, provincia, distrito, direccion, telefono, premios_json, certificaciones_json, coordenadas, imagenes_json, numero_trabajadores } = req.body;
    
    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const sql = 'UPDATE procesadoras SET ruc = ?, razon_social = ?, nombre_comercial = ?, pais = ?, ciudad = ?, departamento = ?, provincia = ?, distrito = ?, direccion = ?, telefono = ?, premios_json = ?, certificaciones_json = ?, coordenadas = ?, imagenes_json = ?, numero_trabajadores = ? WHERE id = ? AND user_id = ?';
    try {
        await run(sql, [ruc, razon_social, nombre_comercial, pais, ciudad, departamento, provincia, distrito, direccion, telefono, JSON.stringify(premios_json || []), JSON.stringify(certificaciones_json || []), coordenadas, JSON.stringify(imagenes_json || []), numero_trabajadores, id, userId]);
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
        const catalog = require('./default-templates.json').templates;
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
        const catalog = require('./default-templates.json').templates;
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
        const parsedStages = stages.map(s => ({...s, campos_json: safeJSONParse(s.campos_json)}));
        res.status(200).json(parsedStages);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createStage = async (req, res) => {
    const { templateId } = req.params;
    const { nombre_etapa,  descripcion, campos_json } = req.body;
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

const getBatchesTree = async (req, res) => {
    const userId = req.user.id;
    try {
        const allBatches = await all('SELECT * FROM batches', []);
        const batchesProcessed = allBatches.map(b => ({ ...b, data: safeJSONParse(b.data), is_locked: !!b.is_locked, children: [] }));
        const batchMap = {};
        batchesProcessed.forEach(b => { batchMap[b.id] = b; });
        const allRoots = [];
        batchesProcessed.forEach(b => {
            if (b.parent_id && batchMap[b.parent_id]) { batchMap[b.parent_id].children.push(b); } else { allRoots.push(b); }
        });
        const userRoots = allRoots.filter(root => root.user_id === userId);
        res.status(200).json(userRoots);
    } catch (err) { res.status(500).json({ error: "Error batches." }); }
};

const checkBatchOwnership = async (batchId, userId) => {
    const targetBatch = await get('SELECT id, user_id, parent_id, is_locked FROM batches WHERE id = ?', [batchId]);
    if (!targetBatch) return null;
    let ownerId = targetBatch.user_id;
    if (!ownerId) {
        const root = await get(`WITH RECURSIVE ancestry AS (SELECT id, parent_id, user_id FROM batches WHERE id = ? UNION ALL SELECT b.id, b.parent_id, b.user_id FROM batches b JOIN ancestry a ON b.id = a.parent_id) SELECT user_id FROM ancestry WHERE user_id IS NOT NULL LIMIT 1`, [batchId]);
        if (root) ownerId = root.user_id;
    }
    return ownerId == userId ? targetBatch : null;
};

// --- Lotes (con Generación de ID en Backend) ---
const generateUniqueLoteId = async (prefix) => {
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

// --- ACOPIOS (NUEVO MÓDULO) ---

const getAcquisitions = async (req, res) => {
    const userId = req.user.id;
    try {
        // MODIFICADO: Filtrar solo registros activos (no borrados lógicamente)
        const rows = await all('SELECT * FROM acquisitions WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC', [userId]);
        const result = rows.map(r => ({
            ...r,
            imagenes_json: safeJSONParse(r.imagenes_json || '[]'),
            data_adicional: safeJSONParse(r.data_adicional || '{}')
        }));
        res.status(200).json(result);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createAcquisition = async (req, res) => {
    const userId = req.user.id;
    const { nombre_producto, tipo_acopio, subtipo, fecha_acopio, peso_kg, precio_unitario, finca_origen, observaciones, imagenes_json, data_adicional } = req.body;
    
    // Generar ID único para el acopio (Ej: ACP-X821)
    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `ACP-${randomPart}`;

    try {
        await run(
            'INSERT INTO acquisitions (id, user_id, nombre_producto, tipo_acopio, subtipo, fecha_acopio, peso_kg, precio_unitario, finca_origen, observaciones, imagenes_json, data_adicional) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, userId, nombre_producto, tipo_acopio, subtipo, fecha_acopio, peso_kg, precio_unitario, finca_origen, observaciones, JSON.stringify(imagenes_json), JSON.stringify(data_adicional)]
        );
        res.status(201).json({ message: "Acopio registrado", id });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteAcquisition = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    try {
        // 1. Verificar si el acopio ya fue usado en algún lote de producción
        const usageCheck = await get('SELECT id FROM batches WHERE acquisition_id = ? LIMIT 1', [id]);

        if (usageCheck) {
            // CASO A: Tiene historial -> Eliminación Lógica (Soft Delete)
            await run('UPDATE acquisitions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [id, userId]);
            res.status(200).json({ 
                message: "El acopio tiene procesos vinculados. Se ha archivado (eliminación lógica) para mantener la trazabilidad.", 
                type: 'soft' 
            });
        } else {
            // CASO B: No tiene historial -> Eliminación Física (Hard Delete)
            const result = await run('DELETE FROM acquisitions WHERE id = ? AND user_id = ?', [id, userId]);
            if (result.changes === 0) return res.status(404).json({ error: "Acopio no encontrado." });
            res.status(204).send(); // No content
        }
    } catch (err) { 
        console.error("Error deleteAcquisition:", err);
        res.status(500).json({ error: err.message }); 
    }
};

const updateAcquisition = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { nombre_producto, tipo_acopio, subtipo, fecha_acopio, peso_kg, precio_unitario, finca_origen, observaciones, imagenes_json, data_adicional } = req.body;

    try {
        const result = await run(
            'UPDATE acquisitions SET nombre_producto = ?, tipo_acopio = ?, subtipo = ?, fecha_acopio = ?, peso_kg = ?, precio_unitario = ?, finca_origen = ?, observaciones = ?, imagenes_json = ?, data_adicional = ? WHERE id = ? AND user_id = ?',
            [nombre_producto, tipo_acopio, subtipo, fecha_acopio, peso_kg, precio_unitario, finca_origen, observaciones, JSON.stringify(imagenes_json), JSON.stringify(data_adicional), id, userId]
        );
        
        if (result.changes === 0) return res.status(404).json({ error: "Acopio no encontrado o sin permisos." });
        
        res.status(200).json({ message: "Acopio actualizado correctamente" });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

const createBatch = async (req, res) => {
    const userId = req.user.id;
    let { plantilla_id, etapa_id, parent_id, data, producto_id, acquisition_id, system_template_name, stage_name, stage_order } = req.body;
    
    try {
        // JIT Template
        if ((!plantilla_id || !etapa_id) && system_template_name && stage_name) {
            const resolved = await ensureTemplateAndStageExists(userId, system_template_name, stage_name, stage_order);
            plantilla_id = resolved.plantilla_id;
            etapa_id = resolved.etapa_id;
        }

        const stage = await get('SELECT nombre_etapa FROM etapas_plantilla WHERE id = ?', [etapa_id]);
        if (!stage) return res.status(404).json({ error: "Etapa no encontrada." });
        
        const prefix = stage.nombre_etapa.substring(0, 3).toUpperCase();
        const newId = await generateUniqueBatchId(prefix);
        data.id = newId;

        let finalProductId = null;
        if (producto_id) finalProductId = producto_id;
        else if (data.productoFinal?.value) finalProductId = data.productoFinal.value;

        if (acquisition_id) await run("UPDATE acquisitions SET estado = 'procesado' WHERE id = ? AND user_id = ?", [acquisition_id, userId]);

        let sql, params;
        if (!parent_id) {
            sql = 'INSERT INTO batches (id, user_id, plantilla_id, etapa_id, parent_id, data, producto_id, acquisition_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
            params = [data.id, userId, plantilla_id, etapa_id, null, JSON.stringify(data), finalProductId, acquisition_id || null];
        } else {
            const ownerInfo = await checkBatchOwnership(parent_id, userId);
            if (!ownerInfo) return res.status(403).json({ error: "No tienes permiso." });
            const parentBatch = await get('SELECT plantilla_id FROM batches WHERE id = ?', [parent_id]);
            sql = 'INSERT INTO batches (id, plantilla_id, etapa_id, parent_id, data, producto_id) VALUES (?, ?, ?, ?, ?, ?)';
            params = [data.id, parentBatch.plantilla_id, etapa_id, parent_id, JSON.stringify(data), finalProductId];
        }
        await run(sql, params);
        res.status(201).json({ message: "Lote creado", id: data.id });
    } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
};

const updateBatch = async (req, res) => {
    const { id } = req.params; const { data, producto_id } = req.body;
    const targetBatch = await checkBatchOwnership(id, req.user.id);
    if (!targetBatch) return res.status(403).json({ error: "Sin permiso." });
    if (targetBatch.is_locked) return res.status(409).json({ error: "Lote bloqueado." });

    let finalProductId = undefined;
    if (producto_id !== undefined) finalProductId = producto_id === "" ? null : producto_id;
    else if (data && data.productoFinal?.value) finalProductId = data.productoFinal.value;

    try {
        if (finalProductId !== undefined) await run('UPDATE batches SET data = ?, producto_id = ? WHERE id = ?', [JSON.stringify(data), finalProductId, id]);
        else await run('UPDATE batches SET data = ? WHERE id = ?', [JSON.stringify(data), id]);
        res.status(200).json({ message: "Lote actualizado" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteBatch = async (req, res) => {
    const { id } = req.params;
    const targetBatch = await checkBatchOwnership(id, req.user.id);
    if (!targetBatch) return res.status(403).json({ error: "Sin permiso." });
    if (targetBatch.is_locked) return res.status(409).json({ error: "Lote bloqueado." });
    try { await run('DELETE FROM batches WHERE id = ?', [id]); res.status(204).send(); } catch (err) { res.status(500).json({ error: err.message }); }
};

const finalizeBatch = async (req, res) => {
    const { id } = req.params; const userId = req.user.id;
    const targetBatch = await checkBatchOwnership(id, userId);
    if (!targetBatch) return res.status(403).json({ error: "Sin permiso." });
    if (targetBatch.is_locked) return res.status(409).json({ error: "Ya finalizado." });

    try {
        const rows = await all(`WITH RECURSIVE trace AS (SELECT * FROM batches WHERE id = ? UNION ALL SELECT b.* FROM batches b INNER JOIN trace t ON b.id = t.parent_id) SELECT * FROM trace;`, [id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });

        const rootBatch = rows.find(r => !r.parent_id);
        const [templateInfo, allStages, ownerInfo, acopioData, productoInfo] = await Promise.all([
            get('SELECT nombre_producto FROM plantillas_proceso WHERE id = ?', [rootBatch.plantilla_id]),
            all('SELECT id, nombre_etapa, descripcion, orden, campos_json, fase FROM etapas_plantilla WHERE plantilla_id = ? ORDER BY orden', [rootBatch.plantilla_id]),
            get('SELECT empresa, company_logo, subscription_tier FROM users WHERE id = ?', [rootBatch.user_id]),
            rootBatch.acquisition_id ? get('SELECT * FROM acquisitions WHERE id = ?', [rootBatch.acquisition_id]) : null,
            targetBatch.producto_id ? get('SELECT * FROM productos WHERE id = ?', [targetBatch.producto_id]) : null
        ]);

        // CORRECCIÓN: Obtener procesadoras para guardar en el snapshot
        const procesadorasList = await all('SELECT * FROM procesadoras WHERE user_id = ?', [ownerId]);
        const procesadorasData = procesadorasList.map(p => ({
            ...p,
            coordenadas: safeJSONParse(p.coordenadas || 'null'),
            imagenes_json: safeJSONParse(p.imagenes_json || '[]'),
            premios_json: safeJSONParse(p.premios_json || '[]'),
            certificaciones_json: safeJSONParse(p.certificaciones_json || '[]')
        }));

        const historySnapshot = { productName: templateInfo.nombre_producto, ownerInfo, stages: [], fincaData: null, procesadorasData: procesadorasData, acopioData: acopioData ? { ...acopioData, data_adicional: safeJSONParse(acopioData.data_adicional) } : null, productoFinal: null, nutritionalData: null, perfilSensorialData: null, ruedaSaborData: null, maridajesRecomendados: {}, generatedAt: new Date().toISOString() };

        if (productoInfo) {
             historySnapshot.productoFinal = { ...productoInfo, imagenes_json: safeJSONParse(productoInfo.imagenes_json), premios_json: safeJSONParse(productoInfo.premios_json) };
             if (productoInfo.receta_nutricional_id) {
                 const receta = await get('SELECT * FROM recetas_nutricionales WHERE id = ?', [productoInfo.receta_nutricional_id]);
                 if(receta) { const ing = await all('SELECT * FROM ingredientes_receta WHERE receta_id = ?', [receta.id]); historySnapshot.nutritionalData = { ...receta, ingredientes: ing.map(i => ({...i, nutrientes_base_json: safeJSONParse(i.nutrientes_base_json)})) }; }
             }
        }

        // --- DESGLOSE ACOPIO ---
        if (historySnapshot.acopioData) {
            const ad = historySnapshot.acopioData.data_adicional || {};
            const imgs = safeJSONParse(acopioData.imagenes_json || '{}'); // Cargar mapa de imágenes

            if (acopioData.finca_origen) {
                 const finca = await get('SELECT * FROM fincas WHERE nombre_finca = ? AND user_id = ?', [acopioData.finca_origen, userId]);
                 if(finca) historySnapshot.fincaData = { ...finca, coordenadas: safeJSONParse(finca.coordenadas), imagenes_json: safeJSONParse(finca.imagenes_json), certificaciones_json: safeJSONParse(finca.certificaciones_json), premios_json: safeJSONParse(finca.premios_json) };
            }
            const acopioStagesDef = allStages.filter(s => s.fase === 'acopio' || (s.orden <= 3 && s.nombre_etapa.match(/(cosecha|ferment|secado)/i)));
            acopioStagesDef.forEach(stageDef => {
                const suffix = `__${stageDef.orden}`;
                let stageData = {}; let dataFound = false;

                // Datos
                Object.keys(ad).forEach(key => { if (key.endsWith(suffix)) { stageData[key.split('__')[0]] = ad[key]; dataFound = true; } });
                const fields = safeJSONParse(stageDef.campos_json);
                [...(fields.entradas||[]), ...(fields.variables||[]), ...(fields.salidas||[])].map(f => f.name).forEach(fname => { if (!stageData[fname] && ad[fname]) { stageData[fname] = ad[fname]; dataFound = true; } });

                // Imágenes (Cruce con sufijo)
                Object.keys(imgs).forEach(key => {
                    if (key.endsWith(suffix)) {
                         stageData['imageUrl'] = { value: imgs[key], visible: true, nombre: 'Foto' };
                         dataFound = true;
                    }
                });

                if (dataFound) {
                    historySnapshot.stages.push({
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
        
        // ... (Recuperar Perfil Sensorial y Rueda - Lógica igual) ...
        let perfilId = null, ruedaId = null; const rootData = safeJSONParse(rootBatch.data); if (rootData.target_profile_id?.value) perfilId = rootData.target_profile_id.value; if (rootData.target_wheel_id?.value) ruedaId = rootData.target_wheel_id.value; if (!perfilId || !ruedaId) { for (const row of rows) { const rd = safeJSONParse(row.data); if (!perfilId && rd.tipoPerfil?.value) perfilId = rd.tipoPerfil.value; if (!ruedaId && rd.tipoRuedaSabor?.value) ruedaId = rd.tipoRuedaSabor.value; } }
        if (perfilId) { let perfil = await get('SELECT * FROM perfiles WHERE id = ?', [perfilId]); if (!perfil && isNaN(perfilId)) perfil = await get('SELECT * FROM perfiles WHERE nombre = ? AND user_id = ?', [perfilId, userId]); if (perfil) { historySnapshot.perfilSensorialData = safeJSONParse(perfil.perfil_data); if (perfil.tipo === 'cacao') { const allCafes = await all("SELECT * FROM perfiles WHERE tipo = 'cafe' AND user_id = ?", [userId]); const recCafe = allCafes.map(cafe => ({ producto: { ...cafe, perfil_data: safeJSONParse(cafe.perfil_data) }, puntuacion: calcularMaridajeCacaoCafe(historySnapshot.perfilSensorialData, safeJSONParse(cafe.perfil_data)) })).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 3); historySnapshot.maridajesRecomendados = { cafe: recCafe }; } } }
        if (ruedaId) { const rueda = await get('SELECT * FROM ruedas_sabores WHERE id = ?', [ruedaId]); if (rueda) historySnapshot.ruedaSaborData = { ...rueda, notas_json: safeJSONParse(rueda.notas_json) }; }

        rows.sort((a,b) => { const sA = allStages.find(s=>s.id===a.etapa_id)?.orden||0; const sB = allStages.find(s=>s.id===b.etapa_id)?.orden||0; return sA - sB; }).forEach(row => {
            const sInfo = allStages.find(s => s.id === row.etapa_id);
            if(sInfo) historySnapshot.stages.push({ id: row.id, nombre_etapa: sInfo.nombre_etapa, descripcion: sInfo.descripcion, campos_json: safeJSONParse(sInfo.campos_json), data: safeJSONParse(row.data), blockchain_hash: row.blockchain_hash, is_locked: row.is_locked, timestamp: row.created_at });
        });

        const dataToHash = { id, snapshot: historySnapshot, salt: crypto.randomBytes(16).toString('hex') };
        const hash = crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');
        historySnapshot.blockchain_hash = hash;

        await run(`INSERT INTO traceability_registry (id, batch_id, user_id, nombre_producto, gtin, fecha_finalizacion, snapshot_data, blockchain_hash) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET snapshot_data = excluded.snapshot_data, blockchain_hash = excluded.blockchain_hash`,
            [id, id, userId, templateInfo.nombre_producto, historySnapshot.productoFinal?.gtin, new Date().toISOString(), JSON.stringify(historySnapshot), hash]);

        await run('UPDATE batches SET blockchain_hash = ?, is_locked = TRUE WHERE id = ?', [hash, id]);
        let curr = targetBatch.parent_id;
        while(curr) { await run('UPDATE batches SET is_locked = TRUE WHERE id = ?', [curr]); const p = await get('SELECT parent_id FROM batches WHERE id = ?', [curr]); curr = p ? p.parent_id : null; }

        res.status(200).json({ message: "Certificado exitosamente.", hash });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const getTrazabilidad = async (req, res) => {
    const { id } = req.params;
    try {
        const record = await get('SELECT snapshot_data, views FROM traceability_registry WHERE id = ?', [id]);
        if (record) {
            run('UPDATE traceability_registry SET views = views + 1 WHERE id = ?', [id]).catch(()=>{});
            return res.status(200).json(safeJSONParse(record.snapshot_data));
        }

        run('UPDATE batches SET views = COALESCE(views, 0) + 1 WHERE id = ?', [id]).catch(()=>{});
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
                 if(receta) { const ing = await all('SELECT * FROM ingredientes_receta WHERE receta_id = ?', [receta.id]); history.nutritionalData = { ...receta, ingredientes: ing.map(i => ({...i, nutrientes_base_json: safeJSONParse(i.nutrientes_base_json)})) }; }
             }
        }
        
        // --- DESGLOSE ACOPIO ---
        if (history.acopioData) {
            const ad = history.acopioData.data_adicional || {};
            const imgs = safeJSONParse(acopioData.imagenes_json || '{}');
            
            if (acopioData.finca_origen) {
                 const finca = await get('SELECT * FROM fincas WHERE nombre_finca = ? AND user_id = ?', [acopioData.finca_origen, ownerId]);
                 if(finca) history.fincaData = { ...finca, coordenadas: safeJSONParse(finca.coordenadas), imagenes_json: safeJSONParse(finca.imagenes_json), certificaciones_json: safeJSONParse(finca.certificaciones_json), premios_json: safeJSONParse(finca.premios_json) };
            }
            const acopioStagesDef = allStages.filter(s => s.fase === 'acopio' || (s.orden <= 3 && s.nombre_etapa.match(/(cosecha|ferment|secado)/i)));
            acopioStagesDef.forEach(stageDef => {
                const suffix = `__${stageDef.orden}`;
                let stageData = {}; let dataFound = false;
                Object.keys(ad).forEach(key => { if (key.endsWith(suffix)) { stageData[key.split('__')[0]] = ad[key]; dataFound = true; } });
                const fields = safeJSONParse(stageDef.campos_json);
                [...(fields.entradas||[]), ...(fields.variables||[]), ...(fields.salidas||[])].map(f => f.name).forEach(fname => { if (!stageData[fname] && ad[fname]) { stageData[fname] = ad[fname]; dataFound = true; } });
                
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
                    const allCafes = await all("SELECT * FROM perfiles WHERE tipo = 'cafe' AND user_id = ?", [ownerId]);
                    const recCafe = allCafes.map(cafe => ({ producto: { ...cafe, perfil_data: safeJSONParse(cafe.perfil_data) }, puntuacion: calcularMaridajeCacaoCafe(history.perfilSensorialData, safeJSONParse(cafe.perfil_data)) })).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 3);
                    history.maridajesRecomendados = { cafe: recCafe };
                }
            }
        }
        if (ruedaId) {
            const rueda = await get('SELECT * FROM ruedas_sabores WHERE id = ?', [ruedaId]);
            if (rueda) history.ruedaSaborData = { ...rueda, notas_json: safeJSONParse(rueda.notas_json) };
        }

        rows.sort((a,b) => { 
             const sA = allStages.find(s=>s.id===a.etapa_id)?.orden||0; 
             const sB = allStages.find(s=>s.id===b.etapa_id)?.orden||0; 
             return sA - sB; 
        }).forEach(row => {
            const sInfo = allStages.find(s => s.id === row.etapa_id);
            if(sInfo) history.stages.push({ id: row.id, nombre_etapa: sInfo.nombre_etapa, descripcion: sInfo.descripcion, campos_json: safeJSONParse(sInfo.campos_json), data: safeJSONParse(row.data), blockchain_hash: row.blockchain_hash, is_locked: row.is_locked, timestamp: row.created_at });
        });

        res.status(200).json(history);

    } catch (error) { res.status(500).json({ error: "Error interno." }); }
};

const getImmutableBatches = async (req, res) => {
    const userId = req.user.id;
    try {
        const sql = `
            WITH RECURSIVE user_batches AS (
                SELECT id FROM batches WHERE user_id = ?
                UNION ALL
                SELECT l.id 
                FROM batches l 
                JOIN user_batches ub ON l.parent_id = ub.id
            )
            SELECT 
                l.id, 
                l.blockchain_hash, 
                l.created_at,
                l.views,
                l.data,
                p.nombre_producto as tipo_proceso,
                e.nombre_etapa as ultima_etapa,
                prod.gtin, -- <--- NUEVO: Obtenemos el GTIN del producto comercial
                prod.nombre as nombre_comercial, -- Opcional, para mostrar nombre del producto final
                COALESCE(AVG(r.rating), 0) as avg_rating,
                COUNT(r.id) as total_reviews
            FROM batches l
            JOIN user_batches ub ON l.id = ub.id
            JOIN plantillas_proceso p ON l.plantilla_id = p.id
            JOIN etapas_plantilla e ON l.etapa_id = e.id
            LEFT JOIN productos prod ON prod.id = (
                WITH RECURSIVE ancestry AS (
                    SELECT id, parent_id, producto_id FROM batches WHERE id = l.id
                    UNION ALL
                    SELECT parent.id, parent.parent_id, parent.producto_id 
                    FROM batches parent 
                    JOIN ancestry child ON child.parent_id = parent.id
                )
                SELECT producto_id FROM ancestry WHERE producto_id IS NOT NULL LIMIT 1
            )
            LEFT JOIN product_reviews r ON l.id = r.batch_id
            WHERE l.blockchain_hash IS NOT NULL 
            AND l.blockchain_hash != ''
            GROUP BY l.id, p.nombre_producto, e.nombre_etapa, l.created_at, l.views, l.blockchain_hash, l.data, prod.gtin, prod.nombre
            ORDER BY l.created_at DESC
        `;
        
        const rows = await all(sql, [userId]);
        
        const result = rows.map(row => ({
            ...row,
            data: safeJSONParse(row.data)
        }));

        res.status(200).json(result);
    } catch (err) {
        console.error("Error en getImmutableBatches:", err);
        res.status(500).json({ error: err.message });
    }
};

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
            costs: costs.map(c => ({...c, cost_data: safeJSONParse(c.cost_data)}))
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

const getProductos = async (req, res) => {
    const userId = req.user.id;
    try {
        // FILTRO: Solo productos activos (deleted_at IS NULL)
        const sql = `
            SELECT p.*, r.nombre as receta_nutricional_nombre 
            FROM productos p
            LEFT JOIN recetas_nutricionales r ON p.receta_nutricional_id = r.id
            WHERE p.user_id = ? AND p.deleted_at IS NULL
            ORDER BY p.created_at DESC
        `;
        const rows = await all(sql, [userId]);
        
        const productos = rows.map(p => ({
            ...p,
            imagenes_json: safeJSONParse(p.imagenes_json || '[]'),
            premios_json: safeJSONParse(p.premios_json || '[]')
        }));
        res.status(200).json(productos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const createProducto = async (req, res) => {
    const userId = req.user.id;
    // Agregamos receta_nutricional_id
    const { nombre, descripcion, gtin, is_formal_gtin, imagenes_json, ingredientes, tipo_producto, peso, premios_json, receta_nutricional_id } = req.body;
    const id = require('crypto').randomUUID();

    let finalGtin = gtin;
    if (!finalGtin) {
        finalGtin = '999' + Math.floor(10000000000 + Math.random() * 90000000000); 
    }
    
    // Sanitizar receta_id (si viene vacío, es null)
    const recetaId = (receta_nutricional_id && receta_nutricional_id.trim() !== "") ? receta_nutricional_id : null;

    try {
        await run(
            'INSERT INTO productos (id, user_id, nombre, descripcion, gtin, is_formal_gtin, imagenes_json, ingredientes, tipo_producto, peso, premios_json, receta_nutricional_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [id, userId, nombre, descripcion, finalGtin, is_formal_gtin || false, JSON.stringify(imagenes_json || []), ingredientes, tipo_producto, peso, JSON.stringify(premios_json || []), recetaId]
        );
        res.status(201).json({ message: "Producto creado", id });
    } catch (err) {
        if (err.message.includes('UNIQUE')) return res.status(409).json({ error: "Ya existe un producto con este GTIN." });
        res.status(500).json({ error: err.message });
    }
};

const updateProducto = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    // Agregamos receta_nutricional_id
    const { nombre, descripcion, gtin, imagenes_json, ingredientes, tipo_producto, peso, premios_json, receta_nutricional_id } = req.body;

    const recetaId = (receta_nutricional_id && receta_nutricional_id.trim() !== "") ? receta_nutricional_id : null;

    try {
        await run(
            'UPDATE productos SET nombre = ?, descripcion = ?, gtin = ?, imagenes_json = ?, ingredientes = ?, tipo_producto = ?, peso = ?, premios_json = ?, receta_nutricional_id = ? WHERE id = ? AND user_id = ?',
            [nombre, descripcion, gtin, JSON.stringify(imagenes_json || []), ingredientes, tipo_producto, peso, JSON.stringify(premios_json || []), recetaId, id, userId]
        );
        res.status(200).json({ message: "Producto actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteProducto = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    
    try {
        // 1. Verificar uso en lotes de producción (batches)
        const usageCheck = await get('SELECT id FROM batches WHERE producto_id = ? LIMIT 1', [id]);

        if (usageCheck) {
            // CASO A: Usado en trazabilidad -> Soft Delete
            await run('UPDATE productos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', [id, userId]);
            res.status(200).json({ 
                message: "El producto tiene historial de trazabilidad. Se ha archivado (eliminación lógica) para no romper registros antiguos.", 
                type: 'soft' 
            });
        } else {
            // CASO B: Sin uso -> Hard Delete
            const result = await run('DELETE FROM productos WHERE id = ? AND user_id = ?', [id, userId]);
            if (result.changes === 0) return res.status(404).json({ error: "Producto no encontrado." });
            res.status(204).send();
        }
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
            console.log(`[Auto-Clone] Plantilla '${systemTemplateName}' no existe para usuario ${userId}. Creando...`);
            
            const catalogPath = path.join(__dirname, 'default-templates.json');
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

module.exports = {
    registerUser, loginUser, logoutUser, handleGoogleLogin,
    getFincas, createFinca, updateFinca, deleteFinca,
    getProcesadoras, createProcesadora, updateProcesadora, deleteProcesadora,
    getPerfiles, createPerfil, updatePerfil, deletePerfil,
    getTemplates, createTemplate, updateTemplate, deleteTemplate, 
    getSystemTemplates, cloneTemplate, // <-- NUEVAS FUNCIONES EXPORTADAS
    getStagesForTemplate, createStage, updateStage, deleteStage,
    getAcquisitions, createAcquisition, deleteAcquisition, updateAcquisition,
    getBatchesTree, createBatch, updateBatch, deleteBatch, finalizeBatch,
    getTrazabilidad, getImmutableBatches,
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
    getProductos, createProducto, updateProducto, deleteProducto,
    validateDeforestation, getBatchByGtinAndLot,
    addIngredienteReceta, updateIngredientePeso, deleteIngrediente,
    getRecetasNutricionales, createRecetaNutricional, deleteRecetaNutricional, updateRecetaNutricional,
    searchUSDA, getUSDADetails
};