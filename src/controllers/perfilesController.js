const PerfilModel = require('../models/perfilModel');
const crypto = require('crypto');
const { safeJSONParse, getSensoryProfilesConfig } = require('../utils/helpers');

const getAll = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const rows = await PerfilModel.getAllByEmpresa(empresa_id);
        const perfiles = rows.map(p => ({
            ...p,
            perfil_data: safeJSONParse(p.perfil_data)
        }));
        res.json(perfiles);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getById = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const perfil = await PerfilModel.getById(id, empresa_id);
        
        if (!perfil) return res.status(404).json({ error: 'Perfil no encontrado' });
        
        perfil.perfil_data = safeJSONParse(perfil.perfil_data);
        res.json(perfil);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { nombre_perfil, tipo, perfil_data, puntaje_sca } = req.body;
        
        if (!nombre_perfil || !tipo || !perfil_data) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }

        // Validación dinámica contra el JSON
        const config = getSensoryProfilesConfig();
        if (!config[tipo]) {
            return res.status(400).json({ error: `Tipo de producto no válido: ${tipo}` });
        }

        // Filtrar perfil_data para guardar solo atributos válidos
        const validKeys = config[tipo].map(attr => attr.id);
        const filteredData = {};
        validKeys.forEach(key => {
            if (perfil_data[key] !== undefined) {
                filteredData[key] = perfil_data[key];
            }
        });

        const id = crypto.randomUUID();
        const public_token = crypto.randomBytes(16).toString('hex');

        const newPerfil = await PerfilModel.create({
            id,
            empresa_id,
            nombre_perfil,
            tipo,
            perfil_data: JSON.stringify(filteredData),
            puntaje_sca,
            public_token
        });

        res.status(201).json(newPerfil);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const update = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const { nombre_perfil, tipo, perfil_data, puntaje_sca } = req.body;

        const config = getSensoryProfilesConfig();
        let filteredData = perfil_data;

        if (tipo && config[tipo] && perfil_data) {
            const validKeys = config[tipo].map(attr => attr.id);
            filteredData = {};
            validKeys.forEach(key => {
                if (perfil_data[key] !== undefined) {
                    filteredData[key] = perfil_data[key];
                }
            });
        }

        await PerfilModel.updateById(id, empresa_id, {
            nombre_perfil,
            tipo,
            perfil_data: filteredData ? JSON.stringify(filteredData) : undefined,
            puntaje_sca
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        
        await PerfilModel.deleteById(id, empresa_id);
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove
};
