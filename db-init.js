const sqlite3 = require('sqlite3').verbose();
const DB_SOURCE = "database.db";

// Helper para convertir db.run en una promesa
function runQuery(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                if (err.message.includes('duplicate column')) {
                    console.log(`[INFO] Columna ya existe (Saltando): ${sql.substring(0, 30)}...`);
                    resolve();
                    return;
                }
                console.error(`Error ejecutando SQL: ${sql.substring(0, 60)}...`, err.message);
                return reject(err);
            }
            resolve();
        });
    });
}

// Función principal asíncrona para controlar el flujo
async function initializeDatabase() {
    const db = new sqlite3.Database(DB_SOURCE, async (err) => {
        if (err) {
            console.error("Error al conectar con la base de datos:", err.message);
            throw err;
        }
        console.log('Conectado a la base de datos SQLite.');
        
        try {
            console.log('Creando/actualizando tablas...');
            
            await runQuery(db, 'PRAGMA foreign_keys = ON;');

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    usuario TEXT NOT NULL UNIQUE,
                    password TEXT NOT NULL,
                    nombre TEXT, apellido TEXT, dni TEXT, ruc TEXT, empresa TEXT, company_logo TEXT, celular TEXT, correo TEXT,
                    role TEXT DEFAULT 'user',
                    default_currency TEXT DEFAULT 'PEN',
                    default_unit TEXT DEFAULT 'KG',
                    subscription_tier TEXT DEFAULT 'artesano',
                    trial_ends_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
            console.log("Tabla 'users' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS fincas (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    propietario TEXT,
                    dni_ruc TEXT,
                    nombre_finca TEXT NOT NULL,
                    pais TEXT,
                    departamento TEXT, -- Estado/Region
                    provincia TEXT,    -- Ciudad/Provincia
                    distrito TEXT,     -- Municipio/Localidad
                    ciudad TEXT,       -- (Campo legacy o ciudad principal)
                    altura INTEGER,
                    superficie REAL,
                    coordenadas TEXT,
                    telefono TEXT,
                    historia TEXT,
                    imagenes_json TEXT,
                    certificaciones_json TEXT,
                    premios_json TEXT,
                    foto_productor TEXT,
                    numero_trabajadores INTEGER,
                    access_token TEXT UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, nombre_finca)
                )`);
            console.log("Tabla 'fincas' actualizada y lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS procesadoras (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    ruc TEXT NOT NULL,
                    razon_social TEXT NOT NULL,
                    nombre_comercial TEXT,
                    pais TEXT,
                    departamento TEXT,
                    provincia TEXT,
                    distrito TEXT,
                    ciudad TEXT,
                    direccion TEXT,
                    telefono TEXT,
                    coordenadas JSONB,
                    premios_json TEXT,
                    certificaciones_json TEXT,
                    imagenes_json TEXT,
                    numero_trabajadores INTEGER,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, ruc)
                )`);
            console.log("Tabla 'procesadoras' actualizada y lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS plantillas_proceso (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    nombre_producto TEXT NOT NULL,
                    descripcion TEXT,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, nombre_producto)
                )`);
            console.log("Tabla 'plantillas_proceso' lista.");
            
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS etapas_plantilla (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    plantilla_id INTEGER NOT NULL,
                    nombre_etapa TEXT NOT NULL,
                    orden INTEGER NOT NULL,
                    descripcion TEXT,
                    campos_json TEXT NOT NULL,
                    fase TEXT DEFAULT 'procesamiento',
                    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE
                )`);
            console.log("Tabla 'etapas_plantilla' lista.");

            // --- NUEVA TABLA: ACOPIOS (INDEPENDIENTE) ---
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS acquisitions (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    nombre_producto TEXT NOT NULL, -- Ej: Cacao
                    tipo_acopio TEXT NOT NULL, -- Ej: Grano Seco, Baba
                    subtipo TEXT, -- Ej: Lavado, Honey (para cafe)
                    fecha_acopio DATE,
                    peso_kg REAL,
                    precio_unitario REAL,

                    -- DATOS ORIGINALES (Lo que ingresó el usuario)
                    original_quantity REAL,
                    original_price REAL,
                    unit_id INTEGER REFERENCES units_of_measure(id),
                    currency_id INTEGER REFERENCES currencies(id),

                    finca_origen TEXT,
                    observaciones TEXT,
                    imagenes_json TEXT,
                    data_adicional JSONB, -- Para campos extras dinámicos
                    estado TEXT DEFAULT 'disponible', -- disponible, procesado, agotado
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);
            console.log("Tabla 'acquisitions' creada.");

            // --- NUEVA TABLA: BATCHES (PROCESAMIENTO) ---
            // Esta tabla reemplaza funcionalmente a 'lotes' para el nuevo flujo
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS batches (
                    id TEXT PRIMARY KEY, -- Ej: COS-1234
                    plantilla_id INTEGER,
                    etapa_id INTEGER NOT NULL,
                    user_id INTEGER, -- Dueño del lote raíz
                    parent_id TEXT,  -- Relación padre-hijo dentro de batches
                    
                    -- VINCULACIONES CLAVE
                    producto_id TEXT, -- Link a SKU comercial (Tabla productos)
                    acquisition_id TEXT, -- Link a Materia Prima (Tabla acquisitions)
                    
                    data TEXT NOT NULL, -- Datos técnicos JSON
                    
                    -- ESTADOS Y CERTIFICACIÓN
                    blockchain_hash TEXT,
                    is_locked BOOLEAN DEFAULT 0,
                    views INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active', -- active, recall, expired
                    recall_reason TEXT,
                    
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
                    FOREIGN KEY (etapa_id) REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_id) REFERENCES batches(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL,
                    FOREIGN KEY (acquisition_id) REFERENCES acquisitions(id) ON DELETE SET NULL
                )`);

            // --- NUEVA TABLA: TRAZABILIDAD (OPTIMIZADA) ---
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS batch_outputs (
                    id TEXT PRIMARY KEY,
                    batch_id TEXT NOT NULL,
                    product_type TEXT NOT NULL, -- Ej: 'CAFE_ORO', 'CASCARILLA', 'MERMA'
                    quantity REAL NOT NULL,
                    unit_id INTEGER,
                    unit_cost REAL,
                    currency_id INTEGER,
                    output_category TEXT DEFAULT 'principal', -- 'principal', 'subproducto', 'merma'
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE,
                    FOREIGN KEY (unit_id) REFERENCES units_of_measure(id) ON DELETE SET NULL,
                    FOREIGN KEY (currency_id) REFERENCES currencies(id) ON DELETE SET NULL
                )`);
            console.log("Tabla 'batch_outputs' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS lotes (
                    id TEXT PRIMARY KEY,
                    plantilla_id INTEGER,
                    etapa_id INTEGER NOT NULL,
                    user_id INTEGER,
                    parent_id TEXT,
                    producto_id TEXT,
                    acquisition_id TEXT,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    blockchain_hash TEXT,
                    is_locked BOOLEAN DEFAULT 0,
                    views INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'active',
                    recall_reason TEXT,
                    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
                    FOREIGN KEY (etapa_id) REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_id) REFERENCES lotes(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL,
                    FOREIGN KEY (acquisition_id) REFERENCES acquisitions(id) ON DELETE SET NULL
                )`);
            console.log("Tabla 'lotes' lista.");
            
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS perfiles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    nombre TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    perfil_data TEXT NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, nombre, tipo)
                )`);
            console.log("Tabla 'perfiles' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS ruedas_sabores (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    nombre_rueda TEXT NOT NULL,
                    tipo TEXT NOT NULL,
                    notas_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, nombre_rueda)
                )`);
            console.log("Tabla 'ruedas_sabores' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS blends (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    nombre_blend TEXT NOT NULL,
                    tipo_producto TEXT NOT NULL,
                    componentes_json TEXT NOT NULL,
                    perfil_final_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, nombre_blend)
                )`);
            console.log("Tabla 'blends' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS recetas_chocolate (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    nombre_receta TEXT NOT NULL,
                    componentes_json JSONB NOT NULL,
                    perfil_final_json JSONB NOT NULL,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(user_id, nombre_receta)
                )`);
            console.log("Tabla 'recetas_chocolate' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS lote_costs (
                    batch_id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    cost_data JSONB NOT NULL,
                    FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE CASCADE
                )`);
            console.log("Tabla 'lote_costs' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS product_reviews (
                    id SERIAL PRIMARY KEY,
                    batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
                    user_email TEXT NOT NULL,
                    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    comment TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(batch_id, user_email)
                )`);
            console.log("Tabla 'product_reviews' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS blog_posts (
                    id TEXT PRIMARY KEY, 
                    title TEXT NOT NULL,
                    slug TEXT NOT NULL UNIQUE,
                    summary TEXT,
                    content TEXT NOT NULL,
                    cover_image TEXT,
                    author_id INTEGER REFERENCES users(id),
                    is_published BOOLEAN DEFAULT FALSE,
                    published_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
            console.log("Tabla 'blog_posts' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS productos (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    tipo_producto TEXT,
                    peso TEXT,
                    gtin TEXT,
                    is_formal_gtin BOOLEAN DEFAULT 0,
                    imagen_url TEXT, 
                    imagenes_json TEXT, 
                    ingredientes TEXT,
                    premios_json TEXT,
                    receta_nutricional_id TEXT REFERENCES recetas_nutricionales(id) ON DELETE SET NULL, -- NUEVO CAMPO
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP, -- NUEVO CAMPO AUDITORÍA,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                    UNIQUE(user_id, gtin)
                )`);
            console.log("Tabla 'productos' lista (Estructura Actualizada).");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS recetas_nutricionales (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    nombre TEXT NOT NULL,
                    descripcion TEXT,
                    peso_porcion_gramos REAL DEFAULT 100,
                    porciones_envase REAL DEFAULT 1,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    deleted_at TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )`);

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS ingredientes_receta (
                    id TEXT PRIMARY KEY,
                    receta_id TEXT NOT NULL,
                    usda_id TEXT,
                    nombre TEXT NOT NULL,
                    peso_gramos REAL NOT NULL,
                    nutrientes_base_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (receta_id) REFERENCES recetas_nutricionales(id) ON DELETE CASCADE
                )`);
            
            // 10. CATÁLOGO DE INGREDIENTES (CACHE LOCAL) <-- NUEVO
            // Esta tabla almacena los ingredientes obtenidos de APIs externas para no depender siempre de ellas.
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS ingredientes_catalogo (
                    id TEXT PRIMARY KEY,
                    nombre TEXT NOT NULL,
                    origen TEXT DEFAULT 'off', -- 'local', 'off'
                    codigo_externo TEXT, -- ID externo para evitar duplicados
                    nutrientes_json TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(codigo_externo)
                )`);

            // --- NUEVA TABLA: UNIDADES DE MEDIDA ---
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS units_of_measure (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL UNIQUE,
                    name TEXT,
                    type TEXT NOT NULL, -- 'MASA', 'VOLUMEN', 'UNIDAD'
                    base_factor REAL DEFAULT 1.0, -- Factor para convertir a la unidad base (KG para masa, L para volumen)
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
            console.log("Tabla 'units_of_measure' creada.");

            // Carga inicial Unidades (usando INSERT OR IGNORE para evitar duplicados en re-ejecuciones)
            const initialUnits = [
                ['KG', 'Kilogramo', 'MASA', 1.0],
                ['LB', 'Libra', 'MASA', 0.453592],
                ['G', 'Gramo', 'MASA', 0.001],
                ['TON', 'Tonelada', 'MASA', 1000.0],
                ['QQ', 'Quintal (46kg)', 'MASA', 46.0],
                ['L', 'Litro', 'VOLUMEN', 1.0],
                ['ML', 'Mililitro', 'VOLUMEN', 0.001],
                ['GAL', 'Galón (US)', 'VOLUMEN', 3.78541],
                ['Un', 'Unidad', 'UNIDAD', 1.0]
            ];

            for (const unit of initialUnits) {
                await runQuery(db, `INSERT OR IGNORE INTO units_of_measure (code, name, type, base_factor) VALUES ('${unit[0]}', '${unit[1]}', '${unit[2]}', ${unit[3]})`);
            }
            console.log("Datos iniciales de unidades cargados.");

            // --- NUEVA TABLA: MONEDAS ---
            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS currencies (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code TEXT NOT NULL UNIQUE,
                    name TEXT NOT NULL,
                    symbol TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
            console.log("Tabla 'currencies' creada.");

            // Carga inicial Monedas
            const initialCurrencies = [
                ['USD', 'Dólar Estadounidense', '$'],
                ['PEN', 'Sol Peruano', 'S/'],
                ['EUR', 'Euro', '€'],
                ['COP', 'Peso Colombiano', '$'],
                ['MXN', 'Peso Mexicano', '$']
            ];

            for (const curr of initialCurrencies) {
                await runQuery(db, `INSERT OR IGNORE INTO currencies (code, name, symbol) VALUES ('${curr[0]}', '${curr[1]}', '${curr[2]}')`);
            }
            console.log("Datos iniciales de monedas cargados.");

            console.log('Esquema de base de datos listo.');

        } catch (error) {
            console.error("Falló la inicialización de la base de datos:", error);
        } finally {
            db.close((err) => {
                if (err) return console.error("Error al cerrar la base de datos:", err.message);
                console.log('Conexión a la base de datos cerrada.');
            });
        }
    });
}

initializeDatabase();

