const { get, all, run } = require('../config/db.js');
const crypto = require('crypto');

const ThemeModel = {
    /**
     * Obtiene todos los temas prediseñados (solo lectura para usuarios).
     */
    getPresets: async () => {
        try {
            const sql = 'SELECT * FROM theme_presets ORDER BY name ASC';
            return await all(sql);
        } catch (error) {
            console.error('Error en ThemeModel.getPresets:', error);
            throw error;
        }
    },

    /**
     * Obtiene el tema guardado para el perfil comercial del usuario.
     */
    getByUserId: async (userId) => {
        try {
            const profile = await get('SELECT id, name, logo_url, white_label_config FROM company_profiles WHERE user_id = ?', [userId]);
            if (!profile) return null;

            const theme = await get(`
                SELECT t.*, p.name AS preset_name 
                FROM company_profile_theme t
                LEFT JOIN theme_presets p ON t.preset_id = p.id
                WHERE t.company_profile_id = ?
            `, [profile.id]);

            return {
                company_profile_id: profile.id,
                company_name: profile.name,
                theme: theme || null,
                white_label_config: profile.white_label_config ? (typeof profile.white_label_config === 'string' ? JSON.parse(profile.white_label_config) : profile.white_label_config) : null
            };
        } catch (error) {
            console.error('Error en ThemeModel.getByUserId:', error);
            throw error;
        }
    },

    /**
     * Guarda o actualiza el tema del perfil comercial (Upsert).
     */
    saveCompanyTheme: async (userId, data) => {
        try {
            const profile = await get('SELECT id FROM company_profiles WHERE user_id = ?', [userId]);
            if (!profile) {
                throw new Error('No existe un perfil comercial registrado para este usuario. Por favor crea primero tu Perfil Comercial.');
            }

            const companyProfileId = profile.id;
            const existingTheme = await get('SELECT id FROM company_profile_theme WHERE company_profile_id = ?', [companyProfileId]);

            const {
                preset_id = null,
                is_custom = false,
                custom_name = null,
                color_primary = '#78350f',
                color_secondary = '#451a03',
                color_accent = '#d97706',
                color_background = '#fdfaf6',
                color_text = '#1c1917'
            } = data;

            let themeId;
            const isCustomVal = (is_custom === true || is_custom === 1 || is_custom === 'true') ? 1 : 0;

            if (existingTheme) {
                themeId = existingTheme.id;
                await run(`
                    UPDATE company_profile_theme 
                    SET preset_id = ?, is_custom = ?, custom_name = ?,
                        color_primary = ?, color_secondary = ?, color_accent = ?,
                        color_background = ?, color_text = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                `, [
                    preset_id, isCustomVal, custom_name,
                    color_primary, color_secondary, color_accent,
                    color_background, color_text, themeId
                ]);
            } else {
                themeId = crypto.randomUUID();
                await run(`
                    INSERT INTO company_profile_theme (
                        id, company_profile_id, preset_id, is_custom, custom_name,
                        color_primary, color_secondary, color_accent, color_background, color_text
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [
                    themeId, companyProfileId, preset_id, isCustomVal, custom_name,
                    color_primary, color_secondary, color_accent, color_background, color_text
                ]);
            }

            // Sincronizar con white_label_config en company_profiles
            const existingProfile = await get('SELECT white_label_config FROM company_profiles WHERE id = ?', [companyProfileId]);
            let wlConfig = {};
            try {
                wlConfig = typeof existingProfile.white_label_config === 'string'
                    ? JSON.parse(existingProfile.white_label_config || '{}')
                    : (existingProfile.white_label_config || {});
            } catch (e) {
                wlConfig = {};
            }

            wlConfig.primary_color = color_primary;
            wlConfig.secondary_color = color_secondary;
            wlConfig.accent_color = color_accent;
            wlConfig.background_color = color_background;
            wlConfig.text_color = color_text;
            wlConfig.theme_preset_id = preset_id;
            wlConfig.theme_custom_name = custom_name;
            wlConfig.is_custom_theme = isCustomVal === 1;

            await run('UPDATE company_profiles SET white_label_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [
                JSON.stringify(wlConfig), companyProfileId
            ]);

            return {
                id: themeId,
                company_profile_id: companyProfileId,
                preset_id,
                is_custom: isCustomVal === 1,
                custom_name,
                color_primary,
                color_secondary,
                color_accent,
                color_background,
                color_text
            };
        } catch (error) {
            console.error('Error en ThemeModel.saveCompanyTheme:', error);
            throw error;
        }
    }
};

module.exports = ThemeModel;
