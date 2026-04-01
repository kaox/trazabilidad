const ProductoModel = require('../models/productoModel');
const crypto = require('crypto');
// Importar nuestra librería de Storage agnóstica
const { processImagesArray, deleteImagesArray } = require('../utils/storage');
// Ajusta la ruta a donde tengas tus helpers
const { safeJSONParse } = require('../utils/helpers');

const provider = 'vercel';//'vercel'

const getProductos = async (req, res) => {
    const userId = req.user.id;
    try {
        const rows = await ProductoModel.getAllByUserId(userId);

        // Transformamos los strings JSON de la BD a objetos JS para el frontend
        const productos = rows.map(p => ({
            ...p,
            atributos_dinamicos: safeJSONParse(p.atributos_dinamicos || '{}'),
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
        receta_nutricional_id, is_published, perfil_id, rueda_id, variedad, proceso, nivel_tueste, puntaje_sca,
        unit_id, precio, currency_id, finca_id, grupo_genetico, porcentaje_cacao
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
            atributos_dinamicos: {
                variedad,
                proceso,
                nivel_tueste,
                puntaje_sca: puntaje_sca ? parseFloat(puntaje_sca) : null,
                grupo_genetico,
                porcentaje_cacao: porcentaje_cacao ? parseFloat(porcentaje_cacao) : null
            },
            unit_id: (unit_id && unit_id !== "") ? unit_id : null,
            precio: (precio && precio !== "") ? precio : null,
            currency_id: (currency_id && currency_id !== "") ? currency_id : null,
            finca_id: (finca_id && finca_id !== "") ? finca_id : null
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
        perfil_id, rueda_id, variedad, proceso, nivel_tueste, puntaje_sca,
        unit_id, precio, currency_id, finca_id, grupo_genetico, porcentaje_cacao
    } = req.body;

    // Sanitización
    const recetaId = (receta_nutricional_id && receta_nutricional_id.trim() !== "") ? receta_nutricional_id : null;
    const perfilId = (perfil_id && perfil_id !== "") ? perfil_id : null;
    const ruedaId = (rueda_id && rueda_id !== "") ? rueda_id : null;

    // Procesamiento de imágenes
    const procesadasImagenes = await processImagesArray(imagenes_json, 'productos', userId, provider);

    try {
        const oldProduct = await ProductoModel.getByIdAndUserId(id, userId);
        let oldImages = oldProduct && oldProduct.imagenes_json ? safeJSONParse(oldProduct.imagenes_json || '[]') : [];
        if (!Array.isArray(oldImages)) oldImages = [];
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
            atributos_dinamicos: {
                variedad,
                proceso,
                nivel_tueste,
                puntaje_sca: puntaje_sca ? parseFloat(puntaje_sca) : null,
                grupo_genetico,
                porcentaje_cacao: porcentaje_cacao ? parseFloat(porcentaje_cacao) : null
            },
            unit_id: (unit_id && unit_id !== "") ? unit_id : null,
            precio: (precio && precio !== "") ? precio : null,
            currency_id: (currency_id && currency_id !== "") ? currency_id : null,
            finca_id: (finca_id && finca_id !== "") ? finca_id : null
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

const getPublicProducts = async (req, res) => {
    const { userId } = req.params;

    try {
        // Llamamos al modelo pasándole solo el dato que necesita
        const rows = await ProductoModel.getPublicProductsWithImmutable(userId);

        // Transformamos los strings JSON de la BD a objetos JS para el frontend
        const products = rows.map(p => ({
            ...p,
            atributos_dinamicos: safeJSONParse(p.atributos_dinamicos || '{}'),
            imagenes_json: safeJSONParse(p.imagenes_json || '[]')
        }));

        res.status(200).json(products);
    } catch (err) {
        console.error("Error getPublicProducts:", err);
        res.status(500).json({ error: err.message });
    }
};

const normalizeImage = (data) => {
    if (!data) return null;
    if (typeof data === 'string') {
        const trimmed = data.trim();
        if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
            try {
                const parsed = JSON.parse(trimmed);
                return normalizeImage(parsed);
            } catch (e) { }
        }
        return data;
    }
    if (Array.isArray(data)) {
        return data.length > 0 ? normalizeImage(data[0]) : null;
    }
    if (typeof data === 'object') {
        return data.url || data.src || data.image || null;
    }
    return null;
};

const getMarketplaceProducts = async (req, res) => {
    try {
        const { tipo, categorias, sabores, premios: premiosFiltro, limit = 20, offset = 0 } = req.query;
        const perfilMin = req.query.perfil_min || {};

        // 1. Delegamos al Modelo la tarea de traer los datos (Data Access)
        const rows = await ProductoModel.getMarketplaceBaseProducts(tipo);

        // 2. Lógica de negocio: Formateo y Normalización
        let products = rows.map(row => {
            const atributosData = safeJSONParse(row.atributos_dinamicos || '{}');
            const saboresData = safeJSONParse(row.sabores_json);
            const perfilData = safeJSONParse(row.perfil_data);
            const premiosData = safeJSONParse(row.product_premios_json);
            const imagenesDataRaw = safeJSONParse(row.product_imagenes_json || '[]');

            const imagen = normalizeImage(imagenesDataRaw);
            const imagenesData = Array.isArray(imagenesDataRaw) ? imagenesDataRaw : (imagenesDataRaw ? [imagenesDataRaw] : []);

            return {
                id: row.product_id,
                nombre: row.product_name,
                descripcion: row.product_descripcion,
                tipo: row.product_tipo,
                presentacion: row.presentacion,
                variedad: atributosData.variedad,
                proceso: atributosData.proceso,
                nivel_tueste: atributosData.nivel_tueste,
                puntaje_sca: atributosData.puntaje_sca,
                grupo_genetico: atributosData.grupo_genetico,
                porcentaje_cacao: atributosData.porcentaje_cacao,
                imagen,
                imagenes_json: imagenesData,
                sabores: saboresData,
                perfil: perfilData,
                premios: Array.isArray(premiosData) ? premiosData : [],
                precio: row.product_precio,
                moneda: row.currency_symbol,
                unidad: row.unit_code,
                lotes: row.has_traceability ? [{ registry_id: 1 }] : [], // Si tiene trazabilidad, retorna un array con al menos un elemento
                finca: row.finca_nombre ? {
                    nombre: row.finca_nombre,
                    pais: row.finca_pais,
                    departamento: row.finca_departamento,
                    provincia: row.finca_provincia,
                    distrito: row.finca_distrito,
                    altura: row.finca_altura,
                    historia: row.finca_historia,
                    productor: row.finca_propietario,
                    coordenadas: row.finca_coordenadas,
                    imagenes: row.finca_imagenes,
                    video: row.finca_video
                } : null,
                empresa: {
                    id: row.company_id,
                    nombre: row.company_name,
                    tipo: row.company_type,
                    slug: row.company_slug, // Nota: row.company_slug no está en el SELECT de tu query actual, revísalo
                    logo: row.company_logo,
                    pais: row.company_pais  // Nota: row.company_pais tampoco está en el SELECT actual
                }
            };
        });

        // 3. Lógica de negocio: Filtros en memoria
        if (categorias) {
            const selectedCategories = Array.isArray(categorias) ? categorias : [categorias];
            if (selectedCategories.length > 0) {
                products = products.filter(p => p.sabores && Array.isArray(p.sabores) &&
                    selectedCategories.some(cat => p.sabores.some(n => n.category && n.category.toLowerCase() === cat.toLowerCase()))
                );
            }
        }

        if (sabores) {
            const selectedSubnotes = Array.isArray(sabores) ? sabores : [sabores];
            if (selectedSubnotes.length > 0) {
                products = products.filter(p => p.sabores && Array.isArray(p.sabores) &&
                    selectedSubnotes.some(sub => p.sabores.some(n => n.subnote && n.subnote.toLowerCase() === sub.toLowerCase()))
                );
            }
        }

        const perfilKeys = Object.keys(perfilMin);
        if (perfilKeys.length > 0) {
            products = products.filter(p => {
                if (!p.perfil) return false;
                return perfilKeys.every(attr => {
                    const minVal = parseFloat(perfilMin[attr]);
                    const productVal = parseFloat(p.perfil[attr]);
                    if (isNaN(minVal) || minVal <= 0) return true;
                    if (isNaN(productVal)) return false;
                    return productVal >= minVal;
                });
            });
        }

        if (premiosFiltro) {
            const premiosArray = Array.isArray(premiosFiltro) ? premiosFiltro : [premiosFiltro];
            if (premiosArray.length > 0) {
                products = products.filter(p => p.premios && p.premios.length > 0 &&
                    premiosArray.some(prem => p.premios.some(pp => pp.nombre && pp.nombre.toLowerCase().includes(prem.toLowerCase())))
                );
            }
        }

        // 4. Paginación en memoria
        const total = products.length;
        const paginatedProducts = products.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

        // 5. Respuesta HTTP
        res.json({ total, products: paginatedProducts });
    } catch (err) {
        console.error("Error getMarketplaceProducts:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getProductos, createProducto, updateProducto, deleteProducto, getPublicProducts, getMarketplaceProducts };