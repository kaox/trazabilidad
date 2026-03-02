/**
 * src/models/CompanyProfile.js
 * Modelo para interactuar con la tabla company_profiles en SQLite.
 */
const { get, run } = require('../config/db.js');
const crypto = require('crypto');

const CompanyProfile = {
    /**
     * Obtiene el perfil comercial de un usuario por su ID.
     * @param {string} userId - ID del usuario.
     * @returns {Promise<Object|null>} - Objeto con los datos del perfil o null si no existe.
     */
    findByUserId: async (userId) => {
        try {
            const sql = 'SELECT * FROM company_profiles WHERE user_id = ?';
            const profile = await get(sql, [userId]);
            
            if (profile) {
                // Convertir campos booleanos de SQLite (0/1) a true/false para el frontend
                profile.is_published = profile.is_published === 1;
            }
            return profile;
        } catch (error) {
            console.error('Error in CompanyProfile.findByUserId:', error);
            throw error;
        }
    },

    /**
     * Crea o actualiza un perfil comercial (Upsert logic).
     * @param {string} userId - ID del usuario.
     * @param {Object} data - Objeto con los datos del perfil comercial a guardar.
     * @returns {Promise<string>} - El ID del perfil creado o actualizado.
     */
    upsert: async (userId, data) => {
        try {
            // 1. Verificar si ya existe un perfil para este usuario
            const existingProfile = await get('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);

            // Normalizar el checkbox a 1 o 0 para SQLite
            const isPublished = data.is_published === true || data.is_published === 'true' || data.is_published === 1 ? 1 : 0;

            const params = [
                data.company_type || '',
                data.company_id || null, // <- Nuevo campo
                data.name || '',
                data.logo_url || null,
                data.cover_image_url || null,
                data.history_text || '',
                data.contact_email || '',
                data.contact_phone || '',
                data.social_instagram || '',
                data.social_facebook || '',
                data.website_url || '',
                isPublished,
                userId // Para el WHERE del UPDATE o el INSERT
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
                        social_instagram, social_facebook, website_url, is_published, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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