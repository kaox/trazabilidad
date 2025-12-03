const sqlite3 = require('sqlite3').verbose();
const DB_SOURCE = "database.db";

// Helper para convertir db.run en una promesa
function runQuery(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
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
                    subscription_tier TEXT DEFAULT 'artesano',
                    trial_ends_at TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )`);
            console.log("Tabla 'users' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS fincas (
                    id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    propietario TEXT,
                    dni_ruc TEXT,
                    nombre_finca TEXT NOT NULL,
                    pais TEXT,
                    ciudad TEXT,
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
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
                    tipo_empresa TEXT,
                    pais TEXT,
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
                    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE
                )`);
            console.log("Tabla 'etapas_plantilla' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS lotes (
                    id TEXT PRIMARY KEY,
                    plantilla_id INTEGER,
                    etapa_id INTEGER NOT NULL,
                    user_id INTEGER,
                    parent_id TEXT,
                    data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (plantilla_id) REFERENCES plantillas_proceso(id) ON DELETE CASCADE,
                    FOREIGN KEY (etapa_id) REFERENCES etapas_plantilla(id) ON DELETE CASCADE,
                    FOREIGN KEY (parent_id) REFERENCES lotes(id) ON DELETE CASCADE,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
                    lote_id TEXT PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    cost_data JSONB NOT NULL,
                    FOREIGN KEY (lote_id) REFERENCES lotes(id) ON DELETE CASCADE
                )`);
            console.log("Tabla 'lote_costs' lista.");

            await runQuery(db, `
                CREATE TABLE IF NOT EXISTS product_reviews (
                    id SERIAL PRIMARY KEY,
                    lote_id TEXT NOT NULL REFERENCES lotes(id) ON DELETE CASCADE,
                    user_email TEXT NOT NULL,
                    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                    comment TEXT,
                    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(lote_id, user_email)
                )`);
            console.log("Tabla 'plantillas_proceso' lista.");

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

