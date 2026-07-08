const LoteModel = require('../models/loteModel');
const EtapaModel = require('../models/etapaModel');
const crypto = require('crypto');

const getAll = async (req, res) => {
    try {
        const user_id = req.user.company_id || req.user.id;
        const lotes = await LoteModel.getAllByUser(user_id);
        res.json(lotes);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getById = async (req, res) => {
    try {
        const user_id = req.user.company_id || req.user.id;
        const { id } = req.params;

        const lote = await LoteModel.getById(id, user_id);
        if (!lote) return res.status(404).json({ error: 'Lote no encontrado' });

        // Traemos también las etapas (hoja de ruta) que pertenecen a este lote
        const etapas = await EtapaModel.getAllByLoteId(id);
        lote.etapas = etapas;

        res.json(lote);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        const { codigo_lote, producto_id, estado } = req.body;
        if (!codigo_lote || !producto_id) {
            return res.status(400).json({ error: 'El código de lote y producto_id son obligatorios.' });
        }

        const id = await LoteModel.create({ codigo_lote, producto_id, estado });
        res.status(201).json({ id, message: 'Lote creado exitosamente' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo_lote, producto_id, estado } = req.body;

        const result = await LoteModel.update(id, { codigo_lote, producto_id, estado });
        if (result.changes === 0) {
            return res.status(400).json({ error: 'Lote no encontrado o está sellado en blockchain.' });
        }
        res.json({ success: true, message: 'Lote actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await LoteModel.delete(id);
        if (result.changes === 0) {
            return res.status(400).json({ error: 'Lote no encontrado o está sellado en blockchain.' });
        }
        res.status(204).send();
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const sellarBlockchain = async (req, res) => {
    try {
        const { id } = req.params;

        // Simulación de generación de hash Blockchain
        const semilla = id + Date.now().toString() + Math.random().toString();
        const hash = '0x' + crypto.createHash('sha256').update(semilla).digest('hex');

        const result = await LoteModel.lockLote(id, hash);
        if (result.changes === 0) return res.status(404).json({ error: 'Lote no encontrado' });

        res.json({ success: true, blockchain_hash: hash, message: 'Lote sellado inmutablemente' });
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
    sellarBlockchain
};