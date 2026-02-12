// src/controllers/suggestionController.js
const SuggestionModel = require('../models/admin-suggestions-model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// Asegúrate de ajustar la ruta a donde tengas tu archivo de helpers
const { safeJSONParse } = require('../utils/helpers'); 

const getAdminSuggestions = async (req, res) => {
    try {
        const rows = await SuggestionModel.getAll();
        
        // Lógica de transformación de datos (Frontend formatting)
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

// --- LOGICA MAGIC LINK ---

const generateMagicLink = async (req, res) => {
    const { id } = req.params;
    try {
        // 1. Generar token
        const token = crypto.randomUUID();
        
        // 2. Guardar en BD
        await SuggestionModel.setMagicToken(id, token);
        
        // 3. Construir URL
        const protocol = req.headers['x-forwarded-proto'] || req.protocol;
        const host = req.get('host');
        const link = `${protocol}://${host}/magic-login/${token}`;
        
        res.json({ link });
    } catch (err) {
        console.error("Error generando magic link:", err);
        res.status(500).json({ error: err.message });
    }
};

const handleMagicLogin = async (req, res) => {
    const { token } = req.params;
    
    try {
        // 1. Buscar sugerencia
        const suggestion = await SuggestionModel.findByMagicToken(token);
        
        if (!suggestion) {
            return res.status(404).send('<h1>Enlace inválido o expirado</h1><p>Por favor contacta a soporte.</p>');
        }

        // 2. Verificar usuario existente
        let user = await SuggestionModel.findUserBySuggestionId(suggestion.id);
        
        if (!user) {
            // CREAR USUARIO NUEVO
            const tempPassword = await bcrypt.hash(crypto.randomUUID(), 10);
            const username = 'user_' + suggestion.id.replace(/-/g, '_');
            
            // Llamamos al modelo con un objeto limpio
            user = await SuggestionModel.createUserFromSuggestion({
                username,
                password: tempPassword,
                nombre: 'Admin',
                apellido: suggestion.name,
                empresa: suggestion.name,
                type: suggestion.type,
                companyId: suggestion.id,
                logo: suggestion.logo,
                instagram: suggestion.social_instagram,
                facebook: suggestion.social_facebook
            });
            
            // Marcar como reclamada
            await SuggestionModel.markAsClaimed(suggestion.id);
        }

        // 3. Generar JWT
        const tokenPayload = { id: user.id, username: user.usuario, role: user.role };
        const jwtToken = jwt.sign(tokenPayload, process.env.JWT_SECRET || 'supersecretkey', { expiresIn: '24h' });
        
        // 4. Set Cookie y Redirect
        res.cookie('token', jwtToken, { 
            httpOnly: true, 
            secure: process.env.NODE_ENV === 'production', 
            sameSite: 'lax', 
            path: '/' 
        });

        res.redirect('/onboarding.html?welcome=true');

    } catch (err) {
        console.error("Error en Magic Login:", err);
        res.status(500).send('Error interno del servidor al procesar el enlace.');
    }
};

module.exports = { 
    getAdminSuggestions,
    deleteSuggestion,
    generateMagicLink,
    handleMagicLogin
};