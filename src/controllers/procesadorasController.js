const ProcesadoraModel = require('../models/procesadoraModel');
const { safeJSONParse, sanitizeNumber } = require('../utils/helpers');
const { processImagesArray, deleteImagesArray } = require('../utils/storage');

const provider = 'supabase';

const getProcesadoras = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await ProcesadoraModel.getAllByUserId(userId);
        const procesadoras = rows.map(p => ({
            ...p,
            premios_json: safeJSONParse(p.premios_json || '[]'),
            certificaciones_json: safeJSONParse(p.certificaciones_json || '[]'),
            coordenadas: safeJSONParse(p.coordenadas || 'null'),
            imagenes_json: safeJSONParse(p.imagenes_json || '[]')
        }));
        res.status(200).json(procesadoras);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createProcesadora = async (req, res) => {
    const userId = req.user.id;
    let { ruc, razon_social, nombre_comercial, tipo, pais, ciudad, departamento, provincia, distrito, direccion, telefono, premios_json, certificaciones_json, coordenadas, imagenes_json, historia, video_link, numero_trabajadores } = req.body;
    const id = require('crypto').randomUUID();

    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const procesadasImagenes = await processImagesArray(imagenes_json, 'procesadoras', userId, provider);

    try {
        await ProcesadoraModel.create({
            id, user_id: userId, ruc, razon_social, nombre_comercial, tipo,
            pais, ciudad, departamento, provincia, distrito, direccion, telefono,
            premios_json, certificaciones_json, coordenadas,
            imagenes_json: procesadasImagenes,
            historia, video_link, numero_trabajadores
        });
        res.status(201).json({ message: "Procesadora creada", id });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const updateProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    let { ruc, razon_social, nombre_comercial, tipo, pais, ciudad, departamento, provincia, distrito, direccion, telefono, premios_json, certificaciones_json, coordenadas, imagenes_json, historia, video_link, numero_trabajadores } = req.body;

    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const procesadasImagenes = await processImagesArray(imagenes_json, 'procesadoras', userId, provider);

    try {
        const oldProcesadora = await ProcesadoraModel.getByIdAndUserId(id, userId);
        if (!oldProcesadora) return res.status(404).json({ error: "Procesadora no encontrada o no tienes permiso." });

        const oldImages = oldProcesadora.imagenes_json ? safeJSONParse(oldProcesadora.imagenes_json || '[]') : [];
        const deletedImages = oldImages.filter(oldImg => !procesadasImagenes.includes(oldImg));

        if (deletedImages.length > 0) {
            await deleteImagesArray(deletedImages, provider);
        }

        await ProcesadoraModel.update(id, userId, {
            ruc, razon_social, nombre_comercial, tipo,
            pais, ciudad, departamento, provincia, distrito, direccion, telefono,
            premios_json, certificaciones_json, coordenadas,
            imagenes_json: procesadasImagenes,
            historia, video_link, numero_trabajadores
        });
        res.status(200).json({ message: "Procesadora actualizada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteProcesadora = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const oldProcesadora = await ProcesadoraModel.getByIdAndUserId(id, userId);
        if (!oldProcesadora) return res.status(404).json({ error: "Procesadora no encontrada o no tienes permiso." });

        const oldImages = oldProcesadora.imagenes_json ? safeJSONParse(oldProcesadora.imagenes_json) : [];
        if (oldImages.length > 0) {
            await deleteImagesArray(oldImages, provider);
        }

        const result = await ProcesadoraModel.deleteById(id, userId);
        if (result.changes === 0) return res.status(404).json({ error: "Procesadora no encontrada o no tienes permiso." });
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

module.exports = {
    getProcesadoras,
    createProcesadora,
    updateProcesadora,
    deleteProcesadora
};
