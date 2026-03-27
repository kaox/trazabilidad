const db = require('../config/db');

// Obtener un producto especifico
const getByIdAndUserId = async (id, userId) => {
    const sql = `SELECT * FROM productos WHERE id = ? AND user_id = ? AND deleted_at IS NULL`;
    return await db.get(sql, [id, userId]);
};

// Obtener productos activos de un usuario
const getAllByUserId = async (userId) => {
    const sql = `
        SELECT p.*, r.nombre as receta_nutricional_nombre,
               u.code as unit_code, c.symbol as currency_symbol,
               f.nombre_finca as finca_nombre
        FROM productos p
        LEFT JOIN recetas_nutricionales r ON p.receta_nutricional_id = r.id
        LEFT JOIN units_of_measure u ON p.unit_id = u.id
        LEFT JOIN currencies c ON p.currency_id = c.id
        LEFT JOIN fincas f ON p.finca_id = f.id
        WHERE p.user_id = ? AND p.deleted_at IS NULL
        ORDER BY p.created_at DESC
    `;
    return await db.all(sql, [userId]);
};

// Crear un nuevo producto
const create = async (data) => {
    const sql = `
        INSERT INTO productos (
            id, user_id, nombre, descripcion, gtin, is_formal_gtin, 
            imagenes_json, ingredientes, tipo_producto, peso, premios_json, 
            receta_nutricional_id, is_published, perfil_id, rueda_id,
            variedad, proceso, nivel_tueste, puntaje_sca,
            unit_id, precio, currency_id, finca_id, grupo_genetico, porcentaje_cacao
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // El orden de los parámetros debe coincidir con la query
    const params = [
        data.id, data.user_id, data.nombre, data.descripcion, data.gtin, data.is_formal_gtin,
        data.imagenes_json, data.ingredientes, data.tipo_producto, data.peso, data.premios_json,
        data.receta_nutricional_id, data.is_published, data.perfil_id, data.rueda_id,
        data.variedad, data.proceso, data.nivel_tueste, data.puntaje_sca,
        data.unit_id, data.precio, data.currency_id, data.finca_id, data.grupo_genetico, data.porcentaje_cacao
    ];

    return await db.run(sql, params);
};

// Actualizar producto
const update = async (id, userId, data) => {
    const sql = `
        UPDATE productos SET 
            nombre = ?, descripcion = ?, gtin = ?, imagenes_json = ?, 
            ingredientes = ?, tipo_producto = ?, peso = ?, premios_json = ?, 
            receta_nutricional_id = ?, is_published = ?, perfil_id = ?, rueda_id = ?,
            variedad = ?, proceso = ?, nivel_tueste = ?, puntaje_sca = ?,
            unit_id = ?, precio = ?, currency_id = ?, finca_id = ?, 
            grupo_genetico = ?, porcentaje_cacao = ?
        WHERE id = ? AND user_id = ?
    `;

    const params = [
        data.nombre, data.descripcion, data.gtin, data.imagenes_json,
        data.ingredientes, data.tipo_producto, data.peso, data.premios_json,
        data.receta_nutricional_id, data.is_published, data.perfil_id, data.rueda_id,
        data.variedad, data.proceso, data.nivel_tueste, data.puntaje_sca,
        data.unit_id, data.precio, data.currency_id, data.finca_id,
        data.grupo_genetico, data.porcentaje_cacao,
        id, userId
    ];

    return await db.run(sql, params);
};

// Verificar si el producto se está usando en algún lote
const checkUsageInBatches = async (productId) => {
    return await db.get('SELECT id FROM batches WHERE producto_id = ? LIMIT 1', [productId]);
};

// Eliminación Lógica (Soft Delete): Solo marca la fecha, no borra el registro
const softDelete = async (id, userId) => {
    return await db.run(
        'UPDATE productos SET deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
        [id, userId]
    );
};

// Eliminación Física (Hard Delete): Borra el registro de la BD
const hardDelete = async (id, userId) => {
    return await db.run(
        'DELETE FROM productos WHERE id = ? AND user_id = ?',
        [id, userId]
    );
};

// Listar Productos de una Empresa con/sin trazabilidad inmutable
const getPublicProductsWithImmutable = async (userId) => {
    const sql = `
        WITH RECURSIVE BatchLineage AS (
            -- 1. Ancla: Empezamos desde los lotes certificados
            SELECT 
                b.id as target_batch_id, 
                b.parent_id, 
                b.producto_id,
                tr.id as registry_id
            FROM batches b
            JOIN traceability_registry tr ON CAST(b.id AS TEXT) = CAST(tr.batch_id AS TEXT)
            
            UNION ALL
            
            -- 2. Recursión: Vamos subiendo hacia los padres buscando datos
            SELECT 
                bl.target_batch_id, 
                parent.parent_id, 
                parent.producto_id,
                bl.registry_id
            FROM batches parent
            JOIN BatchLineage bl ON CAST(bl.parent_id AS TEXT) = CAST(parent.id AS TEXT)
        ),
        ResolvedProducts AS (
            -- 3. Consolidación
            SELECT 
                target_batch_id,
                registry_id,
                MAX(producto_id) as producto_id
            FROM BatchLineage
            WHERE producto_id IS NOT NULL AND producto_id != ''
            GROUP BY target_batch_id, registry_id
        )
        -- 4. Consulta Final: Solo productos ACTIVOS y PUBLICADOS
        SELECT DISTINCT 
            p.id, 
            p.nombre, 
            p.descripcion, 
            p.imagenes_json, 
            p.tipo_producto,
            COUNT(rp.registry_id) as lotes_count
        FROM productos p
        JOIN ResolvedProducts rp ON CAST(p.id AS TEXT) = CAST(rp.producto_id AS TEXT)
        WHERE CAST(p.user_id AS TEXT) = ? 
          AND (p.is_published IS TRUE OR p.is_published IS NULL)
          AND p.deleted_at IS NULL
        GROUP BY p.id, p.nombre, p.descripcion, p.imagenes_json, p.tipo_producto
        ORDER BY p.nombre ASC
    `;

    return await db.all(sql, [String(userId)]);
};

const getMarketplaceBaseProducts = async (tipo) => {
    let sql = `
        SELECT
            p.id as product_id,
            p.user_id as company_id,
            p.nombre as product_name,
            p.imagen_url as product_imagen,
            p.descripcion as product_descripcion,
            p.peso as presentacion,
            p.tipo_producto as product_tipo,
            p.variedad as product_variedad,
            p.proceso as product_proceso,
            p.nivel_tueste as product_nivel_tueste,
            p.puntaje_sca as product_puntaje_sca,
            p.premios_json as product_premios_json,
            p.imagenes_json as product_imagenes_json,
            p.precio as product_precio,
            c.symbol as currency_symbol,
            u_measure.code as unit_code,
            f.nombre_finca as finca_nombre,
            perf.perfil_data as perfil_data,
            perf.tipo as perfil_tipo,
            rueda.notas_json as sabores_json,
            rueda.tipo as sabores_tipo,
            cp.name as company_name,
            cp.company_type as company_type,
            COALESCE(cp.logo_url, u.company_logo) as company_logo
        FROM productos p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN currencies c ON p.currency_id = c.id
        LEFT JOIN units_of_measure u_measure ON p.unit_id = u_measure.id
        LEFT JOIN fincas f ON p.finca_id = f.id
        LEFT JOIN company_profiles cp ON u.id = cp.user_id
        LEFT JOIN perfiles perf ON p.perfil_id = perf.id
        LEFT JOIN ruedas_sabores rueda ON p.rueda_id = rueda.id
        WHERE p.is_published IS TRUE AND p.deleted_at IS NULL
    `;
    const params = [];

    if (tipo && tipo !== 'todos') {
        sql += ` AND LOWER(p.tipo_producto) = LOWER(?)`;
        params.push(tipo);
    }

    return await db.all(sql, params);
};

const getPublicProductsWithProfilesByUserId = async (userId) => {
    const sql = `
        SELECT 
            p.id, p.nombre, p.descripcion, p.imagenes_json, p.tipo_producto, p.premios_json, p.peso,
            perf.perfil_data, 
            rueda.notas_json, rueda.nombre_rueda
        FROM productos p
        LEFT JOIN perfiles perf ON p.perfil_id = perf.id
        LEFT JOIN ruedas_sabores rueda ON p.rueda_id = rueda.id
        WHERE p.user_id = ? 
          AND p.deleted_at IS NULL
          AND (p.is_published IS TRUE OR p.is_published IS NULL)
        ORDER BY p.nombre ASC
    `;
    return await db.all(sql, [userId]);
};

const getBasicPublicProductsByUserId = async (userId) => {
    const sql = `
        SELECT p.id, p.nombre, p.descripcion, p.imagenes_json, p.tipo_producto,
               p.variedad, p.proceso, p.nivel_tueste, p.puntaje_sca
        FROM productos p
        WHERE p.user_id = ? AND p.deleted_at IS NULL
          AND (p.is_published IS TRUE OR p.is_published IS NULL)
        ORDER BY p.nombre ASC
    `;
    return await db.all(sql, [userId]);
};

module.exports = {
    getByIdAndUserId,
    getAllByUserId,
    create, update,
    checkUsageInBatches,
    softDelete,
    hardDelete,
    getPublicProductsWithImmutable,
    getMarketplaceBaseProducts,
    getPublicProductsWithProfilesByUserId,
    getBasicPublicProductsByUserId
};