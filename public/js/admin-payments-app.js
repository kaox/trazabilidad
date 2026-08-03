/**
 * Admin Payments App - Client Side
 * Maneja la aprobación/rechazo de pagos manuales (Yape/Plin, BBVA),
 * historial de transacciones por usuario y vencimiento de suscripciones.
 */

const adminPaymentsApp = {
    overviewData: null,
    currentVoucher: null,

    init: async function () {
        await this.loadOverview();
    },

    loadOverview: async function () {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/payments', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const json = await res.json();
            if (!json.success || !json.data) {
                console.error('Error cargando pagos admin:', json.error);
                return;
            }

            this.overviewData = json.data;

            // 1. Renderizar KPIs
            const { kpis } = this.overviewData;
            document.getElementById('kpi-pending-count').textContent = kpis.pendingCount || 0;
            document.getElementById('badge-pending-count').textContent = kpis.pendingCount || 0;
            document.getElementById('kpi-approved-total').textContent = `$${(kpis.approvedTotalUSD || 0).toFixed(2)}`;
            document.getElementById('kpi-active-subs').textContent = kpis.activeSubscriptionsCount || 0;
            document.getElementById('kpi-expired-subs').textContent = kpis.expiredCount || 0;

            // 2. Renderizar Tablas
            this.renderPendingTable();
            this.renderHistoryTable();
            this.renderUsersTable();
        } catch (error) {
            console.error('Error al cargar panel de pagos admin:', error);
        }
    },

    switchTab: function (tabName) {
        const btnPending = document.getElementById('admin-tab-pending');
        const btnHistory = document.getElementById('admin-tab-history');
        const btnUsers = document.getElementById('admin-tab-users');

        const contentPending = document.getElementById('admin-content-pending');
        const contentHistory = document.getElementById('admin-content-history');
        const contentUsers = document.getElementById('admin-content-users');

        const inactiveClass = 'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition text-stone-600 hover:text-stone-900';
        const activeClass = 'px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition bg-amber-800 text-white shadow';

        btnPending.className = inactiveClass;
        btnHistory.className = inactiveClass;
        btnUsers.className = inactiveClass;

        contentPending.classList.add('hidden');
        contentHistory.classList.add('hidden');
        contentUsers.classList.add('hidden');

        if (tabName === 'history') {
            btnHistory.className = activeClass;
            contentHistory.classList.remove('hidden');
        } else if (tabName === 'users') {
            btnUsers.className = activeClass;
            contentUsers.classList.remove('hidden');
        } else {
            btnPending.className = activeClass;
            contentPending.classList.remove('hidden');
        }
    },

    // --- TAB 1: Tabla de Pendientes ---
    renderPendingTable: function () {
        const tbody = document.getElementById('table-body-pending');
        if (!tbody) return;

        const list = this.overviewData?.pendingVouchers || [];

        if (list.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="p-8 text-center text-stone-400 font-medium">
                        <i class="fas fa-check-circle text-green-500 text-2xl block mb-2"></i>
                        ¡No hay comprobantes pendientes de validación! Todos los pagos están al día.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = list.map(v => {
            const userName = `${v.nombre || ''} ${v.apellido || ''}`.trim() || v.usuario;
            const companyName = v.empresa || 'Empresa sin nombre';
            const methodBadge = v.payment_method === 'yape_plin'
                ? `<span class="bg-purple-100 text-purple-900 font-bold px-2.5 py-1 rounded-full text-[10px]"><i class="fas fa-qrcode mr-1"></i>Yape / Plin</span>`
                : `<span class="bg-blue-100 text-blue-900 font-bold px-2.5 py-1 rounded-full text-[10px]"><i class="fas fa-university mr-1"></i>BBVA Transfer</span>`;

            const cycleText = v.cycle === 'annual' ? 'Anual (-17%)' : 'Mensual';
            const dateStr = new Date(v.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

            const hasVoucher = Boolean(v.voucher_url && v.voucher_url !== '');

            return `
                <tr class="hover:bg-amber-50/40 transition">
                    <td class="p-3.5">
                        <span class="font-bold text-stone-900 block">${userName}</span>
                        <span class="text-[11px] text-stone-500">${companyName} • ${v.correo}</span>
                    </td>
                    <td class="p-3.5">
                        <span class="font-bold text-amber-900 uppercase block">${v.plan}</span>
                        <span class="text-[11px] text-stone-500">${cycleText} • $${(v.amount || 0).toFixed(2)} USD</span>
                    </td>
                    <td class="p-3.5">${methodBadge}</td>
                    <td class="p-3.5 font-mono font-bold text-stone-800">${v.operation_number || 'N/A'}</td>
                    <td class="p-3.5 text-center">
                        ${hasVoucher ? `
                            <button onclick="adminPaymentsApp.openVoucherModal('${v.id}')" class="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg text-[10px] inline-flex items-center gap-1">
                                <i class="fas fa-eye"></i> Ver Voucher
                            </button>
                        ` : '<span class="text-stone-400 italic">Sin imagen</span>'}
                    </td>
                    <td class="p-3.5 text-stone-500 text-[11px]">${dateStr}</td>
                    <td class="p-3.5 text-right space-x-1">
                        <button onclick="adminPaymentsApp.approveVoucher('${v.id}')" title="Aprobar Pago" class="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs transition shadow-xs">
                            <i class="fas fa-check mr-1"></i> Aprobar
                        </button>
                        <button onclick="adminPaymentsApp.rejectVoucher('${v.id}')" title="Rechazar Pago" class="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 font-bold rounded-xl text-xs transition">
                            <i class="fas fa-times"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    // --- TAB 2: Tabla de Histórico ---
    renderHistoryTable: function (filterQuery = '', statusFilter = 'ALL') {
        const tbody = document.getElementById('table-body-history');
        if (!tbody) return;

        let list = this.overviewData?.allVouchers || [];

        if (statusFilter !== 'ALL') {
            list = list.filter(v => v.status === statusFilter);
        }

        if (filterQuery) {
            const q = filterQuery.toLowerCase();
            list = list.filter(v =>
                (v.usuario || '').toLowerCase().includes(q) ||
                (v.nombre || '').toLowerCase().includes(q) ||
                (v.correo || '').toLowerCase().includes(q) ||
                (v.empresa || '').toLowerCase().includes(q) ||
                (v.operation_number || '').toLowerCase().includes(q)
            );
        }

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-6 text-center text-stone-400">No se encontraron pagos en el historial.</td></tr>`;
            return;
        }

        tbody.innerHTML = list.map(v => {
            const userName = `${v.nombre || ''} ${v.apellido || ''}`.trim() || v.usuario;
            const statusBadge = v.status === 'approved'
                ? `<span class="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full text-[10px]">Aprobado</span>`
                : v.status === 'rejected'
                ? `<span class="bg-red-100 text-red-900 font-bold px-2 py-0.5 rounded-full text-[10px]">Rechazado</span>`
                : `<span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px]">Pendiente</span>`;

            const dateStr = new Date(v.created_at).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });

            return `
                <tr class="hover:bg-stone-50 transition">
                    <td class="p-3.5 font-mono text-[10px] text-stone-400">${v.id.substring(0, 8)}...<br><span class="text-stone-600">${dateStr}</span></td>
                    <td class="p-3.5">
                        <span class="font-bold text-stone-900 block">${userName}</span>
                        <span class="text-[11px] text-stone-500">${v.correo}</span>
                    </td>
                    <td class="p-3.5">
                        <span class="font-bold text-stone-800 uppercase block">${v.plan} (${v.cycle})</span>
                        <span class="text-xs font-bold text-emerald-800">$${(v.amount || 0).toFixed(2)} USD</span>
                    </td>
                    <td class="p-3.5 uppercase font-bold text-[10px] text-stone-600">${v.payment_method}</td>
                    <td class="p-3.5 font-mono font-bold text-stone-800">${v.operation_number || 'N/A'}</td>
                    <td class="p-3.5 text-center">${statusBadge}</td>
                    <td class="p-3.5 text-right">
                        ${v.voucher_url ? `<button onclick="adminPaymentsApp.openVoucherModal('${v.id}')" class="text-amber-800 font-bold text-xs hover:underline">Ver Voucher</button>` : '—'}
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterHistory: function () {
        const q = document.getElementById('search-history')?.value || '';
        const st = document.getElementById('filter-history-status')?.value || 'ALL';
        this.renderHistoryTable(q, st);
    },

    // --- TAB 3: Tabla de Usuarios & Expiraciones ---
    renderUsersTable: function (filterQuery = '') {
        const tbody = document.getElementById('table-body-users');
        if (!tbody) return;

        let list = this.overviewData?.users || [];

        if (filterQuery) {
            const q = filterQuery.toLowerCase();
            list = list.filter(u =>
                (u.usuario || '').toLowerCase().includes(q) ||
                (u.nombre || '').toLowerCase().includes(q) ||
                (u.correo || '').toLowerCase().includes(q) ||
                (u.empresa || '').toLowerCase().includes(q)
            );
        }

        if (list.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-stone-400">No se encontraron usuarios.</td></tr>`;
            return;
        }

        const now = new Date();

        tbody.innerHTML = list.map(u => {
            const name = `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.usuario;
            const tier = (u.subscription_tier || 'basico').toLowerCase();

            let tierBadge = `<span class="bg-stone-100 text-stone-700 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase">Básico</span>`;
            if (tier === 'emprendedor') {
                tierBadge = `<span class="bg-amber-100 text-amber-900 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase">Emprendedor</span>`;
            } else if (tier === 'corporativo') {
                tierBadge = `<span class="bg-purple-100 text-purple-900 font-bold px-2.5 py-1 rounded-full text-[10px] uppercase">Corporativo</span>`;
            } else if (tier === 'admin') {
                tierBadge = `<span class="bg-stone-900 text-white font-bold px-2.5 py-1 rounded-full text-[10px] uppercase">Admin</span>`;
            }

            let expirationStr = 'Sin vencimiento activo';
            let expStatus = `<span class="text-stone-400 text-xs">—</span>`;

            if (u.subscription_expires_at) {
                const expDate = new Date(u.subscription_expires_at);
                expirationStr = expDate.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
                
                const diffTime = expDate - now;
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                if (diffDays < 0) {
                    expStatus = `<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Vencido (${Math.abs(diffDays)}d)</span>`;
                } else if (diffDays <= 7) {
                    expStatus = `<span class="bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-full text-[10px]">Por Vencer (${diffDays}d)</span>`;
                } else {
                    expStatus = `<span class="bg-emerald-100 text-emerald-900 font-bold px-2 py-0.5 rounded-full text-[10px]">Activo (${diffDays}d)</span>`;
                }
            }

            return `
                <tr class="hover:bg-stone-50 transition">
                    <td class="p-3.5 font-bold text-stone-900">${name}</td>
                    <td class="p-3.5">
                        <span class="block font-medium text-stone-800">${u.empresa || 'Sin Empresa'}</span>
                        <span class="text-[11px] text-stone-500">${u.correo}</span>
                    </td>
                    <td class="p-3.5">${tierBadge}</td>
                    <td class="p-3.5 font-medium text-stone-700">${expirationStr}</td>
                    <td class="p-3.5 text-center">${expStatus}</td>
                    <td class="p-3.5 text-right">
                        <button onclick="adminPaymentsApp.openUserOverride('${u.id}', '${tier}')" class="px-3 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-lg text-xs transition">
                            <i class="fas fa-edit mr-1"></i> Cambiar Plan
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    },

    filterUsers: function () {
        const q = document.getElementById('search-users')?.value || '';
        this.renderUsersTable(q);
    },

    // --- ACCIONES DE APROBACIÓN Y RECHAZO ---
    approveVoucher: async function (voucherId) {
        if (!confirm('¿Confirmas que has verificado el pago e ingresado el dinero a la cuenta?')) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/payments/vouchers/${voucherId}/approve`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            const json = await res.json();
            if (json.success) {
                alert('¡Pago validado y plan activado exitosamente!');
                this.closeVoucherModal();
                await this.loadOverview();
            } else {
                alert('Error al aprobar: ' + (json.error || 'Error desconocido'));
            }
        } catch (e) {
            console.error('Error aprobando voucher:', e);
            alert('Error de conexión.');
        }
    },

    rejectVoucher: async function (voucherId) {
        const reason = prompt('Ingrese el motivo del rechazo del comprobante (ej. Monto incompleto, voucher no legible):', 'Comprobante no válido');
        if (!reason) return;

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/payments/vouchers/${voucherId}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ reason })
            });

            const json = await res.json();
            if (json.success) {
                alert('Comprobante rechazado.');
                this.closeVoucherModal();
                await this.loadOverview();
            } else {
                alert('Error al rechazar: ' + (json.error || 'Error desconocido'));
            }
        } catch (e) {
            console.error('Error rechazando voucher:', e);
            alert('Error de conexión.');
        }
    },

    // --- MODAL DE VERIFICACIÓN DE VOUCHER ---
    openVoucherModal: function (voucherId) {
        const v = (this.overviewData?.allVouchers || []).find(item => item.id === voucherId);
        if (!v) return;

        this.currentVoucher = v;

        const previewContainer = document.getElementById('modal-voucher-preview');
        const detailsContainer = document.getElementById('modal-voucher-details');
        const modalBtnApprove = document.getElementById('modal-btn-approve');
        const modalBtnReject = document.getElementById('modal-btn-reject');

        if (v.voucher_url && v.voucher_url.startsWith('data:image')) {
            previewContainer.innerHTML = `<img src="${v.voucher_url}" class="max-h-[350px] object-contain rounded-xl shadow">`;
        } else if (v.voucher_url && v.voucher_url.startsWith('data:application/pdf')) {
            previewContainer.innerHTML = `<embed src="${v.voucher_url}" type="application/pdf" class="w-full h-80 rounded-xl">`;
        } else {
            previewContainer.innerHTML = `
                <div class="text-center p-6 text-stone-500">
                    <i class="fas fa-file-invoice text-4xl mb-2 text-stone-400"></i>
                    <p class="text-xs font-bold">Comprobante registrado por número de operación #${v.operation_number || 'N/A'}</p>
                </div>
            `;
        }

        const userName = `${v.nombre || ''} ${v.apellido || ''}`.trim() || v.usuario;

        detailsContainer.innerHTML = `
            <div class="grid grid-cols-2 gap-2">
                <div><strong class="text-stone-500">Usuario:</strong> ${userName}</div>
                <div><strong class="text-stone-500">Empresa:</strong> ${v.empresa || 'N/A'}</div>
                <div><strong class="text-stone-500">Plan:</strong> ${v.plan?.toUpperCase()} (${v.cycle})</div>
                <div><strong class="text-stone-500">Monto:</strong> $${(v.amount || 0).toFixed(2)} USD</div>
                <div><strong class="text-stone-500">Método:</strong> ${v.payment_method}</div>
                <div><strong class="text-stone-500">N° Operación:</strong> ${v.operation_number || 'N/A'}</div>
            </div>
        `;

        if (v.status === 'pending') {
            modalBtnApprove.classList.remove('hidden');
            modalBtnReject.classList.remove('hidden');
        } else {
            modalBtnApprove.classList.add('hidden');
            modalBtnReject.classList.add('hidden');
        }

        document.getElementById('modal-voucher').classList.remove('hidden');
    },

    closeVoucherModal: function () {
        document.getElementById('modal-voucher').classList.add('hidden');
        this.currentVoucher = null;
    },

    approveCurrentModalVoucher: function () {
        if (this.currentVoucher) {
            this.approveVoucher(this.currentVoucher.id);
        }
    },

    rejectCurrentModalVoucher: function () {
        if (this.currentVoucher) {
            this.rejectVoucher(this.currentVoucher.id);
        }
    },

    // --- OVERRIDE MANUAL DE USUARIO ---
    openUserOverride: async function (userId, currentTier) {
        const newTier = prompt(`Cambiar plan para el usuario ID: ${userId}\nOpciones: basico, emprendedor, corporativo`, currentTier);
        if (!newTier || !['basico', 'emprendedor', 'corporativo'].includes(newTier.toLowerCase())) {
            return;
        }

        let expirationDate = null;
        if (newTier.toLowerCase() !== 'basico') {
            const customDays = prompt('Ingrese el número de días de duración para la suscripción:', '30');
            if (customDays && !isNaN(customDays)) {
                const d = new Date();
                d.setDate(d.getDate() + parseInt(customDays, 10));
                expirationDate = d.toISOString();
            }
        }

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/admin/payments/users/${userId}/subscription`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    tier: newTier.toLowerCase(),
                    expiration_date: expirationDate
                })
            });

            const json = await res.json();
            if (json.success) {
                alert('Plan de usuario actualizado.');
                await this.loadOverview();
            } else {
                alert('Error al actualizar plan: ' + json.error);
            }
        } catch (e) {
            console.error('Error actualizando usuario:', e);
            alert('Error de conexión.');
        }
    },

    runExpirationCheck: async function () {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/admin/payments/check-expirations', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const json = await res.json();
            if (json.success) {
                alert('Verificación de expiraciones completada. Los planes vencidos han sido degradados a Básico.');
                await this.loadOverview();
            }
        } catch (e) {
            console.error('Error ejecutando verificación:', e);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    adminPaymentsApp.init();
});
