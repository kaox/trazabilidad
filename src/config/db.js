const crypto = require('crypto');
const environment = process.env.NODE_ENV || 'development';

let get, all, run;

if (environment === 'production') {
    // 1. Usamos el Pool de conexiones de 'pg' en lugar de Neon
    const { Pool } = require('pg');

    // Asegúrate de cambiar el nombre de la variable en Vercel a DATABASE_URL
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });

    const queryAdapter = async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        try {
            // 2. Ejecutamos la consulta en el pool de Supabase
            const result = await pool.query(pgSql, params);
            return { rows: result.rows, rowCount: result.rowCount };
        } catch (err) {
            console.error("--> [HTTP DB ERROR]", err);
            throw err;
        }
    };

    get = async (sql, params = []) => {
        const result = await queryAdapter(sql, params);
        return result.rows[0];
    };

    all = async (sql, params = []) => {
        const result = await queryAdapter(sql, params);
        return result.rows;
    };

    run = async (sql, params = []) => {
        const upperSql = sql.trim().toUpperCase();
        let sqlToRun = sql;
        if ((upperSql.startsWith('INSERT') || upperSql.startsWith('UPDATE') || upperSql.startsWith('DELETE')) && !upperSql.includes('RETURNING')) {
            sqlToRun = `${sql} RETURNING id`;
        }
        const result = await queryAdapter(sqlToRun, params);
        return {
            changes: result.rowCount,
            lastID: (result.rows[0] && result.rows[0].id) ? result.rows[0].id : null
        };
    };

} else {
    const sqlite3 = require('sqlite3').verbose();
    const db = new sqlite3.Database("./database.db", err => {
        if (err) console.error("SQLite connection error:", err.message);
        else console.log("Conectado a la base de datos SQLite para desarrollo.");
        db.run('PRAGMA foreign_keys = ON;');
    });

    all = (sql, params = []) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));
    get = (sql, params = []) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
    run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function (err) { err ? reject(err) : resolve({ changes: this.changes, lastID: this.lastID }); }));
}

/**
 * Lógica compartida que requiere acceso a la DB
 */
const generateUniqueBatchId = async (prefix) => {
    let id;
    let isUnique = false;
    while (!isUnique) {
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        id = `${prefix}-${randomPart}`;
        const existing = await get('SELECT id FROM batches WHERE id = ?', [id]);
        if (!existing) isUnique = true;
    }
    return id;
};

const saveContactLead = async (req, res) => {
    const { company_id, name, email, message } = req.body;

    if (!company_id || !name || !email || !message) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
    }

    try {
        const id = crypto.randomUUID();
        await run(
            'INSERT INTO contact_leads (id, company_id, name, email, message) VALUES (?, ?, ?, ?, ?)',
            [id, company_id, name, email, message]
        );
        res.status(201).json({ success: true, id });
    } catch (err) {
        console.error('Error al guardar lead:', err);
        res.status(500).json({ error: 'Error interno al guardar contacto' });
    }
};

module.exports = {
    get, all, run,
    generateUniqueBatchId,
    saveContactLead
};