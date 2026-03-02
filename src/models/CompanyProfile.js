/**
 * src/models/CompanyProfile.js
 * Modelo para interactuar con la tabla company_profiles compatible con db.js (SQLite/Postgres)
 */
const { get, run } = require('../config/db.js');
const crypto = require('crypto');

const CompanyProfile = {
    /**
     * Obtiene el perfil comercial de un usuario por su ID.
     * @param {number|string} userId - ID del usuario.
     * @returns {Promise<Object|null>} - Objeto con los datos del perfil o null si no existe.
     */
    findByUserId: async (userId) => {
        try {
            // Usamos '?' para que el adaptador db.js lo traduzca a $1 en Postgres o lo deje igual en SQLite
            const sql = 'SELECT * FROM company_profiles WHERE user_id = ?';
            const profile = await get(sql, [userId]);
            
            if (profile) {
                // PostgreSQL devuelve true/false, SQLite devuelve 1/0. Unificamos a booleano para el JS.
                profile.is_published = profile.is_published === 1 || profile.is_published === true;
            }
            return profile || null;
        } catch (error) {
            console.error('Error in CompanyProfile.findByUserId:', error);
            throw error;
        }
    },

    /**
     * Crea o actualiza un perfil comercial (Upsert logic).
     * @param {number|string} userId - ID del usuario.
     * @param {Object} data - Objeto con los datos del perfil comercial a guardar.
     * @returns {Promise<string>} - El ID del perfil creado o actualizado.
     */
    upsert: async (userId, data) => {
        try {
            // 1. Verificar si ya existe un perfil para este usuario
            const existingProfile = await get('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);

            // Manejar valores booleanos (true para Postgres, 1 para SQLite - depende del driver subyacente, 
            // pero pasarlo como true suele funcionar bien en ambos si SQLite está configurado para entender booleanos,
            // de lo contrario, si falla en SQLite, cambia esto a 1 o 0).
            const isPublished = data.is_published === true || data.is_published === 'true';

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
                isPublished, // true/false o 1/0
                userId       // El ID del usuario para el WHERE o el INSERT
            ];

            if (existingProfile) {
                // UPDATE (Usando '?' para el queryAdapter)
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
                // INSERT (Usando '?' para el queryAdapter)
                const newId = crypto.randomUUID();
                const sql = `
                    INSERT INTO company_profiles (
                        id, company_type, company_id, name, logo_url, cover_image_url, 
                        history_text, contact_email, contact_phone, 
                        social_instagram, social_facebook, website_url, is_published, user_id
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
                // Para el INSERT, el ID va de primero en los parámetros
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