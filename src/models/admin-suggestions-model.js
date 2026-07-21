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
        companyId, logo, instagram, facebook, celular, correo // <--- Agregados
    } = userObj;

    // Verificar si el usuario ya existe para evitar errores
    const existing = await db.get('SELECT id FROM users WHERE usuario = ?', [username]);
    if (existing) {
        throw new Error(`El usuario ${username} ya existe.`);
    }

    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 30);

    const sql = `
        INSERT INTO users (
            usuario, password, nombre, apellido, 
            empresa, company_type, company_id, 
            company_logo, role, subscription_tier, trial_ends_at,
            social_instagram, social_facebook,
            celular, correo  -- <--- Columnas Agregadas
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.run(sql, [
        username, password, nombre, apellido,
        empresa, type, companyId,
        logo, 'user', 'emprendedor', trialEndDate.toISOString(),
        instagram, facebook,
        celular, correo // <--- Valores Agregados
    ]);

    return await db.get('SELECT * FROM users WHERE id = ?', [result.lastID]);
};

const updateById = async (id, data) => {
    const {
        name, type, pais, departamento, provincia, distrito,
        social_instagram, social_facebook, logo, coordenadas, product_categories
    } = data;

    // Convert arrays/objects to strings if necessary (assuming SQLite)
    const coordsStr = coordenadas ? (typeof coordenadas === 'string' ? coordenadas : JSON.stringify(coordenadas)) : null;
    const catStr = product_categories ? (typeof product_categories === 'string' ? product_categories : JSON.stringify(product_categories)) : null;

    const sql = `
        UPDATE suggested_companies 
        SET name = ?, type = ?, pais = ?, departamento = ?, provincia = ?, distrito = ?, 
            social_instagram = ?, social_facebook = ?, logo = ?, coordenadas = ?, product_categories = ?
        WHERE id = ?
    `;

    return await db.run(sql, [
        name, type, pais, departamento, provincia, distrito,
        social_instagram, social_facebook, logo, coordsStr, catStr,
        id
    ]);
};

// --- SUGGESTED PRODUCTS ---

// Obtener todos los productos de una empresa sugerida
const getProductsByCompanyId = async (companyId) => {
    return await db.all('SELECT * FROM suggested_products WHERE suggested_company_id = ? ORDER BY created_at DESC', [companyId]);
};

// Crear producto sugerido
const createProduct = async (data) => {
    const { id, suggested_company_id, nombre, tipo_producto, peso, imagen_url } = data;
    const sql = `INSERT INTO suggested_products (id, suggested_company_id, nombre, tipo_producto, peso, imagen_url) VALUES (?, ?, ?, ?, ?, ?)`;
    return await db.run(sql, [id, suggested_company_id, nombre, tipo_producto, peso, imagen_url || null]);
};

// Eliminar producto sugerido
const deleteProductById = async (id) => {
    return await db.run('DELETE FROM suggested_products WHERE id = ?', [id]);
};

// Obtener producto por id
const getProductById = async (id) => {
    return await db.get('SELECT * FROM suggested_products WHERE id = ?', [id]);
};

module.exports = {
    getAll,
    deleteById,
    setMagicToken,
    findByMagicToken,
    findUserBySuggestionId,
    createUserFromSuggestion,
    markAsClaimed,
    updateById,
    getProductsByCompanyId,
    createProduct,
    deleteProductById,
    getProductById
};