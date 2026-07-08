const EtapaModel = require('../models/etapaModel');
const LoteModel = require('../models/loteModel');

// Helper interno para proteger el lote si ya está sellado
const verificarLoteAbierto = async (loteId, userId) => {
    const lote = await LoteModel.getById(loteId, userId);
    if (!lote) throw new Error('Lote no encontrado o sin permisos.');
    if (lote.is_locked) throw new Error('El lote está sellado en blockchain. No se pueden modificar sus etapas.');
    return true;
};

const getByLote = async (req, res) => {
    try {
        const { loteId } = req.params;
        const etapas = await EtapaModel.getAllByLoteId(loteId);
        res.json(etapas);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const create = async (req, res) => {
    try {
        const user_id = req.user.company_id || req.user.id;
        const { lote_id, catalogo_etapa_id, fecha, notas, foto, orden, finca_id, procesadora_id } = req.body;

        // 1. Validar que el lote no esté bloqueado
        await verificarLoteAbierto(lote_id, user_id);

        // 2. Regla de negocio (Integridad de Actor): O es Finca o es Procesadora, no ambos.
        if ((finca_id && procesadora_id) || (!finca_id && !procesadora_id)) {
            return res.status(400).json({ error: 'Debes especificar solo un actor: finca_id o procesadora_id.' });
        }

        const id = await EtapaModel.create({
            lote_id, catalogo_etapa_id, fecha, notas, foto, orden, finca_id, procesadora_id
        });
        res.status(201).json({ id, message: 'Etapa añadida a la ruta exitosamente.' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const update = async (req, res) => {
    try {
        const user_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const { lote_id, catalogo_etapa_id, fecha, notas, foto, orden, finca_id, procesadora_id } = req.body;

        await verificarLoteAbierto(lote_id, user_id);

        if ((finca_id && procesadora_id) || (!finca_id && !procesadora_id)) {
            return res.status(400).json({ error: 'Debes especificar solo un actor: finca_id o procesadora_id.' });
        }

        const result = await EtapaModel.update(id, {
            catalogo_etapa_id, fecha, notas, foto, orden, finca_id, procesadora_id
        });
        if (result.changes === 0) return res.status(404).json({ error: 'Etapa no encontrada' });

        res.json({ success: true, message: 'Etapa actualizada' });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

const remove = async (req, res) => {
    try {
        const user_id = req.user.company_id || req.user.id;
        const { id } = req.params;
        const { lote_id } = req.body; // El cliente debe enviar el lote_id para validar bloqueo

        if (!lote_id) return res.status(400).json({ error: 'Se requiere el lote_id para validar.' });

        await verificarLoteAbierto(lote_id, user_id);

        const result = await EtapaModel.delete(id);
        if (result.changes === 0) return res.status(404).json({ error: 'Etapa no encontrada' });

        res.status(204).send();
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
};

module.exports = {
    getByLote,
    create,
    update,
    remove
};