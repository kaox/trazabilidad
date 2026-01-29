document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        inventory: [], // Lista unificada
        currency: 'USD',
        unit: 'KG',
        filter: 'all',
        wacByProduct: {}, // Mapa de Costo Promedio por tipo de producto
        units: [], // <-- Nuevo: Para traducir IDs de unidades
        currencies: []
    };

    // --- DOM ---
    const tableBody = document.getElementById('inventory-table-body');
    const kpiTotalValue = document.getElementById('kpi-total-value');
    const kpiWac = document.getElementById('kpi-wac');
    const kpiTotalStock = document.getElementById('kpi-total-stock');
    const tabs = document.querySelectorAll('.filter-tab');
    const searchInput = document.getElementById('search-inventory');
    const refreshBtn = document.getElementById('refresh-btn');

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
        tableBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400"><i class="fas fa-circle-notch fa-spin mr-2"></i> Actualizando existencias...</td></tr>`;

        try {
            // 1. Cargar Datos en Paralelo (Incluyendo Config Global)
            const [acquisitions, batchesTree, userProfile, unitsRes, currenciesRes] = await Promise.all([
                api('/api/acquisitions'),
                api('/api/batches/tree'),
                api('/api/user/profile'),
                api('/api/config/units'),
                api('/api/config/currencies')
            ]);

            state.currency = userProfile.default_currency || 'USD';
            state.unit = userProfile.default_unit || 'KG';
            state.units = unitsRes;
            state.currencies = currenciesRes;

            // --- PASO PREVIO: Calcular Consumo de Acopios ---
            const acqUsageMap = {};
            const calculateUsage = (nodes) => {
                nodes.forEach(node => {
                    if (node.acquisition_id) {
                        const used = parseFloat(node.input_quantity) || 0;
                        acqUsageMap[node.acquisition_id] = (acqUsageMap[node.acquisition_id] || 0) + used;
                    }
                    if (node.children) calculateUsage(node.children);
                });
            };
            calculateUsage(batchesTree);

            // 2. Calcular WAC (Costo Promedio)
            const costTotals = {};
            const weightTotals = {};

            acquisitions.forEach(acq => {
                const key = acq.nombre_producto; 
                const totalCost = acq.original_price && acq.currency_id ? acq.precio_unitario : (acq.precio_unitario || 0);
                const weight = acq.peso_kg || 0;

                if (!costTotals[key]) { costTotals[key] = 0; weightTotals[key] = 0; }
                
                if (totalCost > 0 && weight > 0) {
                    costTotals[key] += totalCost;
                    weightTotals[key] += weight;
                }
            });

            state.wacByProduct = {};
            Object.keys(costTotals).forEach(key => {
                state.wacByProduct[key] = weightTotals[key] > 0 ? (costTotals[key] / weightTotals[key]) : 0;
            });

            // 3. Procesar Inventario Unificado
            const inventoryList = [];

            // A) Materia Prima (Acopios con Saldo)
            acquisitions.forEach(acq => {
                const used = acqUsageMap[acq.id] || 0;
                const remaining = Math.max(0, acq.peso_kg - used);
                
                if (remaining > 0.1) {
                    const wac = state.wacByProduct[acq.nombre_producto] || 0;
                    const realCost = (acq.precio_unitario && acq.peso_kg) ? (acq.precio_unitario / acq.peso_kg) : wac;
                    let statusLabel = used > 0 ? 'En Uso (Saldo)' : 'Materia Prima';

                    // Recuperar unidad original si existe
                    const origUnitId = acq.unit_id; // Si se guardó en DB
                    let displayUnit = 'KG';
                    if (origUnitId) {
                         const u = state.units.find(x => x.id === origUnitId);
                         if (u) displayUnit = u.code;
                    } else if (acq.data_adicional?.original_unit) {
                         displayUnit = acq.data_adicional.original_unit;
                    }

                    inventoryList.push({
                        id: acq.id,
                        product: `${acq.nombre_producto} - ${acq.tipo_acopio}`,
                        type: 'acopio',
                        status: statusLabel,
                        entryDate: new Date(acq.fecha_acopio),
                        weight: remaining,
                        unitCost: realCost,
                        totalValue: remaining * realCost,
                        location: acq.finca_origen || 'Bodega Acopio',
                        displayUnit: displayUnit || 'KG', // Unidad para mostrar
                        isBalance: used > 0
                    });
                }
            });

            // B) Lotes en Proceso/Terminado
            const processedIds = new Set();
            const flattenForCheck = (nodes) => {
                nodes.forEach(n => {
                    if(n.parent_id) processedIds.add(n.parent_id);
                    if(n.children) flattenForCheck(n.children);
                });
            };
            flattenForCheck(batchesTree);

            const flattenBatches = (nodes) => {
                let flat = [];
                nodes.forEach(node => {
                    const isLeaf = !processedIds.has(node.id);
                    
                    if (isLeaf) {
                        const data = typeof node.data === 'string' ? JSON.parse(node.data) : node.data;
                        
                        // --- LÓGICA DE PESO Y UNIDAD ---
                        let currentWeight = 0;
                        let currentUnitCost = 0;
                        let currentUnitCode = 'KG'; // Default
                        let productLabel = `Proceso: ${node.etapa_id}`;

                        // 1. Buscar en Outputs complejos (Prioridad Alta)
                        const outputValues = Object.values(data).filter(v => typeof v === 'object' && v.type === 'output');
                        
                        if (outputValues.length > 0) {
                            // Asumir que el mayor valor es el producto principal
                            const mainOutput = outputValues.reduce((prev, current) => (parseFloat(prev.value) > parseFloat(current.value)) ? prev : current);
                            currentWeight = parseFloat(mainOutput.value || 0);
                            
                            if (mainOutput.nombre) productLabel = mainOutput.nombre;
                            if (mainOutput.unit_cost) currentUnitCost = parseFloat(mainOutput.unit_cost);
                            
                            // Detectar unidad
                            if (mainOutput.unit_id) {
                                const u = state.units.find(x => x.id == mainOutput.unit_id);
                                if (u) currentUnitCode = u.code;
                            }
                        } else {
                            // 2. Fallback Legacy
                            // Buscar claves específicas para unidades
                            if (data.unidades && data.unidades.value) {
                                currentWeight = parseFloat(data.unidades.value);
                                currentUnitCode = 'Un'; // O 'Und'
                            } else {
                                const weightKeys = Object.keys(data).filter(k => k.toLowerCase().includes('peso') || k.toLowerCase().includes('salida') || k.toLowerCase().includes('cantidad'));
                                if (weightKeys.length > 0) {
                                    currentWeight = parseFloat(data[weightKeys[0]]?.value || 0);
                                    // Si el key es 'unidades', forzar unidad
                                    if(weightKeys[0].toLowerCase().includes('unidad')) currentUnitCode = 'Un';
                                }
                            }
                        }

                        // Inferir tipo producto para valorar
                        let productType = 'Cacao'; 
                        const estimatedWac = state.wacByProduct[productType] || 0;
                        const finalCost = currentUnitCost > 0 ? currentUnitCost : estimatedWac;
                        let type = node.is_locked ? 'terminado' : 'proceso';
                        
                        if (data.lugarProceso?.value) {
                             if(productLabel.startsWith('Proceso')) productLabel = `En ${data.lugarProceso.value}`;
                        }

                        if (currentWeight > 0) {
                            inventoryList.push({
                                id: node.id,
                                product: productLabel,
                                type: type,
                                status: node.is_locked ? 'Terminado' : 'En Proceso',
                                entryDate: new Date(node.created_at),
                                weight: currentWeight,
                                unitCost: finalCost, 
                                totalValue: currentWeight * finalCost, 
                                location: 'Planta Procesamiento',
                                displayUnit: currentUnitCode // Unidad detectada
                            });
                        }
                    }

                    if (node.children && node.children.length > 0) {
                        flat = flat.concat(flattenBatches(node.children));
                    }
                });
                return flat;
            };

            const flatBatches = flattenBatches(batchesTree);
            state.inventory = [...inventoryList, ...flatBatches];

            updateDashboard();

        } catch (e) {
            console.error("Error logic:", e);
            tableBody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-red-500">Error de cálculo. ${e.message}</td></tr>`;
        }
    }

    function updateDashboard() {
        const filtered = state.inventory.filter(item => {
            if (state.filter === 'all') return true;
            return item.type === state.filter;
        });

        const totalVal = state.inventory.reduce((sum, i) => sum + i.totalValue, 0);
        // Nota: Sumar pesos de diferentes unidades (Kg + Unidades) no tiene sentido físico global,
        // pero se mantiene para referencia visual aproximada de "volumen".
        const globalStock = state.inventory.reduce((sum, i) => sum + (i.displayUnit === 'KG' ? i.weight : 0), 0); // Solo sumamos KGs al KPI superior

        animateValue(kpiTotalValue, totalVal);
        kpiWac.textContent = `-`; // WAC global es difuso con unidades mixtas
        kpiTotalStock.textContent = `${globalStock.toLocaleString('es-PE', {maximumFractionDigits: 2})} kg`;

        renderTable(filtered);
    }

    function renderTable(items) {
        if (items.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="8" class="p-12 text-center text-slate-400 italic">No hay existencias en esta categoría.</td></tr>`;
            return;
        }

        tableBody.innerHTML = items.map(item => {
            const daysOld = Math.floor((new Date() - item.entryDate) / (1000 * 60 * 60 * 24));
            
            let badgeClass = 'bg-green-100 text-green-800 border-green-200';
            let icon = 'fa-clock';
            if (daysOld > 30) badgeClass = 'bg-amber-100 text-amber-800 border-amber-200';
            if (daysOld > 90) { badgeClass = 'bg-red-100 text-red-800 border-red-200'; icon = 'fa-triangle-exclamation'; }

            // Formateo visual inteligente según unidad
            let qtyDisplay = item.weight.toFixed(2);
            if (item.displayUnit === 'Un' || item.displayUnit === 'Und' || item.displayUnit === 'Botellas' || item.displayUnit === 'Barras') {
                qtyDisplay = Math.round(item.weight); // Sin decimales para unidades enteras
            }

            let displayWeight = `${qtyDisplay} <span class="text-xs font-normal text-slate-500">${item.displayUnit}</span>`;
            if (item.isBalance) displayWeight = `<span class="text-xs text-amber-600 font-bold mr-1">(Saldo)</span> ${displayWeight}`;

            return `
                <tr class="hover:bg-slate-50 transition border-b border-slate-50 group">
                    <td class="p-4">
                        <span class="font-mono text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">${item.id}</span>
                    </td>
                    <td class="p-4">
                        <div class="font-bold text-slate-800">${item.product}</div>
                        <div class="text-xs text-slate-400 flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> ${item.location}</div>
                    </td>
                    <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${getStatusColor(item.type)}">
                            ${item.status}
                        </span>
                    </td>
                    <td class="p-4 text-right">
                        <div class="font-bold text-slate-700">${displayWeight}</div>
                    </td>
                    <td class="p-4 text-right text-slate-500 text-xs font-mono">
                        ${item.unitCost > 0 ? formatCurrency(item.unitCost) : '-'}
                    </td>
                    <td class="p-4 text-right font-bold text-emerald-700">
                        ${item.totalValue > 0 ? formatCurrency(item.totalValue) : '-'}
                    </td>
                    <td class="p-4 text-center">
                        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border ${badgeClass} text-xs font-bold shadow-sm">
                            <i class="fas ${icon}"></i> ${daysOld} días
                        </div>
                    </td>
                    <td class="p-4 text-center">
                        <a href="/app/procesamiento#${item.type === 'acopio' ? 'acopio=' : ''}${item.id}" class="text-slate-400 hover:text-blue-600 transition p-2 rounded-full hover:bg-blue-50" title="Ver en Procesamiento">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function getStatusColor(type) {
        if (type === 'acopio') return 'bg-blue-50 text-blue-700 border border-blue-100';
        if (type === 'proceso') return 'bg-amber-50 text-amber-700 border border-amber-100';
        if (type === 'terminado') return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
        return 'bg-slate-100 text-slate-600';
    }

    function formatCurrency(val) {
        return new Intl.NumberFormat('es-PE', { style: 'currency', currency: state.currency }).format(val);
    }

    function animateValue(obj, end) {
        const start = 0;
        const duration = 1000;
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            const val = progress * (end - start) + start;
            obj.innerHTML = formatCurrency(val);
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }

    function setupListeners() {
        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                tabs.forEach(t => {
                    t.classList.remove('bg-slate-800', 'text-white', 'active');
                    t.classList.add('text-slate-600', 'hover:bg-white');
                });
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

    async function api(url) {
        const res = await fetch(url);
        if (!res.ok) throw new Error('API Error');
        return res.json();
    }
});