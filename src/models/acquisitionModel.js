const db = require('../config/db');

const getById = async (id) => {
    return await db.get('SELECT * FROM acquisitions WHERE id = ?', [id]);
};

// Obtener todos los acopios de un usuario con sus unidades y monedas
const getAllByUserId = async (userId) => {
    const sql = `
        SELECT a.*, 
               u.code as unit_code, 
               c.code as currency_code, c.symbol as currency_symbol
        FROM acquisitions a
        LEFT JOIN units_of_measure u ON a.unit_id = u.id
        LEFT JOIN currencies c ON a.currency_id = c.id
        WHERE a.user_id = ? AND a.deleted_at IS NULL 
        ORDER BY a.created_at DESC
    `;
    return await db.all(sql, [userId]);
};

// Crear un nuevo acopio
const create = async (data) => {
    const sql = `
        INSERT INTO acquisitions (
            id, user_id, nombre_producto, tipo_acopio, subtipo, fecha_acopio, 
            peso_kg, precio_unitario, 
            original_quantity, original_price, unit_id, currency_id,
            finca_origen, observaciones, imagenes_json, data_adicional
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        data.id, data.userId, data.nombre_producto, data.tipo_acopio, data.subtipo, data.fecha_acopio,
        data.peso_kg, data.precio_unitario,
        data.original_quantity, data.original_price, data.unit_id, data.currency_id,
        data.finca_origen, data.observaciones, data.imagenes_json, data.data_adicional
    ];
    return await db.run(sql, params);
};

// Verificar si el acopio ya fue usado en algún lote de producción
const checkUsageInBatches = async (id) => {
    return await db.get('SELECT id FROM batches WHERE acquisition_id = ? LIMIT 1', [id]);
};

// Eliminación lógica (Soft Delete)
const softDelete = async (id, userId) => {
    return await db.run(
        'UPDATE acquisitions SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?', 
        [id, userId]
    );
};

// Eliminación física (Hard Delete)
const hardDelete = async (id, userId) => {
    return await db.run(
        'DELETE FROM acquisitions WHERE id = ? AND user_id = ?', 
        [id, userId]
    );
};

// Actualizar un acopio
const update = async (id, userId, data) => {
    const sql = `
        UPDATE acquisitions SET 
            nombre_producto = ?, tipo_acopio = ?, subtipo = ?, fecha_acopio = ?, 
            peso_kg = ?, precio_unitario = ?, finca_origen = ?, observaciones = ?, 
            imagenes_json = ?, data_adicional = ? 
        WHERE id = ? AND user_id = ?
    `;
    const params = [
        data.nombre_producto, data.tipo_acopio, data.subtipo, data.fecha_acopio, 
        data.peso_kg, data.precio_unitario, data.finca_origen, data.observaciones, 
        data.imagenes_json, data.data_adicional, 
        id, userId
    ];
    return await db.run(sql, params);
};

module.exports = {
    getById,
    getAllByUserId,
    create,
    checkUsageInBatches,
    softDelete,
    hardDelete,
    update
};