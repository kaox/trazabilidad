/**
 * src/controllers/companyProfileController.js
 * Controlador para gestionar las peticiones HTTP relacionadas con el Perfil Comercial.
 */
const CompanyProfile = require('../models/CompanyProfile');
const { get } = require('../config/db.js'); // Importamos 'get' temporalmente para el fallback
const { processImagesArray, deleteImagesArray } = require('../utils/storage');

const PROVIDER = 'vercel';//'vercel'

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

            const RESERVED_SUBDOMAINS = ['www', 'app', 'api', 'admin', 'localhost', 'rurulab', 'mail', 'smtp'];

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

            // Validación de Subdominio
            if (profileData.subdomain) {
                const subd = profileData.subdomain.toLowerCase().trim();

                // Formato: Alfanumérico y guiones únicamente
                const subdRegex = /^[a-z0-9-]+$/;
                if (!subdRegex.test(subd)) {
                    return res.status(400).json({ error: "El subdominio solo puede contener letras, números y guiones." });
                }

                // Palabras reservadas
                if (RESERVED_SUBDOMAINS.includes(subd)) {
                    return res.status(400).json({ error: "Este subdominio no está disponible (palabra reservada)." });
                }

                // Unicidad
                const isAvailable = await CompanyProfile.isSubdomainAvailable(subd, userId);
                if (!isAvailable) {
                    return res.status(400).json({ error: "Este subdominio ya está siendo usado por otra empresa." });
                }
            }

            // Buscamos el perfil antiguo por si necesitamos borrar su logo
            let oldLogo = null;
            try {
                const oldProfile = await CompanyProfile.findByUserId(userId);
                if (oldProfile && oldProfile.logo_url) oldLogo = oldProfile.logo_url;
            } catch (e) {
                console.error("No se pudo obtener el perfil antiguo", e);
            }

            // Procesamos la imagen del logo si es base64
            if (profileData.logo_url && profileData.logo_url.startsWith('data:image/')) {
                const uploadResult = await processImagesArray([profileData.logo_url], 'company-logos', userId, PROVIDER);

                if (uploadResult && uploadResult.length > 0) {
                    profileData.logo_url = uploadResult[0]; // asignamos la URL generada

                    // Borramos la foto anterior si se subió una nueva
                    if (oldLogo && oldLogo.startsWith('http')) {
                        await deleteImagesArray([oldLogo], PROVIDER);
                    }
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