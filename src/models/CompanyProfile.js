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
                    } catch(e) {
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
     * Crea o actualiza un perfil comercial (Upsert logic).
     */
    upsert: async (userId, data) => {
        try {
            const existingProfile = await get('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
            const isPublished = data.is_published === true || data.is_published === 'true';

            // Convertimos el array de categorías a un String JSON para guardarlo
            const productCategoriesJson = data.product_categories ? JSON.stringify(data.product_categories) : '[]';

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
                productCategoriesJson, // <-- NUEVO PARÁMETRO
                userId 
            ];

            if (existingProfile) {
                // UPDATE (13 campos a actualizar + 1 ID en el WHERE)
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
                        updated_at = CURRENT_TIMESTAMP
                    WHERE user_id = ?
                `;
                await run(sql, params);
                return existingProfile.id;
            } else {
                // INSERT (14 campos en total)
                const newId = crypto.randomUUID();
                const sql = `
                    INSERT INTO company_profiles (
                        id, company_type, company_id, name, logo_url, cover_image_url, 
                        history_text, contact_email, contact_phone, 
                        social_instagram, social_facebook, website_url, is_published, product_categories, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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