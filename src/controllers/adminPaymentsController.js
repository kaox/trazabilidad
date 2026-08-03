const AdminPaymentsModel = require('../models/adminPaymentsModel');

const adminPaymentsController = {
    getOverview: async (req, res) => {
        try {
            const data = await AdminPaymentsModel.getOverview();
            res.json({ success: true, data });
        } catch (error) {
            console.error('Error obteniendo resumen de pagos para admin:', error);
            res.status(500).json({ success: false, error: 'Error al cargar los pagos del sistema.' });
        }
    },

    approveVoucher: async (req, res) => {
        try {
            const { id } = req.params;
            const { duration_months } = req.body;
            const result = await AdminPaymentsModel.approveVoucher(id, duration_months);
            res.json({ success: true, message: 'Pago validado y suscripción activada exitosamente.', data: result });
        } catch (error) {
            console.error('Error aprobando pago:', error);
            res.status(500).json({ success: false, error: error.message || 'Error al aprobar el pago.' });
        }
    },

    rejectVoucher: async (req, res) => {
        try {
            const { id } = req.params;
            const { reason } = req.body;
            const result = await AdminPaymentsModel.rejectVoucher(id, reason);
            res.json({ success: true, message: 'Comprobante rechazado correctamente.', data: result });
        } catch (error) {
            console.error('Error rechazando pago:', error);
            res.status(500).json({ success: false, error: error.message || 'Error al rechazar el pago.' });
        }
    },

    updateUserSubscription: async (req, res) => {
        try {
            const { userId } = req.params;
            const { tier, expiration_date } = req.body;
            const result = await AdminPaymentsModel.updateUserSubscription(userId, tier, expiration_date);
            res.json({ success: true, message: 'Suscripción de usuario actualizada.', data: result });
        } catch (error) {
            console.error('Error actualizando suscripción de usuario:', error);
            res.status(500).json({ success: false, error: error.message || 'Error al actualizar la suscripción.' });
        }
    },

    triggerExpirationCheck: async (req, res) => {
        try {
            await AdminPaymentsModel.checkExpiredSubscriptions();
            res.json({ success: true, message: 'Verificación de expiraciones ejecutada correctamente.' });
        } catch (error) {
            console.error('Error ejecutando verificación de vencimientos:', error);
            res.status(500).json({ success: false, error: 'Error al ejecutar verificación.' });
        }
    }
};

module.exports = adminPaymentsController;
