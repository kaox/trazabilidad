const AcquisitionModel = require('../models/acquisitionModel');
const { safeJSONParse } = require('../utils/helpers');

const getAcquisitions = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await AcquisitionModel.getAllByUserId(userId);

        const result = rows.map(r => ({
            ...r,
            imagenes_json: safeJSONParse(r.imagenes_json || '[]'),
            data_adicional: safeJSONParse(r.data_adicional || '{}'),
            // Inyectamos valores legibles para el frontend si existen los joins, sino fallbacks
            display_unit: r.unit_code || 'KG',
            display_currency: r.currency_symbol || '$'
        }));
        
        res.status(200).json(result);
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

const createAcquisition = async (req, res) => {
    const userId = req.user.id;
    const {
        nombre_producto, tipo_acopio, subtipo, fecha_acopio,
        peso_kg, precio_unitario,
        original_quantity, original_price, unit_id, currency_id,
        finca_origen, observaciones, imagenes_json, data_adicional
    } = req.body;

    const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `ACP-${randomPart}`;

    try {
        await AcquisitionModel.create({
            id, 
            userId, 
            nombre_producto, 
            tipo_acopio, 
            subtipo, 
            fecha_acopio,
            peso_kg, 
            precio_unitario,
            original_quantity, 
            original_price, 
            unit_id, 
            currency_id,
            finca_origen, 
            observaciones, 
            imagenes_json: JSON.stringify(imagenes_json || []), 
            data_adicional: JSON.stringify(data_adicional || {})
        });
        
        res.status(201).json({ message: "Acopio registrado", id });
    } catch (err) { 
        res.status(500).json({ error: err.message }); 
    }
};

const deleteAcquisition = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        // 1. Verificar si el acopio ya fue usado delegando al modelo
        const usageCheck = await AcquisitionModel.checkUsageInBatches(id);

        if (usageCheck) {
            // CASO A: Tiene historial -> Eliminación Lógica (Soft Delete)
            await AcquisitionModel.softDelete(id, userId);
            res.status(200).json({
                message: "El acopio tiene procesos vinculados. Se ha archivado (eliminación lógica) para mantener la trazabilidad.",
                type: 'soft'
            });
        } else {
            // CASO B: No tiene historial -> Eliminación Física (Hard Delete)
            const result = await AcquisitionModel.hardDelete(id, userId);
            
            if (result.changes === 0) return res.status(404).json({ error: "Acopio no encontrado." });
            
            res.status(204).send(); // No content
        }
    } catch (err) {
        console.error("Error deleteAcquisition:", err);
        res.status(500).json({ error: err.message });
    }
};

const updateAcquisition = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { 
        nombre_producto, tipo_acopio, subtipo, fecha_acopio, 
        peso_kg, precio_unitario, finca_origen, observaciones, 
        imagenes_json, data_adicional 
    } = req.body;

    try {
        const result = await AcquisitionModel.update(id, userId, {
            nombre_producto, 
            tipo_acopio, 
            subtipo, 
            fecha_acopio, 
            peso_kg, 
            precio_unitario, 
            finca_origen, 
            observaciones, 
            imagenes_json: JSON.stringify(imagenes_json || []), 
            data_adicional: JSON.stringify(data_adicional || {})
        });

        if (result.changes === 0) return res.status(404).json({ error: "Acopio no encontrado o sin permisos." });

        res.status(200).json({ message: "Acopio actualizado correctamente" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAcquisitions,
    createAcquisition,
    deleteAcquisition,
    updateAcquisition
};