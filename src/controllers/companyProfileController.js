/**
 * src/controllers/companyProfileController.js
 * Controlador para gestionar las peticiones HTTP relacionadas con el Perfil Comercial.
 */
const CompanyProfile = require('../models/CompanyProfile');
const { get } = require('../config/db.js'); // Importamos 'get' temporalmente para el fallback
const { put } = require('@vercel/blob');

const companyProfileController = {
    /**
     * GET /api/user/company-profile
     * Devuelve el perfil comercial del usuario autenticado.
     */
    getCompanyProfile: async (req, res) => {
        try {
            const userId = req.user.id;
            let profile = await CompanyProfile.findByUserId(userId);

            if (!profile) {
                // Fallback de transición: Si el usuario es antiguo y aún no tiene registro en company_profiles,
                // enviamos datos iniciales basados en su registro de 'users' para rellenar el formulario.
                const userFallback = await get('SELECT empresa, company_type, company_id, company_logo, celular, correo, social_instagram, social_facebook FROM users WHERE id = ?', [userId]);
                
                if (userFallback && userFallback.empresa) {
                    profile = {
                        user_id: userId,
                        name: userFallback.empresa,
                        company_type: userFallback.company_type || '',
                        company_id: userFallback.company_id || null, // Pasamos el ID antiguo
                        logo_url: userFallback.company_logo,
                        contact_phone: userFallback.celular,
                        contact_email: userFallback.correo,
                        social_instagram: userFallback.social_instagram,
                        social_facebook: userFallback.social_facebook,
                        is_published: true // Por defecto lo sugerimos visible
                    };
                    return res.status(200).json(profile);
                }
                
                // Si no hay datos antiguos, devolvemos 404 (el frontend lo manejará creando uno nuevo)
                return res.status(404).json({ message: "Perfil comercial no encontrado." });
            }

            res.status(200).json(profile);

        } catch (error) {
            console.error("Error en getCompanyProfile:", error);
            res.status(500).json({ error: "Error interno al obtener el perfil comercial." });
        }
    },

    /**
     * PUT /api/user/company-profile
     * Crea o actualiza el perfil comercial del usuario autenticado.
     */
    upsertCompanyProfile: async (req, res) => {
        try {
            const userId = req.user.id;
            const profileData = req.body;

            // Validación básica
            if (!profileData.name || profileData.name.trim() === '') {
                return res.status(400).json({ error: "El nombre comercial es obligatorio." });
            }
            if (!profileData.company_type || profileData.company_type.trim() === '') {
                return res.status(400).json({ error: "El tipo de entidad es obligatorio." });
            }
            if (!profileData.company_id || profileData.company_id.trim() === '') {
                return res.status(400).json({ error: "Debe seleccionar una entidad vinculada válida." });
            }

            // ----------------------------------------------------
            // INTEGRACIÓN VERCEL BLOB STORE
            // Convertimos la imagen base64 entrante a un archivo alojado.
            // ----------------------------------------------------
            if (profileData.logo_url && profileData.logo_url.startsWith('data:image/')) {
                try {
                    const matches = profileData.logo_url.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        let extension = matches[1];
                        if (extension === 'jpeg') extension = 'jpg';
                        
                        const buffer = Buffer.from(matches[2], 'base64');
                        const filename = `company-logos/user-${userId}-${Date.now()}.${extension}`;

                        // La subida requiere process.env.BLOB_READ_WRITE_TOKEN en el entorno
                        const blob = await put(filename, buffer, {
                            access: 'public'
                        });

                        // Reemplazar la cadena enorme por la URL definitiva publicable.
                        profileData.logo_url = blob.url;
                    }
                } catch (err) {
                    console.error("Error subiendo el logo a Vercel Blob:", err);
                    return res.status(500).json({ error: "No se pudo procesar la imagen del logo en Vercel."});
                }
            }

            // Ejecutamos el Upsert en el modelo
            const profileId = await CompanyProfile.upsert(userId, profileData);

            // Respondemos con éxito
            res.status(200).json({ 
                message: "Perfil comercial guardado exitosamente.",
                id: profileId,
                user_id: userId 
            });

        } catch (error) {
            console.error("Error en upsertCompanyProfile:", error);
            res.status(500).json({ error: "Error interno al guardar el perfil comercial." });
        }
    }
};

module.exports = companyProfileController;