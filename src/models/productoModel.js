const db = require('../config/db');

// Obtener productos activos de un usuario
const getAllByUserId = async (userId) => {
    const sql = `
        SELECT p.*, r.nombre as receta_nutricional_nombre 
        FROM productos p
        LEFT JOIN recetas_nutricionales r ON p.receta_nutricional_id = r.id
        WHERE p.user_id = ? AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
    `;
    return await db.all(sql, [userId]);
};

// Crear un nuevo producto
const create = async (data) => {
    const sql = `
        INSERT INTO productos (
            id, user_id, nombre, descripcion, gtin, is_formal_gtin, 
            imagenes_json, ingredientes, tipo_producto, peso, premios_json, 
            receta_nutricional_id, is_published, perfil_id, rueda_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // El orden de los parámetros debe coincidir con la query
    const params = [
        data.id, data.user_id, data.nombre, data.descripcion, data.gtin, data.is_formal_gtin,
        data.imagenes_json, data.ingredientes, data.tipo_producto, data.peso, data.premios_json,
        data.receta_nutricional_id, data.is_published, data.perfil_id, data.rueda_id
    ];

    return await db.run(sql, params);
};

// Actualizar producto
const update = async (id, userId, data) => {
    const sql = `
        UPDATE productos SET 
            nombre = ?, descripcion = ?, gtin = ?, imagenes_json = ?, 
            ingredientes = ?, tipo_producto = ?, peso = ?, premios_json = ?, 
            receta_nutricional_id = ?, is_published = ?, perfil_id = ?, rueda_id = ? 
        WHERE id = ? AND user_id = ?
    `;

    const params = [
        data.nombre, data.descripcion, data.gtin, data.imagenes_json,
        data.ingredientes, data.tipo_producto, data.peso, data.premios_json,
        data.receta_nutricional_id, data.is_published, data.perfil_id, data.rueda_id,
        id, userId
    ];

    return await db.run(sql, params);
};

// Verificar si el producto se está usando en algún lote
const checkUsageInBatches = async (productId) => {
    return await db.get('SELECT id FROM batches WHERE producto_id = ? LIMIT 1', [productId]);
};

// Eliminación Lógica (Soft Delete): Solo marca la fecha, no borra el registro
const softDelete = async (id, userId) => {
    return await db.run(
        'UPDATE productos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', 
        [id, userId]
    );
};

// Eliminación Física (Hard Delete): Borra el registro de la BD
const hardDelete = async (id, userId) => {
    return await db.run(
        'DELETE FROM productos WHERE id = ? AND user_id = ?', 
        [id, userId]
    );
};

module.exports = { getAllByUserId, create, update, checkUsageInBatches, softDelete, hardDelete };