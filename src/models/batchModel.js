const db = require('../config/db');

// Obtener todos los lotes (para construir el árbol)
const getAll = async () => {
    return await db.all('SELECT * FROM batches', []);
};

// Obtener un lote específico por ID
const getById = async (id) => {
    return await db.get('SELECT id, user_id, parent_id, is_locked, etapa_id, plantilla_id FROM batches WHERE id = ?', [id]);
};

// Encontrar al dueño raíz de un lote a través de sus ancestros usando recursión (CTE)
const getRootOwnerByAncestry = async (batchId) => {
    const sql = `
        WITH RECURSIVE ancestry AS (
            SELECT id, parent_id, user_id FROM batches WHERE id = ? 
            UNION ALL 
            SELECT b.id, b.parent_id, b.user_id FROM batches b 
            JOIN ancestry a ON b.id = a.parent_id
        ) 
        SELECT user_id FROM ancestry WHERE user_id IS NOT NULL LIMIT 1
    `;
    return await db.get(sql, [batchId]);
};

// Verificar si un ID de lote ya existe
const checkIdExists = async (id) => {
    return await db.get('SELECT id FROM batches WHERE id = ?', [id]);
};

// Obtener nombre de la etapa
const getStageName = async (etapaId) => {
    return await db.get('SELECT nombre_etapa FROM etapas_plantilla WHERE id = ?', [etapaId]);
};

// Actualizar el estado de un acopio
const updateAcquisitionStatus = async (acquisitionId, userId, status) => {
    return await db.run("UPDATE acquisitions SET estado = ? WHERE id = ? AND user_id = ?", [status, acquisitionId, userId]);
};

// Crear lote raíz (sin padre)
const createAsRoot = async (data) => {
    const sql = `
        INSERT INTO batches (
            id, user_id, plantilla_id, etapa_id, parent_id, 
            data, producto_id, acquisition_id, input_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        data.id, data.userId, data.plantilla_id, data.etapa_id, null, 
        data.dataString, data.producto_id, data.acquisition_id, data.input_quantity
    ];
    return await db.run(sql, params);
};

// Crear sub-lote (con padre heredado)
const createWithParent = async (data) => {
    const sql = `
        INSERT INTO batches (
            id, plantilla_id, etapa_id, parent_id, 
            data, producto_id, input_quantity
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        data.id, data.plantilla_id, data.etapa_id, data.parent_id, 
        data.dataString, data.producto_id, data.input_quantity
    ];
    return await db.run(sql, params);
};

// Actualizar un lote (SQL dinámico manejado dentro del modelo)
const update = async (id, updateData) => {
    let sql = 'UPDATE batches SET data = ?';
    let params = [updateData.dataString];

    if (updateData.producto_id !== undefined) {
        sql += ', producto_id = ?';
        params.push(updateData.producto_id);
    }

    if (updateData.input_quantity !== undefined) {
        sql += ', input_quantity = ?';
        params.push(updateData.input_quantity);
    }

    sql += ' WHERE id = ?';
    params.push(id);

    return await db.run(sql, params);
};

// Eliminar un lote
const deleteById = async (id) => {
    return await db.run('DELETE FROM batches WHERE id = ?', [id]);
};

// Buscar si la plantilla ya existe
const getTemplateByProduct = async (userId, systemTemplateName) => {
    return await db.get('SELECT id FROM plantillas_proceso WHERE user_id = ? AND nombre_producto = ?', [userId, systemTemplateName]);
};

// Crear nueva plantilla clonada
const createTemplate = async (userId, productName, description) => {
    return await db.run('INSERT INTO plantillas_proceso (user_id, nombre_producto, descripcion) VALUES (?, ?, ?)', [userId, productName, description]);
};

// Crear etapa de plantilla
const createTemplateStage = async (templateId, name, description, order, jsonFields, phase) => {
    return await db.run(
        'INSERT INTO etapas_plantilla (plantilla_id, nombre_etapa, descripcion, orden, campos_json, fase) VALUES (?, ?, ?, ?, ?, ?)',
        [templateId, name, description, order, jsonFields, phase]
    );
};

// Buscar etapa por nombre y orden
const getStageByNameAndOrder = async (templateId, stageName, stageOrder) => {
    let stageSql = 'SELECT id FROM etapas_plantilla WHERE plantilla_id = ? AND nombre_etapa = ?';
    let stageParams = [templateId, stageName];
    if (stageOrder) {
        stageSql += ' AND orden = ?';
        stageParams.push(stageOrder);
    }
    return await db.get(stageSql, stageParams);
};

// Obtener configuración JSON de la etapa para sincronizar outputs
const getStageConfig = async (etapaId) => {
    return await db.get('SELECT campos_json FROM etapas_plantilla WHERE id = ?', [etapaId]);
};

// Borrar outputs anteriores del lote
const deleteBatchOutputs = async (batchId) => {
    return await db.run('DELETE FROM batch_outputs WHERE batch_id = ?', [batchId]);
};

// Registrar nuevo output de lote
const createBatchOutput = async (data) => {
    const sql = `
        INSERT INTO batch_outputs (
            id, batch_id, product_type, quantity, output_category, unit_id, unit_cost, currency_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        data.id, data.batchId, data.productType, data.quantity, 
        data.outputCategory, data.unitId, data.unitCost, data.currencyId
    ];
    return await db.run(sql, params);
};

const getBatchLineage = async (id) => {
    return await db.all(`WITH RECURSIVE trace AS (SELECT * FROM batches WHERE id = ? UNION ALL SELECT b.* FROM batches b INNER JOIN trace t ON b.id = t.parent_id) SELECT * FROM trace;`, [id]);
};
const getTemplateInfo = async (id) => await db.get('SELECT nombre_producto FROM plantillas_proceso WHERE id = ?', [id]);
const getTemplateStagesConfig = async (id) => await db.all('SELECT id, nombre_etapa, descripcion, orden, campos_json, fase FROM etapas_plantilla WHERE plantilla_id = ? ORDER BY orden', [id]);
const getOwnerInfo = async (id) => await db.get('SELECT empresa, company_logo, subscription_tier FROM users WHERE id = ?', [id]);
const getAcquisitionById = async (id) => await db.get('SELECT * FROM acquisitions WHERE id = ?', [id]);
const getProductById = async (id) => await db.get('SELECT * FROM productos WHERE id = ?', [id]);
const getProcesadorasByUserId = async (userId) => await db.all('SELECT * FROM procesadoras WHERE user_id = ?', [userId]);
const getNutritionalRecipeById = async (id) => await db.get('SELECT * FROM recetas_nutricionales WHERE id = ?', [id]);
const getRecipeIngredients = async (id) => await db.all('SELECT * FROM ingredientes_receta WHERE receta_id = ?', [id]);
const getFincaByNameAndUser = async (name, userId) => await db.get('SELECT * FROM fincas WHERE nombre_finca = ? AND user_id = ?', [name, userId]);
const getSensoryProfileById = async (id) => await db.get('SELECT * FROM perfiles WHERE id = ?', [id]);
const getSensoryProfileByNameAndUser = async (name, userId) => await db.get('SELECT * FROM perfiles WHERE nombre = ? AND user_id = ?', [name, userId]);
const getCoffeeProfilesByUser = async (userId) => await db.all("SELECT * FROM perfiles WHERE tipo = 'cafe' AND user_id = ?", [userId]);
const getTasteWheelById = async (id) => await db.get('SELECT * FROM ruedas_sabores WHERE id = ?', [id]);

const upsertTraceabilityRegistry = async (data) => {
    const sql = `
        INSERT INTO traceability_registry (
            id, batch_id, user_id, nombre_producto, gtin, fecha_finalizacion, snapshot_data, blockchain_hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
        ON CONFLICT(id) DO UPDATE SET 
            snapshot_data = excluded.snapshot_data, 
            blockchain_hash = excluded.blockchain_hash
    `;
    return await db.run(sql, [
        data.id, data.batch_id, data.user_id, data.nombre_producto, 
        data.gtin, data.fecha_finalizacion, data.snapshot_data, data.blockchain_hash
    ]);
};

const lockBatchAndSetHash = async (id, hash) => {
    return await db.run('UPDATE batches SET blockchain_hash = ?, is_locked = TRUE WHERE id = ?', [hash, id]);
};

const lockBatch = async (id) => {
    return await db.run('UPDATE batches SET is_locked = TRUE WHERE id = ?', [id]);
};

const getParentId = async (id) => {
    return await db.get('SELECT parent_id FROM batches WHERE id = ?', [id]);
};

const getImmutableBatchesByUserId = async (userId) => {
    const sql = `
        WITH RECURSIVE 
        user_batches AS (
            SELECT id FROM batches WHERE user_id = ?
            UNION ALL
            SELECT l.id 
            FROM batches l 
            JOIN user_batches ub ON l.parent_id = ub.id
        ),
        ancestry AS (
            SELECT id as batch_id, id as root_id, parent_id, acquisition_id 
            FROM batches 
            WHERE parent_id IS NULL
            UNION ALL
            SELECT b.id as batch_id, a.root_id, b.parent_id, COALESCE(b.acquisition_id, a.acquisition_id)
            FROM batches b
            JOIN ancestry a ON b.parent_id = a.batch_id
        )
        SELECT 
            l.id, 
            l.blockchain_hash, 
            l.created_at,
            l.views,
            l.data,
            p.nombre_producto as tipo_proceso,
            e.nombre_etapa as ultima_etapa,
            prod.gtin, 
            prod.nombre as nombre_comercial, 
            COALESCE(AVG(r.rating), 0) as avg_rating,
            COUNT(r.id) as total_reviews,
            acq.finca_origen as finca_nombre,
            f.ciudad as finca_ciudad,
            f.pais as finca_pais
        FROM batches l
        JOIN user_batches ub ON l.id = ub.id
        JOIN plantillas_proceso p ON l.plantilla_id = p.id
        JOIN etapas_plantilla e ON l.etapa_id = e.id
        LEFT JOIN ancestry ans ON l.id = ans.batch_id
        LEFT JOIN acquisitions acq ON ans.acquisition_id = acq.id
        LEFT JOIN fincas f ON acq.finca_origen = f.nombre_finca AND f.user_id = acq.user_id
        LEFT JOIN productos prod ON prod.id = (
            WITH RECURSIVE prod_ancestry AS (
                SELECT id, parent_id, producto_id FROM batches WHERE id = l.id
                UNION ALL
                SELECT parent.id, parent.parent_id, parent.producto_id 
                FROM batches parent 
                JOIN prod_ancestry child ON child.parent_id = parent.id
            )
            SELECT producto_id FROM prod_ancestry WHERE producto_id IS NOT NULL LIMIT 1
        )
        LEFT JOIN product_reviews r ON l.id = r.batch_id
        WHERE l.blockchain_hash IS NOT NULL 
        AND l.blockchain_hash != ''
        GROUP BY l.id, p.nombre_producto, e.nombre_etapa, l.created_at, l.views, l.blockchain_hash, l.data, prod.gtin, prod.nombre, acq.finca_origen, f.ciudad, f.pais
        ORDER BY l.created_at DESC
    `;
    return await db.all(sql, [userId]);
};

const getLatestImmutableBatchByProductId = async (productId) => {
    const sql = `
        SELECT * FROM batches 
        WHERE (producto_id = ? OR 
              id IN (
                  SELECT batch_id FROM (
                      WITH RECURSIVE lineage AS (
                          SELECT id, parent_id, producto_id FROM batches
                          UNION ALL
                          SELECT b.id, b.parent_id, b.producto_id FROM batches b
                          JOIN lineage l ON b.id = l.parent_id
                      )
                      SELECT id as batch_id FROM lineage WHERE producto_id = ?
                  )
              ))
        AND blockchain_hash IS NOT NULL AND blockchain_hash != ''
        ORDER BY created_at DESC LIMIT 1
    `;
    return await db.get(sql, [productId, productId]);
};

module.exports = {
    getAll, getById, getRootOwnerByAncestry, checkIdExists, 
    getStageName, updateAcquisitionStatus, createAsRoot, 
    createWithParent, update, deleteById, 
    getTemplateByProduct, createTemplate, createTemplateStage, getStageByNameAndOrder, 
    getStageConfig, deleteBatchOutputs, createBatchOutput,
    getBatchLineage, getTemplateInfo, getTemplateStagesConfig, getOwnerInfo, 
    getAcquisitionById, getProductById, getProcesadorasByUserId, getNutritionalRecipeById,
    getRecipeIngredients, getFincaByNameAndUser, getSensoryProfileById, getSensoryProfileByNameAndUser,
    getCoffeeProfilesByUser, getTasteWheelById, upsertTraceabilityRegistry, lockBatchAndSetHash, 
    lockBatch, getParentId, getImmutableBatchesByUserId, getLatestImmutableBatchByProductId
};