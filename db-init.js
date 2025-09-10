const sqlite3 = require('sqlite3').verbose();
const DB_SOURCE = "database.db";

// Helper para convertir db.run en una promesa
function runQuery(db, sql) {
    return new Promise((resolve, reject) => {
        db.run(sql, (err) => {
            if (err) {
                console.error(`Error ejecutando SQL: ${sql}`, err.message);
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

            await runQuery(db, `CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                usuario TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                nombre TEXT,
                apellido TEXT,
                dni TEXT,
                ruc TEXT,
                empresa TEXT,
                celular TEXT,
                correo TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`);
            console.log("Tabla 'users' lista.");

            await runQuery(db, `CREATE TABLE IF NOT EXISTS fincas (
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, nombre_finca)
            )`);
            console.log("Tabla 'fincas' lista.");

            await runQuery(db, `CREATE TABLE IF NOT EXISTS procesadoras (
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, ruc)
            )`);
            console.log("Tabla 'procesadoras' lista.");

            await runQuery(db, `CREATE TABLE IF NOT EXISTS lotes (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                tipo TEXT NOT NULL,
                parent_id TEXT,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES lotes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`);
            console.log("Tabla 'lotes' lista.");
            
            await runQuery(db, `CREATE TABLE IF NOT EXISTS perfiles_cacao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                perfil_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, nombre)
            )`);
            console.log("Tabla 'perfiles_cacao' lista.");

            console.log('Esquema de base de datos listo.');

        } catch (error) {
            console.error("Falló la inicialización de la base de datos:", error);
        } finally {
            // Este bloque se ejecuta siempre, haya o no errores, asegurando que la conexión se cierre.
            db.close((err) => {
                if (err) {
                    return console.error("Error al cerrar la base de datos:", err.message);
                }
                console.log('Conexión a la base de datos cerrada.');
            });
        }
    });
}

// Iniciar el proceso
initializeDatabase();