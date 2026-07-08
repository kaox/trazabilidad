const db = require('../config/db');
const crypto = require('crypto');

// Obtener todas las etapas de un lote, uniéndose con el catálogo para traer el nombre y el ícono
const getAllByLoteId = async (loteId) => {
    const sql = `
        SELECT e.*, c.nombre as etapa_nombre, c.icono, c.color
        FROM etapas e
        LEFT JOIN catalogo_etapas c ON e.catalogo_etapa_id = c.id
        WHERE e.lote_id = ?
        ORDER BY e.orden ASC
    `;
    return await db.all(sql, [loteId]);
};

// Crear una nueva etapa en la hoja de ruta
const create = async (data) => {
    const id = crypto.randomUUID();
    const sql = `
        INSERT INTO etapas (
            id, lote_id, catalogo_etapa_id, fecha, notas, foto, orden, finca_id, procesadora_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    await db.run(sql, [
        id,
        data.lote_id,
        data.catalogo_etapa_id,
        data.fecha,
        data.notas || null,
        data.foto || null,
        data.orden,
        data.finca_id || null,
        data.procesadora_id || null
    ]);
    return id;
};

// Actualizar una etapa
const update = async (id, data) => {
    const sql = `
        UPDATE etapas 
        SET catalogo_etapa_id = ?, fecha = ?, notas = ?, foto = ?, orden = ?, 
            finca_id = ?, procesadora_id = ?
        WHERE id = ?
    `;
    return await db.run(sql, [
        data.catalogo_etapa_id,
        data.fecha,
        data.notas || null,
        data.foto || null,
        data.orden,
        data.finca_id || null,
        data.procesadora_id || null,
        id
    ]);
};

const deleteEtapa = async (id) => {
    const sql = `DELETE FROM etapas WHERE id = ?`;
    return await db.run(sql, [id]);
};

module.exports = {
    getAllByLoteId,
    create,
    update,
    delete: deleteEtapa
};