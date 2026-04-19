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

            populateTemplateFilter();
            populateBatchFilter();
            
            templateFilter.addEventListener('change', handleFilterChange);
            batchFilter.addEventListener('change', handleFilterChange);
            
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
            const firstStage = state.fullData.stages[b.plantilla_id]?.[0];
            const inputField = firstStage?.campos_json.entradas[0]?.name;
            return acc + (parseFloat(b.data[inputField]) || 0);
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
        let optionsHtml = '<option value="all">Todos los Procesos</option>';
        optionsHtml += state.fullData.templates.map(t => `<option value="${t.id}">${t.nombre_producto}</option>`).join('');
        templateFilter.innerHTML = optionsHtml;
    }

    function populateBatchFilter(templateId = 'all') {
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
        const sortedStages = Object.entries(stageYields).sort(([, a], [, b]) => a.order - b.order);
        if (charts.rendimiento) charts.rendimiento.destroy();
        charts.rendimiento = new Chart(document.getElementById('rendimiento-chart'), {
            type: 'bar',
            data: {
                labels: sortedStages.map(([label]) => label),
                datasets: [{ label: 'Rendimiento (%)', data: sortedStages.map(([, values]) => values.total / values.count), backgroundColor: '#d97706', borderRadius: 8 }]
            },
            options: { scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
    }

    function renderProduccionChart(fincaProduction) {
        if (charts.produccion) charts.produccion.destroy();
        charts.produccion = new Chart(document.getElementById('produccion-chart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(fincaProduction),
                datasets: [{ data: Object.values(fincaProduction), backgroundColor: ['#78350f', '#a16207', '#ca8a04', '#f59e0b', '#fcd34d'] }]
            },
            options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } }, maintainAspectRatio: false }
        });
    }

    function renderCostoPorEtapaChart(costByStage) {
        const sortedStages = Object.entries(costByStage).sort(([, a], [, b]) => a.order - b.order);
        if (charts.costoEtapa) charts.costoEtapa.destroy();
        charts.costoEtapa = new Chart(document.getElementById('costo-etapa-chart'), {
            type: 'bar',
            data: {
                labels: sortedStages.map(([label]) => label),
                datasets: [{ label: 'Costo ($/kg)', data: sortedStages.map(([, values]) => values.totalCostPerKg / values.count), backgroundColor: '#059669', borderRadius: 8 }]
            },
            options: { indexAxis: 'y', scales: { x: { beginAtZero: true } }, plugins: { legend: { display: false } }, maintainAspectRatio: false }
        });
    }

    init();
});
