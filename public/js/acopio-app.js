document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        acquisitions: [],
        batches: [],      
        templates: [],
        userTemplates: [],
        acopioConfig: [],
        fincas: [],
        procesadoras: [],
        units: [],      
        currencies: [], 
        userProfile: {},
        currentSystemTemplate: null, 
        currentAcopioConfig: null, 
        targetStages: [], 
        extraFields: []
    };

    let imagesMap = {}; 

    // --- DOM ---
    const acopioGrid = document.getElementById('acopio-grid');
    const btnNuevoAcopio = document.getElementById('btn-nuevo-acopio');
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');
    const filterBtns = document.querySelectorAll('.filter-btn');

    // --- INIT ---
    init();

    async function init() {
        try {
            await Promise.all([
                loadGlobalConfig(),
                loadUserProfile(),
                loadConfig(),
                loadSystemTemplates(),
                loadUserTemplates(),
                loadAcquisitionsData(),
                loadBatches(), 
                loadFincas(),
                loadProcesadoras()
            ]);
            
            renderGrid('all');
            setupEventListeners();
            
        } catch (e) {
            console.error("Error inicializando acopio:", e);
        }
    }

    // --- CARGA DE DATOS ---
    async function loadGlobalConfig() {
        try {
            const [units, currencies] = await Promise.all([
                api('/api/config/units'),
                api('/api/config/currencies')
            ]);
            state.units = units.filter(u => u.type === 'MASA');
            state.currencies = currencies;
        } catch (e) { console.error("Error configs globales", e); }
    }
    
    async function loadUserProfile() { try { state.userProfile = await api('/api/user/profile'); } catch (e) {} }
    async function loadConfig() { const res = await fetch('/data/acopio_config.json'); state.acopioConfig = (await res.json()).acopios; }
    async function loadSystemTemplates() { state.templates = await api('/api/templates/system'); }
    async function loadUserTemplates() { try { state.userTemplates = await api('/api/templates'); } catch(e) { state.userTemplates = []; } }
    async function loadAcquisitionsData() { state.acquisitions = await api('/api/acquisitions'); }
    
    async function loadBatches() {
        try { state.batches = await api('/api/batches/tree'); } catch (e) { state.batches = []; }
    }

    async function refreshData() {
        try {
            await Promise.all([loadUserTemplates(), loadAcquisitionsData(), loadBatches()]);
            renderGrid('all');
        } catch (e) { console.error("Error refrescando:", e); }
    }

    async function loadFincas() { try { state.fincas = await api('/api/fincas'); } catch (e) { state.fincas = []; } }
    async function loadProcesadoras() { try { state.procesadoras = await api('/api/procesadoras'); } catch(e) { state.procesadoras = []; } }

    // --- RENDERIZADO DEL SELECTOR (PASO 1) ---
    function openAcopioSelector() {
        const options = state.acopioConfig.map((p, i) => `<option value="${i}">${p.nombre_producto}</option>`).join('');

        modalContent.innerHTML = `
            <div class="p-6 bg-white">
                <h2 class="text-2xl font-display text-green-900 border-b pb-2 mb-4">Registrar Nuevo Ingreso</h2>
                <div class="space-y-4">
                    <div>
                        <label for="product-select" class="block text-sm font-bold text-stone-600 mb-1">Producto / Cultivo</label>
                        <select id="product-select" class="w-full p-3 border border-stone-300 rounded-xl outline-none transition focus:ring-2 focus:ring-green-500">${options}</select>
                    </div>
                    
                    <div id="acopio-type-container" class="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar"></div>
                    
                    <div class="flex justify-end gap-2 mt-6 border-t pt-4">
                        <button onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg">Cancelar</button>
                        <button id="btn-next-step" class="px-6 py-2 bg-green-700 text-white font-bold rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed" disabled>Siguiente</button>
                    </div>
                </div>
            </div>`;
            
        const productSelect = document.getElementById('product-select');
        const typeContainer = document.getElementById('acopio-type-container');
        const nextBtn = document.getElementById('btn-next-step');

        const updateTypes = () => {
            const prodIndex = productSelect.value;
            const productConfig = state.acopioConfig[prodIndex];
            
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
                    subTypesHtml = `<div class="mt-3 ml-8 space-y-2 hidden border-l-2 border-stone-200 pl-3 subtype-group" id="subtype-group-${i}">
                        <p class="text-xs text-stone-500 font-bold uppercase tracking-wider mb-1">Selecciona Tipo:</p>
                        ${a.tipo_acopio.map((sub, j) => `
                            <label class="flex items-center gap-2 cursor-pointer hover:text-green-700 transition py-1">
                                <input type="radio" name="subtype-${i}" value="${j}" class="text-green-600 focus:ring-green-500 h-4 w-4">
                                <span class="text-sm font-medium text-stone-700">${sub.nombre}</span>
                            </label>
                        `).join('')}
                    </div>`;
                }

                return `
                <div class="border border-stone-200 rounded-xl p-4 hover:border-green-500 hover:bg-green-50/30 transition cursor-pointer acopio-option-card group" data-index="${i}" data-has-subtypes="${hasSubtypes}">
                    <div class="flex items-center gap-4 pointer-events-none">
                        <div class="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-green-700 group-hover:bg-green-200 transition"><i class="${a.icono} text-lg"></i></div>
                        <div class="flex-grow">
                            <h4 class="font-bold text-stone-800 group-hover:text-green-800 transition">${a.nombre_acopio}</h4>
                            ${a.descripcion ? `<p class="text-xs text-stone-500 mt-0.5">${a.descripcion}</p>` : ''}
                        </div>
                        <input type="radio" name="acopio-option" value="${i}" class="h-5 w-5 text-green-600 pointer-events-auto">
                    </div>
                    ${subTypesHtml}
                </div>`;
            }).join('');
            
            typeContainer.innerHTML = optionsHtml;
            
            typeContainer.querySelectorAll('.acopio-option-card').forEach(card => {
                card.addEventListener('click', (e) => {
                    if (e.target.type === 'radio' && e.target.name.startsWith('subtype')) return;

                    const radio = card.querySelector('input[name="acopio-option"]');
                    radio.checked = true;

                    typeContainer.querySelectorAll('.acopio-option-card').forEach(c => {
                        c.classList.remove('border-green-500', 'bg-green-50/30', 'ring-2', 'ring-green-500/20');
                        c.querySelector('.subtype-group')?.classList.add('hidden');
                    });
                    card.classList.add('border-green-500', 'bg-green-50/30', 'ring-2', 'ring-green-500/20');

                    if (card.dataset.hasSubtypes === 'true') {
                        const subGroup = card.querySelector('.subtype-group');
                        subGroup.classList.remove('hidden');
                        const subRadios = subGroup.querySelectorAll('input[type="radio"]');
                        if (subRadios.length > 0 && !Array.from(subRadios).some(r => r.checked)) {
                            subRadios[0].checked = true;
                        }
                    }
                    nextBtn.disabled = false;
                });
            });
        };
        productSelect.addEventListener('change', updateTypes);
        updateTypes();

        nextBtn.addEventListener('click', () => {
            const acopioOption = document.querySelector('input[name="acopio-option"]:checked');
            if(!acopioOption) return;
            
            const productConfig = state.acopioConfig[productSelect.value];
            const acopioConfig = productConfig.acopio[acopioOption.value];
            state.currentAcopioConfig = acopioConfig;
            
            let targetStageOrders = acopioConfig.etapas_acopio; 
            let subtipoNombre = null;
            
            if (acopioConfig.tipo_acopio) {
                const subIndexVal = document.querySelector(`input[name="subtype-${acopioOption.value}"]:checked`)?.value;
                if (subIndexVal !== undefined) {
                    const subConfig = acopioConfig.tipo_acopio[subIndexVal];
                    targetStageOrders = subConfig.etapas_acopio;
                    subtipoNombre = subConfig.nombre;
                }
            }

            const allJsonStages = [...(state.currentSystemTemplate.acopio || []), ...(state.currentSystemTemplate.etapas || [])];
            state.targetStages = allJsonStages.filter(s => {
                const id = s.id_etapa !== undefined ? s.id_etapa : s.orden;
                return targetStageOrders.includes(id);
            });
            state.extraFields = acopioConfig.campos || [];
            
            openAcopioForm(acopioConfig.nombre_acopio, 'create', null, subtipoNombre);
        });

        formModal.showModal();
    }

    // --- FORMULARIO CONSOLIDADO (CREAR / EDITAR) ---
    async function openAcopioForm(title, mode = 'create', acopioData = null, subtipo = null) {
        imagesMap = {};
        let formFieldsHtml = '';
        let initialData = {};

        if (mode === 'edit' && acopioData) {
            initialData = acopioData.data_adicional || {};
            if (acopioData.imagenes_json) {
                try {
                    const savedImages = typeof acopioData.imagenes_json === 'string' ? JSON.parse(acopioData.imagenes_json) : acopioData.imagenes_json;
                    if (savedImages && typeof savedImages === 'object') imagesMap = savedImages;
                } catch(e) {}
            }
        }

        // 1. Campos Globales (Peso, Precio, Fecha, Origen)
        if (state.extraFields.length > 0) {
            formFieldsHtml += `<div class="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6 space-y-4">
                <h4 class="font-bold text-amber-900 text-sm uppercase flex items-center gap-2"><i class="fas fa-file-invoice-dollar"></i> Datos de Recepción</h4>`;
            
            for (const field of state.extraFields) {
                let val = initialData[field.name]?.value;
                let metaId = null;
                
                if (mode === 'edit') {
                    if (field.name.includes('peso') || field.name.includes('cantidad')) {
                        val = acopioData.original_quantity; 
                        metaId = acopioData.unit_id;
                    }
                    if (field.name.includes('precio')) {
                        val = acopioData.original_price;
                        metaId = acopioData.currency_id;
                    }
                }
                formFieldsHtml += await createFieldHTML(field, field.name, val, metaId);
            }
            formFieldsHtml += `</div>`;
        }
        
        // 2. Campos de Etapa (Igual)
        const stagesToShow = state.targetStages;
        const renderedFields = new Set(state.extraFields.map(f => f.name));

        for (const stage of stagesToShow) {
             formFieldsHtml += `<div class="mb-6 border-l-4 border-stone-300 pl-4 py-1 bg-white">
                 <h4 class="font-bold text-stone-800 mb-3 text-sm uppercase flex items-center gap-2">
                     <span class="bg-stone-200 text-stone-600 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono">${stage.orden}</span>
                     ${stage.nombre_etapa}
                 </h4>
                 <div class="space-y-4 pl-1">`;
             
             const stageFields = [ ...(stage.campos_json.entradas || []), ...(stage.campos_json.variables || []) ];

             for (const field of stageFields) {
                 if (!renderedFields.has(field.name)) {
                     const uniqueFieldName = `${field.name}__${stage.orden}`; 
                     const fieldData = initialData[uniqueFieldName] || initialData[field.name] || {};
                     const val = fieldData.value;
                     const meta = fieldData.unit_id || fieldData.currency_id;
                     formFieldsHtml += await createFieldHTML(field, uniqueFieldName, val, meta);
                 }
             }
             formFieldsHtml += `</div></div>`;
        }

        const subtipoLabel = subtipo ? ` <span class="text-stone-500 text-sm">(${subtipo})</span>` : '';
        
        modalContent.innerHTML = `
            <div class="p-6 bg-white">
                <h2 class="text-2xl font-display text-green-900 border-b pb-2 mb-4">${mode === 'edit' ? 'Editar' : 'Nuevo'} Registro: <span class="font-bold">${title}</span>${subtipoLabel}</h2>
                <form id="acopio-form" class="max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar space-y-4">
                    ${formFieldsHtml}
                    <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100 sticky bottom-0 bg-white">
                        <button type="button" onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg transition">Cancelar</button>
                        <button type="submit" class="px-8 py-2 bg-green-700 text-white font-bold rounded-lg hover:bg-green-800 shadow-md transition transform active:scale-95">Guardar</button>
                    </div>
                </form>
            </div>
        `;

        setupDynamicListeners();

        // Submit Handler
        document.getElementById('acopio-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Guardando...';
            
            const formData = new FormData(e.target);
            const rawData = Object.fromEntries(formData.entries());
            
            const dataAdicional = {};
            let pesoKg = 0;
            let precioTotal = 0;
            let originalQty = 0;
            let originalPrice = 0;
            let selectedUnitId = null;
            let selectedCurrencyId = null;

            for (const key in rawData) {
                if (!key.startsWith('imageUrl') && !key.endsWith('_unit_id') && !key.endsWith('_currency_id')) { 
                     dataAdicional[key] = { value: rawData[key], visible: true, nombre: key }; 
                }
            }
            
            const fieldsToProcess = [...state.extraFields];
            state.targetStages.forEach(s => {
                if(s.campos_json.entradas) fieldsToProcess.push(...s.campos_json.entradas);
            });

            fieldsToProcess.forEach(field => {
                if (field.type === 'number' && (field.name.toLowerCase().includes('peso') || field.name.toLowerCase().includes('cantidad'))) {
                    const keyFound = Object.keys(rawData).find(k => k === field.name || k.startsWith(field.name + '__'));
                    if(keyFound) {
                        const val = parseFloat(rawData[keyFound]) || 0;
                        const unitId = rawData[`${keyFound}_unit_id`];
                        
                        if(dataAdicional[keyFound]) dataAdicional[keyFound].unit_id = unitId;

                        if (pesoKg === 0 || field.name.includes('pesoEntrada') || field.name.includes('cantidad') || field.name === 'peso_kg') {
                            originalQty = val;
                            selectedUnitId = unitId ? parseInt(unitId) : null;
                            const unitObj = state.units.find(u => u.id === selectedUnitId);
                            const factor = unitObj ? unitObj.base_factor : 1;
                            pesoKg = val * factor;
                        }
                    }
                }
                
                if (field.type === 'number' && field.name.toLowerCase().includes('precio')) {
                     const keyFound = Object.keys(rawData).find(k => k === field.name || k.startsWith(field.name + '__'));
                     if(keyFound) {
                         const val = parseFloat(rawData[keyFound]) || 0;
                         const currId = rawData[`${keyFound}_currency_id`];
                         if(dataAdicional[keyFound]) dataAdicional[keyFound].currency_id = currId;
                         
                         if(field.name.includes('precio')) {
                             originalPrice = val;
                             selectedCurrencyId = currId ? parseInt(currId) : null;
                             precioTotal = val;
                         }
                     }
                }
            });
            
            let fechaVal = new Date().toISOString().split('T')[0];
            const dateKey = Object.keys(rawData).find(k => k.toLowerCase().includes('fecha') && rawData[k]);
            if(dateKey) fechaVal = rawData[dateKey];

            let fincaVal = 'Desconocida';
            const fincaKey = Object.keys(rawData).find(k => k.toLowerCase().includes('finca') && rawData[k]);
            if(fincaKey) fincaVal = rawData[fincaKey];

            const payload = {
                nombre_producto: state.currentSystemTemplate.nombre_producto,
                tipo_acopio: title,
                subtipo: subtipo || acopioData?.subtipo,
                fecha_acopio: fechaVal,
                peso_kg: pesoKg, 
                precio_unitario: precioTotal,
                original_quantity: originalQty,
                original_price: originalPrice,
                unit_id: selectedUnitId,
                currency_id: selectedCurrencyId,
                finca_origen: fincaVal,
                observaciones: rawData['observaciones'] || '',
                imagenes_json: imagesMap,
                data_adicional: dataAdicional
            };

            try {
                if (mode === 'create') {
                    await api('/api/acquisitions', { method: 'POST', body: JSON.stringify(payload) });
                } else if (mode === 'edit') {
                    await api(`/api/acquisitions/${acopioData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
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
        
        if (!formModal.open) formModal.showModal();
    }

    // --- NUEVA FUNCIÓN: fetchAndEdit (RESTORED) ---
    async function fetchAndEdit(acopio) {
        const productConfig = state.acopioConfig.find(c => c.nombre_producto === acopio.nombre_producto);
        if (!productConfig) return alert("Configuración no encontrada para este producto");

        const template = state.templates.find(t => t.nombre_producto === acopio.nombre_producto);
        state.currentSystemTemplate = template;
        
        let acopioConfig = productConfig.acopio.find(a => a.nombre_acopio === acopio.tipo_acopio);
        let targetStageOrders = [];
        
        if (acopioConfig) {
            state.currentAcopioConfig = acopioConfig;
            state.extraFields = acopioConfig.campos || [];
            
            if (acopio.subtipo) {
                const subConfig = acopioConfig.tipo_acopio.find(s => s.nombre === acopio.subtipo);
                if (subConfig) targetStageOrders = subConfig.etapas_acopio;
            } else {
                targetStageOrders = acopioConfig.etapas_acopio;
            }
        }
        
        if (!targetStageOrders || targetStageOrders.length === 0) return alert("No se encontraron etapas para este tipo.");

        const allJsonStages = [...(template.acopio || []), ...(template.etapas || [])];
        state.targetStages = allJsonStages.filter(s => {
            const id = s.id_etapa !== undefined ? s.id_etapa : s.orden;
            return targetStageOrders.includes(id);
        });

        openAcopioForm(acopio.tipo_acopio, 'edit', acopio, acopio.subtipo);
    }

    // --- GENERADOR DE CAMPOS INTELIGENTE ---
    async function createFieldHTML(field, uniqueName, value = '', metaId = null) {
        const fieldName = uniqueName || field.name;
        
        if (field.type === 'number' && (field.name.toLowerCase().includes('peso') || field.name.toLowerCase().includes('cantidad'))) {
            let selectedId = metaId;
            if (!selectedId && state.userProfile.default_unit) {
                const def = state.units.find(u => u.code === state.userProfile.default_unit);
                if(def) selectedId = def.id;
            }
            
            const unitOptions = state.units.map(u => 
                `<option value="${u.id}" ${u.id == selectedId ? 'selected' : ''}>${u.code}</option>`
            ).join('');

            return `
                <div>
                    <label class="block text-xs font-bold text-stone-500 mb-1 uppercase">${field.label}</label>
                    <div class="flex shadow-sm rounded-lg">
                        <input type="number" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-l-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" step="0.01" value="${value}" placeholder="0.00" required>
                        <select name="${fieldName}_unit_id" class="bg-stone-100 border-y border-r border-stone-300 text-stone-700 font-bold px-3 rounded-r-lg outline-none cursor-pointer text-xs focus:bg-stone-200">
                            ${unitOptions}
                        </select>
                    </div>
                </div>`;
        }

        if (field.type === 'number' && field.name.toLowerCase().includes('precio')) {
            let selectedId = metaId;
            if (!selectedId && state.userProfile.default_currency) {
                const def = state.currencies.find(c => c.code === state.userProfile.default_currency);
                if(def) selectedId = def.id;
            }

            const currOptions = state.currencies.map(c => 
                `<option value="${c.id}" ${c.id == selectedId ? 'selected' : ''}>${c.code}</option>`
            ).join('');
            
            return `
                <div>
                    <label class="block text-xs font-bold text-stone-500 mb-1 uppercase">${field.label}</label>
                    <div class="flex shadow-sm rounded-lg">
                         <select name="${fieldName}_currency_id" class="bg-stone-100 border border-r-0 border-stone-300 text-stone-700 font-bold px-2 rounded-l-lg outline-none cursor-pointer text-xs focus:bg-stone-200">
                            ${currOptions}
                        </select>
                        <input type="number" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-r-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" step="0.01" value="${value}" placeholder="0.00">
                    </div>
                </div>`;
        }

        let inputHtml = `<input type="${field.type === 'number' ? 'number' : 'text'}" id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none transition" step="0.01" value="${value}">`;
        
        if (field.type === 'selectFinca') {
             const opts = state.fincas.map(f => `<option value="${f.nombre_finca}" ${f.nombre_finca === value ? 'selected' : ''}>${f.nombre_finca}</option>`).join('');
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-amber-500 outline-none finca-selector"><option value="">Seleccionar Finca...</option>${opts}</select>`;
        } 
        else if (field.type === 'selectLugar' || field.type === 'selectProcesadora') {
             let opts = '<option value="">Seleccionar...</option>';
             if (state.fincas.length > 0) opts += `<optgroup label="Fincas">${state.fincas.map(f => `<option value="${f.nombre_finca}" ${f.nombre_finca === value ? 'selected' : ''}>${f.nombre_finca}</option>`).join('')}</optgroup>`;
             if (state.procesadoras.length > 0) opts += `<optgroup label="Procesadoras">${state.procesadoras.map(p => `<option value="${p.nombre_comercial || p.razon_social}" ${(p.nombre_comercial || p.razon_social) === value ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('')}</optgroup>`;
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none">${opts}</select>`;
        } else if (field.type === 'date') {
             const dateVal = value || new Date().toISOString().split('T')[0];
             inputHtml = `<input type="date" id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 outline-none" value="${dateVal}">`;
        } else if (field.options) {
             const opts = field.options.map(o => `<option value="${o}" ${o === value ? 'selected' : ''}>${o}</option>`).join('');
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-green-500 outline-none"><option value="">Seleccionar...</option>${opts}</select>`;
        } 
        else if (field.type === 'image') {
             return `
                <div class="pt-2 mt-2">
                    <label class="block text-xs font-bold text-stone-500 mb-1 uppercase"><i class="fas fa-camera mr-1"></i> ${field.label}</label>
                    <div class="flex items-center gap-3">
                         <label class="cursor-pointer bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg text-xs font-medium border border-stone-200 transition">
                            <i class="fas fa-upload"></i> Foto
                            <input type="file" name="${fieldName}" class="hidden" accept="image/*">
                        </label>
                        <span class="text-xs text-stone-400 file-name-display">Sin archivo</span>
                    </div>
                    <img class="file-preview-img mt-2 w-full h-24 object-cover rounded-lg hidden">
                </div>`;
        } else if (field.type === 'textarea') {
             inputHtml = `<textarea id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none" rows="3">${value}</textarea>`;
        }
        
        return `<div><label for="${fieldName}" class="block text-xs font-bold text-stone-500 mb-1 uppercase">${field.label}</label>${inputHtml}</div>`;
    }

    // --- GRID RENDER ---
    function renderGrid(filter) {
        if (!acopioGrid) return;
        acopioGrid.innerHTML = '';
        
        let filtered = state.acquisitions;
        if (filter !== 'all') {
            filtered = state.acquisitions.filter(a => 
                (a.nombre_producto && a.nombre_producto.includes(filter)) || 
                (a.tipo_acopio && a.tipo_acopio.includes(filter))
            );
        }

        if (filtered.length === 0) {
            acopioGrid.innerHTML = `<div class="col-span-full text-center py-12 bg-white rounded-xl border-2 border-dashed border-stone-200"><i class="fas fa-inbox text-4xl text-stone-300 mb-3"></i><p class="text-stone-500 font-medium">No se encontraron registros.</p></div>`;
            return;
        }

        // --- CÁLCULO DE CONSUMO Y SALDOS ---
        const acqUsageMap = {};
        if (state.batches) {
            const calculateUsage = (nodes) => {
                nodes.forEach(node => {
                    if (node.acquisition_id) {
                        const used = parseFloat(node.input_quantity) || 0;
                        acqUsageMap[node.acquisition_id] = (acqUsageMap[node.acquisition_id] || 0) + used;
                    }
                    if (node.children) calculateUsage(node.children);
                });
            };
            calculateUsage(state.batches);
        }

        filtered.forEach(acop => {
            const fecha = new Date(acop.fecha_acopio).toLocaleDateString();
            let iconClass = 'fa-box';
            let colorClass = 'text-stone-700';
            let bgClass = 'bg-stone-100';
            if (acop.nombre_producto.includes('Cacao')) { iconClass = 'fa-cookie-bite'; colorClass = 'text-amber-800'; bgClass = 'bg-amber-100'; }
            if (acop.nombre_producto.includes('Café')) { iconClass = 'fa-mug-hot'; colorClass = 'text-red-800'; bgClass = 'bg-red-100'; }

            // VISUALIZACIÓN INTELIGENTE: Peso Original
            let displayWeight = `${acop.peso_kg.toFixed(2)} KG`;
            let displayPrice = acop.precio_unitario ? `$ ${acop.precio_unitario.toFixed(2)}` : '';
            
            if (acop.original_quantity && acop.unit_code) {
                displayWeight = `${acop.original_quantity} ${acop.unit_code}`;
            }
            if (acop.original_price && acop.currency_code) {
                displayPrice = `${acop.currency_code} ${acop.original_price}`;
            }

            // --- LÓGICA DE SALDO (BALANCE) ---
            const used = acqUsageMap[acop.id] || 0;
            const remaining = Math.max(0, acop.peso_kg - used);
            const isDepleted = remaining <= 0.1;
            const progressPercent = Math.min(100, (used / acop.peso_kg) * 100);

            console.log(acop);
            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-xl shadow-sm border border-stone-200 hover:shadow-lg hover:-translate-y-0.5 transition duration-300 group relative";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <span class="${bgClass} ${colorClass} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-white/50 flex items-center gap-1">
                        <i class="fas ${iconClass}"></i> ${acop.nombre_producto} ${acop.subtipo ? `<span class="opacity-75 font-normal ml-1">(${acop.subtipo})</span>` : ''}
                        ${acop.tipo_acopio ? `- ${acop.tipo_acopio}` : ''}
                    </span>
                    <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        <button class="edit-acopio-btn text-stone-400 hover:text-green-700 transition" data-id="${acop.id}" title="Editar"><i class="fas fa-pen"></i></button>
                        <button class="delete-acopio-btn text-stone-400 hover:text-red-600 transition" data-id="${acop.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="mb-2">
                    <div class="flex justify-between items-baseline mb-1">
                        <p class="text-xs text-stone-400 font-medium">Ingreso</p>
                        <p class="text-sm font-bold text-stone-600">${displayWeight}</p>
                    </div>
                    
                    <!-- NUEVA SECCIÓN DE SALDO DESTACADO -->
                    <div class="bg-stone-50 p-3 rounded-lg border border-stone-100 mt-2">
                        <div class="flex justify-between items-end mb-1">
                            <p class="text-[10px] text-stone-500 font-bold uppercase tracking-wider">Saldo Disp.</p>
                            <span class="text-xs font-bold ${isDepleted ? 'text-red-500' : 'text-amber-600'}">
                                ${isDepleted ? 'Agotado' : 'Disponible'}
                            </span>
                        </div>
                        <p class="text-xl font-display font-bold ${isDepleted ? 'text-stone-300' : 'text-green-700'}">
                            ${remaining.toFixed(2)} <span class="text-xs font-sans font-normal text-stone-500">KG</span>
                        </p>
                        <!-- Barra de progreso -->
                        <div class="w-full bg-stone-200 rounded-full h-1.5 mt-2 overflow-hidden">
                            <div class="${isDepleted ? 'bg-red-400' : 'bg-green-500'} h-1.5 rounded-full transition-all duration-500" style="width: ${progressPercent}%"></div>
                        </div>
                        <p class="text-[10px] text-stone-400 mt-1 text-right">${(used).toFixed(2)} kg usados</p>
                    </div>

                    <div class="flex justify-between items-end mt-3 text-xs text-stone-400">
                         <span><i class="fas fa-map-marker-alt"></i> ${acop.finca_origen || 'Origen N/A'}</span>
                         <span>${displayPrice}</span>
                    </div>
                    <div class="text-right text-[10px] text-stone-400 mt-1"><i class="far fa-calendar"></i> ${fecha}</div>
                </div>
                
                ${!isDepleted ? `
                <div class="pt-3 border-t border-stone-100 flex justify-between items-center">
                    <span class="text-xs font-mono text-stone-300">ID: ${acop.id}</span>
                    <a href="#" class="new-process-btn text-sm font-bold text-green-700 hover:text-green-900 flex items-center gap-1 transition">
                        Procesar <i class="fas fa-arrow-right text-xs"></i>
                    </a>
                </div>` : ''}
            `;
            
            // Asignar evento al botón "Procesar" dentro del card
            const processBtn = card.querySelector('.new-process-btn');
            if(processBtn) {
                processBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    prepareProcessing(acop); // Pasar el objeto acopio completo con peso actualizado
                });
            }

            acopioGrid.appendChild(card);
        });
        
        setupGridListeners();
    }
    
    function setupGridListeners() {
         document.querySelectorAll('.delete-acopio-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if(confirm("¿Eliminar este registro de acopio?")) {
                    try {
                        await api(`/api/acquisitions/${id}`, { method: 'DELETE' });
                        await loadAcquisitionsData();
                        await loadBatches(); 
                        renderGrid('all');
                    } catch(err) { alert(err.message); }
                }
            });
        });

        document.querySelectorAll('.edit-acopio-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const acopio = state.acquisitions.find(a => a.id === id);
                if (acopio) {
                     const tmpl = state.templates.find(t => t.nombre_producto === acopio.nombre_producto);
                     if(tmpl) fetchAndEdit(acopio);
                     else alert("Plantilla no encontrada, no se puede editar estructura.");
                }
            });
        });
    }

    function setupDynamicListeners() {
        const fincaSelectors = modalContent.querySelectorAll('.finca-selector');
        fincaSelectors.forEach(select => {
            select.addEventListener('change', (e) => {
                if (e.target.value === '__REDIRECT_FINCAS__') {
                    if(confirm("Ir a Fincas?")) window.location.href = '/app/fincas';
                    else e.target.value = "";
                }
            });
        });
        
        const fileInputs = modalContent.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            const fieldName = input.name;
            // Restaurar vista previa si ya existe imagen en memoria
            if (imagesMap[fieldName]) {
                 const container = input.closest('div').parentElement;
                 const previewImg = container.querySelector('.file-preview-img');
                 if(previewImg) {
                     previewImg.src = imagesMap[fieldName];
                     previewImg.classList.remove('hidden');
                 }
            }

            // Listener modificado para validar 5MB y Comprimir
            input.addEventListener('change', async e => {
                const file = e.target.files[0];
                const fName = e.target.name; 
                const container = e.target.closest('div').parentElement; 
                const previewImg = container.querySelector('.file-preview-img');
                const nameSpan = container.querySelector('.file-name-display');

                if(file) {
                    // 1. VALIDACIÓN DE 8 MB
                    if (file.size > 8 * 1024 * 1024) {
                        alert("La imagen supera el máximo permitido de 5 MB.");
                        e.target.value = ''; // Limpiar input
                        if (nameSpan) nameSpan.textContent = "Sin archivo";
                        if (previewImg) previewImg.classList.add('hidden');
                        return;
                    }

                    if(nameSpan) nameSpan.textContent = "Procesando...";

                    try {
                        // 2. COMPRESIÓN
                        const base64 = await compressImage(file);
                        
                        // Guardar resultado comprimido
                        imagesMap[fName] = base64; 
                        
                        if(nameSpan) nameSpan.textContent = file.name;
                        if(previewImg) { 
                            previewImg.src = base64; 
                            previewImg.classList.remove('hidden'); 
                        }
                    } catch (err) {
                        console.error("Error comprimiendo:", err);
                        alert("Hubo un error al procesar la imagen.");
                        if(nameSpan) nameSpan.textContent = "Error";
                    }
                }
            });
        });
    }

    function setupEventListeners() {
        btnNuevoAcopio.addEventListener('click', openAcopioSelector);
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => { b.classList.remove('bg-stone-800', 'text-white'); b.classList.add('bg-white', 'text-stone-600', 'border'); });
                btn.classList.remove('bg-white', 'text-stone-600', 'border');
                btn.classList.add('bg-stone-800', 'text-white');
                renderGrid(btn.dataset.filter);
            });
        });
    }

    const compressImage = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target.result;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    // Configuración de compresión
                    const MAX_WIDTH = 1024; 
                    const MAX_HEIGHT = 1024;
                    let width = img.width;
                    let height = img.height;

                    // Redimensionar manteniendo aspecto
                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Convertir a JPEG calidad 0.7 (70%)
                    resolve(canvas.toDataURL('image/jpeg', 0.7));
                };
                img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
        });
    };

    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        const res = await fetch(url, options);
        if (res.status === 204) return null;
        if(!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Error API: ${res.status}`); }
        return res.json();
    }
});