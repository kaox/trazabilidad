const AcquisitionModel = require('../models/acquisitionModel');
const { safeJSONParse } = require('../utils/helpers');
const { uploadImageBase64, deleteImageByUrl } = require('../utils/storage');

const PROVIDER = 'supabase';

/**
 * Recorre el mapa imagenes_json (objeto clave → valor base64/URL)
 * y sube a Supabase las que sean base64. Devuelve el mapa con URLs.
 */
const uploadAcopioImages = async (imagenesMap, userId) => {
    if (!imagenesMap || typeof imagenesMap !== 'object' || Array.isArray(imagenesMap)) return imagenesMap;
    const result = {};
    for (const key of Object.keys(imagenesMap)) {
        const val = imagenesMap[key];
        if (typeof val === 'string' && val.startsWith('data:image/')) {
            try {
                const filename = `acopios/user-${userId}-${Date.now()}-${key}`;
                result[key] = await uploadImageBase64(val, filename, PROVIDER);
            } catch (err) {
                console.error(`Error subiendo imagen de acopio [${key}]:`, err.message);
                result[key] = val; // fallback
            }
        } else {
            result[key] = val; // ya es URL o vacío
        }
    }
    return result;
};

/**
 * Elimina de Supabase todas las imágenes URL del mapa imagenes_json.
 */
const deleteAcopioImages = async (imagenesMap) => {
    if (!imagenesMap || typeof imagenesMap !== 'object') return;
    for (const key of Object.keys(imagenesMap)) {
        const val = imagenesMap[key];
        if (typeof val === 'string' && val.startsWith('https://')) {
            await deleteImageByUrl(val, PROVIDER);
        }
    }
};

const getAcquisitions = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await AcquisitionModel.getAllByUserId(userId);

        const result = rows.map(r => ({
            ...r,
            imagenes_json: safeJSONParse(r.imagenes_json || '{}'),
            data_adicional: safeJSONParse(r.data_adicional || '{}'),
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
        // Subir imágenes base64 a Supabase, reemplazar con URLs
        const imagenesSubidas = await uploadAcopioImages(imagenes_json, userId);

        await AcquisitionModel.create({
            id, userId, nombre_producto, tipo_acopio, subtipo, fecha_acopio,
            peso_kg, precio_unitario,
            original_quantity, original_price, unit_id, currency_id,
            finca_origen, observaciones,
            imagenes_json: JSON.stringify(imagenesSubidas || {}),
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
        const usageCheck = await AcquisitionModel.checkUsageInBatches(id);

        if (usageCheck) {
            // CASO A: Soft Delete — no borramos imágenes, las dejamos para el historial
            await AcquisitionModel.softDelete(id, userId);
            res.status(200).json({
                message: "El acopio tiene procesos vinculados. Se ha archivado (eliminación lógica) para mantener la trazabilidad.",
                type: 'soft'
            });
        } else {
            // CASO B: Hard Delete — eliminar imágenes de Supabase
            const existing = await AcquisitionModel.getById(id);
            if (existing) {
                const imagenesMap = safeJSONParse(existing.imagenes_json || '{}');
                await deleteAcopioImages(imagenesMap);
            }

            const result = await AcquisitionModel.hardDelete(id, userId);
            if (result.changes === 0) return res.status(404).json({ error: "Acopio no encontrado." });
            
            res.status(204).send();
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
        // Obtener mapa de imágenes antiguas para borrar las que ya no están
        const existing = await AcquisitionModel.getById(id);
        const oldImages = existing ? safeJSONParse(existing.imagenes_json || '{}') : {};

        // Subir nuevas imágenes base64 a Supabase
        const imagenesSubidas = await uploadAcopioImages(imagenes_json, userId);

        // Eliminar de Supabase las imágenes que fueron removidas
        for (const key of Object.keys(oldImages)) {
            const oldUrl = oldImages[key];
            if (typeof oldUrl === 'string' && oldUrl.startsWith('https://') && imagenesSubidas[key] !== oldUrl) {
                await deleteImageByUrl(oldUrl, PROVIDER);
            }
        }

        const result = await AcquisitionModel.update(id, userId, {
            nombre_producto, tipo_acopio, subtipo, fecha_acopio, 
            peso_kg, precio_unitario, finca_origen, observaciones, 
            imagenes_json: JSON.stringify(imagenesSubidas || {}),
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