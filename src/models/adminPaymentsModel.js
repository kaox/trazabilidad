const { get, all, run } = require('../config/db.js');

const AdminPaymentsModel = {
    /**
     * Revisa y degrada automáticamente a 'basico' a los usuarios cuya fecha de suscripción haya expirado.
     */
    checkExpiredSubscriptions: async () => {
        try {
            const sql = `
                UPDATE users 
                SET subscription_tier = 'basico' 
                WHERE subscription_expires_at IS NOT NULL 
                  AND subscription_expires_at < CURRENT_TIMESTAMP 
                  AND subscription_tier != 'basico' 
                  AND (role IS NULL OR role != 'admin')
            `;
            await run(sql);
        } catch (error) {
            console.error('Error al verificar suscripciones expiradas:', error);
        }
    },

    /**
     * Obtiene el resumen general de pagos, comprobantes pendientes, historial y estado de suscripción de usuarios.
     */
    getOverview: async () => {
        try {
            await AdminPaymentsModel.checkExpiredSubscriptions();

            // 1. Comprobantes pendientes por validar
            const pendingVouchers = await all(`
                SELECT v.*, u.usuario, u.nombre, u.apellido, u.correo, u.empresa, u.company_logo 
                FROM payment_vouchers v
                JOIN users u ON v.user_id = u.id
                WHERE v.status = 'pending'
                ORDER BY v.created_at DESC
            `);

            // 2. Historial completo de pagos (Vouchers manuales)
            const allVouchers = await all(`
                SELECT v.*, u.usuario, u.nombre, u.apellido, u.correo, u.empresa 
                FROM payment_vouchers v
                JOIN users u ON v.user_id = u.id
                ORDER BY v.created_at DESC
            `);

            // 3. Estado de suscripción de todos los usuarios
            const users = await all(`
                SELECT id, usuario, nombre, apellido, correo, empresa, role, subscription_tier, trial_ends_at, subscription_expires_at, created_at
                FROM users
                ORDER BY created_at DESC
            `);

            // 4. Calcular KPIs
            const pendingCount = pendingVouchers.length;
            const approvedTotalUSD = allVouchers
                .filter(v => v.status === 'approved')
                .reduce((sum, v) => sum + (v.amount || 0), 0);
            
            const activeSubscriptionsCount = users.filter(u => u.subscription_tier === 'emprendedor' || u.subscription_tier === 'corporativo').length;
            
            const now = new Date();
            const expiredCount = users.filter(u => u.subscription_expires_at && new Date(u.subscription_expires_at) < now).length;

            return {
                kpis: {
                    pendingCount,
                    approvedTotalUSD,
                    activeSubscriptionsCount,
                    expiredCount
                },
                pendingVouchers,
                allVouchers,
                users
            };
        } catch (error) {
            console.error('Error en AdminPaymentsModel.getOverview:', error);
            throw error;
        }
    },

    /**
     * Aprobar / Validar un comprobante de pago manualmente
     */
    approveVoucher: async (voucherId, customMonths) => {
        try {
            const voucher = await get('SELECT * FROM payment_vouchers WHERE id = ?', [voucherId]);
            if (!voucher) {
                throw new Error('Comprobante de pago no encontrado.');
            }

            const now = new Date();
            let monthsToAdd = 1;

            if (customMonths) {
                monthsToAdd = parseInt(customMonths, 10);
            } else if (voucher.cycle === 'annual') {
                monthsToAdd = 12;
            }

            // Calcular fecha de expiración
            const expiresAt = new Date(now);
            expiresAt.setMonth(expiresAt.getMonth() + monthsToAdd);
            const expirationStr = expiresAt.toISOString();

            // Actualizar voucher
            await run(`UPDATE payment_vouchers SET status = 'approved' WHERE id = ?`, [voucherId]);

            // Actualizar plan y expiración del usuario
            await run(`
                UPDATE users 
                SET subscription_tier = ?, subscription_expires_at = ?, trial_ends_at = NULL 
                WHERE id = ?
            `, [voucher.plan, expirationStr, voucher.user_id]);

            return {
                voucher_id: voucherId,
                user_id: voucher.user_id,
                plan: voucher.plan,
                subscription_expires_at: expirationStr
            };
        } catch (error) {
            console.error('Error en AdminPaymentsModel.approveVoucher:', error);
            throw error;
        }
    },

    /**
     * Rechazar un comprobante de pago
     */
    rejectVoucher: async (voucherId, reason) => {
        try {
            const voucher = await get('SELECT id FROM payment_vouchers WHERE id = ?', [voucherId]);
            if (!voucher) {
                throw new Error('Comprobante de pago no encontrado.');
            }

            await run(`UPDATE payment_vouchers SET status = 'rejected', rejection_reason = ? WHERE id = ?`, [reason || 'Comprobante no válido', voucherId]);
            return { voucher_id: voucherId, status: 'rejected' };
        } catch (error) {
            console.error('Error en AdminPaymentsModel.rejectVoucher:', error);
            throw error;
        }
    },

    /**
     * Override manual para cambiar la suscripción y expiración de un usuario directamente
     */
    updateUserSubscription: async (userId, tier, expirationDate) => {
        try {
            let expiresAt = expirationDate || null;
            if (tier !== 'basico' && !expiresAt) {
                const now = new Date();
                now.setMonth(now.getMonth() + 1);
                expiresAt = now.toISOString();
            }

            await run(`UPDATE users SET subscription_tier = ?, subscription_expires_at = ? WHERE id = ?`, [tier, expiresAt, userId]);
            return { userId, subscription_tier: tier, subscription_expires_at: expiresAt };
        } catch (error) {
            console.error('Error en AdminPaymentsModel.updateUserSubscription:', error);
            throw error;
        }
    }
};

module.exports = AdminPaymentsModel;
