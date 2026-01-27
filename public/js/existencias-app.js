document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        inventory: [], // Lista unificada
        currency: 'USD',
        filter: 'all'
    };

    // --- DOM ---
    const tableBody = document.getElementById('inventory-table-body');
    const kpiTotalValue = document.getElementById('kpi-total-value');
    const kpiWac = document.getElementById('kpi-wac');
    const kpiTotalStock = document.getElementById('kpi-total-stock');
    const tabs = document.querySelectorAll('.filter-tab');
    const searchInput = document.getElementById('search-inventory');

    init();

    async function init() {
        try {
            await loadData();
            setupListeners();
        } catch (e) {
            console.error("Error loading inventory:", e);
            tableBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-500">Error al cargar datos.</td></tr>`;
        }
    }

    async function loadData() {
        // 1. Cargar Datos en Paralelo
        const [acquisitions, batchesTree, userProfile] = await Promise.all([
            api('/api/acquisitions'),
            api('/api/batches/tree'),
            api('/api/user/profile')
        ]);

        state.currency = userProfile.default_currency || 'USD';

        // 2. Procesar Inventario Unificado
        const inventoryList = [];

        // A) Procesar Materia Prima (Acopio)
        // Solo los que están 'disponible' cuentan como stock en bodega de acopio
        acquisitions.forEach(acq => {
            if (acq.estado === 'disponible') {
                inventoryList.push({
                    id: acq.id,
                    product: `${acq.nombre_producto} (${acq.tipo_acopio})`,
                    type: 'acopio',
                    status: 'En Bodega',
                    entryDate: new Date(acq.fecha_acopio),
                    weight: acq.peso_kg || 0,
                    unitCost: (acq.precio_unitario && acq.peso_kg) ? (acq.precio_unitario / acq.peso_kg) : 0,
                    totalValue: acq.precio_unitario || 0,
                    location: acq.finca_origen || 'Centro de Acopio'
                });
            }
        });

        // B) Procesar Lotes en Proceso/Terminados
        // Necesitamos aplanar el árbol de lotes para listarlos
        const flattenBatches = (nodes) => {
            let flat = [];
            nodes.forEach(node => {
                const data = typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
                
                // Intentar inferir peso actual (buscando claves comunes)
                let currentWeight = 0;
                const weightKeys = Object.keys(data).filter(k => k.toLowerCase().includes('peso') || k.toLowerCase().includes('salida') || k.toLowerCase().includes('cantidad'));
                if (weightKeys.length > 0) {
                    currentWeight = parseFloat(data[weightKeys[0]]?.value || 0);
                }

                // Estimación de Costo para Lotes (Heredado simple o Cero por ahora)
                // Nota: Un sistema de costos real requeriría trazabilidad de costos agregados.
                // Aquí mostramos valor 0 o estimado para no confundir con caja real.
                
                // Determinar estado
                let type = node.is_locked ? 'terminado' : 'proceso';
                let statusLabel = node.is_locked ? 'Finalizado' : 'En Proceso';

                // Solo agregar si tiene peso > 0 (es un lote físico existente)
                if (currentWeight > 0) {
                    inventoryList.push({
                        id: node.id,
                        product: getProductNameFromBatch(node), 
                        type: type,
                        status: statusLabel,
                        entryDate: new Date(node.created_at),
                        weight: currentWeight,
                        unitCost: 0, // Pendiente: Implementar herencia de costos
                        totalValue: 0, 
                        location: 'Planta Procesamiento'
                    });
                }

                if (node.children && node.children.length > 0) {
                    flat = flat.concat(flattenBatches(node.children));
                }
            });
            return flat;
        };

        const flatBatches = flattenBatches(batchesTree);
        state.inventory = [...inventoryList, ...flatBatches];

        // 3. Renderizar
        updateDashboard();
    }

    function getProductNameFromBatch(batch) {
        // Intentar obtener nombre legible
        // Idealmente vendría del JOIN con plantillas, pero si no, usamos el ID o data
        return `Lote ${batch.plantilla_id || 'Proceso'}`; // Simplificado
    }

    function updateDashboard() {
        const filtered = state.inventory.filter(item => {
            if (state.filter === 'all') return true;
            return item.type === state.filter;
        });

        // --- CALCULO DE KPIs (Solo sobre lo filtrado o sobre todo?) ---
        // Generalmente KPIs financieros se basan en Materia Prima (Acopio) que es donde tenemos costos reales
        const acopioItems = state.inventory.filter(i => i.type === 'acopio');
        
        const totalVal = acopioItems.reduce((sum, i) => sum + i.totalValue, 0);
        const totalKg = acopioItems.reduce((sum, i) => sum + i.weight, 0);
        const wac = totalKg > 0 ? (totalVal / totalKg) : 0;
        
        const globalStock = state.inventory.reduce((sum, i) => sum + i.weight, 0); // Stock físico total (MP + Proceso)

        // Render KPIs
        animateValue(kpiTotalValue, totalVal, state.currency);
        kpiWac.textContent = `${formatCurrency(wac)} / kg`;
        kpiTotalStock.textContent = `${globalStock.toLocaleString()} kg`;

        // Render Tabla
        renderTable(filtered);
    }

    function renderTable(items) {
        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">No hay existencias en esta categoría.</td></tr>`;
            return;
        }

        tableBody.innerHTML = items.map(item => {
            // Cálculo de Antigüedad (Maduración)
            const daysOld = Math.floor((new Date() - item.entryDate) / (1000 * 60 * 60 * 24));
            
            // Semáforo de Maduración
            let badgeClass = 'bg-green-100 text-green-700';
            let icon = 'fa-clock';
            if (daysOld > 30) badgeClass = 'bg-amber-100 text-amber-700';
            if (daysOld > 90) { badgeClass = 'bg-red-100 text-red-700'; icon = 'fa-triangle-exclamation'; }

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-50">
                    <td class="p-4 font-mono text-xs font-bold text-slate-600">${item.id}</td>
                    <td class="p-4">
                        <div class="font-bold text-slate-800">${item.product}</div>
                        <div class="text-xs text-slate-400">${item.location}</div>
                    </td>
                    <td class="p-4">
                        <span class="px-2 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(item.type)}">
                            ${item.status}
                        </span>
                    </td>
                    <td class="p-4 text-right font-bold text-slate-700">${item.weight.toFixed(2)}</td>
                    <td class="p-4 text-right text-slate-500 text-xs">${item.unitCost > 0 ? formatCurrency(item.unitCost) : '-'}</td>
                    <td class="p-4 text-right font-bold text-emerald-700">${item.totalValue > 0 ? formatCurrency(item.totalValue) : '-'}</td>
                    <td class="p-4 text-center">
                        <span class="inline-flex items-center gap-1 px-2 py-1 rounded border ${badgeClass} border-current border-opacity-20 text-xs font-bold">
                            <i class="fas ${icon}"></i> ${daysOld} días
                        </span>
                    </td>
                    <td class="p-4 text-center">
                        <button class="text-slate-400 hover:text-blue-600 transition p-1" title="Ver Detalle">
                            <i class="fas fa-eye"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    // --- UTILIDADES ---
    function getStatusColor(type) {
        if (type === 'acopio') return 'bg-blue-50 text-blue-700 border border-blue-100';
        if (type === 'proceso') return 'bg-amber-50 text-amber-700 border border-amber-100';
        if (type === 'terminado') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
        return 'bg-slate-100 text-slate-600';
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: state.currency }).format(val);
    }

    function animateValue(obj, end, currency) {
        const start = 0;
        const duration = 1000;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = progress * (end - start) + start;
            obj.innerHTML = new Intl.NumberFormat('es-PE', { style: 'currency', currency: currency }).format(val);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function setupListeners() {
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => t.classList.remove('bg-slate-800', 'text-white', 'active'));
                tabs.forEach(t => t.classList.add('text-slate-600', 'hover:bg-white'));
                
                e.target.classList.add('bg-slate-800', 'text-white', 'active');
                e.target.classList.remove('text-slate-600', 'hover:bg-white');
                
                state.filter = e.target.dataset.status;
                updateDashboard();
            });
        });

        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = state.inventory.filter(i => 
                i.id.toLowerCase().includes(term) || 
                i.product.toLowerCase().includes(term)
            );
            renderTable(filtered);
        });
    }

    // API Helper
    async function api(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('API Error');
        return res.json();
    }
});