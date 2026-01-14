document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        batches: [], 
        templates: [], // Plantillas del SISTEMA (JSON)
        userTemplates: [], // Plantillas del USUARIO (DB)
        acopioConfig: [],
        fincas: [],
        procesadoras: [],
        currentSystemTemplate: null, 
        targetStages: [], // Etapas que se deben llenar en el formulario
        extraFields: [] // Campos extra definidos en acopio_config.json
    };

    let imagesMap = {}; 

    // --- DOM ---
    const acopioGrid = document.getElementById('acopio-grid');
    const btnNuevoAcopio = document.getElementById('btn-nuevo-acopio');
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');

    // --- INIT ---
    init();

    async function init() {
        try {
            // Cargar todo en paralelo
            await Promise.all([
                loadConfig(),
                loadSystemTemplates(),
                loadUserTemplates(),
                loadBatchesData(),
                loadFincas(),
                loadProcesadoras()
            ]);
            
            // Renderizar solo cuando todo esté listo
            renderGrid('all');
            setupEventListeners();
            
        } catch (e) {
            console.error("Error inicializando acopio:", e);
        }
    }

    // --- CARGA DE DATOS ---
    async function loadConfig() {
        const res = await fetch('/data/acopio_config.json');
        const data = await res.json();
        state.acopioConfig = data.acopios;
    }

    async function loadSystemTemplates() {
        state.templates = await api('/api/templates/system');
    }

    async function loadUserTemplates() {
        try { state.userTemplates = await api('/api/templates'); } catch(e) { state.userTemplates = []; }
    }
    
    async function loadBatchesData() {
        state.batches = await api('/api/batches/tree');
    }

    // Función para recargar datos y refrescar la vista (usada tras guardar/eliminar)
    async function refreshData() {
        try {
            await Promise.all([
                loadUserTemplates(), // Recargar plantillas por si se creó una nueva
                loadBatchesData()    // Recargar lotes
            ]);
            renderGrid('all');
        } catch (e) {
            console.error("Error refrescando datos:", e);
        }
    }

    async function loadFincas() { try { state.fincas = await api('/api/fincas'); } catch (e) { state.fincas = []; } }
    async function loadProcesadoras() { try { state.procesadoras = await api('/api/procesadoras'); } catch(e) { state.procesadoras = []; } }

    // --- RENDERIZADO DEL SELECTOR DE ACOPIO (MODAL PASO 1) ---
    function openAcopioSelector() {
        const options = state.acopioConfig.map((p, i) => `<option value="${i}">${p.nombre_producto}</option>`).join('');

        modalContent.innerHTML = `
            <h2 class="text-2xl font-display text-green-900 border-b pb-2 mb-4">Registrar Nuevo Ingreso</h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-bold text-stone-600 mb-1">Producto / Cultivo</label>
                    <select id="product-select" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-green-500 outline-none transition">${options}</select>
                </div>
                
                <div id="acopio-type-container" class="space-y-3">
                    <!-- Opciones se inyectan aquí -->
                </div>
                
                <div class="flex justify-end gap-2 mt-6 border-t pt-4">
                    <button onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg transition">Cancelar</button>
                    <button id="btn-next-step" class="px-6 py-2 bg-green-700 text-white font-bold rounded-lg hover:bg-green-800 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>Siguiente</button>
                </div>
            </div>
        `;

        const productSelect = document.getElementById('product-select');
        const typeContainer = document.getElementById('acopio-type-container');
        const nextBtn = document.getElementById('btn-next-step');

        const updateTypes = () => {
            const prodIndex = productSelect.value;
            const productConfig = state.acopioConfig[prodIndex];
            
            // Buscar la plantilla correspondiente en el CATÁLOGO DE SISTEMA
            const template = state.templates.find(t => t.nombre_producto === productConfig.nombre_producto);
            state.currentSystemTemplate = template;

            if (!template) {
                typeContainer.innerHTML = `<div class="p-4 bg-red-50 text-red-600 rounded-lg text-sm border border-red-200">Error: La plantilla '${productConfig.nombre_producto}' no existe en el sistema.</div>`;
                nextBtn.disabled = true;
                return;
            }

            const optionsHtml = productConfig.acopio.map((a, i) => {
                const hasSubtypes = a.tipo_acopio && a.tipo_acopio.length > 0;
                
                let subTypesHtml = '';
                if (hasSubtypes) {
                    subTypesHtml = `<div class="mt-3 ml-8 space-y-2 hidden border-l-2 border-stone-200 pl-3" id="subtype-group-${i}">
                        <p class="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Selecciona Tipo:</p>
                        ${a.tipo_acopio.map((sub, j) => `
                            <label class="flex items-center gap-2 cursor-pointer hover:text-green-700 transition">
                                <input type="radio" name="subtype-${i}" value="${j}" class="text-green-600 focus:ring-green-500 h-4 w-4">
                                <span class="text-sm font-medium text-stone-700">${sub.nombre}</span>
                            </label>
                        `).join('')}
                    </div>`;
                }

                return `
                <div class="border border-stone-200 rounded-xl p-4 hover:border-green-500 hover:bg-green-50/50 transition cursor-pointer acopio-option-card group" data-index="${i}" data-has-subtypes="${hasSubtypes}">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 group-hover:bg-green-200 transition"><i class="${a.icono} text-lg"></i></div>
                        <div class="flex-grow">
                            <h4 class="font-bold text-stone-800 group-hover:text-green-800 transition">${a.nombre_acopio}</h4>
                            ${a.descripcion ? `<p class="text-xs text-stone-500 mt-0.5">${a.descripcion}</p>` : ''}
                        </div>
                        <input type="radio" name="acopio-option" value="${i}" class="h-5 w-5 text-green-600 focus:ring-green-500">
                    </div>
                    ${subTypesHtml}
                </div>`;
            }).join('');

            typeContainer.innerHTML = optionsHtml;
            
            typeContainer.querySelectorAll('.acopio-option-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.type !== 'radio' || e.target.name === 'acopio-option') {
                        const radio = card.querySelector('input[name="acopio-option"]');
                        radio.checked = true;
                    }
                    typeContainer.querySelectorAll('[id^="subtype-group-"]').forEach(el => el.classList.add('hidden'));
                    
                    if (card.dataset.hasSubtypes === 'true') {
                        const subGroup = document.getElementById(`subtype-group-${card.dataset.index}`);
                        subGroup.classList.remove('hidden');
                        const subRadios = subGroup.querySelectorAll('input[type="radio"]');
                        if (subRadios.length > 0 && !Array.from(subRadios).some(r => r.checked)) {
                            subRadios[0].checked = true;
                        }
                    }
                    nextBtn.disabled = false;
                    typeContainer.querySelectorAll('.acopio-option-card').forEach(c => {
                        c.classList.remove('border-green-500', 'bg-green-50');
                        c.classList.add('border-stone-200');
                    });
                    card.classList.remove('border-stone-200');
                    card.classList.add('border-green-500', 'bg-green-50');
                });
            });
        };

        productSelect.addEventListener('change', updateTypes);
        updateTypes();

        nextBtn.addEventListener('click', () => {
            const prodIndex = productSelect.value;
            const acopioOption = document.querySelector('input[name="acopio-option"]:checked');
            
            if(!acopioOption) return;
            const acopioIndex = acopioOption.value;
            
            const productConfig = state.acopioConfig[prodIndex];
            const acopioConfig = productConfig.acopio[acopioIndex];
            
            let targetStageOrders = acopioConfig.etapas_acopio; 
            
            if (acopioConfig.tipo_acopio) {
                const subIndex = document.querySelector(`input[name="subtype-${acopioIndex}"]:checked`).value;
                targetStageOrders = acopioConfig.tipo_acopio[subIndex].etapas_acopio;
            }

            const allJsonStages = [...(state.currentSystemTemplate.acopio || []), ...(state.currentSystemTemplate.etapas || [])];
            state.targetStages = allJsonStages.filter(s => targetStageOrders.includes(s.orden)); 
            state.extraFields = acopioConfig.campos || [];
            
            openAcopioForm(acopioConfig.nombre_acopio, 'create');
        });

        formModal.showModal();
    }

    // --- FORMULARIO CONSOLIDADO (CREAR / EDITAR) ---
    async function openAcopioForm(title, mode = 'create', batchData = null) {
        imagesMap = {};
        let formFieldsHtml = '';
        let initialData = {};

        if (mode === 'edit' && batchData) {
            initialData = batchData.data || {};
            
            // CORRECCIÓN: Cargar todas las imágenes presentes en los datos
            // Buscamos campos que terminen en 'imageUrl' o contengan 'imageUrl__'
            Object.keys(initialData).forEach(key => {
                // Verificamos si es un campo de foto
                if ((key === 'imageUrl' || key.includes('imageUrl__')) && initialData[key]?.value) {
                    imagesMap[key] = initialData[key].value;
                }
            });
        }

        // 1. Campos adicionales globales
        if (state.extraFields.length > 0) {
            formFieldsHtml += `<div class="bg-green-50 p-4 rounded-xl border border-green-100 mb-6 space-y-3">
                <h4 class="font-bold text-green-900 text-sm uppercase flex items-center gap-2"><i class="fas fa-file-invoice-dollar"></i> Datos de Recepción</h4>`;
            for (const field of state.extraFields) {
                const val = initialData[field.name]?.value;
                formFieldsHtml += await createFieldHTML(field, field.name, val);
            }
            formFieldsHtml += `</div>`;
        }

        // 2. Campos por Etapa
        const stagesToShow = state.targetStages;
        const renderedFields = new Set(state.extraFields.map(f => f.name));

        for (const stage of stagesToShow) {
            formFieldsHtml += `<div class="mb-6 border-l-4 border-stone-300 pl-4 py-1 bg-white">
                <h4 class="font-bold text-stone-800 mb-3 text-sm uppercase flex items-center gap-2">
                    <span class="bg-stone-200 text-stone-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">${stage.orden}</span>
                    ${stage.nombre_etapa}
                </h4>
                <div class="space-y-4 pl-1">`;
            
            const stageFields = [
                ...(stage.campos_json.entradas || []),
                ...(stage.campos_json.salidas || []), 
                ...(stage.campos_json.variables || [])
            ];

            for (const field of stageFields) {
                // CORRECCIÓN: Permitimos 'image' dentro del bucle de etapas
                if (!renderedFields.has(field.name)) {
                    // Nombre único: SIEMPRE usamos el sufijo __orden para campos de etapa,
                    // incluso en edición, ya que fetchAndEdit prepara los datos con estos sufijos.
                    const uniqueFieldName = `${field.name}__${stage.orden}`; 
                    
                    // Buscar valor (con sufijo prioritario, o fallback sin sufijo para campos legacy)
                    const val = initialData[uniqueFieldName]?.value || initialData[field.name]?.value;
                    
                    formFieldsHtml += await createFieldHTML(field, uniqueFieldName, val);
                }
            }
            formFieldsHtml += `</div></div>`;
        }
        
        // (Nota: Se eliminó el campo de foto global "Foto de Evidencia" para respetar las fotos por etapa)

        modalContent.innerHTML = `
            <h2 class="text-2xl font-display text-green-900 border-b pb-2 mb-4">${mode === 'edit' ? 'Editar' : 'Nuevo'} Registro: ${title}</h2>
            <form id="acopio-form" class="max-h-[70vh] overflow-y-auto pr-4 custom-scrollbar">
                ${formFieldsHtml}
                <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100 sticky bottom-0 bg-white">
                    <button type="button" onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg transition">Cancelar</button>
                    <button type="submit" class="px-8 py-2 bg-green-700 text-white font-bold rounded-lg hover:bg-green-800 shadow-md transition transform active:scale-95">Guardar</button>
                </div>
            </form>
        `;

        // Listeners Finca (Redirección)
        const fincaSelectors = modalContent.querySelectorAll('.finca-selector');
        fincaSelectors.forEach(select => {
            select.addEventListener('change', (e) => {
                if (e.target.value === '__REDIRECT_FINCAS__') {
                    if(confirm("¿Deseas ir a la página de Fincas para registrar una nueva? Se perderán los datos actuales.")) {
                        window.location.href = '/app/fincas';
                    } else {
                        e.target.value = "";
                    }
                }
            });
        });

        // Listeners Fotos (Múltiples)
        const fileInputs = modalContent.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', e => {
                const file = e.target.files[0];
                const fieldName = e.target.name; // Ej: imageUrl__1
                
                // Buscar elementos de UI asociados dentro del contenedor padre generado por createFieldHTML
                const container = e.target.closest('div').parentElement; 
                const fileNameSpan = container.querySelector('.file-name-display');
                const previewImg = container.querySelector('.file-preview-img');

                if(file) {
                    if (fileNameSpan) fileNameSpan.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = () => { 
                        const base64 = reader.result;
                        imagesMap[fieldName] = base64; // Guardar en el mapa global con su nombre único
                        if(previewImg) {
                            previewImg.src = base64;
                            previewImg.classList.remove('hidden');
                        }
                    };
                    reader.readAsDataURL(file);
                }
            });
        });

        // Submit
        document.getElementById('acopio-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
            
            const formData = new FormData(e.target);
            const rawData = Object.fromEntries(formData.entries());
            
            const newData = {};
            for (const key in rawData) {
                // Ignoramos el value del input file (que es solo el nombre de archivo)
                // Usaremos imagesMap para el contenido real
                if (key.includes('imageUrl')) {
                     // No guardar el string del path falso
                } else {
                     newData[key] = { value: rawData[key], visible: true, nombre: key }; 
                }
            }
            
            // Integrar imágenes desde el mapa al objeto de datos
            for (const [key, base64] of Object.entries(imagesMap)) {
                newData[key] = { value: base64, visible: true, nombre: 'Foto' };
            }

            try {
                if (mode === 'create') {
                    const finalStage = state.targetStages[state.targetStages.length - 1];
                    
                    // 1. Sincronizar plantilla
                    await api('/api/templates/clone', { 
                        method: 'POST', 
                        body: JSON.stringify({ nombre_producto_sistema: state.currentSystemTemplate.nombre_producto }) 
                    });

                    // 2. CREAR LOTES SECUENCIALMENTE
                    let lastParentId = null;
                    for (const stage of state.targetStages) {
                        const isLastStage = stage === state.targetStages[state.targetStages.length - 1];
                        const stageData = {};

                        // Extraer datos específicos para esta etapa por sufijo
                        for (const key in newData) {
                            if (key.endsWith(`__${stage.orden}`)) {
                                const cleanKey = key.split('__')[0];
                                stageData[cleanKey] = newData[key];
                            } else if (!key.includes('__')) {
                                // Datos globales (campos extra) van al último lote
                                if (isLastStage) stageData[key] = newData[key];
                            }
                        }

                        const response = await api('/api/batches', { 
                            method: 'POST', 
                            body: JSON.stringify({ 
                                system_template_name: state.currentSystemTemplate.nombre_producto, 
                                stage_name: stage.nombre_etapa, 
                                stage_order: stage.orden, 
                                parent_id: lastParentId, 
                                data: stageData 
                            }) 
                        });
                        if (response && response.id) lastParentId = response.id;
                    }
                    console.log("Acopio registrado exitosamente.");
                } else if (mode === 'edit') {
                    // Lógica de Edición Multi-Lote
                    for (const stage of state.targetStages) {
                        const batchId = initialData[`_batchId__${stage.orden}`];
                        if (!batchId) continue;

                        const stageData = {};
                        const isLastStage = stage === state.targetStages[state.targetStages.length - 1];

                        for (const key in newData) {
                            if (key.endsWith(`__${stage.orden}`)) {
                                const cleanKey = key.split('__')[0];
                                stageData[cleanKey] = newData[key];
                            } else if (!key.includes('__') && isLastStage) {
                                // Globales al último lote
                                stageData[key] = newData[key];
                            }
                        }
                        
                        if (Object.keys(stageData).length > 0) {
                            await api(`/api/batches/${batchId}`, { 
                                method: 'PUT', 
                                body: JSON.stringify({ data: stageData }) 
                            });
                        }
                    }
                    console.log("Registro actualizado.");
                }
                
                formModal.close();
                await refreshData(); 
            } catch(e) { 
                console.error(e);
                alert("Error al guardar: " + e.message); 
                btn.disabled = false; 
                btn.innerText = originalText;
            }
        });
        
        // Asegurar que el modal esté visible
        if (!formModal.open) formModal.showModal();
    }

    // --- RECONSTRUCCIÓN PARA EDICIÓN ---
    async function fetchAndEdit(batch, template) {
        if (!template) {
            alert("No se pudo identificar la plantilla de este lote. Intenta recargar la página.");
            return;
        }
        try {
            const stages = await api(`/api/templates/${template.id}/stages`);
            if (!stages || stages.length === 0) throw new Error("La plantilla no tiene etapas definidas.");

            // 1. Reconstruir cadena de lotes (Padre/Hijos)
            let batchChain = [batch];
            const collectChildren = (b) => {
                if (b.children && b.children.length > 0) {
                    const child = b.children[0]; 
                    batchChain.push(child);
                    collectChildren(child);
                }
            };
            collectChildren(batch);

            // 2. Identificar etapas correspondientes a los lotes encontrados
            const chainStages = batchChain.map(b => stages.find(s => s.id === b.etapa_id)).filter(s => s);
            
            if (chainStages.length > 0) {
                state.targetStages = chainStages;
                
                // Intentar recuperar los campos extra del config para mostrarlos
                state.extraFields = []; 
                const productConfig = state.acopioConfig.find(c => template.nombre_producto.includes(c.nombre_producto));
                if (productConfig) {
                    const currentOrders = chainStages.map(s => s.orden).sort((a,b)=>a-b).join(',');
                    // Buscar en opciones directas
                    let foundOption = productConfig.acopio.find(o => o.etapas_acopio && o.etapas_acopio.sort((a,b)=>a-b).join(',') === currentOrders);
                    
                    // Si no, buscar en subtipos
                    if (!foundOption) {
                        for (const opt of productConfig.acopio) {
                            if (opt.tipo_acopio) {
                                const sub = opt.tipo_acopio.find(s => s.etapas_acopio && s.etapas_acopio.sort((a,b)=>a-b).join(',') === currentOrders);
                                if (sub) { foundOption = opt; break; }
                            }
                        }
                    }
                    
                    if (foundOption && foundOption.campos) {
                        state.extraFields = foundOption.campos;
                    }
                }

                // 3. Consolidar Datos
                let consolidatedData = {};
                
                batchChain.forEach((b, index) => {
                    const stage = chainStages[index];
                    if (!stage) return;

                    const bData = b.data || {};
                    
                    // Guardar ID del lote para poder hacer PUT luego
                    consolidatedData[`_batchId__${stage.orden}`] = b.id;

                    for (const key in bData) {
                        const suffixKey = `${key}__${stage.orden}`;
                        consolidatedData[suffixKey] = bData[key];
                        
                        // Campos globales
                        if (index === batchChain.length - 1 || !consolidatedData[key]) {
                             consolidatedData[key] = bData[key];
                        }
                    }
                });

                await openAcopioForm(chainStages[0].nombre_etapa + (chainStages.length > 1 ? '...' : ''), 'edit', { id: batch.id, data: consolidatedData });
                
            } else {
                console.warn("No se encontraron etapas vinculadas para editar.");
                alert("Error: No se pueden editar los datos de este lote.");
            }
        } catch(e) { console.error("Error cargando formulario de edición:", e); alert("Error cargando edición: " + e.message); }
    }

    async function createFieldHTML(field, uniqueName, value = '') {
        const fieldName = uniqueName || field.name;
        let inputHtml = `<input type="${field.type === 'number' ? 'number' : 'text'}" id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none transition" step="0.01" value="${value}">`;
        
        if (field.type === 'selectFinca') {
             const opts = state.fincas.map(f => `<option value="${f.nombre_finca}" ${f.nombre_finca === value ? 'selected' : ''}>${f.nombre_finca}</option>`).join('');
             const addOption = `<option value="__REDIRECT_FINCAS__" class="font-bold text-green-700 bg-green-50">+ Agregar Nueva Finca</option>`;
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none finca-selector"><option value="">Seleccionar Finca...</option>${opts}${addOption}</select>`;
        } 
        else if (field.type === 'selectLugar') {
             let opts = '<option value="">Seleccionar Lugar...</option>';
             if (state.fincas.length > 0) {
                 opts += `<optgroup label="Fincas">${state.fincas.map(f => `<option value="${f.nombre_finca}" ${f.nombre_finca === value ? 'selected' : ''}>${f.nombre_finca}</option>`).join('')}</optgroup>`;
             }
             if (state.procesadoras.length > 0) {
                 opts += `<optgroup label="Procesadoras">${state.procesadoras.map(p => `<option value="${p.nombre_comercial || p.razon_social}" ${(p.nombre_comercial || p.razon_social) === value ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('')}</optgroup>`;
             }
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none">${opts}</select>`;
        }
        else if (field.type === 'selectProcesadora') {
             const opts = state.procesadoras.map(p => `<option value="${p.nombre_comercial || p.razon_social}" ${(p.nombre_comercial || p.razon_social) === value ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('');
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none"><option value="">Seleccionar...</option>${opts}</select>`;
        } else if (field.type === 'date') {
             const dateVal = value || new Date().toISOString().split('T')[0];
             inputHtml = `<input type="date" id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" value="${dateVal}">`;
        } else if (field.options) {
             const opts = field.options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('');
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none"><option value="">Seleccionar...</option>${opts}</select>`;
        } 
        else if (field.type === 'image') {
             const previewSrc = value || ''; 
             return `
                <div class="pt-4 mt-2">
                    <label for="${fieldName}" class="block text-xs font-bold text-stone-500 mb-1 uppercase"><i class="fas fa-camera mr-1"></i> ${field.label}</label>
                    <div class="flex items-center gap-3">
                         <label class="cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-600 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 border border-stone-200">
                            <i class="fas fa-upload"></i> Elegir Foto
                            <input type="file" id="${fieldName}" name="${fieldName}" class="hidden" accept="image/*">
                        </label>
                        <span id="file-name" class="text-xs text-stone-400 italic truncate max-w-[150px] file-name-display">${value ? 'Imagen cargada' : 'Sin archivo'}</span>
                    </div>
                    <img class="file-preview-img mt-2 w-full h-24 object-cover rounded-lg border border-stone-200 ${value ? '' : 'hidden'}" src="${previewSrc}">
                </div>
             `;
        }
        
        return `<div><label for="${fieldName}" class="block text-xs font-bold text-stone-500 mb-1 uppercase">${field.label}</label>${inputHtml}</div>`;
    }

    // --- UTILS ---
    function setupEventListeners() {
        btnNuevoAcopio.addEventListener('click', openAcopioSelector);
    }

    function renderGrid(filter) {
        if (!acopioGrid) return;
        acopioGrid.innerHTML = '';
        const roots = state.batches.filter(b => !b.parent_id); 
        const filtered = roots.filter(batch => {
            if (filter === 'all') return true;
            const dataStr = JSON.stringify(batch.data).toLowerCase();
            return dataStr.includes(filter.toLowerCase());
        });

        if (filtered.length === 0) {
            acopioGrid.innerHTML = `<div class="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-stone-200"><i class="fas fa-inbox text-4xl text-stone-300 mb-3"></i><p class="text-stone-500 font-medium">No se encontraron registros.</p></div>`;
            return;
        }

        filtered.reverse().forEach(batch => {
            let finalData = { ...batch.data }; 
            const findDeepData = (b) => {
                if (b.children && b.children.length > 0) {
                    const child = b.children[0]; 
                    finalData = { ...finalData, ...child.data };
                    findDeepData(child);
                }
            };
            findDeepData(batch);

            const data = finalData || {};
            let fecha = "N/A";
            const dateKey = Object.keys(data).find(k => k.includes('fecha') && data[k].value);
            if(dateKey) fecha = data[dateKey].value;

            let finca = "Finca desconocida";
            const fincaKey = Object.keys(data).find(k => k.includes('finca') && data[k].value);
            if(fincaKey) finca = data[fincaKey].value;
            
            let pesoDisplay = '0 kg';
            let tipoLabel = 'Acopio';
            let iconClass = 'fas fa-box';
            let pesoVal = 0; 
            
            const tmpl = state.userTemplates.find(t => t.id === batch.plantilla_id);
            const tmplName = tmpl ? tmpl.nombre_producto : 'Producto';
            
            let themeColor = 'stone';
            let productConfig = null;
            if(tmplName) {
                 productConfig = state.acopioConfig.find(c => tmplName.includes(c.nombre_producto));
                 if(productConfig) themeColor = productConfig.color;
            }

            const findIcon = (name) => {
                if (!productConfig) return 'fas fa-box';
                const acopio = productConfig.acopio.find(a => a.nombre_acopio.includes(name) || name.includes(a.nombre_acopio));
                return acopio ? acopio.icono : 'fas fa-box';
            };
            
            if (data.pesoSeco?.value != null) { pesoVal = parseFloat(data.pesoSeco.value); pesoDisplay = `${pesoVal} kg`; tipoLabel = 'Grano Seco'; iconClass = findIcon('Grano Seco'); }
            else if (data.pesoGranosBaba?.value != null) { pesoVal = parseFloat(data.pesoGranosBaba.value); pesoDisplay = `${pesoVal} kg`; tipoLabel = 'En Baba'; iconClass = findIcon('Baba'); }
            else if (data.pesoCerezas?.value != null) { pesoVal = parseFloat(data.pesoCerezas.value); pesoDisplay = `${pesoVal} kg`; tipoLabel = 'Cereza'; iconClass = findIcon('Cereza'); }
            else if (data.pesoPergamino?.value != null) { pesoVal = parseFloat(data.pesoPergamino.value); pesoDisplay = `${pesoVal} kg`; tipoLabel = 'Pergamino'; iconClass = findIcon('Pergamino'); }
            else if (data.pesoCafeVerde?.value != null) { pesoVal = parseFloat(data.pesoCafeVerde.value); pesoDisplay = `${pesoVal} kg`; tipoLabel = 'Verde/Oro'; iconClass = findIcon('Verde'); }

            let precioDisplay = "";
            if (data.precioUnitario?.value && pesoVal > 0) {
                const precioUnit = parseFloat(data.precioUnitario.value);
                const totalPagado = (pesoVal * precioUnit).toFixed(2);
                precioDisplay = `<span class="text-base font-normal text-stone-400 ml-2">($${totalPagado})</span>`;
            }
            
            // Detalles extra
            let detalleProducto = "";
            const variedad = data.variedad?.value;
            const clasificacion = data.clasificacion?.value;
            if (tmplName.toLowerCase().includes('cacao')) { if (variedad) detalleProducto = `<span class="text-stone-500 font-medium ml-1">[${variedad}]</span>`; } 
            else if (tmplName.toLowerCase().includes('cafe')) { const parts = []; if (clasificacion) parts.push(clasificacion); if (variedad) parts.push(variedad); if (parts.length > 0) detalleProducto = `<span class="text-stone-500 font-medium ml-1">[${parts.join(' - ')}]</span>`; }

            const bgLight = `bg-${themeColor}-50`;
            const textDark = `text-${themeColor}-800`;
            const borderCol = `border-${themeColor}-200`;
            const bgDark = `bg-${themeColor}-600`;

            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-xl shadow-sm border border-stone-200 hover:shadow-lg hover:-translate-y-0.5 transition duration-300 group relative overflow-hidden";
            card.innerHTML = `
                <div class="absolute left-0 top-0 bottom-0 w-1 ${bgDark}"></div>
                <div class="flex justify-between items-start mb-3 pl-3">
                    <span class="${bgLight} ${textDark} text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider border ${borderCol} flex items-center gap-1"><i class="${iconClass}"></i> ${tipoLabel}</span>
                    <div class="flex gap-2">
                        <button class="edit-acopio-btn text-stone-400 hover:text-green-700 transition" data-id="${batch.id}" title="Editar Info"><i class="fas fa-pen"></i></button>
                        <button class="delete-acopio-btn text-stone-400 hover:text-red-600 transition" data-id="${batch.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="mb-4 pl-3">
                    <p class="text-3xl font-display font-bold text-stone-800 mb-1">${pesoDisplay}${precioDisplay}</p>
                    <p class="text-xs text-stone-500 font-medium uppercase tracking-wide mb-1 flex items-center gap-1"><i class="fas fa-map-marker-alt text-stone-400"></i> ${finca}</p>
                    <div class="flex justify-between items-end"><p class="text-xs text-stone-400">${tmplName}${detalleProducto}</p><span class="text-xs text-stone-400 flex items-center gap-1"><i class="far fa-calendar"></i> ${fecha}</span></div>
                </div>
                <div class="pt-3 border-t border-stone-100 flex justify-between items-center pl-3">
                    <span class="text-xs font-mono text-stone-300">ID: ${batch.id.substring(0,6)}</span>
                    <a href="/app/trazabilidad" class="text-sm font-bold ${textDark} hover:underline flex items-center gap-1 transition">Continuar <i class="fas fa-arrow-right text-xs transform group-hover:translate-x-1 transition-transform"></i></a>
                </div>
            `;
            acopioGrid.appendChild(card);
        });
        
        attachCardListeners();
    }
    
    function attachCardListeners() {
        document.querySelectorAll('.delete-acopio-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if(confirm("¿Eliminar este registro de acopio? Se borrará toda la trazabilidad asociada.")) {
                    try {
                        await api(`/api/batches/${id}`, { method: 'DELETE' });
                        await refreshData();
                        console.log("Registro eliminado correctamente");
                    } catch(err) { console.error("Error al eliminar:", err); alert("Error al eliminar: " + err.message); }
                }
            });
        });

        document.querySelectorAll('.edit-acopio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const batch = state.batches.find(b => b.id === id);
                if (batch) {
                    const tmpl = state.userTemplates.find(t => t.id === batch.plantilla_id);
                    if (!tmpl) { alert("Error de integridad: Plantilla no encontrada."); return; }
                    fetchAndEdit(batch, tmpl);
                } else { alert("Error interno: Lote no encontrado."); }
            });
        });
    }

    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        let res;
        try { res = await fetch(url, options); } catch (err) { throw new Error("Error de conexión."); }
        if (res.status === 204) return null;
        if(!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Error API: ${res.status}`); }
        const text = await res.text();
        try { return text ? JSON.parse(text) : {}; } catch (e) { throw new Error("Respuesta inválida."); }
    }
});