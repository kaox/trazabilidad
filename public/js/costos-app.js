document.addEventListener('DOMContentLoaded', () => {
    const mainContent = document.getElementById('main-content');
    let state = {
        batchTrees: [],
        templates: {},
        stages: {},
        costs: {}
    };

    async function init() {
        try {
            const [batchTrees, templates] = await Promise.all([
                api('/api/batches/tree'),
                api('/api/templates')
            ]);
            state.batchTrees = batchTrees;
            templates.forEach(t => state.templates[t.id] = t);
            for (const t of templates) {
                state.stages[t.id] = await api(`/api/templates/${t.id}/stages`);
            }
            renderProcessList();
        } catch (error) {
            mainContent.innerHTML = `<p class="text-red-500 text-center">Error al cargar los datos. Asegúrate de tener procesos de trazabilidad registrados.</p>`;
        }
    }

    function renderProcessList() {
        if (state.batchTrees.length === 0) {
            mainContent.innerHTML = `<div class="text-center bg-white p-8 rounded-xl shadow-md"><h2 class="font-display text-2xl">No hay procesos iniciados</h2><p class="text-stone-600 mt-2">Ve al módulo de <a href="/app/trazabilidad" class="text-sky-600 hover:underline">Trazabilidad</a> para comenzar a registrar tus lotes.</p></div>`;
            return;
        }
        const listHtml = state.batchTrees.map(tree => {
            const template = state.templates[tree.plantilla_id];
            const firstStage = state.stages[tree.plantilla_id]?.find(s => s.id === tree.etapa_id);
            const date = tree.data.fecha?.value || tree.data.fechaCosecha?.value || 'N/A';
            return `
                <div class="bg-white p-4 rounded-lg shadow-sm flex justify-between items-center">
                    <div>
                        <p class="font-bold">${tree.id}</p>
                        <p class="text-sm text-stone-500">${template?.nombre_producto || 'Proceso'} - ${firstStage?.nombre_etapa || 'Etapa inicial'} (${date})</p>
                    </div>
                    <button data-lote-id="${tree.id}" class="analyze-btn bg-amber-800 text-white font-bold py-2 px-4 rounded-lg hover:bg-amber-900">Analizar Costos</button>
                </div>
            `;
        }).join('');
        mainContent.innerHTML = `
            <div class="max-w-3xl mx-auto space-y-4">
                <h2 class="text-2xl font-display text-center mb-6">Selecciona un Proceso para Analizar</h2>
                ${listHtml}
            </div>
        `;
        document.querySelectorAll('.analyze-btn').forEach(btn => btn.addEventListener('click', handleAnalyzeClick));
    }
    
    async function handleAnalyzeClick(e) {
        const loteId = e.target.dataset.loteId;
        const batchTree = state.batchTrees.find(b => b.id === loteId);
        try {
            state.costs = await api(`/api/costs/${loteId}`);
        } catch (error) {
            state.costs = {};
        }
        renderCostingInterface(batchTree);
    }

    function renderCostingInterface(batchTree) {
        mainContent.innerHTML = `
            <button id="back-btn" class="mb-6 text-sky-600 hover:underline">< Volver a la lista</button>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div id="cost-tree-view" class="lg:col-span-1 bg-white p-6 rounded-xl shadow-lg h-fit"></div>
                <div id="cost-form-view" class="lg:col-span-2 bg-white p-6 rounded-xl shadow-lg"></div>
            </div>
        `;
        
        const costTreeView = document.getElementById('cost-tree-view');
        const costFormView = document.getElementById('cost-form-view');
        const backBtn = document.getElementById('back-btn');

        backBtn.addEventListener('click', renderProcessList);
        
        const formHtml = generateFormsHtml(batchTree);
        costFormView.innerHTML = `<h3 class="text-xl font-display border-b pb-2 mb-4">Ingreso de Costos por Etapa</h3><div class="space-y-6">${formHtml}</div><div class="flex justify-end mt-6"><button id="save-costs-btn" class="bg-green-700 text-white font-bold py-2 px-6 rounded-lg hover:bg-green-800">Guardar Costos</button></div>`;
        
        const updateCostSummary = () => {
            const calculatedCosts = calculateAllCosts(batchTree);
            const treeHtml = generateTreeHtml(batchTree, calculatedCosts);
            costTreeView.innerHTML = `<h3 class="text-xl font-display border-b pb-2 mb-4">Resumen de Costos</h3>${treeHtml}`;
        };

        costFormView.addEventListener('input', updateCostSummary);
        document.getElementById('save-costs-btn').addEventListener('click', () => saveCosts(batchTree.id));
        
        updateCostSummary();
    }

    function generateTreeHtml(batchNode, calculatedCosts, level = 0) {
        const costInfo = calculatedCosts[batchNode.id] || { accumulatedCost: 0, costPerKg: 0, inputWeight: 0, outputWeight: 0 };
        const stage = state.stages[batchNode.plantilla_id]?.find(s => s.id === batchNode.etapa_id);

        let html = `
            <div style="margin-left: ${level * 20}px" class="p-2 rounded-md ${level > 0 ? 'mt-2 border-l-2' : ''}">
                <p class="font-semibold">${stage?.nombre_etapa || 'Etapa desconocida'}</p>
                <div class="text-sm text-stone-600">
                    <p>Entrada: <span class="font-medium text-stone-800">${costInfo.inputWeight.toFixed(2)} kg</span></p>
                    <p>Salida: <span class="font-medium text-stone-800">${costInfo.outputWeight.toFixed(2)} kg</span></p>
                    <p>Costo Acumulado: <span class="font-bold text-green-700">$${costInfo.accumulatedCost.toFixed(2)}</span></p>
                    <p>Costo/kg Salida: <span class="font-bold text-green-700">$${costInfo.costPerKg.toFixed(2)}</span></p>
                </div>
            </div>
        `;
        if (batchNode.children && batchNode.children.length > 0) {
            html += batchNode.children.map(child => generateTreeHtml(child, calculatedCosts, level + 1)).join('');
        }
        return html;
    }

    function generateFormsHtml(batchNode) {
        const stage = state.stages[batchNode.plantilla_id]?.find(s => s.id === batchNode.etapa_id);
        const costs = state.costs[batchNode.id] || {};

        let fieldsHtml = createCostInput('costoAdquisicion', 'Costo de Adquisición', costs.costoAdquisicion);
        fieldsHtml += createCostInput('costoManoDeObra', 'Costo Mano de Obra', costs.costoManoDeObra);
        fieldsHtml += createCostInput('costoInsumos', 'Costo Insumos', costs.costoInsumos);
        fieldsHtml += createCostInput('costoOperativos', 'Costos Operativos', costs.costoOperativos);

        let html = `
            <div data-lote-id="${batchNode.id}" class="cost-form-group border p-4 rounded-lg">
                <h4 class="font-bold text-amber-800">${stage?.nombre_etapa}</h4>
                <div class="space-y-2 mt-2">${fieldsHtml}</div>
            </div>
        `;

        if (batchNode.children && batchNode.children.length > 0) {
            html += batchNode.children.map(child => generateFormsHtml(child)).join('');
        }
        return html;
    }
    
    function createCostInput(name, label, value = 0) {
        const tooltips = {
            costoAdquisicion: 'Costo inicial de la materia prima. Ingrésalo en la primera etapa que controlas (ej. al comprar cacao seco).',
            costoManoDeObra: 'Salarios y mano de obra directa utilizada SOLO en esta etapa del proceso.',
            costoInsumos: 'Costo de ingredientes o materiales adicionales usados SOLO en esta etapa (ej. levaduras, leña, etc.).',
            costoOperativos: 'Costos indirectos de esta etapa (ej. electricidad, agua, depreciación de maquinaria).'
        };

        const tooltipText = tooltips[name] || '';

        const tooltipHtml = tooltipText ? `
            <div class="relative flex items-center ml-2 group">
                <i class="fas fa-info-circle text-stone-400 cursor-pointer"></i>
                <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 text-xs text-white bg-stone-800 rounded-md shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    ${tooltipText}
                </div>
            </div>
        ` : '';

        return `
            <div class="grid grid-cols-3 items-center gap-2">
                <label for="${name}" class="text-sm col-span-2 flex items-center">
                    ${label}
                    ${tooltipHtml}
                </label>
                <input type="number" name="${name}" value="${value || 0}" class="col-span-1 p-2 border rounded-md text-right" step="0.01" placeholder="0.00">
            </div>
        `;
    }

    function calculateAllCosts(rootBatch) {
        const results = {};
        const getFieldValue = (data, fieldName) => {
            if (!data || !fieldName) return null;
            const field = data[fieldName];
            return (typeof field === 'object' && field !== null) ? parseFloat(field.value) : parseFloat(field);
        };
        
        function traverse(batchNode, parentCostInfo) {
            const formGroup = document.querySelector(`.cost-form-group[data-lote-id="${batchNode.id}"]`);
            const stage = state.stages[batchNode.plantilla_id]?.find(s => s.id === batchNode.etapa_id);
            
            const adquisicion = parseFloat(formGroup?.querySelector('[name=costoAdquisicion]')?.value) || 0;
            const manoDeObra = parseFloat(formGroup?.querySelector('[name=costoManoDeObra]')?.value) || 0;
            const insumos = parseFloat(formGroup?.querySelector('[name=costoInsumos]')?.value) || 0;
            const operativos = parseFloat(formGroup?.querySelector('[name=costoOperativos]')?.value) || 0;
            const processCosts = manoDeObra + insumos + operativos + adquisicion;

            let inheritedCost = 0;
            
            const inputField = stage?.campos_json.entradas[0]?.name;
            const outputField = stage?.campos_json.salidas[0]?.name;
            const inputWeight = getFieldValue(batchNode.data, inputField) || (parentCostInfo?.outputWeight || 0);
            const outputWeight = getFieldValue(batchNode.data, outputField) || 0;
            
            if (parentCostInfo) {
                inheritedCost = parentCostInfo.costPerKg * inputWeight;
            }
            
            const accumulatedCost = inheritedCost + processCosts;
            const costPerKg = outputWeight > 0 ? accumulatedCost / outputWeight : 0;

            const currentCostInfo = { accumulatedCost, costPerKg, inputWeight, outputWeight };
            results[batchNode.id] = currentCostInfo;

            if (batchNode.children && batchNode.children.length > 0) {
                batchNode.children.forEach(child => traverse(child, currentCostInfo));
            }
        }
        
        traverse(rootBatch, null);
        return results;
    }
    
    async function saveCosts(rootLoteId) {
        const formGroups = document.querySelectorAll('.cost-form-group');
        const costData = {};
        formGroups.forEach(group => {
            const loteId = group.dataset.loteId;
            const inputs = group.querySelectorAll('input');
            costData[loteId] = {};
            inputs.forEach(input => {
                costData[loteId][input.name] = parseFloat(input.value) || 0;
            });
        });

        try {
            await api(`/api/costs/${rootLoteId}`, { method: 'POST', body: JSON.stringify({ cost_data: costData }) });
            alert('Costos guardados con éxito.');
            state.costs = costData;
        } catch (error) {
            alert('Error al guardar los costos: ' + error.message);
        }
    }

    init();
});

