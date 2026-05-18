// src/controllers/widgetController.js
const fs = require('fs');
const path = require('path');
const PerfilModel = require('../models/perfilModel');
const RuedaModel = require('../models/ruedaModel');
const EmpresaModel = require('../models/empresaModel');
const { safeJSONParse } = require('../utils/helpers');
const { getCache, setCache } = require('../utils/cache');

const serveWidget = async (req, res) => {
    try {
        const { public_token } = req.params;
        const { getSensoryProfilesConfig } = require('../utils/helpers');

        const cacheKey = `widget:perfil:${public_token}`;
        let perfil = await getCache(cacheKey);

        if (!perfil) {
            perfil = await PerfilModel.getByPublicToken(public_token);
            if (perfil) await setCache(cacheKey, perfil, 3600); // 1 hora
        } else {
            console.log(`⚡ Cache HIT para ${cacheKey}`);
        }
        
        let html = fs.readFileSync(path.join(__dirname, '../../views/widget-radar.html'), 'utf8');
        
        if (!perfil) {
            html = html.replace('{{{PERFIL_DATA_JSON}}}', JSON.stringify({ error: 'Perfil no encontrado' }));
            return res.send(html);
        }

        // Validate subscription
        const empresa = await EmpresaModel.getById(perfil.empresa_id);
        const isActive = empresa && (!empresa.trial_ends_at || new Date(empresa.trial_ends_at) > new Date()); 

        if (!isActive) {
            html = html.replace('{{{PERFIL_DATA_JSON}}}', JSON.stringify({ error: 'Suscripción inactiva' }));
            return res.send(html);
        }

        const config = getSensoryProfilesConfig();
        const dataToInject = {
            nombre: perfil.nombre_perfil,
            tipo: perfil.tipo,
            perfil_data: safeJSONParse(perfil.perfil_data),
            config: config[perfil.tipo] || []
        };

        html = html.replace('{{{PERFIL_DATA_JSON}}}', JSON.stringify(dataToInject));
        res.send(html);

    } catch (err) {
        console.error("Error in widget controller:", err);
        res.status(500).send('Error interno del servidor');
    }
};

const serveRuedaWidget = async (req, res) => {
    try {
        const { public_token } = req.params;
        
        const cacheKey = `widget:rueda:${public_token}`;
        let rueda = await getCache(cacheKey);

        if (!rueda) {
            rueda = await RuedaModel.getByToken(public_token);
            if (rueda) await setCache(cacheKey, rueda, 3600); // 1 hora
        } else {
            console.log(`⚡ Cache HIT para ${cacheKey}`);
        }
        
        let html = fs.readFileSync(path.join(__dirname, '../../views/widget-rueda.html'), 'utf8');
        
        if (!rueda) {
            html = html.replace('{{{RUEDA_DATA_JSON}}}', JSON.stringify({ error: 'Rueda no encontrada' }));
            return res.send(html);
        }

        const dataToInject = {
            nombre: rueda.nombre_rueda,
            tipo: rueda.tipo,
            notas_json: safeJSONParse(rueda.notas_json)
        };

        html = html.replace('{{{RUEDA_DATA_JSON}}}', JSON.stringify(dataToInject));
        res.send(html);

    } catch (err) {
        console.error("Error in rueda widget controller:", err);
        res.status(500).send('Error interno del servidor');
    }
};

module.exports = {
    serveWidget,
    serveRuedaWidget
};
