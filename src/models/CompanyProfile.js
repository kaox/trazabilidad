/**
 * src/models/CompanyProfile.js
 * Modelo para interactuar con la tabla company_profiles compatible con db.js (SQLite/Postgres)
 */
const { get, run } = require('../config/db.js');
const crypto = require('crypto');

const CompanyProfile = {
    /**
     * Obtiene el perfil comercial de un usuario por su ID.
     */
    findByUserId: async (userId) => {
        try {
            const sql = 'SELECT * FROM company_profiles WHERE user_id = ?';
            const profile = await get(sql, [userId]);

            if (profile) {
                profile.is_published = profile.is_published === 1 || profile.is_published === true;
                // Parsear las categorías si existen
                if (profile.product_categories) {
                    try {
                        profile.product_categories = JSON.parse(profile.product_categories);
                    } catch (e) {
                        profile.product_categories = [];
                    }
                } else {
                    profile.product_categories = [];
                }
            }
            return profile || null;
        } catch (error) {
            console.error('Error in CompanyProfile.findByUserId:', error);
            throw error;
        }
    },

    /**
     * Verifica si un subdominio ya está en uso por otro usuario.
     */
    isSubdomainAvailable: async (subdomain, excludeUserId) => {
        try {
            const sql = 'SELECT id FROM company_profiles WHERE subdomain = ? AND user_id != ?';
            const row = await get(sql, [subdomain.toLowerCase(), excludeUserId]);
            return !row;
        } catch (error) {
            console.error('Error in CompanyProfile.isSubdomainAvailable:', error);
            throw error;
        }
    },

    /**
     * Verifica si un custom_domain ya está en uso por otro usuario.
     */
    isCustomDomainAvailable: async (domain, excludeUserId) => {
        try {
            const sql = 'SELECT id FROM company_profiles WHERE custom_domain = ? AND user_id != ?';
            const row = await get(sql, [domain.toLowerCase(), excludeUserId]);
            return !row;
        } catch (error) {
            console.error('Error in CompanyProfile.isCustomDomainAvailable:', error);
            throw error;
        }
    },

    /**
     * Busca un perfil por su dominio personalizado registrado.
     * Usado en el middleware del servidor para detectar dominios custom.
     */
    findByCustomDomain: async (domain) => {
        try {
            const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim();
            const sql = `
                SELECT 
                    cp.user_id AS id,
                    cp.name AS empresa,
                    cp.logo_url AS company_logo,
                    cp.subdomain,
                    cp.custom_domain,
                    cp.white_label_config,
                    COALESCE(f.provincia, p.provincia) AS provincia,
                    COALESCE(f.departamento, p.departamento) AS departamento,
                    COALESCE(f.pais, p.pais) AS pais
                FROM company_profiles cp
                LEFT JOIN fincas f ON cp.company_id = f.id AND cp.company_type = 'finca'
                LEFT JOIN procesadoras p ON cp.company_id = p.id AND cp.company_type = 'procesadora'
                WHERE LOWER(cp.custom_domain) = ? AND cp.is_published IS TRUE
                LIMIT 1
            `;
            return await get(sql, [cleanDomain]) || null;
        } catch (error) {
            console.error('Error in CompanyProfile.findByCustomDomain:', error);
            return null;
        }
    },

    /**
     * Crea o actualiza un perfil comercial (Upsert logic).
     */
    upsert: async (userId, data) => {
        try {
            const existingProfile = await get('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
            const isPublished = data.is_published === true || data.is_published === 'true';
            const subdomain = data.subdomain ? data.subdomain.toLowerCase().trim() : null;
            const customDomain = data.custom_domain
                ? data.custom_domain.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase().trim()
                : null;

            // Convertimos el array de categorías a un String JSON para guardarlo
            const productCategoriesJson = data.product_categories ? JSON.stringify(data.product_categories) : '[]';

            // Serializar white_label_config como JSON si viene como objeto
            const whiteLabelConfig = data.white_label_config
                ? (typeof data.white_label_config === 'string' ? data.white_label_config : JSON.stringify(data.white_label_config))
                : null;

            const params = [
                data.company_type || null,
                data.company_id || null,
                data.name || '',
                data.logo_url || null,
                data.cover_image_url || null,
                data.history_text || null,
                data.contact_email || null,
                data.contact_phone || null,
                data.social_instagram || null,
                data.social_facebook || null,
                data.website_url || null,
                isPublished,
                productCategoriesJson,
                subdomain,
                whiteLabelConfig,
                customDomain,
                userId
            ];

            if (existingProfile) {
                // UPDATE
                const sql = `
                    UPDATE company_profiles SET 
                        company_type = ?, 
                        company_id = ?,
                        name = ?, 
                        logo_url = ?, 
                        cover_image_url = ?, 
                        history_text = ?, 
                        contact_email = ?, 
                        contact_phone = ?, 
                        social_instagram = ?, 
                        social_facebook = ?, 
                        website_url = ?, 
                        is_published = ?,
                        product_categories = ?,
                        subdomain = ?,
                        white_label_config = ?,
                        custom_domain = ?,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `;
                await run(sql, params);
                return existingProfile.id;
            } else {
                // INSERT
                const newId = crypto.randomUUID();
                const sql = `
                    INSERT INTO company_profiles (
                        id, company_type, company_id, name, logo_url, cover_image_url, 
                        history_text, contact_email, contact_phone, 
                        social_instagram, social_facebook, website_url, is_published, 
                        product_categories, subdomain, white_label_config, custom_domain, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                const insertParams = [newId, ...params];
                await run(sql, insertParams);
                return newId;
            }
        } catch (error) {
            console.error('Error in CompanyProfile.upsert:', error);
            throw error;
        }
    }
};

module.exports = CompanyProfile;