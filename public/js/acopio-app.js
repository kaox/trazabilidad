document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        acquisitions: [], // Datos de la tabla 'acquisitions'
        templates: [],    // Plantillas del SISTEMA (JSON)
        userTemplates: [], // Plantillas del USUARIO (DB)
        acopioConfig: [],
        fincas: [],
        procesadoras: [],
        currentSystemTemplate: null, 
        currentAcopioConfig: null, // Configuración seleccionada (para saber qué campos son peso/precio)
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
                loadConfig(),
                loadSystemTemplates(),
                loadUserTemplates(),
                loadAcquisitionsData(), // Carga desde /api/acquisitions
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
    
    // CAMBIO: Cargar Acopios en lugar de Lotes
    async function loadAcquisitionsData() {
        state.acquisitions = await api('/api/acquisitions');
    }

    async function refreshData() {
        try {
            await Promise.all([
                loadUserTemplates(), 
                loadAcquisitionsData()
            ]);
            renderGrid('all');
        } catch (e) {
            console.error("Error refrescando datos:", e);
        }
    }

    async function loadFincas() { try { state.fincas = await api('/api/fincas'); } catch (e) { state.fincas = []; } }
    async function loadProcesadoras() { try { state.procesadoras = await api('/api/procesadoras'); } catch(e) { state.procesadoras = []; } }

    // --- RENDERIZADO DEL SELECTOR (PASO 1) ---
    function openAcopioSelector() {
        const options = state.acopioConfig.map((p, i) => `<option value="${i}">${p.nombre_producto}</option>`).join('');

        modalContent.innerHTML = `
            <h2 class="text-2xl font-display text-green-900 border-b pb-2 mb-4">Registrar Nuevo Ingreso</h2>
            <div class="space-y-4">
                <div>
                    <label for="product-select" class="block text-sm font-bold text-stone-600 mb-1">Producto / Cultivo</label>
                    <select id="product-select" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-green-500 outline-none transition">${options}</select>
                </div>
                
                <div id="acopio-type-container" class="space-y-3"></div>
                
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
            state.currentAcopioConfig = acopioConfig; // Guardar config actual para saber nombres de campos
            
            let targetStageOrders = acopioConfig.etapas_acopio; 
            let subtipoNombre = null;
            
            if (acopioConfig.tipo_acopio) {
                const subIndex = document.querySelector(`input[name="subtype-${acopioIndex}"]:checked`).value;
                const subConfig = acopioConfig.tipo_acopio[subIndex];
                targetStageOrders = subConfig.etapas_acopio;
                subtipoNombre = subConfig.nombre;
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
            // Reconstruir data plana desde data_adicional
            initialData = acopioData.data_adicional || {};
            // Agregar campos principales al initialData para que se muestren en los inputs
            if (acopioData.peso_kg) initialData[getWeightFieldName()] = { value: acopioData.peso_kg };
            if (acopioData.precio_unitario) initialData['precioUnitario'] = { value: acopioData.precio_unitario };
            if (acopioData.fecha_acopio) initialData['fecha'] = { value: acopioData.fecha_acopio }; // Mapeo genérico
            
            // Cargar imágenes
            if (acopioData.imagenes_json) {
                try {
                    const savedImages = typeof acopioData.imagenes_json === 'string' ? JSON.parse(acopioData.imagenes_json) : acopioData.imagenes_json;

                    if (savedImages && typeof savedImages === 'object') {
                        imagesMap = savedImages;
                    }
                } catch(e) { console.warn("Error parsing images", e); }
            }
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
                ...(stage.campos_json.variables || [])
            ];

            for (const field of stageFields) {
                if (!renderedFields.has(field.name)) {
                    // Nombre único con sufijo
                    const uniqueFieldName = `${field.name}__${stage.orden}`; 
                    // Buscar valor: con sufijo (prioridad) o sin sufijo (campos globales como fecha)
                    const val = initialData[uniqueFieldName]?.value || initialData[field.name]?.value;
                    
                    // Si es imagen, verificar en imagesMap
                    if (field.type === 'image' && imagesMap[uniqueFieldName]) {
                         // Se cargará visualmente abajo, no necesitamos pasar valor al createFieldHTML
                    }

                    formFieldsHtml += await createFieldHTML(field, uniqueFieldName, val);
                }
            }
            formFieldsHtml += `</div></div>`;
        }

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

        // Listeners Finca
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

        // Listeners Fotos
        const fileInputs = modalContent.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            // Pre-cargar preview si existe en imagesMap
            const fieldName = input.name;
            if (imagesMap[fieldName]) {
                 const container = input.closest('div').parentElement;
                 const previewImg = container.querySelector('.file-preview-img');
                 const fileNameSpan = container.querySelector('.file-name-display');
                 if(previewImg) {
                     previewImg.src = imagesMap[fieldName];
                     previewImg.classList.remove('hidden');
                     if(fileNameSpan) fileNameSpan.textContent = "Imagen existente";
                 }
            }

            input.addEventListener('change', e => {
                const file = e.target.files[0];
                const fName = e.target.name; 
                const container = e.target.closest('div').parentElement; 
                const fileNameSpan = container.querySelector('.file-name-display');
                const previewImg = container.querySelector('.file-preview-img');

                if(file) {
                    if (fileNameSpan) fileNameSpan.textContent = file.name;
                    const reader = new FileReader();
                    reader.onload = () => { 
                        const base64 = reader.result;
                        imagesMap[fName] = base64; 
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
            
            // Construir data_adicional (todo el formulario con formato {value, visible})
            const dataAdicional = {};
            for (const key in rawData) {
                if (!key.startsWith('imageUrl')) { // Las imágenes no van en el form data directo
                     dataAdicional[key] = { value: rawData[key], visible: true, nombre: key }; 
                }
            }
            
            // Extraer campos principales para columnas de tabla acquisitions
            const pesoKey = getWeightFieldName();
            const pesoVal = rawData[pesoKey] || 0;
            const precioVal = rawData['precioUnitario'] || 0;
            
            // Buscar fecha (puede estar en fecha, fecha__1, fechaCosecha, etc)
            let fechaVal = new Date().toISOString().split('T')[0];
            const dateKey = Object.keys(rawData).find(k => k.toLowerCase().includes('fecha') && rawData[k]);
            if(dateKey) fechaVal = rawData[dateKey];

            // Buscar finca
            let fincaVal = 'Desconocida';
            const fincaKey = Object.keys(rawData).find(k => k.toLowerCase().includes('finca') && rawData[k]);
            if(fincaKey) fincaVal = rawData[fincaKey];

            const payload = {
                nombre_producto: state.currentSystemTemplate.nombre_producto,
                tipo_acopio: title,
                subtipo: subtipo || acopioData?.subtipo,
                fecha_acopio: fechaVal,
                peso_kg: pesoVal,
                precio_unitario: precioVal,
                finca_origen: fincaVal,
                observaciones: rawData['observaciones'] || '',
                imagenes_json: imagesMap, // Mapa completo de imágenes
                data_adicional: dataAdicional
            };

            try {
                if (mode === 'create') {
                    await api('/api/acquisitions', { method: 'POST', body: JSON.stringify(payload) });
                    //alert("Acopio registrado exitosamente.");
                } else if (mode === 'edit') {
                     // IMPLEMENTACIÓN DE EDICIÓN
                     // Usamos el ID del objeto acopioData que pasamos al abrir el form
                     await api(`/api/acquisitions/${acopioData.id}`, { method: 'PUT', body: JSON.stringify(payload) });
                     //alert("Acopio actualizado exitosamente.");
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
    
    // Helper para encontrar el nombre del campo de peso según config
    function getWeightFieldName() {
        if (state.currentAcopioConfig && state.currentAcopioConfig.campos) {
            const pesoField = state.currentAcopioConfig.campos.find(c => c.name.toLowerCase().includes('peso'));
            if (pesoField) return pesoField.name;
        }
        return 'pesoEntrada'; // Fallback
    }

    // --- RECONSTRUCCIÓN PARA EDICIÓN ---
    async function fetchAndEdit(acopio) {
        // Encontrar la configuración correspondiente
        const productConfig = state.acopioConfig.find(c => c.nombre_producto === acopio.nombre_producto);
        if (!productConfig) return alert("Configuración no encontrada para este producto");

        const template = state.templates.find(t => t.nombre_producto === acopio.nombre_producto);
        state.currentSystemTemplate = template;
        
        // Buscar el tipo de acopio
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

        // Obtener etapas
        const allJsonStages = [...(template.acopio || []), ...(template.etapas || [])];
        state.targetStages = allJsonStages.filter(s => {
            const id = s.id_etapa !== undefined ? s.id_etapa : s.orden;
            return targetStageOrders.includes(id);
        });

        openAcopioForm(acopio.tipo_acopio, 'edit', acopio, acopio.subtipo);
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
             // El input file no lleva value, la previsualización se maneja en openAcopioForm con la imagen cargada
             return `
                <div class="pt-4 mt-2">
                    <label for="${fieldName}" class="block text-xs font-bold text-stone-500 mb-1 uppercase"><i class="fas fa-camera mr-1"></i> ${field.label}</label>
                    <div class="flex items-center gap-3">
                         <label class="cursor-pointer bg-stone-100 hover:bg-stone-200 text-stone-600 px-3 py-2 rounded-lg text-xs font-medium transition flex items-center gap-2 border border-stone-200">
                            <i class="fas fa-upload"></i> Elegir Foto
                            <input type="file" id="${fieldName}" name="${fieldName}" class="hidden" accept="image/*">
                        </label>
                        <span class="text-xs text-stone-400 italic truncate max-w-[150px] file-name-display">Sin archivo nuevo</span>
                    </div>
                    <img class="file-preview-img mt-2 w-full h-24 object-cover rounded-lg border border-stone-200 hidden">
                </div>
             `;
        }
        
        return `<div><label for="${fieldName}" class="block text-xs font-bold text-stone-500 mb-1 uppercase">${field.label}</label>${inputHtml}</div>`;
    }

    // --- UTILS ---
    function setupEventListeners() {
        btnNuevoAcopio.addEventListener('click', openAcopioSelector);
        
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                filterBtns.forEach(b => {
                    b.classList.remove('bg-stone-800', 'text-white');
                    b.classList.add('bg-white', 'text-stone-600', 'border');
                });
                btn.classList.remove('bg-white', 'text-stone-600', 'border');
                btn.classList.add('bg-stone-800', 'text-white');
                renderGrid(btn.dataset.filter);
            });
        });
    }

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

        filtered.forEach(acop => {
            const pesoDisplay = `${acop.peso_kg} kg`;
            const tipoLabel = acop.subtipo ? `${acop.tipo_acopio} (${acop.subtipo})` : acop.tipo_acopio;
            const fecha = new Date(acop.fecha_acopio).toLocaleDateString();
            
            let iconClass = 'fa-box';
            let colorClass = 'text-stone-700';
            let bgClass = 'bg-stone-100';
            
            // Lógica visual básica
            if (acop.nombre_producto.includes('Cacao')) { iconClass = 'fa-cookie-bite'; colorClass = 'text-amber-800'; bgClass = 'bg-amber-100'; }
            if (acop.nombre_producto.includes('Café')) { iconClass = 'fa-mug-hot'; colorClass = 'text-red-800'; bgClass = 'bg-red-100'; }

            let extraInfo = '';
            const data = acop.data_adicional || {};
            
            const getVal = (key) => {
                 if (data[key]?.value) return data[key].value;
                 // Buscar en claves sufijadas (e.g. variedad__1)
                 const foundKey = Object.keys(data).find(k => k.startsWith(key + '__'));
                 return foundKey ? data[foundKey].value : "";
            };

            if (acop.nombre_producto.toLowerCase().includes('cacao')) {
                const variedad = getVal('variedad');
                if (variedad) extraInfo = ` <span class="font-normal opacity-75 ml-1">[${variedad}]</span>`;
            } else if (acop.nombre_producto.toLowerCase().includes('café') || acop.nombre_producto.toLowerCase().includes('cafe')) {
                 const clasificacion = getVal('clasificacion');
                 const variedad = getVal('variedad');
                 const parts = [];
                 if (clasificacion) parts.push(clasificacion);
                 if (variedad) parts.push(variedad);
                 if (parts.length > 0) extraInfo = ` <span class="font-normal opacity-75 ml-1">[${parts.join(' - ')}]</span>`;
            }

            const card = document.createElement('div');
            card.className = "bg-white p-5 rounded-xl shadow-sm border border-stone-200 hover:shadow-lg hover:-translate-y-0.5 transition duration-300 group relative";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <span class="${bgClass} ${colorClass} text-[10px] font-bold px-2 py-1 rounded uppercase tracking-wider border border-white/50 flex items-center gap-1">
                        <i class="fas ${iconClass}"></i> ${acop.nombre_producto}${extraInfo}
                    </span>
                    <div class="flex gap-2">
                        <button class="edit-acopio-btn text-stone-400 hover:text-green-700 transition" data-id="${acop.id}" title="Editar Info"><i class="fas fa-pen"></i></button>
                        <button class="delete-acopio-btn text-stone-400 hover:text-red-600 transition" data-id="${acop.id}" title="Eliminar"><i class="fas fa-trash"></i></button>
                    </div>
                </div>
                <div class="mb-4">
                    <p class="text-2xl font-display font-bold text-stone-800 mb-1">${pesoDisplay}</p>
                    <p class="text-xs text-stone-500 font-medium uppercase tracking-wide mb-1 flex items-center gap-1">
                        <i class="fas fa-layer-group"></i> ${tipoLabel}
                    </p>
                    <div class="flex justify-between items-end">
                         <span class="text-xs text-stone-400 flex items-center gap-1"><i class="fas fa-map-marker-alt"></i> ${acop.finca_origen || 'Origen N/A'}</span>
                         <span class="text-xs text-stone-400 flex items-center gap-1"><i class="far fa-calendar"></i> ${fecha}</span>
                    </div>
                </div>
                <div class="pt-3 border-t border-stone-100 flex justify-between items-center">
                    <span class="text-xs font-mono text-stone-300">ID: ${acop.id}</span>
                    <a href="/app/trazabilidad#acopio=${acop.id}" class="text-sm font-bold text-green-700 hover:text-green-900 flex items-center gap-1 transition">
                        Iniciar Proceso <i class="fas fa-arrow-right text-xs transform group-hover:translate-x-1 transition-transform"></i>
                    </a>
                </div>
            `;
            acopioGrid.appendChild(card);
        });
        
        // Listeners CRUD
        document.querySelectorAll('.delete-acopio-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id;
                if(confirm("¿Eliminar este registro de acopio?")) {
                    try {
                        await api(`/api/acquisitions/${id}`, { method: 'DELETE' });
                        await loadAcquisitionsData();
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
                    // Reconstruir contexto para editar (buscar template, config, etc.)
                    // Como ya tenemos nombre_producto y tipo, podemos buscar directo
                    const tmpl = state.templates.find(t => t.nombre_producto === acopio.nombre_producto);
                    if(tmpl) fetchAndEdit(acopio, tmpl);
                    else alert("Plantilla no encontrada, no se puede editar estructura.");
                }
            });
        });
    }

    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        const res = await fetch(url, options);
        if (res.status === 204) return null;
        if(!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `Error API: ${res.status}`); }
        return res.json();
    }
});