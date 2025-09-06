const sqlite3 = require('sqlite3').verbose();
const DB_SOURCE = "database.db";

// Conecta a la base de datos (la creará si no existe)
const db = new sqlite3.Database(DB_SOURCE, (err) => {
    if (err) {
        console.error(err.message);
        throw err;
    } else {
        console.log('Conectado a la base de datos SQLite.');
        
        // El método serialize asegura que los comandos se ejecuten en orden
        db.serialize(() => {
            console.log('Creando tablas...');
            
            // Habilitar claves foráneas
            db.run('PRAGMA foreign_keys = ON;');

            // Crear tabla de fincas
            db.run(`CREATE TABLE IF NOT EXISTS fincas (
                id TEXT PRIMARY KEY,
                propietario TEXT,
                dni_ruc TEXT,
                nombre_finca TEXT NOT NULL UNIQUE,
                superficie REAL,
                coordenadas TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )`, (err) => {
                if (err) console.error("Error al crear tabla 'fincas'", err.message);
                else console.log("Tabla 'fincas' creada o ya existente.");
            });

            // Crear tabla de lotes
            // El cierre de la base de datos se mueve aquí, al callback del último comando
            db.run(`CREATE TABLE IF NOT EXISTS lotes (
                id TEXT PRIMARY KEY,
                tipo TEXT NOT NULL,
                parent_id TEXT,
                data TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES lotes(id) ON DELETE CASCADE
            )`, (err) => {
                if (err) {
                    console.error("Error al crear tabla 'lotes'", err.message);
                } else {
                    console.log("Tabla 'lotes' creada o ya existente.");
                    console.log('Esquema de base de datos listo.');
                }

                // Cierra la conexión a la base de datos DESPUÉS de ejecutar los comandos
                db.close((err) => {
                    if (err) {
                        return console.error(err.message);
                    }
                    console.log('Conexión a la base de datos cerrada.');
                });
            });

            // Tabla de Usuarios
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
            )`, (err) => {
                if (err) {
                    console.error("Error al crear tabla 'users'", err.message);
                } else {
                    console.log("Tabla 'users' creada o ya existente.");
                }
                db.close((err) => {
                    if (err) return console.error(err.message);
                    console.log('Conexión a la base de datos cerrada.');
                });
            });
        });
    }
});

