/**
 * Checkout App - Client-Side Logic
 * Maneja el resumen de plan, toggle mensual/anual, selector USD/PEN con tipo de cambio en vivo
 * (fxapi.app), métodos de pago adaptativos (Yape, BBVA, Mercado Pago) y confirmación de comprobantes.
 */

const checkoutApp = {
    plan: 'emprendedor',
    cycle: 'monthly',
    currency: 'USD',       // 'USD' | 'PEN'
    activeTab: 'yape',
    exchangeRate: 3.75,    // Fallback hasta que cargue el live rate
    rateLastUpdated: null,

    plansData: {
        emprendedor: {
            title: 'Plan Emprendedor',
            badge: 'Recomendado',
            monthly: { priceUSD: 15.00, baseUSD: 15.00, discountUSD: 0 },
            annual:  { priceUSD: 150.00, baseUSD: 180.00, discountUSD: 30.00 },
            features: [
                'Landing Page propia con URL dedicada',
                'Venta Directa por WhatsApp integrada',
                'Generación de Códigos QR para empaques',
                'Registro de hasta 20 Productos',
                'Registro de 10 Fincas y 10 Plantas',
                'Lotes de Trazabilidad ILIMITADOS',
                'Estadísticas de visitas y escaneos QR'
            ]
        },
        corporativo: {
            title: 'Plan Corporativo',
            badge: 'I+D y Agroindustria',
            monthly: { priceUSD: 45.00, baseUSD: 45.00, discountUSD: 0 },
            annual:  { priceUSD: 450.00, baseUSD: 540.00, discountUSD: 90.00 },
            features: [
                'Todo lo del Plan Emprendedor',
                'Registro ILIMITADO de Productos',
                'Registro ILIMITADO de Fincas y Plantas',
                'Módulos I+D: Etiquetas Nutricionales (FDA, UE, OPS y Nutri-Score)',
                'Módulos I+D: Estimación de Cosecha impulsada por IA',
                'Soporte Técnico Especializado e Integración API'
            ]
        }
    },

    /* ─────────────────────────────────────────────
       INIT
    ───────────────────────────────────────────── */
    init: async function () {
        const params = new URLSearchParams(window.location.search);
        const urlPlan  = (params.get('plan')  || 'emprendedor').toLowerCase();
        const urlCycle = (params.get('cycle') || 'monthly').toLowerCase();

        if (this.plansData[urlPlan]) this.plan = urlPlan;
        if (urlCycle === 'annual' || urlCycle === 'monthly') this.cycle = urlCycle;

        // Mostrar skeleton de precio mientras carga el rate
        this.showRateLoadingState(true);

        // Cargar tipo de cambio en vivo (no bloqueamos UI)
        await this.fetchLiveRate();

        this.updateSummaryUI();
        this.switchTab('yape');
    },

    /* ─────────────────────────────────────────────
       LIVE EXCHANGE RATE — fxapi.app (gratuito, sin key)
    ───────────────────────────────────────────── */
    fetchLiveRate: async function () {
        try {
            const res = await fetch('https://fxapi.app/api/usd/pen.json', {
                signal: AbortSignal.timeout(4000)
            });
            if (!res.ok) throw new Error('fxapi.app no disponible');
            const data = await res.json();

            if (data && data.rate && data.rate > 0) {
                this.exchangeRate = data.rate;
                this.rateLastUpdated = data.timestamp || new Date().toISOString();
                this.updateRateBadge();
            }
        } catch (err) {
            // Fallback al tipo de cambio hardcoded (3.75)
            console.warn('Usando tipo de cambio de fallback (S/ 3.75):', err.message);
            this.rateLastUpdated = null;
        } finally {
            this.showRateLoadingState(false);
        }
    },

    updateRateBadge: function () {
        const badgeEl = document.getElementById('rate-badge');
        const rateValEl = document.getElementById('rate-live-value');
        const rateSourceEl = document.getElementById('rate-source-label');

        if (rateValEl) rateValEl.textContent = `1 USD = S/ ${this.exchangeRate.toFixed(4)}`;
        if (badgeEl) badgeEl.classList.remove('hidden');
        if (rateSourceEl) {
            const d = this.rateLastUpdated ? new Date(this.rateLastUpdated) : null;
            rateSourceEl.textContent = d
                ? `Actualizado ${d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`
                : 'Tipo de cambio de referencia';
        }
    },

    showRateLoadingState: function (loading) {
        const loaderEl = document.getElementById('rate-loading');
        if (loaderEl) {
            if (loading) loaderEl.classList.remove('hidden');
            else loaderEl.classList.add('hidden');
        }
    },

    /* ─────────────────────────────────────────────
       CURRENCY TOGGLE (USD ↔ PEN)
    ───────────────────────────────────────────── */
    setCurrency: function (currency) {
        this.currency = currency;

        const btnUSD = document.getElementById('currency-btn-usd');
        const btnPEN = document.getElementById('currency-btn-pen');
        const activeClass   = 'px-4 py-1.5 rounded-xl text-xs font-bold transition bg-amber-800 text-white shadow';
        const inactiveClass = 'px-4 py-1.5 rounded-xl text-xs font-bold transition text-stone-600 hover:text-stone-900';

        if (currency === 'PEN') {
            if (btnPEN) btnPEN.className = activeClass;
            if (btnUSD) btnUSD.className = inactiveClass;
        } else {
            if (btnUSD) btnUSD.className = activeClass;
            if (btnPEN) btnPEN.className = inactiveClass;
        }

        this.updateSummaryUI();
    },

    /* ─────────────────────────────────────────────
       HELPERS DE FORMATO
    ───────────────────────────────────────────── */
    formatAmount: function (usdAmount) {
        if (this.currency === 'PEN') {
            const pen = usdAmount * this.exchangeRate;
            return { primary: `S/ ${pen.toFixed(2)}`, secondary: `≈ $${usdAmount.toFixed(2)} USD` };
        }
        const pen = usdAmount * this.exchangeRate;
        return { primary: `$${usdAmount.toFixed(2)} USD`, secondary: `≈ S/ ${pen.toFixed(2)}` };
    },

    getSymbol: function () {
        return this.currency === 'PEN' ? 'S/' : '$';
    },

    getAmountInActiveCurrency: function (usdAmount) {
        return this.currency === 'PEN' ? usdAmount * this.exchangeRate : usdAmount;
    },

    /* ─────────────────────────────────────────────
       BILLING CYCLE TOGGLE
    ───────────────────────────────────────────── */
    setCycle: function (newCycle) {
        if (newCycle === 'annual' || newCycle === 'monthly') {
            this.cycle = newCycle;
            this.updateSummaryUI();
        }
    },

    /* ─────────────────────────────────────────────
       UI UPDATE — Summary Column
    ───────────────────────────────────────────── */
    updateSummaryUI: function () {
        const planObj  = this.plansData[this.plan];
        const cycleObj = planObj[this.cycle];
        const isPEN = this.currency === 'PEN';

        // Título y Badge
        const titleEl = document.getElementById('summary-plan-title');
        const badgeEl = document.getElementById('summary-plan-badge');
        if (titleEl) titleEl.textContent = planObj.title;
        if (badgeEl) badgeEl.textContent = planObj.badge;

        // Botones de ciclo de facturación
        const btnMonthly = document.getElementById('cycle-btn-monthly');
        const btnAnnual  = document.getElementById('cycle-btn-annual');

        if (this.cycle === 'annual') {
            if (btnAnnual)  btnAnnual.className  = 'w-1/2 py-2 rounded-xl text-xs font-bold transition bg-amber-800 text-white shadow flex items-center justify-center gap-1';
            if (btnMonthly) btnMonthly.className = 'w-1/2 py-2 rounded-xl text-xs font-bold transition text-stone-600 hover:text-stone-900';
        } else {
            if (btnMonthly) btnMonthly.className = 'w-1/2 py-2 rounded-xl text-xs font-bold transition bg-amber-800 text-white shadow';
            if (btnAnnual)  btnAnnual.className  = 'w-1/2 py-2 rounded-xl text-xs font-bold transition text-stone-600 hover:text-stone-900 flex items-center justify-center gap-1';
        }

        // Precio base (antes de descuento)
        const basePriceEl    = document.getElementById('summary-base-price');
        const baseFormatted  = this.formatAmount(cycleObj.baseUSD);
        if (basePriceEl) basePriceEl.textContent = baseFormatted.primary;

        // Descuento anual
        const discountRow     = document.getElementById('summary-discount-row');
        const discountAmtEl   = document.getElementById('summary-discount-amount');
        const cycleTextEl     = document.getElementById('summary-cycle-text');

        if (this.cycle === 'annual' && cycleObj.discountUSD > 0) {
            if (discountRow) discountRow.classList.remove('hidden');
            const discountFmt = this.formatAmount(cycleObj.discountUSD);
            if (discountAmtEl) discountAmtEl.textContent = `-${discountFmt.primary}`;
            if (cycleTextEl) cycleTextEl.textContent = 'Facturado anualmente (2 meses gratis)';
        } else {
            if (discountRow) discountRow.classList.add('hidden');
            if (cycleTextEl) cycleTextEl.textContent = 'Facturado mensualmente';
        }

        // Total principal + valor alternativo
        const totalEl         = document.getElementById('summary-total-usd');
        const totalAltEl      = document.getElementById('summary-total-alt');
        const totalFmt        = this.formatAmount(cycleObj.priceUSD);
        const totalCurrencyEl = document.getElementById('summary-currency-label');

        if (totalEl) totalEl.textContent = isPEN
            ? (cycleObj.priceUSD * this.exchangeRate).toFixed(2)
            : cycleObj.priceUSD.toFixed(2);
        if (totalCurrencyEl) totalCurrencyEl.textContent = isPEN ? 'PEN' : 'USD';
        if (totalAltEl) totalAltEl.textContent = totalFmt.secondary;

        // Features
        const featuresListEl = document.getElementById('summary-features-list');
        if (featuresListEl) {
            featuresListEl.innerHTML = planObj.features.map(f => `
                <li class="flex items-start gap-2">
                    <i class="fas fa-check text-green-600 mt-0.5"></i>
                    <span>${f}</span>
                </li>
            `).join('');
        }

        // Instrucciones Yape — actualizar monto
        const yapeAmtEl = document.getElementById('yape-instruction-amount');
        if (yapeAmtEl) {
            const yapeAmt = this.formatAmount(cycleObj.priceUSD);
            yapeAmtEl.innerHTML = `<strong class="text-purple-900">${yapeAmt.primary}</strong> <span class="text-stone-500">(${yapeAmt.secondary})</span>`;
        }

        // Botón Mercado Pago — siempre en USD
        const mpBtnAmtEl = document.getElementById('mp-btn-amount');
        if (mpBtnAmtEl) mpBtnAmtEl.textContent = `$${cycleObj.priceUSD.toFixed(2)} USD`;
    },

    /* ─────────────────────────────────────────────
       TABS DE MÉTODOS DE PAGO
    ───────────────────────────────────────────── */
    switchTab: function (tabName) {
        this.activeTab = tabName;

        const btnYape    = document.getElementById('tab-btn-yape');
        const btnBbva    = document.getElementById('tab-btn-bbva');
        const btnMp      = document.getElementById('tab-btn-mp');
        const contentYape = document.getElementById('tab-content-yape');
        const contentBbva = document.getElementById('tab-content-bbva');
        const contentMp   = document.getElementById('tab-content-mp');

        const inactiveClass = 'py-3 px-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition text-stone-600 hover:text-stone-900';

        if (btnYape) btnYape.className = inactiveClass;
        if (btnBbva) btnBbva.className = inactiveClass;
        if (btnMp)   btnMp.className   = inactiveClass;

        if (contentYape) contentYape.classList.add('hidden');
        if (contentBbva) contentBbva.classList.add('hidden');
        if (contentMp)   contentMp.classList.add('hidden');

        if (tabName === 'bbva') {
            if (btnBbva) btnBbva.className = 'py-3 px-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition tab-active-bbva';
            if (contentBbva) contentBbva.classList.remove('hidden');
        } else if (tabName === 'mp') {
            if (btnMp) btnMp.className = 'py-3 px-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition tab-active-mp';
            if (contentMp) contentMp.classList.remove('hidden');
        } else {
            if (btnYape) btnYape.className = 'py-3 px-2 rounded-xl text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1.5 transition tab-active-yape';
            if (contentYape) contentYape.classList.remove('hidden');
        }
    },

    /* ─────────────────────────────────────────────
       UTILIDADES
    ───────────────────────────────────────────── */
    copyToClipboard: function (text, label) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text);
            this.showToast(`¡${label} copiada al portapapeles!`);
        } else {
            const input = document.createElement('input');
            input.value = text;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            this.showToast(`¡${label} copiada al portapapeles!`);
        }
    },

    handleFilePreview: function (inputEl, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (inputEl.files && inputEl.files[0]) {
            const file = inputEl.files[0];
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = function (e) {
                    container.innerHTML = `
                        <div class="flex items-center gap-3 p-2 bg-stone-100 rounded-xl border border-stone-200">
                            <img src="${e.target.result}" class="w-12 h-12 object-cover rounded-lg">
                            <div class="text-xs">
                                <span class="font-bold text-stone-800 block">${file.name}</span>
                                <span class="text-stone-500">${(file.size / 1024).toFixed(1)} KB</span>
                            </div>
                        </div>
                    `;
                    container.classList.remove('hidden');
                };
                reader.readAsDataURL(file);
            } else {
                container.innerHTML = `
                    <div class="p-2 bg-stone-100 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 flex items-center gap-2">
                        <i class="fas fa-file-pdf text-red-600 text-base"></i>
                        <span>${file.name}</span>
                    </div>
                `;
                container.classList.remove('hidden');
            }
        } else {
            container.classList.add('hidden');
        }
    },

    /* ─────────────────────────────────────────────
       SUBMIT VOUCHER (Yape / BBVA)
    ───────────────────────────────────────────── */
    handleVoucherSubmit: async function (e, method) {
        e.preventDefault();
        const planObj  = this.plansData[this.plan];
        const cycleObj = planObj[this.cycle];

        const opInputId   = method === 'bbva_transfer' ? 'bbva-op-number' : 'yape-op-number';
        const fileInputId = method === 'bbva_transfer' ? 'bbva-voucher-file' : 'yape-voucher-file';
        const submitBtnId = method === 'bbva_transfer' ? 'btn-submit-bbva' : 'btn-submit-yape';

        const opNum   = document.getElementById(opInputId)?.value || '';
        const fileEl  = document.getElementById(fileInputId);
        const submitBtn = document.getElementById(submitBtnId);

        let voucherBase64 = '';
        if (fileEl && fileEl.files && fileEl.files[0]) {
            voucherBase64 = await this.readFileAsDataURL(fileEl.files[0]);
        }

        const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Enviar Comprobante';

        try {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin mr-1"></i> Registrando...`;
            }

            const token = localStorage.getItem('token');
            const res = await fetch('/api/payments/submit-voucher', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    plan: this.plan,
                    cycle: this.cycle,
                    amount: cycleObj.priceUSD,
                    payment_method: method,
                    operation_number: opNum,
                    voucher_url: voucherBase64 || ''
                })
            });

            const json = await res.json();

            if (json.success) {
                const amtFmt = this.formatAmount(cycleObj.priceUSD);
                alert(`¡Comprobante enviado con éxito! 🎉\n\nOperación #${opNum || 'N/A'} por ${amtFmt.primary}\nNuestro equipo validará la transferencia y activará tu ${planObj.title} a la brevedad.`);
                window.location.href = '/app/cuenta';
            } else {
                alert('Error al registrar comprobante: ' + (json.error || 'Ocurrió un problema'));
            }
        } catch (err) {
            console.error('Error al enviar voucher:', err);
            alert('Error de conexión al enviar comprobante.');
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        }
    },

    /* ─────────────────────────────────────────────
       MERCADO PAGO REDIRECT
    ───────────────────────────────────────────── */
    handleMercadoPagoRedirect: async function () {
        const btn = document.getElementById('btn-submit-mp');
        const originalText = btn ? btn.innerHTML : 'Pagar con Mercado Pago';

        try {
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Redirigiendo a Mercado Pago...`;
            }

            const token = localStorage.getItem('token');
            const res = await fetch('/api/payments/create-preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ plan: this.plan, cycle: this.cycle })
            });

            if (!res.ok) throw new Error('No se pudo crear la preferencia de pago.');
            const data = await res.json();

            if (data.init_point) {
                window.location.href = data.init_point;
            } else {
                alert('No se pudo obtener la URL de Mercado Pago.');
            }
        } catch (error) {
            console.error('Error al redirigir a Mercado Pago:', error);
            alert('Error al iniciar el pago con Mercado Pago. Por favor reintente.');
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    },

    readFileAsDataURL: function (file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload  = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    },

    showToast: function (msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = 'bg-stone-900 text-white px-4 py-3 rounded-2xl shadow-xl text-xs font-bold flex items-center gap-2 mb-2';
        toast.innerHTML = `<i class="fas fa-check-circle text-green-400"></i> ${msg}`;

        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    checkoutApp.init();
});
