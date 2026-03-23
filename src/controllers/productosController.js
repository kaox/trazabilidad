const ProductoModel = require('../models/productoModel');
const crypto = require('crypto');
// Importar nuestra librería de Storage agnóstica
const { processImagesArray, deleteImagesArray } = require('../utils/storage');
// Ajusta la ruta a donde tengas tus helpers
const { safeJSONParse } = require('../utils/helpers');
const provider = 'vercel';
const getProductos = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await ProductoModel.getAllByUserId(userId);

        // Transformamos los strings JSON de la BD a objetos JS para el frontend
        const productos = rows.map(p => ({
            ...p,
            imagenes_json: safeJSONParse(p.imagenes_json || '[]'),
            premios_json: safeJSONParse(p.premios_json || '[]')
        }));

        res.status(200).json(productos);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const createProducto = async (req, res) => {
    const userId = req.user.id;
    const {
        nombre, descripcion, gtin, is_formal_gtin, imagenes_json,
        ingredientes, tipo_producto, peso, premios_json,
        receta_nutricional_id, is_published, perfil_id, rueda_id, variedad, proceso, nivel_tueste, puntaje_sca
    } = req.body;

    // 1. Generar ID
    const id = crypto.randomUUID();

    // 2. Lógica de Negocio: GTIN
    let finalGtin = gtin;
    if (!finalGtin) {
        finalGtin = '999' + Math.floor(10000000000 + Math.random() * 90000000000);
    }

    // 3. Sanitización de datos (Business Logic)
    const recetaId = (receta_nutricional_id && receta_nutricional_id.trim() !== "") ? receta_nutricional_id : null;
    const published = is_published !== undefined ? is_published : true;
    const perfilId = (perfil_id && perfil_id !== "") ? perfil_id : null;
    const ruedaId = (rueda_id && rueda_id !== "") ? rueda_id : null;

    const procesadasImagenes = await processImagesArray(imagenes_json, 'productos', userId, provider);

    try {
        // Preparamos el objeto para el modelo (JSONs convertidos a String aquí)
        await ProductoModel.create({
            id: id,
            user_id: userId,
            nombre,
            descripcion,
            gtin: finalGtin,
            is_formal_gtin: is_formal_gtin || false,
            imagenes_json: JSON.stringify(procesadasImagenes),
            ingredientes,
            tipo_producto,
            peso,
            premios_json: JSON.stringify(premios_json || []),
            receta_nutricional_id: recetaId,
            is_published: published,
            perfil_id: perfilId,
            rueda_id: ruedaId,
            variedad: variedad,
            proceso: proceso,
            nivel_tueste: nivel_tueste,
            puntaje_sca: puntaje_sca
        });

        res.status(201).json({ message: "Producto creado", id });
    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: "Ya existe un producto con este GTIN." });
        }
        res.status(500).json({ error: err.message });
    }
};

const updateProducto = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const {
        nombre, descripcion, gtin, imagenes_json, ingredientes,
        tipo_producto, peso, premios_json, receta_nutricional_id, is_published,
        perfil_id, rueda_id, variedad, proceso, nivel_tueste, puntaje_sca
    } = req.body;

    // Sanitización
    const recetaId = (receta_nutricional_id && receta_nutricional_id.trim() !== "") ? receta_nutricional_id : null;
    const perfilId = (perfil_id && perfil_id !== "") ? perfil_id : null;
    const ruedaId = (rueda_id && rueda_id !== "") ? rueda_id : null;

    // Procesamiento de imágenes
    const procesadasImagenes = await processImagesArray(imagenes_json, 'productos', userId, provider);

    try {
        const oldProduct = await ProductoModel.getByIdAndUserId(id, userId);
        const oldImages = oldProduct && oldProduct.imagenes_json ? safeJSONParse(oldProduct.imagenes_json || '[]') : [];
        const deletedImages = oldImages.filter(oldImg => !procesadasImagenes.includes(oldImg));

        if (deletedImages.length > 0) {
            await deleteImagesArray(deletedImages, provider);
        }

        await ProductoModel.update(id, userId, {
            nombre,
            descripcion,
            gtin,
            imagenes_json: JSON.stringify(procesadasImagenes),
            ingredientes,
            tipo_producto,
            peso,
            premios_json: JSON.stringify(premios_json || []),
            receta_nutricional_id: recetaId,
            is_published,
            perfil_id: perfilId,
            rueda_id: ruedaId,
            variedad: variedad,
            proceso: proceso,
            nivel_tueste: nivel_tueste,
            puntaje_sca: puntaje_sca
        });

        res.status(200).json({ message: "Producto actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteProducto = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
        // Delegamos la consulta SQL al modelo
        const usageCheck = await ProductoModel.checkUsageInBatches(id);
        const product = await ProductoModel.getByIdAndUserId(id, userId);

        if (usageCheck) {
            // CASO A: Tiene historial -> Soft Delete
            await ProductoModel.softDelete(id, userId);

            // Retornamos 200 con mensaje explicativo
            return res.status(200).json({
                message: "El producto tiene historial de trazabilidad. Se ha archivado (eliminación lógica) para no romper registros antiguos.",
                type: 'soft'
            });
        } else {
            // CASO B: No tiene historial -> Hard Delete
            const result = await ProductoModel.hardDelete(id, userId);

            // Validamos si realmente se borró algo (por si el ID no era de este usuario)
            if (result.changes === 0) {
                return res.status(404).json({ error: "Producto no encontrado." });
            }

            // Eliminar imágenes de Storage si existen
            if (product && product.imagenes_json) {
                const images = safeJSONParse(product.imagenes_json || '[]');
                if (images.length > 0) {
                    await deleteImagesArray(images, provider);
                }
            }

            // Retornamos 204 No Content (éxito sin cuerpo)
            return res.status(204).send();
        }
    } catch (err) {
        console.error("Error al eliminar producto:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getProductos, createProducto, updateProducto, deleteProducto };