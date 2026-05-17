const db = require('../config/db');
const crypto = require('crypto');

const getAllByEmpresaId = async (empresaId) => {
    const sql = `SELECT * FROM ruedas_sabores WHERE empresa_id = ? ORDER BY created_at DESC`;
    return await db.all(sql, [empresaId]);
};

const getById = async (id, empresaId) => {
    const sql = `SELECT * FROM ruedas_sabores WHERE id = ? AND empresa_id = ?`;
    return await db.get(sql, [id, empresaId]);
};

const getByToken = async (token) => {
    const sql = `SELECT nombre_rueda, tipo, notas_json FROM ruedas_sabores WHERE public_token = ?`;
    return await db.get(sql, [token]);
};

const create = async (data) => {
    const sql = `
        INSERT INTO ruedas_sabores (
            id, empresa_id, nombre_rueda, tipo, notas_json, public_token
        ) VALUES (?, ?, ?, ?, ?, ?)
    `;
    const id = crypto.randomUUID();
    const token = crypto.randomUUID();
    const params = [
        id,
        data.empresa_id,
        data.nombre_rueda,
        data.tipo,
        JSON.stringify(data.notas_json || []),
        token
    ];
    await db.run(sql, params);
    return id;
};

const update = async (id, empresaId, data) => {
    const sql = `
        UPDATE ruedas_sabores 
        SET nombre_rueda = ?, tipo = ?, notas_json = ?
        WHERE id = ? AND empresa_id = ?
    `;
    const params = [
        data.nombre_rueda,
        data.tipo,
        JSON.stringify(data.notas_json || []),
        id,
        empresaId
    ];
    return await db.run(sql, params);
};

const deleteRueda = async (id, empresaId) => {
    const sql = `DELETE FROM ruedas_sabores WHERE id = ? AND empresa_id = ?`;
    return await db.run(sql, [id, empresaId]);
};

const regenerateToken = async (id, empresaId) => {
    const newToken = crypto.randomUUID();
    const sql = `UPDATE ruedas_sabores SET public_token = ? WHERE id = ? AND empresa_id = ?`;
    await db.run(sql, [newToken, id, empresaId]);
    return newToken;
};

module.exports = {
    getAllByEmpresaId,
    getById,
    getByToken,
    create,
    update,
    delete: deleteRueda,
    regenerateToken
};
