document.addEventListener('DOMContentLoaded', () => {
    let state = {
        batches: [],
        templates: [],
        stagesByTemplate: {},
        fincas: [],
        procesadoras: []
    };
    let charts = {};

    const kpiContainer = document.getElementById('kpi-container');
    const templateFilter = document.getElementById('template-filter');

    async function init() {
        try {
            [state.batches, state.templates, state.fincas, state.procesadoras] = await Promise.all([
                api('/api/batches/tree'),
                api('/api/templates'),
                api('/api/fincas'),
                api('/api/procesadoras')
            ]);

            for (const t of state.templates) {
                state.stagesByTemplate[t.id] = await api(`/api/templates/${t.id}/stages`);
            }

            populateFilter();
            templateFilter.addEventListener('change', handleFilterChange);
            processAndRenderDashboard(state.batches); // Render inicial con todos los datos
        } catch (error) {
            console.error("Error al cargar datos para el dashboard:", error);
            kpiContainer.innerHTML = `<p class="text-red-600 col-span-full">Error al cargar los datos del dashboard.</p>`;
        }
    }
    
    function populateFilter() {
        let optionsHtml = '<option value="all">Todos los Procesos</option>';
        optionsHtml += state.templates.map(t => `<option value="${t.id}">${t.nombre_producto}</option>`).join('');
        templateFilter.innerHTML = optionsHtml;
    }

    function handleFilterChange() {
        const selectedTemplateId = templateFilter.value;
        if (selectedTemplateId === 'all') {
            processAndRenderDashboard(state.batches);
        } else {
            const filteredBatches = state.batches.filter(b => b.plantilla_id == selectedTemplateId);
            processAndRenderDashboard(filteredBatches);
        }
    }

    function processAndRenderDashboard(filteredBatches) {
        const { stageYields, totalYields } = calculateStageYields(filteredBatches);
        const fincaProduction = calculateFincaProduction(filteredBatches);

        renderKPIs(filteredBatches, totalYields);
        renderRendimientoChart(stageYields);
        renderProduccionChart(fincaProduction);
    }

    function calculateStageYields(batches) {
        const stageYields = {};
        const totalYields = [];

        function traverse(batchData, template, stage, parentBatch = null) {
            let inputWeight = 0, outputWeight = 0;
            const entradas = stage.campos_json.entradas || [];
            const salidas = stage.campos_json.salidas || [];

            if (entradas.length > 0 && entradas[0].name) {
                if (parentBatch) {
                    const parentStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden - 1);
                    if (parentStage?.campos_json.salidas[0]) {
                        inputWeight = parseFloat(parentBatch[parentStage.campos_json.salidas[0].name]) || 0;
                    }
                } else {
                    inputWeight = parseFloat(batchData[entradas[0].name]) || 0;
                }
            }

            if (salidas.length > 0 && salidas[0].name) {
                outputWeight = parseFloat(batchData[salidas[0].name]) || 0;
            }

            if (inputWeight > 0) {
                const yieldPercent = (outputWeight / inputWeight) * 100;
                if (!stageYields[stage.nombre_etapa]) {
                    stageYields[stage.nombre_etapa] = { total: 0, count: 0, order: stage.orden };
                }
                stageYields[stage.nombre_etapa].total += yieldPercent;
                stageYields[stage.nombre_etapa].count++;
                totalYields.push(yieldPercent);
            }

            const nextStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden + 1);
            if (nextStage) {
                const childKey = nextStage.nombre_etapa.toLowerCase().replace(/ & /g, '_and_');
                if (batchData[childKey] && Array.isArray(batchData[childKey])) {
                    batchData[childKey].forEach(child => traverse(child, template, nextStage, batchData));
                }
            }
        }

        batches.forEach(rootBatch => {
            const template = state.templates.find(t => t.id === rootBatch.plantilla_id);
            if (template && state.stagesByTemplate[template.id]?.length > 0) {
                const firstStage = state.stagesByTemplate[template.id][0];
                traverse(rootBatch, template, firstStage);
            }
        });

        return { stageYields, totalYields };
    }

    function calculateFincaProduction(batches) {
        const productionByFinca = {};
        batches.forEach(rootBatch => {
            const finca = rootBatch.finca;
            if (finca) {
                const template = state.templates.find(t => t.id === rootBatch.plantilla_id);
                if (template && state.stagesByTemplate[template.id]?.length > 0) {
                    const firstStage = state.stagesByTemplate[template.id][0];
                    const inputField = firstStage.campos_json.entradas[0]?.name;
                    if (inputField) {
                        const weight = parseFloat(rootBatch[inputField]) || 0;
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

    function renderKPIs(filteredBatches, totalYields) {
        const avgYield = totalYields.length > 0 ? totalYields.reduce((a, b) => a + b, 0) / totalYields.length : 0;

        const kpis = [
            { label: 'Lotes Activos', value: filteredBatches.length, icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2a4 4 0 00-4-4H3V7a4 4 0 014-4h4a4 4 0 014 4v4m-6 6h6m-3 3v-3" /></svg>`, color: 'text-sky-700 bg-sky-100' },
            { label: 'Rendimiento Promedio', value: `${avgYield.toFixed(1)}%`, icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>`, color: 'text-green-700 bg-green-100' },
            { label: 'Fincas Registradas', value: state.fincas.length, icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M12.71,2.58C12.32,2.2,11.69,2.2,11.3,2.58L4.31,9.54C3.93,9.93,4.23,10.58,4.76,10.58H7V18C7,18.55,7.45,19,8,19H16C16.55,19,17,18.55,17,18V10.58H19.24C19.77,10.58,20.07,9.93,19.7,9.54L12.71,2.58Z" /></svg>`, color: 'text-amber-800 bg-amber-100' },
            { label: 'Procesadoras', value: state.procesadoras.length, icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" viewBox="0 0 24 24" fill="currentColor"><path d="M18 17H22V15H18V17M18 13H22V11H18V13M18 9H22V7H18V9M16 19H6V21H16V19M16 3H6C4.9 3 4 3.9 4 5V17H2V5C2 2.79 3.79 1 6 1H16V3Z" /></svg>`, color: 'text-indigo-700 bg-indigo-100' }
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

    init();
});

