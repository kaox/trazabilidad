document.addEventListener('DOMContentLoaded', () => {
    let state = { batches: [], templates: [], stagesByTemplate: {} };
    const crearProcesoBtn = document.getElementById('crear-proceso-btn');
    const dashboardView = document.getElementById('dashboard-view');
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');

    // --- Lógica de Datos ---
    function generateId(prefix = 'LOTE') {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `${prefix}-${timestamp}-${random}`;
    }

    // --- Inicialización ---
    async function init() {
        await loadTemplates();
        await loadBatches();
        
        crearProcesoBtn.addEventListener('click', openTemplateSelectorModal);
        formModal.addEventListener('click', e => { if (e.target.id === 'form-modal') formModal.close(); });
        dashboardView.addEventListener('click', handleDashboardClick);
    }
    
    async function loadBatches() {
        try {
            state.batches = await api('/api/batches/tree');
            renderDashboard(state.batches);
        } catch (error) {
            console.error("Error al cargar lotes:", error);
            dashboardView.innerHTML = `<p class="text-red-500 text-center">Error al cargar datos de lotes.</p>`;
        }
    }

    async function loadTemplates() {
        try {
            state.templates = await api('/api/templates');
            for (const t of state.templates) {
                state.stagesByTemplate[t.id] = await api(`/api/templates/${t.id}/stages`);
            }
        } catch (error) {
            console.error("Error al cargar plantillas:", error);
        }
    }

    // --- Renderizado ---
    function renderDashboard(lotesRaiz) {
        dashboardView.innerHTML = '';
        document.getElementById('welcome-screen').classList.toggle('hidden', lotesRaiz.length > 0);
        lotesRaiz.forEach(loteRaiz => {
            const template = state.templates.find(t => t.id === loteRaiz.plantilla_id);
            if (template && state.stagesByTemplate[template.id]?.length > 0) {
                const firstStage = state.stagesByTemplate[template.id][0];
                dashboardView.appendChild(createBatchCard(loteRaiz, template, firstStage));
            }
        });
    }

    function createBatchCard(batchData, template, stage, parentBatch = null) {
        const card = document.createElement('div');
        card.className = 'batch-card-wrapper mb-4';
        
        const nextStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden + 1);
        const hasChildren = batchData.children && Array.isArray(batchData.children) && batchData.children.length > 0;

        const processData = batchData.data || batchData;

        const entradas = stage.campos_json.entradas || [];
        const salidas = stage.campos_json.salidas || [];
        const variables = stage.campos_json.variables || [];
        const imageUrlField = variables.find(v => v.type === 'image');

        const getFieldValue = (data, fieldName) => {
            if (!data || !fieldName) return null;
            const field = data[fieldName];
            if (typeof field === 'object' && field !== null && field.hasOwnProperty('value')) {
                return field.value;
            }
            return field;
        };
        
        let inputWeight = 0;
        let displayInputWeight = 0;
        let outputWeight = 0;

        if (salidas.length > 0 && salidas[0].name) {
            outputWeight = parseFloat(getFieldValue(processData, salidas[0].name)) || 0;
        }

        const inputField = entradas[0]?.name;
        if (inputField && processData[inputField]) {
            inputWeight = parseFloat(getFieldValue(processData, inputField)) || 0;
        } else if (parentBatch) {
            const parentStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden - 1);
            if (parentStage?.campos_json.salidas[0]) {
                const outputFieldOfParent = parentStage.campos_json.salidas[0].name;
                inputWeight = parseFloat(getFieldValue(parentBatch.data || parentBatch, outputFieldOfParent)) || 0;
            }
        }
        
        displayInputWeight = inputWeight;
        if (parentBatch && inputWeight === 0) {
             const parentStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden - 1);
            if (parentStage?.campos_json.salidas[0]) {
                const outputFieldOfParent = parentStage.campos_json.salidas[0].name;
                displayInputWeight = parseFloat(getFieldValue(parentBatch.data || parentBatch, outputFieldOfParent)) || 0;
            }
        }

        const yieldPercent = (inputWeight > 0) ? (outputWeight / inputWeight) * 100 : 0;
        
        let variablesHtml = variables.filter(v => v.type !== 'image').map(v => `<div><dt class="text-stone-500">${v.label}:</dt><dd class="font-medium text-stone-800">${getFieldValue(processData, v.name) || 'N/A'}</dd></div>`).join('');
        
        let ioHtml = `<div class="flex gap-4">`;
        const inputLabel = entradas[0]?.label || 'Entrada';
        ioHtml += `<div class="flex-1"><p class="text-sm text-stone-500">${inputLabel}</p><p class="font-bold text-lg">${displayInputWeight.toFixed(2)} kg</p></div>`;
        if (salidas.length > 0) ioHtml += `<div class="flex-1"><p class="text-sm text-stone-500">Salida (${salidas[0].label})</p><p class="font-bold text-lg text-green-700">${outputWeight.toFixed(2)} kg</p></div>`;
        ioHtml += `</div>`;
        
        const fechaKey = variables.find(v => v.type === 'date')?.name;
        const fecha = fechaKey ? (getFieldValue(processData, fechaKey) || 'Sin fecha') : 'Sin fecha';
        const imageUrl = imageUrlField ? getFieldValue(processData, imageUrlField.name) : null;
        
        const cardContent = document.createElement('div');
        cardContent.className = 'bg-white rounded-xl shadow-md';
        cardContent.innerHTML = `
            <div class="p-4 border-l-4" style="border-color: ${getTemplateColor(template.id)}">
                <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div class="flex items-center gap-2 flex-grow ${hasChildren ? 'cursor-pointer expand-trigger' : ''}">
                        ${hasChildren ? `<svg class="w-5 h-5 text-stone-400 transition-transform duration-300 flex-shrink-0 expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7-7"></path></svg>` : '<div class="w-5 flex-shrink-0"></div>' }
                        <div>
                            <h3 class="font-bold text-lg text-amber-900">${stage.nombre_etapa} <span class="text-base font-normal text-stone-500">[${fecha}]</span></h3>
                            ${!parentBatch ? `<span class="inline-block text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full" style="background-color: ${getTemplateColor(template.id, true)}; color: ${getTemplateColor(template.id)}">${template.nombre_producto}</span>`: ''}
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2 items-center justify-start sm:justify-end flex-shrink-0">
                        <button class="qr-btn text-xs bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-lg" data-id="${batchData.id}" title="Generar QR">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 3a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1V3zm2 2a1 1 0 100-2 1 1 0 000 2zM3 11a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zm2 2a1 1 0 100-2 1 1 0 000 2zM11 3a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V3zm2 2a1 1 0 100-2 1 1 0 000 2zM12 11a1 1 0 00-1 1v1h1a1 1 0 110 2h-1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1v-1a1 1 0 00-1-1zm-1 5a1 1 0 100-2 1 1 0 000 2zm3 0a1 1 0 100-2 1 1 0 000 2zm2 0a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" /></svg>
                        </button>
                        <button class="edit-btn text-xs bg-stone-200 hover:bg-stone-300 p-2 rounded-lg" data-batch-id="${batchData.id}" data-template-id="${template.id}" data-stage-id="${stage.id}" title="Editar">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd" /></svg>
                        </button>
                        <button class="delete-btn text-xs bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg" data-batch-id="${batchData.id}" title="Eliminar">
                           <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v6a1 1 0 11-2 0V8z" clip-rule="evenodd" /></svg>
                        </button>
                        ${nextStage ? `<button ${outputWeight <= 0 ? 'disabled' : ''} class="add-sub-btn text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg disabled:bg-gray-400" data-parent-id="${batchData.id}" data-template-id="${template.id}" data-next-stage-id="${nextStage.id}">+ Añadir ${nextStage.nombre_etapa}</button>` : ''}
                    </div>
                </div>
                <div class="pl-7 mt-4 flex flex-col sm:flex-row gap-4">
                    ${imageUrl ? `<img src="${imageUrl}" class="w-24 h-24 rounded-lg object-cover flex-shrink-0">` : ''}
                    <div class="flex-grow space-y-4">
                        <div class="pt-4 border-t sm:border-t-0"><dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm">${variablesHtml}</dl></div>
                        <div class="pt-4 border-t">${ioHtml}</div>
                        <div>
                            <div class="flex justify-between items-center mb-1"><span class="text-sm font-medium text-amber-800">Rendimiento</span><span class="text-sm font-bold text-amber-800">${yieldPercent.toFixed(1)}%</span></div>
                            <div class="w-full bg-stone-200 rounded-full h-2.5"><div class="bg-amber-700 h-2.5 rounded-full" style="width: ${yieldPercent}%"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'children-container hidden pl-5 border-l-2 border-dashed border-stone-300 md:ml-6 md:pl-4 md:border-l-solid md:border-stone-200';

        if (hasChildren) {
            batchData.children.forEach(childBatch => {
                childrenContainer.appendChild(createBatchCard(childBatch, template, nextStage, batchData));
            });
        }
        
        card.appendChild(cardContent);
        card.appendChild(childrenContainer);

        return card;
    }

    // --- Lógica de Modales y Formularios ---
    function openTemplateSelectorModal() {
        if (state.templates.length === 0) {
            alert("No hay plantillas de proceso. Crea una en Gestión -> Plantillas.");
            return;
        }
        let optionsHTML = state.templates.map(t => `<option value="${t.id}">${t.nombre_producto}</option>`).join('');
        modalContent.innerHTML = `
            <h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">Iniciar Nuevo Proceso</h2>
            <p class="text-stone-600 mb-4">Selecciona la plantilla a utilizar:</p>
            <select id="template-selector" class="w-full p-3 border rounded-xl">${optionsHTML}</select>
            <div class="flex justify-end gap-4 mt-6">
                <button type="button" class="bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl" onclick="document.getElementById('form-modal').close()">Cancelar</button>
                <button type="button" id="start-process-btn" class="bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 px-6 rounded-xl">Siguiente</button>
            </div>`;
        formModal.showModal();

        document.getElementById('start-process-btn').addEventListener('click', async () => {
            const templateId = document.getElementById('template-selector').value;
            const template = state.templates.find(t => t.id == templateId);
            if (!template) return;
            const stages = state.stagesByTemplate[template.id];
            if (stages.length === 0) {
                alert("Esta plantilla no tiene etapas definidas.");
                return;
            }
            openFormModal('create', template, stages[0]);
        });
    }
    
    async function openFormModal(mode, template, stage, parentBatch = null, batchData = {}) {
        modalContent.innerHTML = await generateFormHTML(mode, template, stage, parentBatch, batchData.data);
        formModal.showModal();
        
        modalContent.querySelectorAll('.image-upload-input').forEach(imageInput => {
            imageInput.addEventListener('change', e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                    const preview = imageInput.closest('.flex').querySelector('img');
                    const hiddenInput = imageInput.closest('.flex').querySelector('input[type="hidden"]');
                    if(preview) preview.src = reader.result;
                    if(hiddenInput) hiddenInput.value = reader.result;
                };
                reader.readAsDataURL(file);
            });
        });
        
        const form = document.getElementById('batch-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const rawData = Object.fromEntries(formData.entries());
            
            const newData = {};
            for (const key in rawData) {
                if (!key.startsWith('visible_')) {
                    newData[key] = {
                        value: rawData[key],
                        visible: formData.has(`visible_${key}`)
                    };
                }
            }
            
            try {
                if (mode === 'create') {
                    await api('/api/batches', { method: 'POST', body: JSON.stringify({ 
                        plantilla_id: template.id, 
                        etapa_id: stage.id, 
                        parent_id: parentBatch ? parentBatch.id : null, 
                        data: newData 
                    }) });
                } else {
                    newData.id = batchData.id;
                    await api(`/api/batches/${batchData.id}`, { method: 'PUT', body: JSON.stringify({ data: newData }) });
                }
                formModal.close();
                await loadBatches();
            } catch (error) {
                console.error('Error al guardar:', error);
                alert('No se pudo guardar el lote: ' + error.message);
            }
        });
        document.getElementById('cancel-btn').addEventListener('click', () => formModal.close());
    }

    async function generateFormHTML(mode, template, stage, parentBatch, data = {}) {
        let formFields = '';
        if (mode === 'edit') formFields += `<div><label class="block text-sm font-medium text-stone-700">ID Lote</label><p class="w-full p-3 bg-stone-100 rounded-xl font-mono text-sm">${(data.id?.value || data.id)}</p></div>`;
        
        const allFields = [
            ...(stage.campos_json.entradas || []),
            ...(stage.campos_json.salidas || []),
            ...(stage.campos_json.variables || [])
        ];
        
        for (const field of allFields) {
            formFields += await createFieldHTML(field, data[field.name]);
        }
        
        return `<form id="batch-form"><h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">${mode === 'create' ? 'Crear' : 'Editar'} ${stage.nombre_etapa}</h2><div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">${formFields}</div><div class="flex justify-end gap-4 mt-6"><button type="button" id="cancel-btn" class="bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl">Cancelar</button><button type="submit" class="bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 px-6 rounded-xl">Guardar</button></div></form>`;
    }

    async function createFieldHTML(field, fieldData) {
        const { label, name, type, options } = field;
        const value = (typeof fieldData === 'object' && fieldData !== null) ? fieldData.value : fieldData;
        const isVisible = (typeof fieldData === 'object' && fieldData !== null) ? fieldData.visible : true;
        const checkedAttr = isVisible ? 'checked' : '';

        let inputHtml = '';
        switch(type) {
            case 'date': inputHtml = createInputHTML(name, 'date', value); break;
            case 'number': inputHtml = createInputHTML(name, 'number', value); break;
            case 'image': inputHtml = createImageInputHTML(name, value); break;
            case 'textarea': inputHtml = createTextAreaHTML(name, value); break;
            case 'select': inputHtml = createSelectHTML(name, options, value); break;
            case 'selectFinca': inputHtml = await createFincaSelectHTML(name, value); break;
            case 'selectProcesadora': inputHtml = await createProcesadoraSelectHTML(name, value); break;
            case 'selectPerfil': inputHtml = await createPerfilSelectHTML(name, value); break;
            case 'selectLugar': inputHtml = await createLugarProcesoSelectHTML(name, value); break;
            default: inputHtml = createInputHTML(name, 'text', value);
        }
        
        return `
            <div>
                <label for="${name}" class="block text-sm font-medium text-stone-700 mb-1">${label}</label>
                <div class="flex items-center gap-3">
                    <div class="flex-grow">${inputHtml}</div>
                    <div class="flex items-center space-x-2" title="Controla la visibilidad de este campo en la página pública">
                        <input type="checkbox" id="visible_${name}" name="visible_${name}" ${checkedAttr} class="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500">
                        <label for="visible_${name}" class="text-xs text-stone-500">Visible</label>
                    </div>
                </div>
            </div>
        `;
    }

    function createInputHTML(name, type, value) {
        return `<input type="${type}" id="${name}" name="${name}" value="${value||''}" class="w-full p-3 border border-stone-300 rounded-xl" step="0.01">`;
    }
    
    function createSelectHTML(name, options, selectedValue) {
        const opts = options.map(opt => `<option value="${opt}" ${opt === selectedValue ? 'selected':''}>${opt}</option>`).join('');
        return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl bg-white"><option value="">Seleccionar...</option>${opts}</select>`;
    }
    
    function createTextAreaHTML(name, value) {
        return `<textarea id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl" rows="3">${value || ''}</textarea>`;
    }
    
    function createImageInputHTML(name, value) {
        return `<div class="pt-4 border-t"><div class="mt-1 flex items-center gap-4"><img src="${value||'https://placehold.co/100x100/e7e5e4/a8a29e?text=Foto'}" alt="Previsualización" class="h-24 w-24 rounded-lg object-cover"><div class="w-full"><input type="file" class="image-upload-input block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" accept="image/*"><input type="hidden" name="${name}" value="${value||''}"><p class="text-xs text-stone-500 mt-2">Sube una imagen.</p></div></div></div>`;
    }

    async function createFincaSelectHTML(name, selectedValue) {
        try {
            const fincas = await api('/api/fincas');
            if (fincas.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500">No hay fincas. <a href="/app/fincas" class="text-sky-600 hover:underline">Registra una</a>.</div><input type="hidden" name="${name}" value=""></div>`;
            return createSelectHTML(name, fincas.map(f => f.nombre_finca), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar fincas.</div>`; }
    }
    
    async function createProcesadoraSelectHTML(name, selectedValue) {
        try {
            const procesadoras = await api('/api/procesadoras');
            if (procesadoras.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500">No hay procesadoras. <a href="/app/procesadoras" class="text-sky-600 hover:underline">Registra una</a>.</div><input type="hidden" name="${name}" value=""></div>`;
            return createSelectHTML(name, procesadoras.map(p => p.nombre_comercial || p.razon_social), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar procesadoras.</div>`; }
    }

    async function createPerfilSelectHTML(name, selectedValue) {
        try {
            const perfiles = await api('/api/perfiles');
            return createSelectHTML(name, perfiles.map(p => p.nombre), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar perfiles.</div>`; }
    }
    
    async function createLugarProcesoSelectHTML(name, selectedValue) {
        try {
            const [fincas, procesadoras] = await Promise.all([api('/api/fincas'), api('/api/procesadoras')]);
            let optionsHTML = '<option value="">Seleccionar lugar...</option>';
            if(fincas.length > 0) {
                optionsHTML += `<optgroup label="Fincas">${fincas.map(f => `<option value="Finca: ${f.nombre_finca}" ${`Finca: ${f.nombre_finca}` === selectedValue ? 'selected' : ''}>${f.nombre_finca}</option>`).join('')}</optgroup>`;
            }
            if(procesadoras.length > 0) {
                optionsHTML += `<optgroup label="Procesadoras">${procesadoras.map(p => `<option value="Procesadora: ${p.nombre_comercial || p.razon_social}" ${`Procesadora: ${p.nombre_comercial || p.razon_social}` === selectedValue ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('')}</optgroup>`;
            }
            return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl">${optionsHTML}</select>`;
        } catch (error) {
            return `<div class="text-red-500">Error al cargar lugares.</div>`;
        }
    }
    
    function findBatchById(lotes, id) {
        for (const lote of lotes) {
            if (lote.id === id) return lote;
            if (lote.children && lote.children.length > 0) {
                const found = findBatchById(lote.children, id);
                if (found) return found;
            }
        }
        return null;
    }
    
    function findParentBatch(lotes, childId, parent = null) {
        for (const lote of lotes) {
            if (lote.id === childId) return parent;
            if (lote.children && lote.children.length > 0) {
                const found = findParentBatch(lote.children, childId, lote);
                if (found) return found;
            }
        }
        return null;
    }

    function getTemplateColor(templateId, isLight = false) {
        const colors = [
            { main: '#78350f', light: '#fed7aa' }, // Amber
            { main: '#166534', light: '#dcfce7' }, // Green
            { main: '#991b1b', light: '#fee2e2' }, // Red
            { main: '#1d4ed8', light: '#dbeafe' }, // Blue
            { main: '#86198f', light: '#fae8ff' }, // Fuchsia
        ];
        const color = colors[templateId % colors.length];
        return isLight ? color.light : color.main;
    }
    
    async function handleDashboardClick(e) {
        const expandTrigger = e.target.closest('.expand-trigger');
        if (expandTrigger) {
            const wrapper = expandTrigger.closest('.batch-card-wrapper');
            if (wrapper) {
                const childrenContainer = wrapper.querySelector('.children-container');
                const icon = expandTrigger.querySelector('.expand-icon');
                if (childrenContainer) childrenContainer.classList.toggle('hidden');
                if (icon) icon.classList.toggle('rotate-90');
            }
            return;
        }

        const button = e.target.closest('button');
        if (!button) return;
        
        if (button.classList.contains('add-sub-btn')) {
            const template = state.templates.find(t => t.id == button.dataset.templateId);
            const nextStage = state.stagesByTemplate[template.id].find(s => s.id == button.dataset.nextStageId);
            const parentBatch = findBatchById(state.batches, button.dataset.parentId);
            openFormModal('create', template, nextStage, parentBatch);
        }

        if (button.classList.contains('edit-btn')) {
            const batch = findBatchById(state.batches, button.dataset.batchId);
            const template = state.templates.find(t => t.id == button.dataset.templateId);
            const stage = state.stagesByTemplate[template.id].find(s => s.id == button.dataset.stageId);
            const parent = findParentBatch(state.batches, batch.id);
            openFormModal('edit', template, stage, parent, batch);
        }
        
        if (button.classList.contains('delete-btn')) {
            const batchId = button.dataset.batchId;
            if (confirm('¿Estás seguro de que quieres eliminar este lote y todos sus sub-procesos?')) {
                try {
                    await api(`/api/batches/${batchId}`, { method: 'DELETE' });
                    await loadBatches();
                } catch (error) {
                    alert('Error al eliminar el lote: ' + error.message);
                }
            }
        }
        
        if (button.classList.contains('qr-btn')) {
            const url = `${window.location.origin}/tracking/${button.dataset.id}`; // Apuntar a la nueva página
            const qr = qrcode(0, 'L');
            qr.addData(url);
            qr.make();
            const link = document.createElement('a');
            link.href = qr.createDataURL(4, 2);
            link.download = `QR_${button.dataset.id}.png`;
            link.click();
        }
    }

    init();
});

