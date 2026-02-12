// src/controllers/suggestionController.js
const SuggestionModel = require('../models/admin-suggestions-model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { safeJSONParse } = require('../utils/helpers');
const { OAuth2Client } = require('google-auth-library');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

const getAdminSuggestions = async (req, res) => {
    try {
        const rows = await SuggestionModel.getAll();
        const suggestions = rows.map(s => ({
            ...s,
            coordenadas: safeJSONParse(s.coordenadas_json)
        }));
        res.json(suggestions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteSuggestion = async (req, res) => {
    const { id } = req.params;
    try {
        await SuggestionModel.deleteById(id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateSuggestion = async (req, res) => {
    const { id } = req.params;
    try {
        await SuggestionModel.updateById(id, req.body);
        res.status(200).json({ message: 'Sugerencia actualizada correctamente' });
    } catch (err) {
        console.error("Error actualizando sugerencia:", err);
        res.status(500).json({ error: err.message });
    }
};

// --- LOGICA MAGIC LINK ---

const generateMagicLink = async (req, res) => {
    const { id } = req.params;
    try {
        const token = crypto.randomUUID();
        await SuggestionModel.setMagicToken(id, token);
        
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const link = `${protocol}://${host}/magic-login/${token}`;
        
        res.json({ link });
    } catch (err) {
        console.error("Error generando magic link:", err);
        res.status(500).json({ error: err.message });
    }
};

// PASO 1: Redirección simple (NO CREA USUARIO AÚN)
const handleMagicLogin = async (req, res) => {
    const { token } = req.params;
    try {
        const suggestion = await SuggestionModel.findByMagicToken(token);
        
        if (!suggestion) {
            return res.status(404).send('<h1>Enlace inválido o expirado</h1><p>Solicita uno nuevo al administrador.</p>');
        }
        
        // Redirigimos al onboarding pasando el token en la URL para que el frontend lo use
        res.redirect(`/onboarding.html?magic_token=${token}`);
    } catch (err) {
        console.error("Error en Magic Redirect:", err);
        res.status(500).send('Error interno.');
    }
};

// PASO 2: Endpoint para que el Frontend obtenga los datos precargados
const getMagicLinkData = async (req, res) => {
    const { token } = req.params;
    try {
        const suggestion = await SuggestionModel.findByMagicToken(token);
        if (!suggestion) return res.status(404).json({ error: 'Token inválido' });

        // Devolvemos solo los datos necesarios para prellenar el formulario
        res.json({
            empresa: suggestion.name,
            company_type: suggestion.type,
            company_logo: suggestion.logo,
            social_instagram: suggestion.social_instagram,
            social_facebook: suggestion.social_facebook
            // No devolvemos IDs internos sensibles
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// PASO 3: Registro Final (Aquí se crea el usuario)
const completeMagicRegistration = async (req, res) => {
    const { magic_token, google_token, usuario, password, ...formData } = req.body;

    // CORRECCIÓN: Validar credenciales solo si NO hay google_token
    if (!google_token) {
        if (!usuario || !password) {
            return res.status(400).json({ error: "Usuario y contraseña son requeridos" });
        }
    }

    try {
        // Validar token magic
        const suggestion = await SuggestionModel.findByMagicToken(magic_token);
        if (!suggestion) return res.status(400).json({ error: 'El enlace ha expirado o no es válido.' });

        const existingUser = await SuggestionModel.findUserBySuggestionId(suggestion.id);
        if (existingUser) return res.status(409).json({ error: 'Esta empresa ya ha sido reclamada.' });

        let finalUsername = usuario;
        let finalPasswordHash = null;

        if (google_token) {
            // Verificar Google Token
            const ticket = await client.verifyIdToken({
                idToken: google_token,
                audience: GOOGLE_CLIENT_ID,
            });
            const payload = ticket.getPayload();
            const { email } = payload;
            
            // Si no envió usuario manual, generamos uno del email
            if (!finalUsername) {
                finalUsername = email.split('@')[0];
            }
            
            // Generar password aleatorio fuerte (el usuario usará Google para entrar)
            finalPasswordHash = await bcrypt.hash(crypto.randomUUID(), 10);
            
            // Aseguramos que el correo venga de Google si no venía en formData
            if (!formData.correo) formData.correo = email;

        } else {
            // Flujo Manual
            finalPasswordHash = await bcrypt.hash(password, 10);
            finalUsername = usuario.toLowerCase().trim();
        }

        // Crear usuario
        const newUser = await SuggestionModel.createUserFromSuggestion({
            username: finalUsername,
            password: finalPasswordHash,
            nombre: formData.nombre || 'Admin',
            apellido: formData.apellido || '',
            empresa: formData.empresa, 
            type: formData.company_type,
            companyId: suggestion.id,
            logo: formData.company_logo || suggestion.logo,
            instagram: formData.social_instagram,
            facebook: formData.social_facebook,
            correo: formData.correo // Importante guardar el correo
        });

        await SuggestionModel.markAsClaimed(suggestion.id);

        const tokenPayload = { id: newUser.id, username: newUser.usuario, role: newUser.role };
        const jwtToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '24h' });
        
        res.cookie('token', jwtToken, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            path: '/' 
        });

        res.json({ success: true, redirect: '/app/dashboard', token: jwtToken });

    } catch (err) {
        if (err.message && err.message.includes('UNIQUE')) {
            return res.status(409).json({ error: "El nombre de usuario ya existe. Intenta con otro." });
        }
        console.error("Error en registro magic:", err);
        res.status(500).json({ error: "Error al crear la cuenta." });
    }
};

module.exports = { 
    getAdminSuggestions,
    deleteSuggestion,
    updateSuggestion,
    generateMagicLink,
    handleMagicLogin,
    getMagicLinkData,        // <--- Nuevo
    completeMagicRegistration // <--- Nuevo
};