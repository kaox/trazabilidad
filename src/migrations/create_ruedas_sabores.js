const { run, all } = require('../config/db');
const crypto = require('crypto');

async function migrate() {
    console.log("Starting migration for ruedas_sabores table...");

    try {
        // Check if table exists and its structure
        const tableInfo = await all("PRAGMA table_info(ruedas_sabores)");
        
        if (tableInfo.length > 0) {
            const hasUUID = tableInfo.some(col => col.name === 'id' && col.type === 'TEXT');
            if (hasUUID) {
                console.log("ruedas_sabores already using UUID schema. Skipping.");
                return;
            }
            console.log("Old ruedas_sabores table detected. Migrating to new schema...");
            await run("ALTER TABLE ruedas_sabores RENAME TO ruedas_sabores_old");
        }

        // Create new table with UUID and public_token
        await run(`
            CREATE TABLE ruedas_sabores (
                id TEXT PRIMARY KEY,
                empresa_id INTEGER NOT NULL,
                nombre_rueda TEXT NOT NULL,
                tipo TEXT NOT NULL, -- 'cafe' or 'cacao'
                notas_json TEXT NOT NULL,
                public_token TEXT UNIQUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP,
                FOREIGN KEY (empresa_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log("Success: ruedas_sabores table created.");

        // Migrate data if old table exists
        const oldExists = await all("SELECT name FROM sqlite_master WHERE type='table' AND name='ruedas_sabores_old'");
        if (oldExists.length > 0) {
            console.log("Migrating records from ruedas_sabores_old...");
            const oldRecords = await all("SELECT * FROM ruedas_sabores_old");
            for (const row of oldRecords) {
                await run(
                    "INSERT INTO ruedas_sabores (id, empresa_id, nombre_rueda, tipo, notas_json, public_token) VALUES (?, ?, ?, ?, ?, ?)",
                    [crypto.randomUUID(), row.user_id, row.nombre_rueda, row.tipo, row.notas_json, crypto.randomUUID()]
                );
            }
            console.log(`Migrated ${oldRecords.length} records.`);
        }

        console.log("Migration finished.");
    } catch (e) {
        console.error("Migration failed:", e.message);
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(err => {
        console.error(err);
        process.exit(1);
    });
}
