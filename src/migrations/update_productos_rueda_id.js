const { run, all } = require('../config/db');

async function migrate() {
    console.log("Updating productos table to use TEXT rueda_id...");

    try {
        await run("PRAGMA foreign_keys = OFF;");
        
        // 1. Rename existing table
        await run("ALTER TABLE productos RENAME TO productos_backup;");
        
        // 2. Create new table with TEXT rueda_id and correct FK
        await run(`
            CREATE TABLE productos (
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
                receta_nutricional_id TEXT REFERENCES recetas_nutricionales(id) ON DELETE SET NULL,
                perfil_id INTEGER, -- Legacy
                rueda_id TEXT,    -- Now TEXT
                is_published BOOLEAN DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                deleted_at TIMESTAMP,
                unit_id INTEGER,
                precio NUMERIC,
                currency_id INTEGER,
                finca_id TEXT,
                atributos_dinamicos JSON DEFAULT '{}',
                perfil_sensorial_id TEXT,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (receta_nutricional_id) REFERENCES recetas_nutricionales(id) ON DELETE SET NULL,
                FOREIGN KEY (perfil_sensorial_id) REFERENCES perfiles(id) ON DELETE SET NULL,
                FOREIGN KEY (rueda_id) REFERENCES ruedas_sabores(id) ON DELETE SET NULL,
                UNIQUE(user_id, gtin)
            )`);

        // 3. Migrate data
        const oldProducts = await all("SELECT * FROM productos_backup");
        const ruedas = await all("SELECT id, nombre_rueda, empresa_id FROM ruedas_sabores");
        const ruedasOld = await all("SELECT id, nombre_rueda, user_id FROM ruedas_sabores_old");

        console.log(`Migrating ${oldProducts.length} products...`);

        for (const prod of oldProducts) {
            let newRuedaId = null;
            if (prod.rueda_id) {
                const oldRueda = ruedasOld.find(r => r.id == prod.rueda_id);
                if (oldRueda) {
                    const newRueda = ruedas.find(r => r.nombre_rueda === oldRueda.nombre_rueda && r.empresa_id === oldRueda.user_id);
                    if (newRueda) newRuedaId = newRueda.id;
                }
            }
            
            const sql = `
                INSERT INTO productos (
                    id, user_id, nombre, descripcion, tipo_producto, peso, gtin, is_formal_gtin,
                    imagen_url, imagenes_json, ingredientes, premios_json, receta_nutricional_id,
                    perfil_id, rueda_id, is_published, created_at, deleted_at, unit_id,
                    precio, currency_id, finca_id, atributos_dinamicos, perfil_sensorial_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            
            await run(sql, [
                prod.id, prod.user_id, prod.nombre, prod.descripcion, prod.tipo_producto, prod.peso, prod.gtin, prod.is_formal_gtin,
                prod.imagen_url, prod.imagenes_json, prod.ingredientes, prod.premios_json, prod.receta_nutricional_id,
                prod.perfil_id, newRuedaId, prod.is_published, prod.created_at, prod.deleted_at, prod.unit_id,
                prod.precio, prod.currency_id, prod.finca_id, prod.atributos_dinamicos, prod.perfil_sensorial_id
            ]);
        }

        // 4. Cleanup
        await run("DROP TABLE productos_backup;");
        await run("PRAGMA foreign_keys = ON;");
        
        console.log("Migration finished successfully.");
    } catch (e) {
        console.error("Migration failed:", e);
        await run("PRAGMA foreign_keys = ON;");
    }
}

if (require.main === module) {
    migrate().then(() => process.exit(0)).catch(e => {
        console.error(e);
        process.exit(1);
    });
}
