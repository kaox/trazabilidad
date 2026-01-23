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
            
            processAndRenderDashboard(state.fullData.batchTrees);
        } catch (error) {
            console.error("Error al cargar datos para el dashboard:", error);
            kpiContainer.innerHTML = `<p class="text-red-500 col-span-full text-center">${error.message}</p>`;
        }
    }
    
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

        // Si cambia el filtro de plantilla, se resetea el de lote
        if (event.target.id === 'template-filter') {
            populateBatchFilter(selectedTemplateId);
             // After repopulating, the batch filter is reset to 'all', so we should process based on that
            processBasedOnFilters(selectedTemplateId, 'all');
            return;
        }
        
        processBasedOnFilters(selectedTemplateId, selectedBatchId);
    }

    function processBasedOnFilters(templateId, batchId) {
        let filteredBatches = state.fullData.batchTrees;

        if (templateId !== 'all') {
            filteredBatches = filteredBatches.filter(b => b.plantilla_id == templateId);
        }
        if (batchId !== 'all') {
            filteredBatches = filteredBatches.filter(b => b.id === batchId);
        }
        
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
            let inputWeight = 0;
            let outputWeight = 0;
            const entradas = stage.campos_json.entradas || [];
            const salidas = stage.campos_json.salidas || [];

            if (salidas.length > 0 && salidas[0].name) {
                outputWeight = getFieldValue(batchData.data, salidas[0].name) || 0;
            }

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
                if (!stageYields[stage.nombre_etapa]) {
                    stageYields[stage.nombre_etapa] = { total: 0, count: 0, order: stage.orden };
                }
                stageYields[stage.nombre_etapa].total += yieldPercent;
                stageYields[stage.nombre_etapa].count++;
                if (!parentBatch) { // Only count total yield for root processes
                    totalYields.push(yieldPercent);
                }
            }

            if (batchData.children && batchData.children.length > 0) {
                const nextStage = state.fullData.stages[template.id]?.find(s => s.orden === stage.orden + 1);
                if (nextStage) {
                    batchData.children.forEach(child => traverse(child, template, nextStage, batchData));
                }
            }
        }

        batches.forEach(rootBatch => {
            const template = state.fullData.templates.find(t => t.id === rootBatch.plantilla_id);
            if (template && state.fullData.stages[template.id]?.length > 0) {
                const firstStage = state.fullData.stages[template.id][0];
                traverse(rootBatch, template, firstStage);
            }
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
                        if (!productionByFinca[finca]) {
                            productionByFinca[finca] = 0;
                        }
                        productionByFinca[finca] += weight;
                    }
                }
            }
        });
        return productionByFinca;
    }

    function calculateCostMetrics(batches) {
        const costData = state.fullData.costs;
        let totalInvertido = 0;
        let totalFinalKg = 0;
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
            const inputField = stage.campos_json?.entradas?.[0]?.name;
            const outputField = stage.campos_json?.salidas?.[0]?.name;
            const inputWeight = getFieldValue(batchNode.data, inputField) || (parentCostInfo?.outputWeight || 0);
            const outputWeight = getFieldValue(batchNode.data, outputField) || 0;
            
            if (parentCostInfo && inputWeight > 0) {
                inheritedCost = parentCostInfo.costPerKg * inputWeight;
            }
            
            const accumulatedCost = inheritedCost + processCosts;
            const costPerKg = outputWeight > 0 ? accumulatedCost / outputWeight : 0;
            
            const currentCostInfo = { accumulatedCost, costPerKg, outputWeight };

            if (!costByStage[stage.nombre_etapa]) {
                costByStage[stage.nombre_etapa] = { totalCostPerKg: 0, count: 0, order: stage.orden };
            }
            costByStage[stage.nombre_etapa].totalCostPerKg += costPerKg;
            costByStage[stage.nombre_etapa].count++;

            if (batchNode.children && batchNode.children.length > 0) {
                batchNode.children.forEach(child => calculateTreeCosts(child, currentCostInfo));
            } else { // Es una hoja final del árbol
                totalInvertido += accumulatedCost;
                totalFinalKg += outputWeight;
            }
        };

        batches.forEach(tree => calculateTreeCosts(tree));
        
        const costKPIs = {
            costoTotalInvertido: totalInvertido,
            costoPromedioPorLote: batches.length > 0 ? totalInvertido / batches.length : 0,
            costoPromedioFinalKg: totalFinalKg > 0 ? totalInvertido / totalFinalKg : 0
        };
        
        return { costKPIs, costByStage };
    }

    function renderKPIs(filteredBatches, totalYields, costKPIs) {
        const avgYield = totalYields.length > 0 ? totalYields.reduce((a, b) => a + b, 0) / totalYields.length : 0;
        const { fincas, procesadoras } = state.fullData;
        
        const kpis = [
            { label: 'Costo Total Invertido', value: `$${costKPIs.costoTotalInvertido.toFixed(2)}`, icon: `<i class="fas fa-dollar-sign text-2xl"></i>`, color: 'text-teal-700 bg-teal-100' },
            { label: 'Costo Promedio / Lote', value: `$${costKPIs.costoPromedioPorLote.toFixed(2)}`, icon: `<i class="fas fa-box text-2xl"></i>`, color: 'text-teal-700 bg-teal-100' },
            { label: 'Costo Final / Kg', value: `$${costKPIs.costoPromedioFinalKg.toFixed(2)}`, icon: `<i class="fas fa-weight-hanging text-2xl"></i>`, color: 'text-teal-700 bg-teal-100' },
            { label: 'Rendimiento Promedio', value: `${avgYield.toFixed(1)}%`, icon: `<i class="fas fa-chart-line text-2xl"></i>`, color: 'text-green-700 bg-green-100' },
        ];

        kpiContainer.innerHTML = kpis.map(kpi => `
            <div class="bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4">
                <div class="flex-shrink-0 h-16 w-16 rounded-full flex items-center justify-center ${kpi.color}">${kpi.icon}</div>
                <div>
                    <p class="text-sm text-stone-500">${kpi.label}</p>
                    <p class="text-2xl font-bold text-stone-800">${kpi.value}</p>
                </div>
            </div>
        `).join('');
    }
    
    function renderRendimientoChart(stageYields) {
        const sortedStages = Object.entries(stageYields).sort(([, a], [, b]) => a.order - b.order);
        const labels = sortedStages.map(([label]) => label);
        const data = sortedStages.map(([, values]) => values.total / values.count);
        
        if (charts.rendimiento) charts.rendimiento.destroy();

        charts.rendimiento = new Chart(document.getElementById('rendimiento-chart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Rendimiento Promedio (%)',
                    data,
                    backgroundColor: 'rgba(120, 53, 15, 0.7)',
                    borderColor: 'rgb(120, 53, 15)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: { y: { beginAtZero: true, max: 100 } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderProduccionChart(fincaProduction) {
        const labels = Object.keys(fincaProduction);
        const data = Object.values(fincaProduction);
        
        if (charts.produccion) charts.produccion.destroy();

        charts.produccion = new Chart(document.getElementById('produccion-chart'), {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    label: 'Producción Inicial (kg)',
                    data,
                    backgroundColor: ['#78350f', '#a16207', '#ca8a04', '#f59e0b', '#fcd34d'],
                    hoverOffset: 4
                }]
            },
            options: {
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function renderCostoPorEtapaChart(costByStage) {
        const sortedStages = Object.entries(costByStage).sort(([, a], [, b]) => a.order - b.order);
        const labels = sortedStages.map(([label]) => label);
        const data = sortedStages.map(([, values]) => values.totalCostPerKg / values.count);
        
        if (charts.costoEtapa) charts.costoEtapa.destroy();

        charts.costoEtapa = new Chart(document.getElementById('costo-etapa-chart'), {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Costo Promedio ($/kg)',
                    data,
                    backgroundColor: 'rgba(20, 83, 45, 0.7)',
                    borderColor: 'rgb(20, 83, 45)',
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                scales: { x: { beginAtZero: true } },
                plugins: { legend: { display: false } }
            }
        });
    }

    init();
});

