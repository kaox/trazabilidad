const db = require('../config/db');

// Obtener registros inmutables completados en blockchain para un usuario
const getCompletedRegistriesByUserId = async (userId) => {
    const sql = `
        SELECT batch_id as id, blockchain_hash, fecha_finalizacion, snapshot_data
        FROM traceability_registry
        WHERE user_id = ? AND blockchain_hash IS NOT NULL AND blockchain_hash != ''
        ORDER BY fecha_finalizacion DESC
    `;
    return await db.all(sql, [userId]);
};

module.exports = {
    getCompletedRegistriesByUserId
};