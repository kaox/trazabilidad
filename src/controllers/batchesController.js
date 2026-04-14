const BatchModel = require('../models/batchModel');
const { safeJSONParse, toCamelCase } = require('../utils/helpers');
const { uploadImageBase64 } = require('../utils/storage');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BATCH_IMAGE_PROVIDER = 'supabase';

/**
 * Recorre el objeto data de un lote y sube cualquier imagen en base64 a Supabase.
 * Reemplaza el valor base64 por la URL pública resultante.
 * @param {object} dataObj - El objeto data del lote
 * @param {number|string} userId - ID del usuario
 * @returns {Promise<object>} - El mismo objeto data con URLs en lugar de base64
 */
const uploadBatchImages = async (dataObj, userId) => {
    if (!dataObj || typeof dataObj !== 'object') return dataObj;
    const processedData = { ...dataObj };
    for (const key of Object.keys(processedData)) {
        const entry = processedData[key];
        if (entry && typeof entry === 'object' && entry.value && typeof entry.value === 'string' && entry.value.startsWith('data:image/')) {
            try {
                const filename = `batches/user-${userId}-${Date.now()}-${key}`;
                const url = await uploadImageBase64(entry.value, filename, BATCH_IMAGE_PROVIDER);
                processedData[key] = { ...entry, value: url };
            } catch (err) {
                console.error(`Error subiendo imagen del lote [campo: ${key}]:`, err.message);
                // Mantenemos el original si falla
            }
        }
    }
    return processedData;
};

// NOTA: Asegúrate de importar estas funciones desde sus respectivos archivos/servicios
// const { ensureTemplateAndStageExists, syncBatchOutputs } = require('../services/tuServicioDePlantillas');

const ensureTemplateAndStageExists = async (userId, systemTemplateName, stageName, stageOrder) => {
    try {
        // 1. Buscar si la plantilla ya existe para el usuario delegando al modelo
        let template = await BatchModel.getTemplateByProduct(userId, systemTemplateName);
        let templateId;

        if (template) {
            templateId = template.id;
        } else {
            // 2. Si no existe, CLONAR desde el JSON (Lógica JIT)            
            // Ajustamos la ruta asumiendo que el archivo de datos está en una carpeta 'data' fuera de 'controllers'
            const catalogPath = path.join(__dirname, 'data/procesos_config.json');
            const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
            const templateToClone = catalogData.templates.find(t => t.nombre_producto === systemTemplateName);

            if (!templateToClone) throw new Error(`Plantilla del sistema '${systemTemplateName}' no encontrada.`);

            const templateResult = await BatchModel.createTemplate(userId, templateToClone.nombre_producto, templateToClone.descripcion);
            templateId = templateResult.lastID; // Depende de cómo tu db.run devuelve el resultado (debe incluir lastID)

            // Insertar etapas (Acopio + Proceso)
            const allStages = [...(templateToClone.acopio || []), ...(templateToClone.etapas || [])];

            for (const stage of allStages) {
                // Determinar fase
                const fase = (templateToClone.acopio && templateToClone.acopio.includes(stage)) ? 'acopio' : 'procesamiento';

                await BatchModel.createTemplateStage(
                    templateId, stage.nombre_etapa, stage.descripcion, stage.orden,
                    JSON.stringify(stage.campos_json), fase
                );
            }
        }

        // 3. Buscar el ID de la etapa específica usando el modelo
        const stage = await BatchModel.getStageByNameAndOrder(templateId, stageName, stageOrder);

        if (!stage) throw new Error(`Etapa '${stageName}' no encontrada en la plantilla '${systemTemplateName}'.`);

        return { plantilla_id: templateId, etapa_id: stage.id };

    } catch (error) {
        console.error("Error en ensureTemplateAndStageExists:", error);
        throw error;
    }
};

const syncBatchOutputs = async (batchId, etapaId, dataObj) => {
    try {
        const stage = await BatchModel.getStageConfig(etapaId);
        if (!stage) return;

        const config = safeJSONParse(stage.campos_json);
        if (!config || !config.salidas || !Array.isArray(config.salidas)) return;

        await BatchModel.deleteBatchOutputs(batchId);

        for (const salida of config.salidas) {
            const key = salida.name || toCamelCase(salida.label);
            const entry = dataObj[key];

            // Verificamos si es un objeto complejo (nuevo formato) o simple (viejo)
            let quantity = 0;
            let unitId = null;
            let unitCost = 0;
            let currencyId = null;

            if (entry && typeof entry === 'object' && entry.type === 'output') {
                quantity = parseFloat(entry.value) || 0;
                unitId = entry.unit_id ? parseInt(entry.unit_id) : null;
                unitCost = entry.unit_cost ? parseFloat(entry.unit_cost) : 0;
                currencyId = entry.currency_id ? parseInt(entry.currency_id) : null;
            } else if (entry && typeof entry === 'object' && entry.value) {
                // Fallback formato simple {value: "100"}
                quantity = parseFloat(entry.value) || 0;
            }

            if (quantity > 0) {
                const outId = crypto.randomUUID();

                await BatchModel.createBatchOutput({
                    id: outId,
                    batchId: batchId,
                    productType: salida.label,
                    quantity: quantity,
                    outputCategory: salida.product_type || 'principal',
                    unitId: unitId,
                    unitCost: unitCost,
                    currencyId: currencyId
                });
            }
        }
    } catch (e) {
        console.error("Error sincronizando outputs:", e);
    }
};

// --- Helper interno: Verificar Dueño ---
const checkBatchOwnership = async (batchId, userId) => {
    const targetBatch = await BatchModel.getById(batchId);
    if (!targetBatch) return null;

    let ownerId = targetBatch.user_id;
    if (!ownerId) {
        // Delegamos la complejidad de la consulta recursiva (CTE) al modelo
        const root = await BatchModel.getRootOwnerByAncestry(batchId);
        if (root) ownerId = root.user_id;
    }
    return ownerId == userId ? targetBatch : null;
};

// --- Helper interno: Generar ID Dinámico ---
const generateUniqueBatchId = async (prefix) => {
    let id;
    let isUnique = false;
    while (!isUnique) {
        const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();
        id = `${prefix}-${randomPart}`;
        const existing = await BatchModel.checkIdExists(id);
        if (!existing) {
            isUnique = true;
        }
    }
    return id;
};

// --- Controladores HTTP ---
const getBatchesTree = async (req, res) => {
    const userId = req.user.id;
    try {
        const allBatches = await BatchModel.getAll();

        // Lógica de negocio: Construcción del árbol en memoria
        const batchesProcessed = allBatches.map(b => ({
            ...b,
            data: safeJSONParse(b.data),
            is_locked: !!b.is_locked,
            children: []
        }));

        const batchMap = {};
        batchesProcessed.forEach(b => { batchMap[b.id] = b; });

        const allRoots = [];
        batchesProcessed.forEach(b => {
            if (b.parent_id && batchMap[b.parent_id]) {
                batchMap[b.parent_id].children.push(b);
            } else {
                allRoots.push(b);
            }
        });

        const userRoots = allRoots.filter(root => root.user_id === userId);
        res.status(200).json(userRoots);
    } catch (err) {
        res.status(500).json({ error: "Error batches." });
    }
};

const createBatch = async (req, res) => {
    const userId = req.user.id;
    let {
        plantilla_id, etapa_id, parent_id, data, producto_id, acquisition_id,
        system_template_name, stage_name, stage_order, input_quantity
    } = req.body;

    try {
        if ((!plantilla_id || !etapa_id) && system_template_name && stage_name) {
            // Nota: ensureTemplateAndStageExists debe ser importado arriba
            const resolved = await ensureTemplateAndStageExists(userId, system_template_name, stage_name, stage_order);
            plantilla_id = resolved.plantilla_id;
            etapa_id = resolved.etapa_id;
        }

        const stage = await BatchModel.getStageName(etapa_id);
        if (!stage) return res.status(404).json({ error: "Etapa no encontrada." });

        const prefix = stage.nombre_etapa.substring(0, 3).toUpperCase();
        const newId = await generateUniqueBatchId(prefix);
        data.id = newId;

        let finalProductId = null;
        if (producto_id) finalProductId = producto_id;
        else if (data.productoFinal?.value) finalProductId = data.productoFinal.value;

        const qtyUsed = parseFloat(input_quantity) || 0;

        // Actualizar estado de acopio
        if (acquisition_id) {
            await BatchModel.updateAcquisitionStatus(acquisition_id, userId, 'procesado');
        }

        // Subir imágenes base64 a Supabase antes de persistir
        data = await uploadBatchImages(data, userId);

        // Delegar inserción al modelo según tenga padre o no
        if (!parent_id) {
            await BatchModel.createAsRoot({
                id: data.id, userId, plantilla_id, etapa_id,
                dataString: JSON.stringify(data),
                producto_id: finalProductId,
                acquisition_id: acquisition_id || null,
                input_quantity: qtyUsed
            });
        } else {
            const ownerInfo = await checkBatchOwnership(parent_id, userId);
            if (!ownerInfo) return res.status(403).json({ error: "No tienes permiso." });

            const parentBatch = await BatchModel.getById(parent_id);

            await BatchModel.createWithParent({
                id: data.id,
                plantilla_id: parentBatch.plantilla_id,
                etapa_id, parent_id,
                dataString: JSON.stringify(data),
                producto_id: finalProductId,
                input_quantity: qtyUsed
            });
        }

        // Nota: syncBatchOutputs debe ser importado arriba
        await syncBatchOutputs(data.id, etapa_id, data);

        res.status(201).json({ message: "Lote creado", id: data.id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};

const updateBatch = async (req, res) => {
    const { id } = req.params;
    let { data, producto_id, input_quantity } = req.body;

    try {
        const targetBatch = await BatchModel.getById(id);

        if (!targetBatch) return res.status(404).json({ error: "Lote no encontrado" });
        if (targetBatch.is_locked) return res.status(409).json({ error: "Lote bloqueado." });

        // Obtener userId para el path de imagen (ancestría si es lote hijo)
        const batchUserId = targetBatch.user_id || req.user?.id;

        // Subir imágenes base64 a Supabase antes de persistir
        data = await uploadBatchImages(data, batchUserId);

        let finalProductId = undefined;
        if (producto_id !== undefined) finalProductId = producto_id === "" ? null : producto_id;
        else if (data && data.productoFinal?.value) finalProductId = data.productoFinal.value;

        const qtyUsed = input_quantity !== undefined ? parseFloat(input_quantity) : undefined;

        // El SQL dinámico ahora vive protegido dentro del modelo
        await BatchModel.update(id, {
            dataString: JSON.stringify(data),
            producto_id: finalProductId,
            input_quantity: qtyUsed
        });

        // Nota: syncBatchOutputs debe ser importado arriba
        await syncBatchOutputs(id, targetBatch.etapa_id, data);

        res.status(200).json({ message: "Lote actualizado" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteBatch = async (req, res) => {
    const { id } = req.params;
    try {
        const targetBatch = await checkBatchOwnership(id, req.user.id);
        if (!targetBatch) return res.status(403).json({ error: "Sin permiso." });
        if (targetBatch.is_locked) return res.status(409).json({ error: "Lote bloqueado." });

        // Eliminar imágenes del lote de Supabase antes de borrar el registro
        const { deleteImageByUrl } = require('../utils/storage');
        const batchData = safeJSONParse(targetBatch.data || '{}');
        for (const key of Object.keys(batchData)) {
            const entry = batchData[key];
            if (entry && typeof entry === 'object' && typeof entry.value === 'string' && entry.value.startsWith('https://')) {
                await deleteImageByUrl(entry.value, BATCH_IMAGE_PROVIDER);
            }
        }

        await BatchModel.deleteById(id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const finalizeBatch = async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
        const targetBatch = await checkBatchOwnership(id, userId);
        if (!targetBatch) return res.status(403).json({ error: "Sin permiso." });
        if (targetBatch.is_locked) return res.status(409).json({ error: "Ya finalizado." });

        const rows = await BatchModel.getBatchLineage(id);
        if (rows.length === 0) return res.status(404).json({ error: 'Lote no encontrado' });

        const rootBatch = rows.find(r => !r.parent_id);
        const ownerId = rootBatch.user_id;

        // Ejecución en paralelo usando el modelo
        const [templateInfo, allStages, ownerInfo, acopioData, productoInfo] = await Promise.all([
            BatchModel.getTemplateInfo(rootBatch.plantilla_id),
            BatchModel.getTemplateStagesConfig(rootBatch.plantilla_id),
            BatchModel.getOwnerInfo(rootBatch.user_id),
            rootBatch.acquisition_id ? BatchModel.getAcquisitionById(rootBatch.acquisition_id) : null,
            rootBatch.producto_id ? BatchModel.getProductById(rootBatch.producto_id) : null
        ]);

        const procesadorasList = await BatchModel.getProcesadorasByUserId(ownerId);
        const procesadorasData = procesadorasList.map(p => ({
            ...p,
            coordenadas: safeJSONParse(p.coordenadas || 'null'),
            imagenes_json: safeJSONParse(p.imagenes_json || '[]'),
            premios_json: safeJSONParse(p.premios_json || '[]'),
            certificaciones_json: safeJSONParse(p.certificaciones_json || '[]')
        }));

        const historySnapshot = {
            productName: templateInfo.nombre_producto,
            ownerInfo,
            stages: [],
            fincaData: null,
            procesadorasData: procesadorasData,
            acopioData: acopioData ? { ...acopioData, data_adicional: safeJSONParse(acopioData.data_adicional) } : null,
            productoFinal: null,
            nutritionalData: null,
            perfilSensorialData: null,
            ruedaSaborData: null,
            maridajesRecomendados: {},
            generatedAt: new Date().toISOString()
        };

        if (productoInfo) {
            historySnapshot.productoFinal = { ...productoInfo, imagenes_json: safeJSONParse(productoInfo.imagenes_json), premios_json: safeJSONParse(productoInfo.premios_json) };
            if (productoInfo.receta_nutricional_id) {
                const receta = await BatchModel.getNutritionalRecipeById(productoInfo.receta_nutricional_id);
                if (receta) {
                    const ing = await BatchModel.getRecipeIngredients(receta.id);
                    historySnapshot.nutritionalData = { ...receta, ingredientes: ing.map(i => ({ ...i, nutrientes_base_json: safeJSONParse(i.nutrientes_base_json) })) };
                }
            }
        }

        // --- DESGLOSE ACOPIO ---
        if (historySnapshot.acopioData) {
            const ad = historySnapshot.acopioData.data_adicional || {};
            const imgs = safeJSONParse(acopioData.imagenes_json || '{}');

            if (acopioData.finca_origen) {
                const finca = await BatchModel.getFincaByNameAndUser(acopioData.finca_origen, userId);
                if (finca) historySnapshot.fincaData = { ...finca, coordenadas: safeJSONParse(finca.coordenadas), imagenes_json: safeJSONParse(finca.imagenes_json), certificaciones_json: safeJSONParse(finca.certificaciones_json), premios_json: safeJSONParse(finca.premios_json) };
            }

            const acopioStagesDef = allStages.filter(s => s.fase === 'acopio' || (s.orden <= 3 && s.nombre_etapa.match(/(cosecha|ferment|secado)/i)));
            acopioStagesDef.forEach(stageDef => {
                const suffix = `__${stageDef.orden}`;
                let stageData = {}; let dataFound = false;

                Object.keys(ad).forEach(key => { if (key.endsWith(suffix)) { stageData[key.split('__')[0]] = ad[key]; dataFound = true; } });
                const fields = safeJSONParse(stageDef.campos_json);
                [...(fields.entradas || []), ...(fields.variables || []), ...(fields.salidas || [])].map(f => f.name).forEach(fname => { if (!stageData[fname] && ad[fname]) { stageData[fname] = ad[fname]; dataFound = true; } });

                Object.keys(imgs).forEach(key => {
                    if (key.endsWith(suffix)) {
                        stageData['imageUrl'] = { value: imgs[key], visible: true, nombre: 'Foto' };
                        dataFound = true;
                    }
                });

                if (dataFound) {
                    historySnapshot.stages.push({
                        id: `${acopioData.id}_S${stageDef.orden}`,
                        nombre_etapa: stageDef.nombre_etapa,
                        descripcion: stageDef.descripcion,
                        campos_json: fields,
                        data: stageData,
                        blockchain_hash: null,
                        is_locked: true,
                        timestamp: acopioData.fecha_acopio
                    });
                }
            });
        }

        let perfilId = null, ruedaId = null;
        const rootData = safeJSONParse(rootBatch.data);

        if (rootData.target_profile_id?.value) perfilId = rootData.target_profile_id.value;
        if (rootData.target_wheel_id?.value) ruedaId = rootData.target_wheel_id.value;

        if (!perfilId || !ruedaId) {
            for (const row of rows) {
                const rd = safeJSONParse(row.data);
                if (!perfilId && rd.tipoPerfil?.value) perfilId = rd.tipoPerfil.value;
                if (!ruedaId && rd.tipoRuedaSabor?.value) ruedaId = rd.tipoRuedaSabor.value;
            }
        }

        if (perfilId) {
            let perfil = await BatchModel.getSensoryProfileById(perfilId);
            if (!perfil && isNaN(perfilId)) perfil = await BatchModel.getSensoryProfileByNameAndUser(perfilId, userId);

            if (perfil) {
                historySnapshot.perfilSensorialData = safeJSONParse(perfil.perfil_data);

                if (perfil.tipo === 'cacao' && typeof calcularMaridajeCacaoCafe === 'function') {
                    const allCafes = await BatchModel.getCoffeeProfilesByUser(userId);
                    const recCafe = allCafes.map(cafe => ({
                        producto: { ...cafe, perfil_data: safeJSONParse(cafe.perfil_data) },
                        puntuacion: calcularMaridajeCacaoCafe(historySnapshot.perfilSensorialData, safeJSONParse(cafe.perfil_data))
                    })).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 3);

                    historySnapshot.maridajesRecomendados = { cafe: recCafe };
                }
            }
        }

        if (ruedaId) {
            const rueda = await BatchModel.getTasteWheelById(ruedaId);
            if (rueda) historySnapshot.ruedaSaborData = { ...rueda, notas_json: safeJSONParse(rueda.notas_json) };
        }

        rows.sort((a, b) => {
            const sA = allStages.find(s => s.id === a.etapa_id)?.orden || 0;
            const sB = allStages.find(s => s.id === b.etapa_id)?.orden || 0;
            return sA - sB;
        }).forEach(row => {
            const sInfo = allStages.find(s => s.id === row.etapa_id);
            if (sInfo) historySnapshot.stages.push({
                id: row.id,
                nombre_etapa: sInfo.nombre_etapa,
                descripcion: sInfo.descripcion,
                campos_json: safeJSONParse(sInfo.campos_json),
                data: safeJSONParse(row.data),
                blockchain_hash: row.blockchain_hash,
                is_locked: row.is_locked,
                timestamp: row.created_at
            });
        });

        const dataToHash = { id, snapshot: historySnapshot, salt: crypto.randomBytes(16).toString('hex') };
        const hash = crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');
        historySnapshot.blockchain_hash = hash;

        // Guardar certificado inmutable en la BD
        await BatchModel.upsertTraceabilityRegistry({
            id: id,
            batch_id: id,
            user_id: userId,
            nombre_producto: templateInfo.nombre_producto,
            gtin: historySnapshot.productoFinal?.gtin,
            fecha_finalizacion: historySnapshot.generatedAt,
            snapshot_data: JSON.stringify(historySnapshot),
            blockchain_hash: hash
        });

        // Bloquear el lote actual
        await BatchModel.lockBatchAndSetHash(id, hash);

        // Bloquear todos los lotes padre iterativamente
        let curr = targetBatch.parent_id;
        while (curr) {
            await BatchModel.lockBatch(curr);
            const p = await BatchModel.getParentId(curr);
            curr = p ? p.parent_id : null;
        }

        res.status(200).json({ message: "Certificado exitosamente.", hash });
    } catch (err) {
        console.error("Error finalizeBatch:", err);
        res.status(500).json({ error: err.message });
    }
};

const getImmutableBatches = async (req, res) => {
    const userId = req.user.id;

    try {
        const rows = await BatchModel.getImmutableBatchesByUserId(userId);

        const result = rows.map(row => {
            const dataObj = safeJSONParse(row.data);

            if (!dataObj.finca && row.finca_nombre) {
                dataObj.finca = { value: row.finca_nombre, visible: true, nombre: 'Finca Origen' };
            }
            if (!dataObj.ciudad && row.finca_ciudad) {
                dataObj.ciudad = { value: row.finca_ciudad, visible: true, nombre: 'Ciudad' };
            }
            if (!dataObj.ubicacion && row.finca_ciudad && row.finca_pais) {
                dataObj.ubicacion = { value: `${row.finca_ciudad}, ${row.finca_pais}`, visible: true, nombre: 'Ubicación' };
            }

            return {
                ...row,
                data: dataObj
            };
        });

        res.status(200).json(result);
    } catch (err) {
        console.error("Error en getImmutableBatches:", err);
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getBatchesTree,
    createBatch,
    updateBatch,
    deleteBatch,
    finalizeBatch,
    getImmutableBatches
};