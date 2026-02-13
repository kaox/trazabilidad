// src/models/suggestionModel.js
const db = require('../config/db');

// Obtener todas las sugerencias
const getAll = async () => {
    return await db.all('SELECT * FROM suggested_companies ORDER BY created_at DESC');
};

// Borrar sugerencia
const deleteById = async (id) => {
    return await db.run('DELETE FROM suggested_companies WHERE id = ?', [id]);
};

// Guardar el token mágico
const setMagicToken = async (id, token) => {
    return await db.run('UPDATE suggested_companies SET magic_token = ? WHERE id = ?', [token, id]);
};

// Buscar por token mágico
const findByMagicToken = async (token) => {
    return await db.get('SELECT * FROM suggested_companies WHERE magic_token = ?', [token]);
};

// Buscar usuario existente asociado a una sugerencia
const findUserBySuggestionId = async (suggestionId) => {
    return await db.get('SELECT * FROM users WHERE company_id = ?', [suggestionId]);
};

// Marcar como reclamada
const markAsClaimed = async (id) => {
    return await db.run("UPDATE suggested_companies SET status = 'claimed', magic_token = NULL WHERE id = ?", [id]);
};

// Crear usuario desde sugerencia (Lógica compleja de SQL)
const createUserFromSuggestion = async (userObj) => {
    const { 
        username, password, nombre, apellido, empresa, type, 
        companyId, logo, instagram, facebook, celular, correo
    } = userObj;

    const sql = `
        INSERT INTO users (
            usuario, password, nombre, apellido, 
            empresa, company_type, company_id, 
            company_logo, role, subscription_tier, 
            social_instagram, social_facebook, celular, correo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.run(sql, [
        username, password, nombre, apellido, empresa, type, 
        companyId, logo, 'user', 'artesano', instagram, facebook, celular, correo
    ]);

    // Devolvemos el usuario recién creado
    return await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
};

const updateById = async (id, data) => {
    const { 
        name, type, pais, departamento, provincia, distrito, 
        social_instagram, social_facebook 
    } = data;

    const sql = `
        UPDATE suggested_companies 
        SET name = ?, type = ?, pais = ?, departamento = ?, provincia = ?, distrito = ?, 
            social_instagram = ?, social_facebook = ?
        WHERE id = ?
    `;

    return await db.run(sql, [
        name, type, pais, departamento, provincia, distrito, 
        social_instagram, social_facebook, 
        id
    ]);
};

module.exports = {
    getAll,
    deleteById,
    setMagicToken,
    findByMagicToken,
    findUserBySuggestionId,
    createUserFromSuggestion,
    markAsClaimed,
    updateById
};