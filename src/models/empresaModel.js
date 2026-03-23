const db = require('../config/db');

// Obtener empresas verificadas con su conteo de lotes inmutables
const getVerifiedCompaniesWithImmutable = async () => {
    const sql = `
        SELECT 
            CAST(u.id AS TEXT) as id, 
            cp.name as name, 
            cp.logo_url as logo, 
            cp.company_type as type,
            cp.product_categories,
            'verified' as status,
            COUNT(DISTINCT tr.id) as lotes_count,
            COALESCE(f.pais, p.pais) as pais,
            COALESCE(f.departamento, p.departamento) as departamento,
            COALESCE(f.provincia, p.provincia) as provincia,
            COALESCE(f.coordenadas, p.coordenadas) as coordenadas,
            LOWER(COALESCE(f.tipo, p.tipo)) as sub_type
        FROM users u
        JOIN company_profiles cp ON u.id = cp.user_id
        LEFT JOIN fincas f ON cp.company_type = 'finca' AND cp.company_id = f.id
        LEFT JOIN procesadoras p ON cp.company_type = 'procesadora' AND cp.company_id = p.id
        LEFT JOIN traceability_registry tr ON CAST(u.id AS TEXT) = CAST(tr.user_id AS TEXT)
            AND tr.blockchain_hash IS NOT NULL 
            AND tr.blockchain_hash != ''
        WHERE cp.is_published IS TRUE
        GROUP BY u.id, cp.name, cp.logo_url, cp.company_type, cp.product_categories, 
                 f.pais, f.departamento, f.provincia, p.pais, p.departamento, p.provincia, 
                 f.coordenadas, p.coordenadas, f.tipo, p.tipo
    `;
    return await db.all(sql);
};

// Obtener empresas sugeridas (pendientes)
const getSuggestedCompanies = async () => {
    const sql = `
        SELECT id, name, logo, type, 'pending' as status, pais, departamento, provincia, distrito, 0 as lotes_count, coordenadas, product_categories, LOWER(sub_type) as sub_type
        FROM suggested_companies WHERE status = 'pending'
    `;
    return await db.all(sql);
};

const getSuggestedById = async (id) => {
    return await db.get('SELECT * FROM suggested_companies WHERE id = ?', [id]);
};

const getVerifiedProfileByUserId = async (userId) => {
    const sql = `
        SELECT 
            u.id as u_id, u.empresa as u_empresa, u.company_type as u_type, u.company_id as u_company_id,
            u.company_logo as u_logo, u.celular as u_phone, u.correo as u_email,
            u.social_instagram as u_ig, u.social_facebook as u_fb,
            cp.name as cp_name, cp.company_type as cp_type, cp.company_id as cp_company_id,
            cp.logo_url, cp.cover_image_url, cp.history_text, cp.contact_email,
            cp.contact_phone, cp.social_instagram as cp_ig, cp.social_facebook as cp_fb,
            cp.website_url, cp.is_published
        FROM users u
        LEFT JOIN company_profiles cp ON u.id = cp.user_id
        WHERE u.id = ?
    `;
    return await db.get(sql, [userId]);
};

// 5. (NUEVO) Obtener los datos físicos de una Finca
const getFincaById = async (id) => {
    return await db.get('SELECT * FROM fincas WHERE id = ?', [id]);
};

// 6. (NUEVO) Obtener los datos físicos de una Procesadora
const getProcesadoraById = async (id) => {
    return await db.get('SELECT * FROM procesadoras WHERE id = ?', [id]);
};

module.exports = {
    getVerifiedCompaniesWithImmutable,
    getSuggestedCompanies,
    getSuggestedById,
    getVerifiedProfileByUserId
};