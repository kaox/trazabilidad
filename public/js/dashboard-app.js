document.addEventListener('DOMContentLoaded', () => {
    let state = {
        fullData: null // Almacenará todos los datos del dashboard
    };
    let charts = {};

    const kpiContainer = document.getElementById('kpi-container');
    const templateFilter = document.getElementById('template-filter');
    const batchFilter = document.getElementById('batch-filter');

    async function init() {
        try {
            state.fullData = await api('/api/dashboard/data');

            if (templateFilter) populateTemplateFilter();
            if (batchFilter) populateBatchFilter();
            
            if (templateFilter) templateFilter.addEventListener('change', handleFilterChange);
            if (batchFilter) batchFilter.addEventListener('change', handleFilterChange);
            
            // Render basic impact sections
            renderHeroStats();
            renderImpactCards();
            updateStepper();
            setupStepperInteractivity();

            // Render analytical charts
            processAndRenderDashboard(state.fullData.batchTrees);
        } catch (error) {
            console.error("Error al cargar datos para el dashboard:", error);
            if (kpiContainer) kpiContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">${error.message}</p>`;
        }
    }

    function renderHeroStats() {
        const container = document.getElementById('quick-stats-summary');
        if (!container) return;

        const activeBatches = state.fullData.batchTrees.filter(b => !b.blockchain_hash).length;
        const totalKg = state.fullData.batchTrees.reduce((acc, b) => {
            const firstStage = state.fullData.stages?.[b.plantilla_id]?.[0];
            const inputField = firstStage?.campos_json?.entradas?.[0]?.name;
            return acc + (inputField ? (parseFloat(b.data[inputField]) || 0) : 0);
        }, 0);

        const stats = [
            { label: 'Lotes Proyectados', value: state.fullData.batchTrees.length, icon: 'fa-layer-group' },
            { label: 'Kg Acopiados', value: `${totalKg.toLocaleString()} kg`, icon: 'fa-weight-hanging' },
            { label: 'Fincas Activas', value: state.fullData.fincas.length, icon: 'fa-map-location-dot' }
        ];

        container.innerHTML = stats.map(s => `
            <div class="bg-white/50 backdrop-blur-sm px-6 py-3 rounded-2xl flex items-center gap-3 border border-amber-200/50">
                <i class="fas ${s.icon} text-amber-700"></i>
                <div>
                    <p class="text-[10px] uppercase font-bold text-stone-500 tracking-wider">${s.label}</p>
                    <p class="text-lg font-bold text-amber-900">${s.value}</p>
                </div>
            </div>
        `).join('');
    }

    function renderImpactCards() {
        // 1. Identidad Digital
        const idStatus = document.getElementById('identity-status');
        if (idStatus) {
            const profile = state.fullData.userProfile;
            const isPublished = profile?.is_published;
            idStatus.innerHTML = `
                <div class="flex items-center gap-2 mb-2">
                    <span class="h-2 w-2 rounded-full ${isPublished ? 'bg-green-500 animate-pulse' : 'bg-red-500'}"></span>
                    <span class="text-xs font-bold ${isPublished ? 'text-green-700' : 'text-red-700'}">${isPublished ? 'Landing Pública' : 'Landing en Borrador'}</span>
                </div>
                <p class="text-xs text-stone-500">Subdominio: <span class="font-mono text-stone-800">${profile?.subdomain || 'no-asignado'}.rurulab.com</span></p>
            `;
        }

        // 2. Motor de Trazabilidad
        const traceStatus = document.getElementById('traceability-status');
        if (traceStatus) {
            const totalBatches = state.fullData.batchTrees.length;
            const finalized = state.fullData.batchTrees.filter(b => b.blockchain_hash).length;
            traceStatus.innerHTML = `
                <div class="flex flex-col gap-1">
                    <div class="flex justify-between text-xs font-bold mb-1">
                        <span class="text-stone-500">Progreso General</span>
                        <span class="text-emerald-700">${finalized}/${totalBatches} Finalizados</span>
                    </div>
                    <div class="w-full bg-emerald-100 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-emerald-600 h-full transition-all duration-1000" style="width: ${totalBatches > 0 ? (finalized / totalBatches) * 100 : 0}%"></div>
                    </div>
                </div>
            `;
        }

        // 3. Calidad
        const qualityStatus = document.getElementById('quality-status');
        if (qualityStatus) {
            const productsWithProfile = state.fullData.productos.filter(p => p.nota_taza).length;
            qualityStatus.innerHTML = `
                <div class="flex items-baseline gap-2">
                    <span class="text-3xl font-black text-purple-900">${productsWithProfile}</span>
                    <span class="text-xs font-bold text-stone-500 uppercase">Perfiles de Sabor</span>
                </div>
                <p class="text-xs text-stone-400 mt-1 italic">Vincúlalos en tu Catálogo Público</p>
            `;
        }
    }

    function updateStepper() {
        const hasFincas = state.fullData.fincas.length > 0;
        const hasAcopios = state.fullData.acquisitions.length > 0;
        const hasBatches = state.fullData.batchTrees.length > 0;
        const hasQuality = state.fullData.productos.some(p => p.nota_taza);
        const hasMarket = state.fullData.productos.length > 0;

        if (hasAcopios) document.getElementById('step-acopio')?.classList.add('active');
        if (hasBatches) document.getElementById('step-procesamiento')?.classList.add('active');
        if (hasQuality) document.getElementById('step-calidad')?.classList.add('active');
        if (hasMarket) document.getElementById('step-mercado')?.classList.add('active');
    }

    function setupStepperInteractivity() {
        document.querySelectorAll('.stepper-item').forEach(item => {
            item.style.cursor = 'pointer';
            item.addEventListener('click', () => {
                const href = item.getAttribute('data-href');
                if (href) location.href = href;
            });
        });
    }

    // --- RE-INTEGRATED CALCULATION LOGIC ---

    function populateTemplateFilter() {
        if (!templateFilter) return;
        let optionsHtml = '<option value="all">Todos los Procesos</option>';
        optionsHtml += state.fullData.templates.map(t => `<option value="${t.id}">${t.nombre_producto}</option>`).join('');
        templateFilter.innerHTML = optionsHtml;
    }

    function populateBatchFilter(templateId = 'all') {
        if (!batchFilter) return;
        let batchesToShow = state.fullData.batchTrees;
        if (templateId !== 'all') {
            batchesToShow = state.fullData.batchTrees.filter(b => b.plantilla_id == templateId);
        }

        let optionsHtml = '<option value="all">Todos los Lotes</option>';
        optionsHtml += batchesToShow.map(batch => {
            const date = batch.data.fecha?.value || batch.data.fechaCosecha?.value || 'N/A';
            return `<option value="${batch.id}">${batch.id} [${date}]</option>`;
        }).join('');
        batchFilter.innerHTML = optionsHtml;
    }
    
    function handleFilterChange() {
        const selectedTemplateId = templateFilter.value;
        const selectedBatchId = batchFilter.value;

        if (event.target.id === 'template-filter') {
            populateBatchFilter(selectedTemplateId);
            processBasedOnFilters(selectedTemplateId, 'all');
            return;
        }
        processBasedOnFilters(selectedTemplateId, selectedBatchId);
    }

    function processBasedOnFilters(templateId, batchId) {
        let filteredBatches = state.fullData.batchTrees;
        if (templateId !== 'all') filteredBatches = filteredBatches.filter(b => b.plantilla_id == templateId);
        if (batchId !== 'all') filteredBatches = filteredBatches.filter(b => b.id === batchId);
        processAndRenderDashboard(filteredBatches);
    }

    function processAndRenderDashboard(filteredBatches) {
        const { stageYields, totalYields } = calculateStageYields(filteredBatches);
        const fincaProduction = calculateFincaProduction(filteredBatches);
        const { costKPIs, costByStage } = calculateCostMetrics(filteredBatches);

        renderKPIs(filteredBatches, totalYields, costKPIs);
        renderRendimientoChart(stageYields);
        renderProduccionChart(fincaProduction);
        renderCostoPorEtapaChart(costByStage);
    }
    
    function calculateStageYields(batches) {
        const stageYields = {};
        const totalYields = [];
        const getFieldValue = (data, fieldName) => {
            if (!data || !fieldName) return null;
            const field = data[fieldName];
            return (typeof field === 'object' && field !== null) ? parseFloat(field.value) : parseFloat(field);
        };

        function traverse(batchData, template, stage, parentBatch = null) {
            let inputWeight = 0, outputWeight = 0;
            const entradas = stage.campos_json.entradas || [], salidas = stage.campos_json.salidas || [];

            if (salidas.length > 0 && salidas[0].name) outputWeight = getFieldValue(batchData.data, salidas[0].name) || 0;
            const inputField = entradas[0]?.name;
            if (inputField && batchData.data[inputField]) {
                inputWeight = getFieldValue(batchData.data, inputField) || 0;
            } else if (parentBatch) {
                const parentStage = state.fullData.stages[template.id]?.find(s => s.orden === stage.orden - 1);
                if (parentStage?.campos_json.salidas[0]) {
                    const outputFieldOfParent = parentStage.campos_json.salidas[0].name;
                    inputWeight = getFieldValue(parentBatch.data, outputFieldOfParent) || 0;
                }
            }

            if (inputWeight > 0 && outputWeight > 0) {
                const yieldPercent = (outputWeight / inputWeight) * 100;
                if (!stageYields[stage.nombre_etapa]) stageYields[stage.nombre_etapa] = { total: 0, count: 0, order: stage.orden };
                stageYields[stage.nombre_etapa].total += yieldPercent;
                stageYields[stage.nombre_etapa].count++;
                if (!parentBatch) totalYields.push(yieldPercent);
            }

            if (batchData.children && batchData.children.length > 0) {
                const nextStage = state.fullData.stages[template.id]?.find(s => s.orden === stage.orden + 1);
                if (nextStage) batchData.children.forEach(child => traverse(child, template, nextStage, batchData));
            }
        }

        batches.forEach(rootBatch => {
            const template = state.fullData.templates.find(t => t.id === rootBatch.plantilla_id);
            if (template && state.fullData.stages[template.id]?.length > 0) traverse(rootBatch, template, state.fullData.stages[template.id][0]);
        });
        return { stageYields, totalYields };
    }

    function calculateFincaProduction(batches) {
        const productionByFinca = {};
        const getFieldValue = (data, fieldName) => {
            if (!data || !fieldName) return null;
            const field = data[fieldName];
            return (typeof field === 'object' && field !== null) ? field.value : field;
        };

        batches.forEach(rootBatch => {
            const finca = getFieldValue(rootBatch.data, 'finca');
            if (finca) {
                const template = state.fullData.templates.find(t => t.id === rootBatch.plantilla_id);
                if (template && state.fullData.stages[template.id]?.length > 0) {
                    const firstStage = state.fullData.stages[template.id][0];
                    const inputField = firstStage.campos_json.entradas[0]?.name;
                    if (inputField) {
                        const weight = parseFloat(getFieldValue(rootBatch.data, inputField)) || 0;
                        productionByFinca[finca] = (productionByFinca[finca] || 0) + weight;
                    }
                }
            }
        });
        return productionByFinca;
    }

    function calculateCostMetrics(batches) {
        const costData = state.fullData.costs;
        let totalInvertido = 0, totalFinalKg = 0;
        const costByStage = {};

        const getFieldValue = (data, fieldName) => {
            if (!data || !fieldName) return null;
            const field = data[fieldName];
            return (typeof field === 'object' && field !== null) ? parseFloat(field.value) : parseFloat(field);
        };

        const calculateTreeCosts = (batchNode, parentCostInfo = null) => {
            const loteCosts = costData.find(c => c.lote_id === batchNode.id)?.cost_data || {};
            const stageCosts = loteCosts[batchNode.id] || {};
            const stage = state.fullData.stages[batchNode.plantilla_id]?.find(s => s.id === batchNode.etapa_id);
            if (!stage) return { accumulatedCost: 0, costPerKg: 0, outputWeight: 0 };
            
            const processCosts = (stageCosts.costoAdquisicion || 0) + (stageCosts.costoManoDeObra || 0) + (stageCosts.costoInsumos || 0) + (stageCosts.costoOperativos || 0);
            let inheritedCost = 0;
            const inputField = stage.campos_json?.entradas?.[0]?.name, outputField = stage.campos_json?.salidas?.[0]?.name;
            const inputWeight = getFieldValue(batchNode.data, inputField) || (parentCostInfo?.outputWeight || 0);
            const outputWeight = getFieldValue(batchNode.data, outputField) || 0;
            
            if (parentCostInfo && inputWeight > 0) inheritedCost = parentCostInfo.costPerKg * inputWeight;
            const accumulatedCost = inheritedCost + processCosts, costPerKg = outputWeight > 0 ? accumulatedCost / outputWeight : 0;
            const currentCostInfo = { accumulatedCost, costPerKg, outputWeight };

            if (!costByStage[stage.nombre_etapa]) costByStage[stage.nombre_etapa] = { totalCostPerKg: 0, count: 0, order: stage.orden };
            costByStage[stage.nombre_etapa].totalCostPerKg += costPerKg;
            costByStage[stage.nombre_etapa].count++;

            if (batchNode.children && batchNode.children.length > 0) {
                batchNode.children.forEach(child => calculateTreeCosts(child, currentCostInfo));
            } else {
                totalInvertido += accumulatedCost;
                totalFinalKg += outputWeight;
            }
        };

        batches.forEach(tree => calculateTreeCosts(tree));
        return { 
            costKPIs: { costoTotalInvertido: totalInvertido, costoPromedioPorLote: batches.length > 0 ? totalInvertido / batches.length : 0, costoPromedioFinalKg: totalFinalKg > 0 ? totalInvertido / totalFinalKg : 0 }, 
            costByStage 
        };
    }

    function renderKPIs(filteredBatches, totalYields, costKPIs) {
        if (!kpiContainer) return;
        const avgYield = totalYields.length > 0 ? totalYields.reduce((a, b) => a + b, 0) / totalYields.length : 0;
        const kpis = [
            { label: 'Costo Total Invertido', value: `$${costKPIs.costoTotalInvertido.toFixed(2)}`, icon: 'fa-dollar-sign', color: 'text-teal-700 bg-teal-100' },
            { label: 'Costo Promedio / Lote', value: `$${costKPIs.costoPromedioPorLote.toFixed(2)}`, icon: 'fa-box', color: 'text-teal-700 bg-teal-100' },
            { label: 'Costo Final / Kg', value: `$${costKPIs.costoPromedioFinalKg.toFixed(2)}`, icon: 'fa-weight-hanging', color: 'text-teal-700 bg-teal-100' },
            { label: 'Rendimiento Promedio', value: `${avgYield.toFixed(1)}%`, icon: 'fa-chart-line', color: 'text-green-700 bg-green-100' },
        ];

        kpiContainer.innerHTML = kpis.map(kpi => `
            <div class="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4">
                <div class="flex-shrink-0 h-12 w-12 rounded-xl flex items-center justify-center ${kpi.color}"><i class="fas ${kpi.icon}"></i></div>
                <div>
                    <p class="text-[10px] uppercase font-bold text-stone-400 tracking-wider">${kpi.label}</p>
                    <p class="text-xl font-bold text-stone-800">${kpi.value}</p>
                </div>
            </div>
        `).join('');
    }
    
    function renderRendimientoChart(stageYields) {
        const canvas = document.getElementById('rendimiento-chart');
        if (!canvas) return;
        const sortedStages = Object.entries(stageYields).sort(([, a], [, b]) => a.order - b.order);
        if (charts.rendimiento) charts.rendimiento.destroy();
        charts.rendimiento = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sortedStages.map(([label]) => label),
                datasets: [{ label: 'Rendimiento (%)', data: sortedStages.map(([, values]) => values.total / values.count), backgroundColor: '#d97706', borderRadius: 8 }]
            },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
    }

    // Comprobación de existencia de gráficos
    function renderProduccionChart(fincaProduction) {
        const canvas = document.getElementById('produccion-chart');
        if (!canvas) return;
        if (charts.produccion) charts.produccion.destroy();
        charts.produccion = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(fincaProduction),
                datasets: [{ data: Object.values(fincaProduction), backgroundColor: ['#78350f', '#a16207', '#ca8a04', '#f59e0b', '#fcd34d'] }]
            },
            options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, maintainAspectRatio: false }
        });
    }

    function renderCostoPorEtapaChart(costByStage) {
        const canvas = document.getElementById('costo-etapa-chart');
        if (!canvas) return;
        const sortedStages = Object.entries(costByStage).sort(([, a], [, b]) => a.order - b.order);
        if (charts.costoEtapa) charts.costoEtapa.destroy();
        charts.costoEtapa = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: sortedStages.map(([label]) => label),
                datasets: [{ label: 'Costo ($/kg)', data: sortedStages.map(([, values]) => values.totalCostPerKg / values.count), backgroundColor: '#059669', borderRadius: 8 }]
            },
            options: { indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
    }

    // --- SECCIÓN ANALYTICS Y EVENTOS ---
    const analyticsDaysFilter = document.getElementById('analytics-days-filter');

    async function loadAnalytics() {
        const days = analyticsDaysFilter ? analyticsDaysFilter.value : 30;
        try {
            const data = await api(`/api/dashboard/analytics?days=${days}`);
            renderAnalytics(data);
        } catch (error) {
            console.error("Error al cargar analíticas:", error);
        }
    }

    function renderAnalytics(data) {
        // KPIs
        const kpi = data.kpis || {};
        document.getElementById('analytics-landing-views').textContent = kpi.landing_views || 0;
        document.getElementById('analytics-trace-views').textContent = kpi.trace_views || 0;
        document.getElementById('analytics-buy-clicks').textContent = kpi.buy_clicks || 0;
        document.getElementById('analytics-active-days').textContent = kpi.active_days || 0;

        // Gráfico de Líneas (Serie Temporal)
        const ctx = document.getElementById('analytics-time-chart');
        if (ctx) {
            const timeSeries = data.timeSeries || [];
            const labels = timeSeries.map(t => {
                const parts = t.day.split('-');
                return parts.length === 3 ? `${parts[2]}/${parts[1]}` : t.day;
            });
            const landingViewsData = timeSeries.map(t => t.landing_views);
            const traceViewsData = timeSeries.map(t => t.trace_views);
            const buyClicksData = timeSeries.map(t => t.buy_clicks);

            if (charts.analyticsTime) charts.analyticsTime.destroy();
            charts.analyticsTime = new Chart(ctx, {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        { label: 'Visitas Landing', data: landingViewsData, borderColor: '#3b82f6', backgroundColor: '#3b82f622', fill: true, tension: 0.3 },
                        { label: 'Vistas Trazabilidad', data: traceViewsData, borderColor: '#10b981', backgroundColor: '#10b98122', fill: true, tension: 0.3 },
                        { label: 'Clics Compra', data: buyClicksData, borderColor: '#f59e0b', backgroundColor: '#f59e0b22', fill: true, tension: 0.3 }
                    ]
                },
                options: {
                    maintainAspectRatio: false,
                    scales: {
                        y: { beginAtZero: true, ticks: { stepSize: 1 } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { boxWidth: 12 } }
                    }
                }
            });
        }

        // Fuentes de Tráfico (Referrers)
        const referrersList = document.getElementById('analytics-referrers-list');
        if (referrersList) {
            const referrers = data.topReferrers || [];
            if (referrers.length === 0) {
                referrersList.innerHTML = `<p class="text-stone-400 text-sm text-center py-8">No hay datos de tráfico aún.</p>`;
            } else {
                const totalRef = referrers.reduce((acc, r) => acc + r.count, 0);
                referrersList.innerHTML = referrers.map(r => {
                    const percentage = totalRef > 0 ? Math.round((r.count / totalRef) * 100) : 0;
                    return `
                        <div class="space-y-1.5">
                            <div class="flex justify-between text-xs font-bold text-stone-700">
                                <span class="truncate pr-2">${r.source}</span>
                                <span>${r.count} (${percentage}%)</span>
                            </div>
                            <div class="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-blue-600 h-full rounded-full" style="width: ${percentage}%"></div>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Tabla de Eventos Recientes
        const tableBody = document.getElementById('analytics-events-table-body');
        if (tableBody) {
            const events = data.recentEvents || [];
            if (events.length === 0) {
                tableBody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-stone-400">No se registran eventos.</td></tr>`;
            } else {
                const eventLabels = {
                    'landing_view': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">Visita Landing</span>',
                    'trace_view': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">Vista Trazabilidad</span>',
                    'buy_click': '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Clic de Compra</span>'
                };
                tableBody.innerHTML = events.map(e => {
                    const label = eventLabels[e.event_type] || `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-stone-100 text-stone-700">${e.event_type}</span>`;
                    const meta = e.meta_data || {};
                    let detail = 'Detalle de evento';
                    if (e.event_type === 'landing_view') {
                        detail = meta.referrer ? `Referido desde: <span class="text-stone-400 font-mono text-xs break-all">${meta.referrer}</span>` : 'Acceso Directo';
                    } else if (e.event_type === 'trace_view') {
                        detail = `Ficha de Trazabilidad`;
                    } else if (e.event_type === 'buy_click') {
                        detail = `Clic en botón de WhatsApp / Compra`;
                    }
                    const dateStr = new Date(e.created_at).toLocaleString();
                    return `
                        <tr class="border-b border-stone-50 hover:bg-stone-50/50">
                            <td class="py-3.5 pr-2">${label}</td>
                            <td class="py-3.5 pr-2">
                                <div class="text-xs max-w-xs md:max-w-md truncate font-semibold text-stone-800">${detail}</div>
                            </td>
                            <td class="py-3.5 text-right text-stone-400 text-xs">${dateStr}</td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // Tabla de Métricas por Producto
        const productsTableBody = document.getElementById('analytics-products-table-body');
        if (productsTableBody) {
            const productStats = data.productStats || [];
            if (productStats.length === 0) {
                productsTableBody.innerHTML = `<tr><td colspan="3" class="py-8 text-center text-stone-400">No se registran productos.</td></tr>`;
            } else {
                productsTableBody.innerHTML = productStats.map(p => {
                    return `
                        <tr class="border-b border-stone-50 hover:bg-stone-50/50">
                            <td class="py-3.5 font-bold text-stone-800 truncate max-w-[150px]">${p.product_name || 'Desconocido'}</td>
                            <td class="py-3.5 text-center text-stone-600 font-semibold">${p.trace_views || 0}</td>
                            <td class="py-3.5 text-center text-stone-600 font-semibold">${p.buy_clicks || 0}</td>
                        </tr>
                    `;
                }).join('');
            }
        }
    }

    if (analyticsDaysFilter) {
        analyticsDaysFilter.addEventListener('change', loadAnalytics);
    }

    // Registrar carga de analíticas en init
    const originalInit = init;
    init = async function() {
        await originalInit();
        await loadAnalytics();
    };

    init();
});
