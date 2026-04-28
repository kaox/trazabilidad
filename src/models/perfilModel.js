// src/models/perfilModel.js
const db = require('../config/db');
const crypto = require('crypto');

const getAllByEmpresa = async (empresa_id) => {
    return await db.all('SELECT * FROM perfiles WHERE empresa_id = ? ORDER BY created_at DESC', [empresa_id]);
};

const getById = async (id, empresa_id) => {
    return await db.get('SELECT * FROM perfiles WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
};

const getByPublicToken = async (public_token) => {
    return await db.get('SELECT * FROM perfiles WHERE public_token = ?', [public_token]);
};

const create = async (perfilData) => {
    const { id, empresa_id, nombre_perfil, tipo, perfil_data, puntaje_sca } = perfilData;
    const public_token = crypto.randomUUID();
    const perfilDataStr = typeof perfil_data === 'string' ? perfil_data : JSON.stringify(perfil_data);

    const sql = `
        INSERT INTO perfiles (id, empresa_id, nombre_perfil, tipo, perfil_data, puntaje_sca, public_token)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.run(sql, [id, empresa_id, nombre_perfil, tipo, perfilDataStr, puntaje_sca, public_token]);
    
    return { ...perfilData, public_token };
};

const updateById = async (id, empresa_id, data) => {
    const { nombre_perfil, tipo, perfil_data, puntaje_sca } = data;
    const perfilDataStr = typeof perfil_data === 'string' ? perfil_data : JSON.stringify(perfil_data);

    const sql = `
        UPDATE perfiles
        SET nombre_perfil = ?, tipo = ?, perfil_data = ?, puntaje_sca = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND empresa_id = ?
    `;

    return await db.run(sql, [nombre_perfil, tipo, perfilDataStr, puntaje_sca, id, empresa_id]);
};

const deleteById = async (id, empresa_id) => {
    return await db.run('DELETE FROM perfiles WHERE id = ? AND empresa_id = ?', [id, empresa_id]);
};

module.exports = {
    getAllByEmpresa,
    getById,
    getByPublicToken,
    create,
    updateById,
    deleteById
};
