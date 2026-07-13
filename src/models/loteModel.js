const db = require('../config/db');
const crypto = require('crypto');

// Obtener todos los lotes del usuario (cruzando con la tabla productos)
const getAllByUser = async (userId) => {
    const sql = `
        SELECT l.*, p.nombre as producto_nombre, p.tipo_producto as categoria
        FROM lotes l
        JOIN productos p ON l.producto_id = p.id
        WHERE p.user_id = ?
        ORDER BY l.created_at DESC
    `;
    return await db.all(sql, [userId]);
};

// Obtener un lote específico
const getById = async (id, userId) => {
    const sql = `
        SELECT l.*, p.nombre as producto_nombre, p.tipo_producto as categoria
        FROM lotes l
        JOIN productos p ON l.producto_id = p.id
        WHERE l.id = ? AND p.user_id = ?
    `;
    return await db.get(sql, [id, userId]);
};

// Crear un nuevo lote
const create = async (data) => {
    const id = crypto.randomUUID();
    const sql = `
        INSERT INTO lotes (id, codigo_lote, producto_id, estado)
        VALUES (?, ?, ?, ?)
    `;
    await db.run(sql, [
        id,
        data.codigo_lote,
        data.producto_id,
        data.estado || 'BORRADOR'
    ]);
    return id;
};

// Actualizar lote (solo si no está bloqueado por blockchain)
const update = async (id, data) => {
    const sql = `
        UPDATE lotes 
        SET codigo_lote = ?, producto_id = ?, estado = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND is_locked IS FALSE
    `;
    const params = [data.codigo_lote, data.producto_id, data.estado, id];
    return await db.run(sql, params);
};

// Sellar en Blockchain (Congelar Lote)
const lockLote = async (id, hash) => {
    const sql = `
        UPDATE lotes 
        SET is_locked IS TRUE, blockchain_hash = ?, estado = 'ACTIVO', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `;
    return await db.run(sql, [hash, id]);
};

// Eliminar lote (solo si no está bloqueado)
const deleteLote = async (id) => {
    const sql = `DELETE FROM lotes WHERE id = ? AND is_locked IS FALSE`;
    return await db.run(sql, [id]);
};

// Obtener lotes públicos de un producto (solo activos)
const getPublicLotesByProducto = async (productoId) => {
    const sql = `SELECT * FROM lotes WHERE producto_id = ? AND estado = 'ACTIVO' ORDER BY created_at DESC`;
    return await db.all(sql, [productoId]);
};

module.exports = {
    getAllByUser,
    getById,
    create,
    update,
    lockLote,
    delete: deleteLote,
    getPublicLotesByProducto
};