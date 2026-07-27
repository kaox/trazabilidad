const ThemeModel = require('../models/themeModel');

const themeController = {
    getPresets: async (req, res) => {
        try {
            const presets = await ThemeModel.getPresets();
            res.json({ success: true, data: presets });
        } catch (error) {
            console.error('Error al obtener temas prediseñados:', error);
            res.status(500).json({ success: false, error: 'Error al obtener temas prediseñados' });
        }
    },

    getCompanyTheme: async (req, res) => {
        try {
            const userId = req.user.id;
            const data = await ThemeModel.getByUserId(userId);
            if (!data) {
                return res.status(404).json({ success: false, error: 'No se encontró un perfil comercial activo.' });
            }
            res.json({ success: true, data: data.theme, company_name: data.company_name, white_label_config: data.white_label_config });
        } catch (error) {
            console.error('Error al obtener el tema de la empresa:', error);
            res.status(500).json({ success: false, error: 'Error al obtener el tema de la empresa' });
        }
    },

    saveCompanyTheme: async (req, res) => {
        try {
            const userId = req.user.id;
            const savedTheme = await ThemeModel.saveCompanyTheme(userId, req.body);
            res.json({ success: true, message: 'Tema guardado y aplicado a tu Landing Page exitosamente', data: savedTheme });
        } catch (error) {
            console.error('Error al guardar el tema de la empresa:', error);
            res.status(500).json({ success: false, error: error.message || 'Error al guardar el tema de la empresa' });
        }
    }
};

module.exports = themeController;
