const FincaModel = require('../models/fincaModel');
const { safeJSONParse, sanitizeNumber } = require('../utils/helpers');
const { processImagesArray, deleteImagesArray, uploadImageBase64, deleteImageByUrl } = require('../utils/storage');

const provider = 'supabase';

const getFincas = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await FincaModel.getAllByUserId(userId);
        const fincas = rows.map(f => ({
            ...f,
            coordenadas: safeJSONParse(f.coordenadas || 'null'),
            imagenes_json: safeJSONParse(f.imagenes_json || '[]'),
            certificaciones_json: safeJSONParse(f.certificaciones_json || '[]'),
            premios_json: safeJSONParse(f.premios_json || '[]')
        }));
        res.status(200).json(fincas);
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const createFinca = async (req, res) => {
    const userId = req.user.id;
    let { propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, video_link, certificaciones_json, premios_json, foto_productor, numero_trabajadores } = req.body;
    const id = require('crypto').randomUUID();

    altura = sanitizeNumber(altura);
    superficie = sanitizeNumber(superficie);
    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const safeParam = (val) => (val === undefined ? null : val);

    const procesadasImagenes = await processImagesArray(imagenes_json, 'fincas', userId, provider);

    let foto_productor_url = null;
    if (foto_productor && foto_productor.startsWith('data:image/')) {
        const filename = `fincas/user-${userId}-${Date.now()}-productor`;
        foto_productor_url = await uploadImageBase64(foto_productor, filename, provider);
    } else {
        foto_productor_url = foto_productor;
    }

    try {
        await FincaModel.create({
            id: safeParam(id),
            user_id: safeParam(userId),
            propietario: safeParam(propietario),
            dni_ruc: safeParam(dni_ruc),
            nombre_finca: safeParam(nombre_finca),
            pais: safeParam(pais),
            departamento: safeParam(departamento),
            provincia: safeParam(provincia),
            distrito: safeParam(distrito),
            ciudad: safeParam(ciudad),
            altura: safeParam(altura),
            superficie: safeParam(superficie),
            coordenadas: coordenadas || null,
            telefono: safeParam(telefono),
            historia: safeParam(historia),
            imagenes_json: JSON.stringify(procesadasImagenes) || '[]',
            video_link: safeParam(video_link),
            certificaciones_json: certificaciones_json || [],
            premios_json: premios_json || [],
            foto_productor: safeParam(foto_productor_url),
            numero_trabajadores: safeParam(numero_trabajadores)
        });
        res.status(201).json({ message: "Finca creada", id: id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    let { propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json, video_link, certificaciones_json, premios_json, foto_productor, numero_trabajadores } = req.body;

    altura = sanitizeNumber(altura);
    superficie = sanitizeNumber(superficie);
    numero_trabajadores = sanitizeNumber(numero_trabajadores);

    const procesadasImagenes = await processImagesArray(imagenes_json, 'fincas', userId, provider);

    try {
        const oldFinca = await FincaModel.getByIdAndUserId(id, userId);
        let oldImages = oldFinca && oldFinca.imagenes_json ? safeJSONParse(oldFinca.imagenes_json || '[]') : [];
        if (!Array.isArray(oldImages)) oldImages = [];
        const deletedImages = oldImages.filter(oldImg => !procesadasImagenes.includes(oldImg));

        if (deletedImages.length > 0) {
            await deleteImagesArray(deletedImages, provider);
        }

        let foto_productor_url = oldFinca ? oldFinca.foto_productor : null;
        if (foto_productor !== undefined && foto_productor !== foto_productor_url) {
            if (foto_productor && foto_productor.startsWith('data:image/')) {
                const filename = `fincas/user-${userId}-${Date.now()}-productor`;
                foto_productor_url = await uploadImageBase64(foto_productor, filename, provider);
            } else {
                foto_productor_url = foto_productor;
            }

            if (oldFinca && oldFinca.foto_productor && oldFinca.foto_productor !== foto_productor_url) {
                await deleteImageByUrl(oldFinca.foto_productor, provider);
            }
        }

        const result = await FincaModel.update(id, userId, {
            propietario, dni_ruc, nombre_finca, pais, departamento, provincia, distrito, ciudad, altura, superficie, coordenadas, telefono, historia, imagenes_json: JSON.stringify(procesadasImagenes), video_link, certificaciones_json, premios_json, foto_productor: foto_productor_url, numero_trabajadores
        });
        if (result.changes === 0) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });
        res.status(200).json({ message: "Finca actualizada" });
    } catch (err) { res.status(500).json({ error: err.message }); }
};

const deleteFinca = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    try {
        const oldFinca = await FincaModel.getByIdAndUserId(id, userId);
        if (!oldFinca) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });

        let oldImages = oldFinca.imagenes_json ? safeJSONParse(oldFinca.imagenes_json) : [];
        if (!Array.isArray(oldImages)) oldImages = [];
        if (oldImages.length > 0) {
            await deleteImagesArray(oldImages, provider);
        }
        if (oldFinca.foto_productor) {
            await deleteImageByUrl(oldFinca.foto_productor, provider);
        }

        const result = await FincaModel.deleteById(id, userId);
        if (result.changes === 0) return res.status(404).json({ error: "Finca no encontrada o no tienes permiso." });
        res.status(204).send();
    } catch (err) { res.status(500).json({ error: err.message }); }
};

// Tokens Logic
const generateFincaToken = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const finca = await FincaModel.getByIdAndUserId(id, userId);
        if (!finca) return res.status(404).json({ error: "Finca no encontrada o sin permiso." });

        if (finca.access_token) {
            return res.json({ token: finca.access_token });
        }

        const token = require('crypto').randomUUID();
        await FincaModel.updateToken(id, token);

        res.json({ token });
    } catch (err) {
        console.error("Error generando token finca:", err);
        res.status(500).json({ error: err.message });
    }
};

const getFincaByToken = async (req, res) => {
    const { token } = req.params;
    try {
        const finca = await FincaModel.getByToken(token);
        if (!finca) return res.status(404).json({ error: "Enlace inválido o expirado." });

        finca.coordenadas = safeJSONParse(finca.coordenadas || 'null');
        finca.imagenes_json = safeJSONParse(finca.imagenes_json || '[]');
        finca.certificaciones_json = safeJSONParse(finca.certificaciones_json || '[]');
        finca.premios_json = safeJSONParse(finca.premios_json || '[]');

        res.json(finca);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateFincaByToken = async (req, res) => {
    const { token } = req.params;
    let { propietario, dni_ruc, nombre_finca, telefono, historia, imagenes_json, coordenadas, altura, superficie, pais, departamento, provincia, distrito, ciudad } = req.body;

    altura = sanitizeNumber(altura);
    superficie = sanitizeNumber(superficie);

    try {
        const fincaId = await FincaModel.getByToken(token);
        if (!fincaId) return res.status(404).json({ error: "Enlace inválido." });

        await FincaModel.updateByToken(fincaId.id, {
            propietario, dni_ruc, nombre_finca, telefono, historia, imagenes_json, coordenadas, altura, superficie, pais, departamento, provincia, distrito, ciudad
        });

        res.json({ message: "Información actualizada correctamente." });
    } catch (err) {
        console.error("Error updateFincaByToken:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getFincas,
    createFinca,
    updateFinca,
    deleteFinca,
    generateFincaToken,
    getFincaByToken,
    updateFincaByToken
};
