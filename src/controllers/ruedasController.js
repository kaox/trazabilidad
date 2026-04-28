const RuedaModel = require('../models/ruedaModel');
const { safeJSONParse } = require('../utils/helpers');

const getAll = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const rows = await RuedaModel.getAllByEmpresaId(empresa_id);
        const ruedas = rows.map(r => ({
            ...r,
            notas_json: safeJSONParse(r.notas_json)
        }));
        res.json(ruedas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getById = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const rueda = await RuedaModel.getById(id, empresa_id);
        if (!rueda) return res.status(404).json({ error: 'Rueda no encontrada' });
        rueda.notas_json = safeJSONParse(rueda.notas_json);
        res.json(rueda);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { nombre_rueda, tipo, notas_json } = req.body;
        if (!nombre_rueda || !tipo) {
            return res.status(400).json({ error: 'Faltan campos requeridos' });
        }
        const id = await RuedaModel.create({
            empresa_id,
            nombre_rueda,
            tipo,
            notas_json: notas_json || []
        });
        res.status(201).json({ id, message: 'Rueda creada exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const update = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const { nombre_rueda, tipo, notas_json } = req.body;
        const result = await RuedaModel.update(id, empresa_id, {
            nombre_rueda,
            tipo,
            notas_json
        });
        if (result.changes === 0) return res.status(404).json({ error: 'Rueda no encontrada' });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const result = await RuedaModel.delete(id, empresa_id);
        if (result.changes === 0) return res.status(404).json({ error: 'Rueda no encontrada' });
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const regenerateToken = async (req, res) => {
    try {
        const empresa_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const public_token = await RuedaModel.regenerateToken(id, empresa_id);
        res.json({ success: true, public_token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
    regenerateToken
};
