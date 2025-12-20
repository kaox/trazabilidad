document.addEventListener('DOMContentLoaded', () => {
    let state = { batches: [], templates: [], stagesByTemplate: {}, ruedasSabor: [], perfilesSensoriales: [], fincas: [] };
    const crearProcesoBtn = document.getElementById('crear-proceso-btn');
    const dashboardView = document.getElementById('dashboard-view');
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');

    let FLAVOR_WHEELS_DATA = {};

    // Configuración de Gráficos y Ruedas de Sabor
    const SCAA_FLAVORS_ES = { /* ... se mantiene igual ... */ }; 

    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    // --- Helper API Wrapper para manejar Auth ---
    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        
        const response = await fetch(url, options);
        if (response.status === 401) {
            window.location.href = '/login.html';
            throw new Error('No autorizado');
        }
        if (response.status === 403) {
            const data = await response.json();
            throw new Error(data.error || 'Acceso denegado (Requiere suscripción)');
        }
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Error HTTP ${response.status}`);
        }
        return response.json();
    }

    // --- Inicialización ---
    async function init() {
        await loadTemplates();
        await loadBatches();
        await loadPerfilesSensoriales();
        await loadFincas();
        await loadRuedasSabor();
        
        crearProcesoBtn.addEventListener('click', openTemplateSelectorModal);
        formModal.addEventListener('click', e => { if (e.target.id === 'form-modal') formModal.close(); });
        dashboardView.addEventListener('click', handleDashboardClick);
    }

    async function loadPerfilesSensoriales() {
        try {
            state.perfilesSensoriales = await api('/api/perfiles');
        } catch (e) { console.error("Error cargando perfiles", e); }
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

    async function loadFincas() {
        try {
            state.fincas = await api('/api/fincas');
        } catch (e) { console.error("Error cargando fincas", e); state.fincas = []; }
    }

    async function loadRuedasSabor() {
        try {
            const response = await fetch('/data/flavor-wheels.json');
            const data = await response.json();
            FLAVOR_WHEELS_DATA = data;
            state.ruedasSabor = await api('/api/ruedas-sabores');
        } catch (error) {
            console.error("Error al cargar ruedas de sabor:", error);
            state.ruedasSabor = [];
        }
    }

    // --- Renderizado del Dashboard ---
    function renderDashboard(lotesRaiz) {
        dashboardView.innerHTML = '';
        document.getElementById('welcome-screen').classList.toggle('hidden', lotesRaiz.length > 0);
        
        lotesRaiz.reverse().forEach(loteRaiz => {
            const template = state.templates.find(t => t.id === loteRaiz.plantilla_id);
            if (template && state.stagesByTemplate[template.id]?.length > 0) {
                const firstStage = state.stagesByTemplate[template.id][0];
                dashboardView.appendChild(createBatchCard(loteRaiz, template, firstStage));
            } else {
                console.warn(`Plantilla no encontrada para lote ${loteRaiz.id}`);
            }
        });
    }

    function createBatchCard(batchData, template, stage, parentBatch = null) {
        const card = document.createElement('div');
        card.className = 'batch-card-wrapper mb-4';
        
        const nextStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden + 1);
        const hasChildren = batchData.children && Array.isArray(batchData.children) && batchData.children.length > 0;
        const isLocked = batchData.is_locked; 

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
        const isQualityStage = stage.nombre_etapa.toLowerCase().match(/(cata|calidad)/);

        // --- BOTONES DE ACCIÓN ---
        let actionButtonsHtml = '';

        const addSubButton = nextStage 
            ? `<button class="add-sub-btn text-xs bg-green-600 hover:bg-green-700 text-white font-bold px-3 py-1.5 rounded-lg disabled:bg-gray-400 ml-2" data-parent-id="${batchData.id}" data-template-id="${template.id}" data-next-stage-id="${nextStage.id}" title="Crear nueva rama">+ ${nextStage.nombre_etapa}</button>` 
            : '';

        const pdfButton = isQualityStage ? `
            <button class="pdf-btn text-xs bg-purple-600 hover:bg-purple-700 text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1" data-batch-id="${batchData.id}" title="Reporte de Calidad">
                <i class="fas fa-file-pdf"></i> Reporte
            </button>
        ` : '';

        if (isLocked) {
            const hashShort = batchData.blockchain_hash ? batchData.blockchain_hash.substring(0, 8) + '...' : 'Generado';
            actionButtonsHtml = `
                <div class="flex items-center gap-2 bg-green-100 border border-green-200 text-green-800 px-3 py-1.5 rounded-lg">
                    <i class="fas fa-certificate text-green-600"></i>
                    <div class="flex flex-col">
                        <span class="text-xs font-bold leading-none">HASH INMUTABLE</span>
                        <span class="text-[10px] font-mono leading-none mt-0.5 opacity-75 cursor-help" title="${batchData.blockchain_hash}">${hashShort}</span>
                    </div>
                </div>
                ${pdfButton}
                <button class="text-xs bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-lg" data-id="${batchData.id}" title="Ver Trazabilidad Pública">
                    <a href="/${batchData.id}" target="_blank"><i class="fa-solid fa-globe"></i></a>
                </button>
                <button class="qr-btn text-xs bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-lg" data-id="${batchData.id}" title="Descargar QR">
                    <i class="fa-solid fa-qrcode"></i>
                </button>
                ${addSubButton}
            `;
        } else {
            actionButtonsHtml = `
                ${pdfButton}
                <button class="text-xs bg-sky-600 hover:bg-sky-700 text-white p-2 rounded-lg" data-id="${batchData.id}" title="Ver">
                    <a href="/${batchData.id}" target="_blank"><i class="fa-solid fa-eye"></i></a>
                </button>
                <button class="edit-btn text-xs bg-stone-200 hover:bg-stone-300 p-2 rounded-lg" data-batch-id="${batchData.id}" data-template-id="${template.id}" data-stage-id="${stage.id}" title="Editar">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>
                <button class="delete-btn text-xs bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg" data-batch-id="${batchData.id}" title="Eliminar">
                    <i class="fa-solid fa-trash"></i>
                </button>
                <button class="finalize-btn text-xs bg-stone-800 hover:bg-black text-white font-bold px-3 py-1.5 rounded-lg flex items-center gap-1" data-batch-id="${batchData.id}" title="Generar Hash y Bloquear Lote">
                    <i class="fas fa-link"></i> Generar Hash & QR
                </button>
                ${addSubButton}
            `;
        }

        const cardContent = document.createElement('div');
        cardContent.className = 'bg-white rounded-xl shadow-md';
        cardContent.innerHTML = `
            <div class="p-4 border-l-4 relative" style="border-color: ${isLocked ? '#10b981' : getTemplateColor(template.id)}">
                ${isLocked ? '<div class="absolute top-0 right-0 p-2 opacity-5 pointer-events-none"><i class="fas fa-lock text-6xl text-green-900"></i></div>' : ''}
                <div class="flex flex-col sm:flex-row justify-between sm:items-start gap-2">
                    <div class="flex items-center gap-2 flex-grow ${hasChildren ? 'cursor-pointer expand-trigger' : ''}">
                        ${hasChildren ? `<svg class="w-5 h-5 text-stone-400 transition-transform duration-300 flex-shrink-0 expand-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7-7"></path></svg>` : '<div class="w-5 flex-shrink-0"></div>' }
                        <div>
                            <h3 class="font-bold text-lg text-amber-900 flex items-center gap-2">
                                ${stage.nombre_etapa} 
                                <span class="text-base font-normal text-stone-500">[${fecha}]</span>
                            </h3>
                            ${!parentBatch ? `<span class="inline-block text-xs font-semibold mr-2 px-2.5 py-0.5 rounded-full" style="background-color: ${getTemplateColor(template.id, true)}; color: ${getTemplateColor(template.id)}">${template.nombre_producto}</span>`: ''}
                        </div>
                    </div>
                    <div class="flex flex-wrap gap-2 items-center justify-start sm:justify-end flex-shrink-0 relative z-10">
                        ${actionButtonsHtml}
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

    // --- Selectores de Plantilla ---
    async function openTemplateSelectorModal() {
        let systemTemplates = [];
        try {
            systemTemplates = await api('/api/templates/system');
        } catch (e) {
            console.error("Error cargando catálogo del sistema", e);
        }

        let myTemplatesHTML = '';
        if (state.templates.length > 0) {
            const options = state.templates.map(t => `<option value="${t.id}">${t.nombre_producto}</option>`).join('');
            myTemplatesHTML = `
                <div class="mb-6 border-b border-stone-200 pb-6">
                    <h3 class="font-bold text-lg text-amber-900 mb-2">1. Usar una de mis plantillas</h3>
                    <p class="text-sm text-stone-500 mb-3">Selecciona una plantilla que ya has importado o personalizado.</p>
                    <div class="flex gap-2">
                        <select id="my-template-selector" class="flex-grow p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                            ${options}
                        </select>
                        <button id="use-my-template-btn" class="bg-amber-800 hover:bg-amber-900 text-white font-bold px-6 rounded-xl shadow-sm transition-colors">
                            Iniciar
                        </button>
                    </div>
                </div>
            `;
        }

        const catalogHTML = systemTemplates.map(t => `
            <div class="border border-stone-200 rounded-xl p-4 hover:border-amber-500 hover:bg-amber-50 transition-all cursor-pointer flex justify-between items-center group">
                <div>
                    <h4 class="font-bold text-amber-900 flex items-center gap-2">
                        ${t.nombre_producto}
                        <span class="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full border">Sistema</span>
                    </h4>
                    <p class="text-xs text-stone-500 mt-1 line-clamp-2">${t.descripcion || 'Sin descripción'}</p>
                </div>
                <button class="clone-template-btn bg-white border border-stone-300 text-stone-700 font-bold py-1.5 px-4 rounded-lg text-sm shadow-sm group-hover:bg-green-600 group-hover:text-white group-hover:border-green-600 transition-all" 
                    data-system-name="${t.nombre_producto}">
                    + Importar
                </button>
            </div>
        `).join('');

        modalContent.innerHTML = `
            <h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">Iniciar Nuevo Proceso</h2>
            ${myTemplatesHTML}
            <div>
                <h3 class="font-bold text-lg text-amber-900 mb-2">
                    ${state.templates.length > 0 ? '2. O importar del catálogo' : 'Selecciona una plantilla para comenzar'}
                </h3>
                <p class="text-sm text-stone-500 mb-3">Estas son las plantillas estándar disponibles. Al importar una, podrás usarla y personalizarla.</p>
                <div class="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                    ${catalogHTML}
                </div>
            </div>
            <div class="flex justify-end mt-6 border-t pt-4">
                <button type="button" class="text-stone-500 hover:text-stone-700 font-bold px-4" onclick="document.getElementById('form-modal').close()">Cancelar</button>
            </div>
        `;
        formModal.showModal();

        if (state.templates.length > 0) {
            document.getElementById('use-my-template-btn').addEventListener('click', () => {
                const templateId = document.getElementById('my-template-selector').value;
                startProcessWithTemplate(templateId);
            });
        }

        modalContent.querySelectorAll('.clone-template-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const btnEl = e.currentTarget; 
                const systemName = btnEl.dataset.systemName;
                const originalText = btnEl.innerHTML;
                btnEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                btnEl.disabled = true;

                try {
                    const result = await api('/api/templates/clone', {
                        method: 'POST',
                        body: JSON.stringify({ nombre_producto_sistema: systemName })
                    });
                    await loadTemplates();
                    startProcessWithTemplate(result.id);
                } catch (error) {
                    console.error(error);
                    alert("Error al importar la plantilla: " + error.message);
                    btnEl.innerHTML = originalText;
                    btnEl.disabled = false;
                }
            });
        });
    }

    async function startProcessWithTemplate(templateId) {
        const template = state.templates.find(t => t.id == templateId);
        if (!template) {
            alert("Error: Plantilla no encontrada en memoria.");
            return;
        }
        
        if (!state.stagesByTemplate[template.id]) {
             try {
                state.stagesByTemplate[template.id] = await api(`/api/templates/${template.id}/stages`);
             } catch(e) {
                 alert("Error cargando etapas de la plantilla.");
                 return;
             }
        }
        
        const stages = state.stagesByTemplate[template.id];
        if (!stages || stages.length === 0) {
            alert("Esta plantilla no tiene etapas definidas.");
            return;
        }
        
        openFormModal('create', template, stages[0]);
    }
    
    async function openFormModal(mode, template, stage, parentBatch = null, batchData = {}) {
        modalContent.innerHTML = await generateFormHTML(mode, template, stage, parentBatch, batchData.data);
        formModal.showModal();
        
        // Manejo de Inputs de Imagen
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

        // Handler para el botón de campos opcionales/ocultos
        const toggleBtn = document.getElementById('toggle-fields-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                const container = document.getElementById('hidden-fields-container');
                const icon = document.getElementById('toggle-fields-icon');
                const text = document.getElementById('toggle-fields-text');
                
                const isHidden = container.classList.contains('hidden');
                
                if (isHidden) {
                    container.classList.remove('hidden');
                    icon.classList.add('rotate-180');
                    text.textContent = 'Ocultar campos opcionales';
                } else {
                    container.classList.add('hidden');
                    icon.classList.remove('rotate-180');
                    text.textContent = 'Mostrar más campos';
                }
            });
        }
        
        const form = document.getElementById('batch-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = form.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';

            const formData = new FormData(form);
            const rawData = Object.fromEntries(formData.entries());
            
            const newData = {};
            for (const key in rawData) {
                if (!key.startsWith('visible_')) {
                    newData[key] = {
                        value: rawData[key],
                        visible: formData.has(`visible_${key}`),
                        nombre: rawData[key]
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
                submitBtn.disabled = false;
                submitBtn.innerText = 'Guardar';
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
        
        let visibleHtml = '';
        let hiddenHtml = '';

        for (const field of allFields) {
            const html = await createFieldHTML(field, data[field.name], template);
            if (field.popup === true) {
                visibleHtml += html;
            } else {
                hiddenHtml += html;
            }
        }
        
        formFields += visibleHtml;

        if (hiddenHtml) {
            formFields += `
                <div class="mt-4 pt-4 border-t border-stone-100">
                    <button type="button" id="toggle-fields-btn" class="flex items-center gap-2 text-sm font-bold text-amber-800 hover:text-amber-900 transition-colors focus:outline-none">
                        <i class="fas fa-chevron-down transition-transform duration-300" id="toggle-fields-icon"></i>
                        <span id="toggle-fields-text">Mostrar más campos</span>
                    </button>
                    <div id="hidden-fields-container" class="hidden mt-4 space-y-4 border-l-2 border-stone-200 pl-4">
                        ${hiddenHtml}
                    </div>
                </div>
            `;
        }
        
        return `<form id="batch-form"><h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">${mode === 'create' ? 'Crear' : 'Editar'} ${stage.nombre_etapa}</h2><div class="space-y-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">${formFields}</div><div class="flex justify-end gap-4 mt-6"><button type="button" id="cancel-btn" class="bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl transition-colors">Cancelar</button><button type="submit" class="bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-md">Guardar</button></div></form>`;
    }

    async function createFieldHTML(field, fieldData, template) {
        const { label, name, type, options } = field;
        const value = (typeof fieldData === 'object' && fieldData !== null) ? fieldData.value : fieldData;
        const isVisible = (typeof fieldData === 'object' && fieldData !== null) ? fieldData.visible : true;
        const checkedAttr = isVisible ? 'checked' : '';
        
        // Detección mejorada del tipo de producto
        let tipoProducto = 'otro';
        const tName = template.nombre_producto.toLowerCase();
        if (tName.includes('cacao') || tName.includes('chocolate')) tipoProducto = 'cacao';
        else if (tName.includes('cafe') || tName.includes('café')) tipoProducto = 'cafe';
        else if (tName.includes('miel')) tipoProducto = 'miel';

        let inputHtml = '';
        switch(type) {
            case 'date': inputHtml = createInputHTML(name, 'date', value); break;
            case 'number': inputHtml = createInputHTML(name, 'number', value); break;
            case 'image': inputHtml = createImageInputHTML(name, value); break;
            case 'textarea': inputHtml = createTextAreaHTML(name, value); break;
            case 'select': inputHtml = createSelectHTML(name, options, value); break;
            case 'selectFinca': inputHtml = await createFincaSelectHTML(name, value); break;
            case 'selectProcesadora': inputHtml = await createProcesadoraSelectHTML(name, value); break;
            case 'selectPerfil': inputHtml = await createPerfilSelectHTML(name, value, tipoProducto); break;
            case 'selectRuedaSabor': inputHtml = await createRuedaSaborSelectHTML(name, value, tipoProducto); break;
            case 'selectLugar': inputHtml = await createLugarProcesoSelectHTML(name, value); break;
            // NUEVO CASE: SELECTOR DE PRODUCTOS
            case 'selectProduct': inputHtml = await createProductSelectHTML(name, value, tipoProducto); break; 
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
        return `<input type="${type}" id="${name}" name="${name}" value="${value||''}" class="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" step="0.01">`;
    }
    
    function createSelectHTML(name, options, selectedValue) {
        const opts = options.map(opt => `<option value="${opt}" ${opt === selectedValue ? 'selected':''}>${opt}</option>`).join('');
        return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none"><option value="">Seleccionar...</option>${opts}</select>`;
    }
    
    function createTextAreaHTML(name, value) {
        return `<textarea id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" rows="3">${value || ''}</textarea>`;
    }
    
    function createImageInputHTML(name, value) {
        return `<div class="pt-4 border-t"><div class="mt-1 flex items-center gap-4"><img src="${value||'https://placehold.co/100x100/e7e5e4/a8a29e?text=Foto'}" alt="Previsualización" class="h-24 w-24 rounded-lg object-cover bg-stone-100 border border-stone-200"><div class="w-full"><input type="file" class="image-upload-input block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" accept="image/*"><input type="hidden" name="${name}" value="${value||''}"><p class="text-xs text-stone-500 mt-2">Sube una imagen.</p></div></div></div>`;
    }

    async function createFincaSelectHTML(name, selectedValue) {
        try {
            const fincas = state.fincas.length > 0 ? state.fincas : await api('/api/fincas');
            if (fincas.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay fincas. <a href="/app/fincas" class="text-sky-600 hover:underline">Registra una aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`;
            return createSelectHTML(name, fincas.map(f => f.nombre_finca), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar fincas.</div>`; }
    }
    
    async function createProcesadoraSelectHTML(name, selectedValue) {
        try {
            const procesadoras = await api('/api/procesadoras');
            if (procesadoras.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay procesadoras. <a href="/app/procesadoras" class="text-sky-600 hover:underline">Registra una aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`;
            return createSelectHTML(name, procesadoras.map(p => p.nombre_comercial || p.razon_social), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar procesadoras.</div>`; }
    }

    async function createPerfilSelectHTML(name, selectedValue, tipoProducto) {
        try {
            const perfiles = await api('/api/perfiles');
            const perfilesFiltradas = perfiles.filter(r => r.tipo === tipoProducto);
            return createSelectHTML(name, perfilesFiltradas.map(p => p.nombre), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar perfiles.</div>`; }
    }

    async function createRuedaSaborSelectHTML(name, selectedValue, tipoProducto) {
        if (!state.ruedasSabor || state.ruedasSabor.length === 0) {
            await loadRuedasSabor();
        }
        
        try {
            const ruedasFiltradas = state.ruedasSabor.filter(r => r.tipo === tipoProducto);
            if (ruedasFiltradas.length === 0) {
                return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay ruedas de sabor de tipo "${tipoProducto}". <a href="/app/ruedas-sabores" class="text-sky-600 hover:underline">Crea una aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`;
            }
            const options = ruedasFiltradas.map(r => `<option value="${r.id}" ${r.id == selectedValue ? 'selected' : ''}>${r.nombre_rueda}</option>`).join('');
            return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none"><option value="">Seleccionar rueda...</option>${options}</select>`;
        } catch (error) {
            return `<div class="text-red-500">Error al cargar ruedas de sabor.</div>`;
        }
    }
    
    async function createLugarProcesoSelectHTML(name, selectedValue) {
        try {
            const fincas = state.fincas.length ? state.fincas : await api('/api/fincas');
            const procesadoras = await api('/api/procesadoras');
            
            let optionsHTML = '<option value="">Seleccionar lugar...</option>';
            if(fincas.length > 0) {
                optionsHTML += `<optgroup label="Fincas">${fincas.map(f => `<option value="${f.nombre_finca}" ${`${f.nombre_finca}` === selectedValue ? 'selected' : ''}>${f.nombre_finca}</option>`).join('')}</optgroup>`;
            }
            if(procesadoras.length > 0) {
                optionsHTML += `<optgroup label="Procesadoras">${procesadoras.map(p => `<option value="Procesadora: ${p.nombre_comercial || p.razon_social}" ${`Procesadora: ${p.nombre_comercial || p.razon_social}` === selectedValue ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('')}</optgroup>`;
            }
            return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">${optionsHTML}</select>`;
        } catch (error) {
            return `<div class="text-red-500">Error al cargar lugares.</div>`;
        }
    }

    // --- NUEVA FUNCIÓN HELPER: SELECTOR DE PRODUCTOS ---
    async function createProductSelectHTML(name, selectedValue, tipoProductoFilter) {
        try {
            const products = await api('/api/productos');
            
            // Opcional: Filtrar productos que coincidan con el tipo de la plantilla para facilitar la búsqueda
            // Si el filtro es 'otro', mostramos todo.
            let productsToShow = products;
            if (tipoProductoFilter !== 'otro') {
                const filtered = products.filter(p => p.tipo_producto === tipoProductoFilter || !p.tipo_producto);
                if (filtered.length > 0) productsToShow = filtered;
            }

            if (productsToShow.length === 0) {
                 return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay productos registrados de tipo ${tipoProductoFilter}. <a href="/app/productos" class="text-sky-600 hover:underline" target="_blank">Crear uno aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`;
            }

            const options = productsToShow.map(p => {
                const isSelected = p.id === selectedValue ? 'selected' : '';
                const gtinText = p.gtin ? ` (GTIN: ${p.gtin})` : '';
                return `<option value="${p.id}" ${isSelected}>${p.nombre}${gtinText}</option>`;
            }).join('');

            return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none">
                        <option value="">Seleccionar Producto Final (SKU)...</option>
                        ${options}
                    </select>
                    <p class="text-xs text-stone-500 mt-1">Vincula este lote a un producto comercial para generar el Pasaporte Digital.</p>`;
        } catch (error) {
            return `<div class="text-red-500">Error al cargar productos.</div>`;
        }
    }
    
    // ... (Helpers de Árbol, Gráficos y PDF se mantienen igual) ...
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
            { main: '#78350f', light: '#fed7aa' }, 
            { main: '#166534', light: '#dcfce7' }, 
            { main: '#991b1b', light: '#fee2e2' }, 
            { main: '#1d4ed8', light: '#dbeafe' }, 
            { main: '#86198f', light: '#fae8ff' }, 
        ];
        let index = 0;
        if (typeof templateId === 'number') {
            index = templateId;
        } else {
            index = templateId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        }
        const color = colors[index % colors.length];
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

        if (button.classList.contains('pdf-btn')) {
            const batchNode = findBatchById(state.batches, button.dataset.batchId);
            if (batchNode) {
                await generateQualityReport(batchNode);
            }
        }
        
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
            const url = `${window.location.origin}/${button.dataset.id}`;
            const qr = qrcode(0, 'L');
            qr.addData(url);
            qr.make();
            const link = document.createElement('a');
            link.href = qr.createDataURL(4, 2);
            link.download = `QR_${button.dataset.id}.png`;
            link.click();
        }

        if (button.classList.contains('finalize-btn')) {
            const batchId = button.dataset.batchId;
            if (confirm('⚠️ ¿Generar Hash Inmutable?\n\nAl confirmar, se creará un sello criptográfico para este lote y no podrás editar sus datos. Sin embargo, SÍ podrás seguir creando nuevos lotes a partir de él.')) {
                const originalText = button.innerHTML;
                button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                button.disabled = true;
                
                try {
                    await api(`/api/batches/${batchId}/finalize`, { method: 'POST' });
                    await loadBatches();
                    alert("✅ Lote certificado exitosamente.");
                } catch (error) {
                    console.error(error);
                    alert("Error: " + error.message);
                    button.innerHTML = originalText;
                    button.disabled = false;
                }
            }
        }
    }

    async function generateQualityReport(batchNode) {
        // ... (código existente del reporte PDF) ...
        const btn = document.querySelector(`.pdf-btn[data-batch-id="${batchNode.id}"]`);
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Generando...`;
        btn.disabled = true;

        try {
            const rootBatch = findRootBatch(state.batches, batchNode.id) || batchNode;
            const template = state.templates.find(t => t.id === rootBatch.plantilla_id);
            
            const getVal = (data, key) => {
                if (!data || !key) return '';
                const field = data[key];
                if (field === undefined || field === null) return '';
                return (typeof field === 'object' && 'value' in field) ? field.value : field;
            };
            
            const fincaName = getVal(rootBatch.data, 'finca');
            const fincaData = state.fincas.find(f => 
                f.nombre_finca?.trim().toLowerCase() === fincaName?.trim().toLowerCase()
            ) || {};

            const reportData = {
                codigo: batchNode.id,
                producto: template?.nombre_producto || 'Producto',
                finca: fincaName,
                productor: fincaData.propietario || getVal(rootBatch.data, 'productor') || 'Productor Certificado', 
                pais: fincaData.pais || getVal(rootBatch.data, 'pais') || 'Origen',
                ciudad: fincaData.ciudad || getVal(rootBatch.data, 'ciudad') || '-',
                altitud: fincaData.altura ? `${fincaData.altura} msnm` : (getVal(rootBatch.data, 'altitud') || '-'),
                variedad: getVal(rootBatch.data, 'variedad') || '-',
                clasificacion: getVal(rootBatch.data, 'clasificacion') || '-',
                puntuacion: getVal(batchNode.data, 'puntuacion') || getVal(batchNode.data, 'notaFinal') || '0',
                fechaCata: getVal(batchNode.data, 'fecha') || new Date().toLocaleDateString()
            };

            let sensoryData = null;
            let flavorData = null;

            const perfilName = getVal(batchNode.data, 'tipoPerfil');
            if (perfilName) {
                const perfil = state.perfilesSensoriales.find(p => p.nombre === perfilName || p.nombre_perfil === perfilName);
                if (perfil) sensoryData = typeof perfil.perfil_data === 'string' ? JSON.parse(perfil.perfil_data) : perfil.perfil_data;
            }

            const ruedaId = getVal(batchNode.data, 'tipoRuedaSabor');
            if (ruedaId) {
                if (!state.ruedasSabor || state.ruedasSabor.length === 0) await loadRuedasSabor();
                const rueda = state.ruedasSabor.find(r => r.id == ruedaId);
                if (rueda) flavorData = rueda;
            }

            const container = document.getElementById('pdf-report-container');
            container.classList.remove('hidden');
            
            container.innerHTML = `
                <div class="font-sans text-stone-800 bg-white p-8 border-4 border-amber-900/10 h-full">
                    <div class="flex justify-between items-center border-b-2 border-amber-800 pb-6 mb-8">
                        <div>
                            <h1 class="text-4xl font-display font-bold text-amber-900">Reporte de Calidad</h1>
                            <p class="text-stone-500 mt-1">Certificado de Análisis Sensorial</p>
                        </div>
                        <div class="text-right">
                            <h2 class="text-2xl font-bold text-stone-800">Ruru Lab</h2>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-8 mb-8">
                        <div class="bg-stone-50 p-6 rounded-xl">
                            <h3 class="font-bold text-xl text-amber-900 mb-4">Datos de Origen</h3>
                            <ul class="space-y-2 text-sm">
                                <li><strong>Código:</strong> ${reportData.codigo}</li>
                                <li><strong>Producto:</strong> ${reportData.producto}</li>
                                <li><strong>Variedad:</strong> ${reportData.variedad}</li>
                                <li><strong>Finca:</strong> ${reportData.finca}</li>
                                <li><strong>Ubicación:</strong> ${reportData.ciudad}, ${reportData.pais}</li>
                            </ul>
                        </div>
                        <div class="bg-amber-50 p-6 rounded-xl text-center">
                            <h3 class="font-bold text-xl text-amber-900 mb-2">Puntuación Global</h3>
                            <span class="text-6xl font-bold text-amber-900">${parseFloat(reportData.puntuacion).toFixed(2)}</span>
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-8">
                        <div>
                            <h4 class="font-bold text-center mb-4">Perfil Sensorial</h4>
                            <div class="relative aspect-square"><canvas id="pdf-radar-chart"></canvas></div>
                        </div>
                        <div>
                            <h4 class="font-bold text-center mb-4">Rueda de Sabor</h4>
                            <div class="relative aspect-square flex items-center justify-center">
                                <canvas id="pdf-doughnut-chart" class="absolute inset-0"></canvas>
                                <canvas id="pdf-doughnut-chart-l2" class="absolute inset-0" style="transform: scale(0.7)"></canvas>
                            </div>
                            <div id="pdf-flavor-legend" class="mt-4 text-xs grid grid-cols-2 gap-1"></div>
                        </div>
                    </div>
                </div>
            `;

            if (sensoryData) renderPdfRadarChart(sensoryData);
            if (flavorData) renderPdfFlavorChart(flavorData);

            await new Promise(resolve => setTimeout(resolve, 500));

            const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.8);
            
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Reporte_Calidad_${reportData.codigo}.pdf`);

        } catch (error) {
            console.error("Error generando PDF:", error);
            alert("Error al generar el reporte PDF.");
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
            document.getElementById('pdf-report-container').classList.add('hidden');
        }
    }

    function renderPdfRadarChart(data) {
        const ctx = document.getElementById('pdf-radar-chart').getContext('2d');
        const labels = Object.keys(data);
        const values = Object.values(data);

        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Perfil',
                    data: values,
                    backgroundColor: 'rgba(146, 64, 14, 0.2)',
                    borderColor: 'rgba(146, 64, 14, 1)',
                    pointBackgroundColor: 'rgba(146, 64, 14, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                animation: false,
                scales: { r: { suggestedMin: 0, suggestedMax: 10, ticks: { display: false } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    function renderPdfFlavorChart(ruedaData) {
        const FLAVOR_DATA = ruedaData.tipo === 'cafe' ? FLAVOR_WHEELS_DATA.cafe : FLAVOR_WHEELS_DATA.cacao;
        if(!FLAVOR_DATA) return;
        const notes = typeof ruedaData.notas_json === 'string' ? JSON.parse(ruedaData.notas_json) : ruedaData.notas_json;

        const categories = {};
        notes.forEach(n => {
            if (!categories[n.category]) categories[n.category] = [];
            categories[n.category].push(n.subnote);
        });

        const labelsL1 = Object.keys(categories);
        const dataL1 = labelsL1.map(c => categories[c].length);
        const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6', '#d946ef', '#f43f5e'];

        const ctx1 = document.getElementById('pdf-doughnut-chart').getContext('2d');
        new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: labelsL1,
                datasets: [{
                    data: dataL1,
                    backgroundColor: colors,
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false }, datalabels: { display: false } }
            }
        });

        const legendHtml = labelsL1.map((cat, i) => `
            <div class="flex items-start gap-1">
                <span class="w-3 h-3 rounded-full mt-1 flex-shrink-0" style="background-color: ${colors[i % colors.length]}"></span>
                <div>
                    <strong class="block font-bold text-stone-800">${cat}</strong>
                    <span class="text-stone-500 leading-tight">${categories[cat].join(', ')}</span>
                </div>
            </div>
        `).join('');
        document.getElementById('pdf-flavor-legend').innerHTML = legendHtml;
    }

    function findRootBatch(allBatches, currentId) {
        let current = findBatchById(allBatches, currentId);
        let parent = findParentBatch(allBatches, currentId);
        while (parent) {
            current = parent;
            parent = findParentBatch(allBatches, current.id);
        }
        return current;
    }

    init();
});