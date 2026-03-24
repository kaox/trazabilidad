const EmpresaModel = require('../models/empresaModel');
const ProductoModel = require('../models/productoModel');
const RegistroModel = require('../models/registroModel');
const FincaModel = require('../models/fincaModel');
const ProcesadoraModel = require('../models/procesadoraModel');
const { safeJSONParse } = require('../utils/helpers');

const getCompanyLandingData = async (req, res) => {
    const { userId } = req.params;

    try {
        let isSuggested = userId.startsWith('SUG-');

        // --- CASO A: EMPRESA SUGERIDA ---
        if (isSuggested) {
            const suggestion = await EmpresaModel.getSuggestedById(userId);
            if (!suggestion) return res.status(404).json({ error: "Sugerencia no encontrada" });

            return res.json({
                user: {
                    id: suggestion.id,
                    name: suggestion.name,
                    logo: suggestion.logo,
                    type: suggestion.type,
                    is_suggested: true
                },
                entity: {
                    nombre_finca: suggestion.type === 'finca' ? suggestion.name : null,
                    nombre_comercial: suggestion.type === 'procesadora' ? suggestion.name : null,
                    pais: suggestion.pais,
                    departamento: suggestion.departamento,
                    provincia: suggestion.provincia,
                    distrito: suggestion.distrito,
                    altura: suggestion.altura,
                    superficie: suggestion.superficie,
                    coordenadas: safeJSONParse(suggestion.coordenadas),
                    type_label: suggestion.type === 'finca' ? 'Finca Sugerida' : 'Planta Sugerida',
                    historia: "Esta empresa fue sugerida por la comunidad. La información mostrada es referencial basada en datos satelitales.",
                    social_instagram: suggestion.social_instagram,
                    social_facebook: suggestion.social_facebook
                },
                products: []
            });
        }

        // --- CASO B: EMPRESA VERIFICADA ---
        
        // 1. Perfil Consolidado (Primera llamada para saber qué tipo de entidad buscar luego)
        const userRow = await EmpresaModel.getVerifiedProfileByUserId(userId);
        if (!userRow) return res.status(404).json({ error: "Empresa no encontrada" });

        const companyData = {
            id: userId,
            name: userRow.cp_name || userRow.u_empresa,
            type: userRow.cp_type || userRow.u_type,
            logo: userRow.logo_url || userRow.u_logo,
            cover: userRow.cover_image_url || null,
            history: userRow.history_text || '',
            phone: userRow.contact_phone || userRow.u_phone || '',
            email: userRow.contact_email || userRow.u_email || '',
            instagram: userRow.cp_ig || userRow.u_ig || '',
            facebook: userRow.cp_fb || userRow.u_fb || '',
            website: userRow.website_url || '',
            is_suggested: false
        };

        const actualCompanyId = userRow.cp_company_id || userRow.u_company_id;

        // 2. Ejecución Paralela: Obtenemos Entidad, Productos y Registros al mismo tiempo
        let entityPromise = Promise.resolve({});
        if (companyData.type === 'finca' && actualCompanyId) {
            entityPromise = FincaModel.getById(actualCompanyId).then(e => { if (e) e.type_label = 'Finca Productora'; return e || {}; });
        } else if (companyData.type === 'procesadora' && actualCompanyId) {
            entityPromise = ProcesadoraModel.getById(actualCompanyId).then(e => { if (e) e.type_label = 'Planta de Procesamiento'; return e || {}; });
        }

        const [entityData, products, registryRows] = await Promise.all([
            entityPromise,
            ProductoModel.getPublicProductsWithProfilesByUserId(userId),
            RegistroModel.getCompletedRegistriesByUserId(userId)
        ]);

        // 3. Parsear JSONs de la entidad
        if (entityData.id) {
            entityData.imagenes = safeJSONParse(entityData.imagenes_json || '[]');
            entityData.certificaciones = safeJSONParse(entityData.certificaciones_json || '[]');
            entityData.premios = safeJSONParse(entityData.premios_json || '[]');
            entityData.coordenadas = safeJSONParse(entityData.coordenadas || 'null');
        }

        // 4. Mapear los lotes a sus productos correspondientes
        const batchesByProduct = {};
        for (const row of registryRows) {
            const snapshot = safeJSONParse(row.snapshot_data || '{}');
            let prodId = snapshot.productoFinal?.id;

            if (prodId) {
                if (!batchesByProduct[prodId]) batchesByProduct[prodId] = [];

                if (batchesByProduct[prodId].length < 5) {
                    let fincaOrigen = 'Origen Verificado';
                    if (snapshot.fincaData && snapshot.fincaData.nombre_finca) fincaOrigen = snapshot.fincaData.nombre_finca;
                    else if (snapshot.acopioData && snapshot.acopioData.finca_origen) fincaOrigen = snapshot.acopioData.finca_origen;

                    batchesByProduct[prodId].push({
                        id: row.id,
                        blockchain_hash: row.blockchain_hash,
                        fecha_finalizacion: row.fecha_finalizacion,
                        finca_origen: fincaOrigen,
                        pais: snapshot.fincaData?.pais || '',
                        departamento: snapshot.fincaData?.departamento || ''
                    });
                }
            }
        }

        // 5. Ensamblar los productos finales
        const productsWithBatches = products.map(p => ({
            ...p,
            imagenes: safeJSONParse(p.imagenes_json || '[]'),
            premios: safeJSONParse(p.premios_json || '[]'),
            perfil_data: safeJSONParse(p.perfil_data),
            notas_rueda: safeJSONParse(p.notas_json),
            recent_batches: batchesByProduct[p.id] || []
        }));

        // 6. Enviar Respuesta
        res.json({
            user: companyData,
            entity: entityData,
            products: productsWithBatches
        });

    } catch (e) {
        console.error("Error Landing:", e);
        res.status(500).json({ error: e.message });
    }
};

const getCompanyLandingDataInternal = async (userId) => {
    try {
        const isSuggested = String(userId).startsWith('SUG-');

        if (isSuggested) {
            const suggestion = await EmpresaModel.getSuggestedById(userId);
            if (!suggestion) return null;
            return {
                user: {
                    id: suggestion.id, name: suggestion.name, logo: suggestion.logo,
                    type: suggestion.type, is_suggested: true, celular: null,
                    instagram: suggestion.social_instagram, facebook: suggestion.social_facebook
                },
                entity: {
                    nombre_finca: suggestion.type === 'finca' ? suggestion.name : null,
                    nombre_comercial: suggestion.type === 'procesadora' ? suggestion.name : null,
                    pais: suggestion.pais, departamento: suggestion.departamento,
                    provincia: suggestion.provincia, distrito: suggestion.distrito,
                    coordenadas: safeJSONParse(suggestion.coordenadas),
                    imagenes: [], certificaciones: [], premios: [], historia: null,
                    social_instagram: suggestion.social_instagram, social_facebook: suggestion.social_facebook
                },
                products: []
            };
        }

        const userRow = await EmpresaModel.getVerifiedProfileByUserId(userId);
        if (!userRow) return null;

        const companyData = {
            id: userId,
            name: userRow.cp_name || userRow.u_empresa,
            type: userRow.cp_type || userRow.u_type,
            logo: userRow.logo_url || userRow.u_logo,
            cover: userRow.cover_image_url || null,
            history: userRow.history_text || '',
            celular: userRow.contact_phone || userRow.u_phone || '',
            email: userRow.contact_email || userRow.u_email || '',
            instagram: userRow.cp_ig || userRow.u_ig || '',
            facebook: userRow.cp_fb || userRow.u_fb || '',
            is_suggested: false
        };

        const actualCompanyId = userRow.cp_company_id || userRow.u_company_id;

        let entityPromise = Promise.resolve({});
        if (companyData.type === 'finca' && actualCompanyId) {
            entityPromise = EmpresaModel.getFincaById(actualCompanyId);
        } else if (companyData.type === 'procesadora' && actualCompanyId) {
            entityPromise = EmpresaModel.getProcesadoraById(actualCompanyId);
        }

        // Usamos el nuevo método del modelo de productos
        const productsPromise = ProductoModel.getBasicPublicProductsByUserId(userId);

        const [entityData, products] = await Promise.all([entityPromise, productsPromise]);

        if (entityData && entityData.id) {
            entityData.imagenes = safeJSONParse(entityData.imagenes_json || '[]');
            entityData.certificaciones = safeJSONParse(entityData.certificaciones_json || '[]');
            entityData.premios = safeJSONParse(entityData.premios_json || '[]');
            entityData.coordenadas = safeJSONParse(entityData.coordenadas || 'null');
        }

        const productsFormatted = products.map(p => ({
            ...p,
            imagenes: safeJSONParse(p.imagenes_json || '[]')
        }));

        return { user: companyData, entity: entityData || {}, products: productsFormatted };

    } catch (e) {
        console.error('Error getCompanyLandingDataInternal:', e);
        return null;
    }
};

module.exports = { getCompanyLandingData, getCompanyLandingDataInternal };