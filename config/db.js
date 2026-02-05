const environment = process.env.NODE_ENV || 'development';

let get, all, run;

if (environment === 'production') {
    const { neon } = require('@neondatabase/serverless');
    const sqlClient = neon(process.env.POSTGRES_URL);

    const queryAdapter = async (sql, params = []) => {
        let paramIndex = 1;
        const pgSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
        try {
            const result = await sqlClient(pgSql, params);
            return { rows: result, rowCount: result.length };
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
            changes: result.rows.length, 
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
    run = (sql, params = []) => new Promise((resolve, reject) => db.run(sql, params, function(err) { err ? reject(err) : resolve({ changes: this.changes, lastID: this.lastID }); }));
}

/**
 * Lógica compartida que requiere acceso a la DB
 * Se mantiene aquí o en una capa de servicios
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

module.exports = {
    get, all, run,
    generateUniqueBatchId
};