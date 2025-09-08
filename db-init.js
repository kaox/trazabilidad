const sqlite3 = require('sqlite3').verbose();
const DB_SOURCE = "database.db";

const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Conectado a la base de datos SQLite.');
        db.serialize(() => {
            console.log('Creando/actualizando tablas...');
            db.run('PRAGMA foreign_keys = ON;');

            // Tabla de Usuarios (sin cambios)
            db.run(`CREATE TABLE IF NOT EXISTS users (
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

            // Tabla de Fincas (con user_id)
            db.run(`CREATE TABLE IF NOT EXISTS fincas (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                propietario TEXT,
                dni_ruc TEXT,
                nombre_finca TEXT NOT NULL,
                superficie REAL,
                coordenadas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, nombre_finca)
            )`, (err) => {
                if (err) console.error("Error en tabla 'fincas'", err.message);
                else console.log("Tabla 'fincas' lista.");
            });

            // Tabla de Lotes (con user_id para las cosechas)
            db.run(`CREATE TABLE IF NOT EXISTS lotes (
                id TEXT PRIMARY KEY,
                user_id INTEGER, -- Solo para cosechas (parent_id IS NULL)
                tipo TEXT NOT NULL,
                parent_id TEXT,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES lotes(id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error("Error en tabla 'lotes'", err.message);
                } else {
                    console.log("Tabla 'lotes' lista.");
                }
                db.close((err) => {
                    if (err) return console.error(err.message);
                    console.log('Conexión a la base de datos cerrada.');
                });
            });

            // Nueva Tabla de Perfiles de Cacao
            db.run(`CREATE TABLE IF NOT EXISTS perfiles_cacao (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                nombre TEXT NOT NULL,
                perfil_data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                UNIQUE(user_id, nombre)
            )`, (err) => {
                if (err) {
                    console.error("Error en tabla 'perfiles_cacao'", err.message);
                } else {
                    console.log("Tabla 'perfiles_cacao' lista.");
                }
                // Cierra la conexión solo después de que el último comando haya terminado
                db.close((err) => {
                    if (err) return console.error(err.message);
                    console.log('Conexión a la base de datos cerrada.');
                });
            });
        });
    }
});

