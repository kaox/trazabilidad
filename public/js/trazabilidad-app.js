document.addEventListener('DOMContentLoaded', () => {
    let state = { 
        batches: [], 
        templates: [], 
        stagesByTemplate: {}, 
        ruedasSabor: [], 
        perfilesSensoriales: [], 
        fincas: [], 
        products: [],
        activeRootBatch: null, 
        view: 'inventory' 
    };

    // DOM Elements - Vistas
    const inventoryView = document.getElementById('inventory-view');
    const productionView = document.getElementById('production-view');
    
    // DOM Elements - Inventario
    const inventoryGrid = document.getElementById('inventory-grid');
    const searchInput = document.getElementById('batch-search');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const emptyState = document.getElementById('empty-state');
    
    // DOM Elements - Producción (Detalle)
    const batchTimeline = document.getElementById('batch-timeline');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');
    const backBtn = document.getElementById('back-to-inventory-btn');
    
    // Header Detalle Lote
    const activeBatchIdEl = document.getElementById('active-batch-id');
    const activeProductTypeEl = document.getElementById('active-product-type');
    const activeStartDateEl = document.getElementById('active-start-date');
    const activeCurrentWeightEl = document.getElementById('active-current-weight');
    const addNextStageBtn = document.getElementById('add-next-stage-btn');

    // Modales
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');
    const blockchainContainer = document.getElementById('blockchain-certificate');
    const hashDisplay = document.getElementById('hash-display');

    let FLAVOR_WHEELS_DATA = {};
    if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);

    // --- INIT ---
    init();

    async function init() {
        try {
            await Promise.all([
                loadTemplates(),
                loadBatches(),
                loadPerfilesSensoriales(),
                loadFincas(),
                loadRuedasSabor(),
                loadProducts()
            ]);
            
            setupEventListeners();
            
            const hash = window.location.hash.substring(1);
            if (hash) {
                const targetBatch = state.batches.find(b => b.id === hash);
                if (targetBatch) openWorkstation(targetBatch);
                else renderInventory('active');
            } else {
                renderInventory('active'); 
            }
            
        } catch (e) {
            console.error("Error init:", e);
            if(inventoryGrid) inventoryGrid.innerHTML = `<p class="col-span-full text-center text-red-500">Error cargando datos: ${e.message}</p>`;
        }
    }

    // --- LISTENERS ---
    function setupEventListeners() {
        // Navegación
        if (backBtn) backBtn.addEventListener('click', () => switchView('inventory'));
        
        // Búsqueda
        if (searchInput) searchInput.addEventListener('input', () => renderInventory());
        
        // Filtros de Inventario
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Actualizar estilo visual
                filterBtns.forEach(b => {
                    b.classList.remove('bg-stone-800', 'text-white');
                    b.classList.add('bg-white', 'text-stone-600', 'border');
                });
                btn.classList.remove('bg-white', 'text-stone-600', 'border');
                btn.classList.add('bg-stone-800', 'text-white');
                
                // Aplicar filtro
                const filter = btn.dataset.filter;
                renderInventory(filter);
            });
        });

        // Cerrar modal al hacer clic fuera
        if (formModal) {
            formModal.addEventListener('click', e => { 
                if (e.target.id === 'form-modal') formModal.close(); 
            });
        }
    }

    // --- CARGA DE DATOS ---
    async function loadBatches() {
        state.batches = await api('/api/batches/tree');
    }
    
    async function loadTemplates() { 
        state.templates = await api('/api/templates'); 
        for (const t of state.templates) { 
            state.stagesByTemplate[t.id] = await api(`/api/templates/${t.id}/stages`); 
        } 
    }
    
    async function loadPerfilesSensoriales() { try { state.perfilesSensoriales = await api('/api/perfiles'); } catch(e){} }
    async function loadFincas() { try { state.fincas = await api('/api/fincas'); } catch(e){} }
    async function loadProducts() { try { state.products = await api('/api/productos'); } catch(e){} }
    async function loadRuedasSabor() { try { const r = await fetch('/data/flavor-wheels.json'); FLAVOR_WHEELS_DATA = await r.json(); state.ruedasSabor = await api('/api/ruedas-sabores'); } catch(e){} }

    // --- GESTIÓN DE VISTAS ---
    function switchView(viewName) {
        state.view = viewName;
        const filters = document.getElementById('inventory-filters');

        if (viewName === 'inventory') {
            inventoryView.classList.remove('hidden');
            productionView.classList.add('hidden');
            if (filters) filters.classList.remove('hidden');
            if (backBtn) backBtn.classList.add('hidden');
            
            if (pageTitle) pageTitle.innerText = "Planta de Producción";
            if (pageSubtitle) pageSubtitle.innerText = "Selecciona un lote de acopio para continuar su transformación.";
            
            state.activeRootBatch = null;
            history.pushState("", document.title, window.location.pathname + window.location.search); 
            renderInventory();
        } else if (viewName === 'production') {
            inventoryView.classList.add('hidden');
            productionView.classList.remove('hidden');
            if (filters) filters.classList.add('hidden');
            if (backBtn) backBtn.classList.remove('hidden');
        }
    }

    // --- VISTA 1: INVENTARIO DE LOTES ---
    function renderInventory(filterStatus = 'active') {
        if (!inventoryGrid) return;
        inventoryGrid.innerHTML = '';
        
        const roots = state.batches.filter(b => !b.parent_id);
        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

        const filtered = roots.filter(batch => {
            const analysis = analyzeBatchChain(batch);
            const searchMatch = batch.id.toLowerCase().includes(searchTerm) || 
                                analysis.lastStageName.toLowerCase().includes(searchTerm) ||
                                analysis.productName.toLowerCase().includes(searchTerm) ||
                                analysis.finca.toLowerCase().includes(searchTerm);
            
            if (!searchMatch) return false;

            // Filtro Estado: Si el último nodo está bloqueado, se considera terminado
            const isFinished = analysis.lastNode.is_locked; 
            
            if (filterStatus === 'active' && isFinished) return false;
            if (filterStatus === 'finished' && !isFinished) return false;

            return true;
        });

        if (filtered.length === 0) {
            if(emptyState) emptyState.classList.remove('hidden');
            inventoryGrid.classList.add('hidden');
            return;
        } else {
            if(emptyState) emptyState.classList.add('hidden');
            inventoryGrid.classList.remove('hidden');
        }

        filtered.reverse().forEach(root => {
            const analysis = analyzeBatchChain(root);
            const template = state.templates.find(t => t.id === root.plantilla_id);
            const color = getTemplateColor(template ? template.id : 0);
            const startDate = new Date(root.created_at);
            const days = Math.floor((new Date() - startDate) / (1000 * 60 * 60 * 24));
            
            // Determinar Siguiente Acción Sugerida en la Tarjeta
            let nextActionLabel = "Ver Detalles";
            let nextActionIcon = "fa-eye";
            
            if (template && state.stagesByTemplate[template.id]) {
                const currentStageObj = state.stagesByTemplate[template.id].find(s => s.id === analysis.lastNode.etapa_id);
                if (currentStageObj) {
                    const nextStageObj = state.stagesByTemplate[template.id].find(s => s.orden === currentStageObj.orden + 1);
                    if (nextStageObj) {
                        nextActionLabel = `Iniciar ${nextStageObj.nombre_etapa}`;
                        nextActionIcon = "fa-play";
                    } else {
                        nextActionLabel = "Certificar / Finalizar";
                        nextActionIcon = "fa-check-circle";
                    }
                }
            }

            const card = document.createElement('div');
            card.className = "bg-white rounded-2xl shadow-sm border border-stone-200 hover:shadow-xl hover:-translate-y-1 transition duration-300 overflow-hidden cursor-pointer group batch-card";
            card.innerHTML = `
                <div class="h-2 w-full" style="background-color: ${color}"></div>
                <div class="p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex flex-col">
                            <span class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1">Lote Origen</span>
                            <span class="font-mono font-bold text-lg text-stone-800 bg-stone-100 px-2 py-0.5 rounded border border-stone-200">${root.id}</span>
                        </div>
                        <div class="text-right">
                             <span class="text-[10px] font-bold uppercase tracking-wide text-white px-2 py-1 rounded-full" style="background-color: ${color}">${analysis.productName}</span>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <h3 class="text-xl font-display font-bold text-stone-800 mb-1">${analysis.lastStageName}</h3>
                        <p class="text-sm text-stone-500 flex items-center gap-2">
                            <i class="fas fa-map-marker-alt text-stone-300"></i> ${analysis.finca}
                        </p>
                    </div>

                    <div class="grid grid-cols-2 gap-4 mb-4 text-sm border-t border-b border-stone-100 py-3">
                        <div>
                            <span class="block text-xs text-stone-400">Peso Actual</span>
                            <span class="font-bold text-stone-700 text-lg">${analysis.lastWeight} kg</span>
                        </div>
                        <div class="text-right">
                            <span class="block text-xs text-stone-400">Tiempo</span>
                            <span class="font-bold text-stone-700">${days} días</span>
                        </div>
                    </div>

                    <div class="grid grid-cols-4 gap-2 mt-4">
                        <button class="col-span-3 py-2 rounded-lg bg-stone-800 text-white font-bold text-sm hover:bg-black transition flex items-center justify-center gap-2 action-open">
                            <i class="fas ${nextActionIcon}"></i> ${nextActionLabel}
                        </button>
                        <button class="col-span-1 py-2 rounded-lg bg-stone-100 text-stone-600 hover:bg-stone-200 transition flex items-center justify-center action-qr" title="QR Lote Origen">
                            <i class="fas fa-qrcode"></i>
                        </button>
                    </div>
                </div>
            `;
            
            const openBtn = card.querySelector('.action-open');
            const qrBtn = card.querySelector('.action-qr');
            openBtn.addEventListener('click', (e) => { e.stopPropagation(); openWorkstation(root); });
            qrBtn.addEventListener('click', (e) => { e.stopPropagation(); downloadQR(root.id); });
            card.addEventListener('click', () => openWorkstation(root));
            
            inventoryGrid.appendChild(card);
        });
    }

    function analyzeBatchChain(rootBatch) {
        let lastNode = rootBatch;
        // Encontrar el último nodo de la cadena principal
        const findLast = (node) => {
            if (node.children && node.children.length > 0) {
                const child = node.children[node.children.length - 1]; 
                lastNode = child;
                findLast(child);
            }
        };
        findLast(rootBatch);

        const tmpl = state.templates.find(t => t.id === rootBatch.plantilla_id);
        const stageList = state.stagesByTemplate[rootBatch.plantilla_id] || [];
        const stageObj = stageList.find(s => s.id === lastNode.etapa_id);
        const d = lastNode.data || {};
        
        let weight = 0;
        const outputKeys = Object.keys(d).filter(k => k.toLowerCase().includes('salida') || k.toLowerCase().includes('seco') || k.toLowerCase().includes('tostado') || k.toLowerCase().includes('final') || k.toLowerCase().includes('unidades'));
        if(outputKeys.length > 0) weight = parseFloat(d[outputKeys[0]]?.value || 0);
        else {
             const inputKeys = Object.keys(d).filter(k => k.toLowerCase().includes('peso'));
             if(inputKeys.length > 0) weight = parseFloat(d[inputKeys[0]]?.value || 0);
        }

        const finca = rootBatch.data.finca?.value || rootBatch.data.lugarProceso?.value || 'N/A';

        return {
            lastNode,
            lastStageName: stageObj ? stageObj.nombre_etapa : 'Etapa Desconocida',
            productName: tmpl ? tmpl.nombre_producto : 'Producto',
            finca: finca,
            rootWeight: weight.toFixed(2), // Simplificado para mostrar peso actual
            lastWeight: weight.toFixed(2),
            is_locked: lastNode.is_locked
        };
    }

    // --- VISTA 2: ESTACIÓN DE TRABAJO (DETALLE DE LOTE) ---
    function openWorkstation(rootBatch) {
        state.activeRootBatch = rootBatch;
        const analysis = analyzeBatchChain(rootBatch);
        
        if(pageTitle) pageTitle.innerText = `${analysis.productName} - ${analysis.finca}`;
        if(pageSubtitle) pageSubtitle.innerText = "Línea de tiempo de producción";
        if(activeBatchIdEl) activeBatchIdEl.innerText = rootBatch.id;
        if(activeProductTypeEl) activeProductTypeEl.innerText = analysis.productName;
        if(activeStartDateEl) activeStartDateEl.innerText = new Date(rootBatch.created_at).toLocaleDateString();
        if(activeCurrentWeightEl) activeCurrentWeightEl.innerText = `${analysis.lastWeight} kg`;

        // Configurar Botón Principal (Basado en el último estado)
        configureNewProcessButton(analysis.lastNode, rootBatch.plantilla_id);

        renderTimeline(rootBatch);
        switchView('production');
        
        window.history.pushState(null, '', `#${rootBatch.id}`);
    }

    function configureNewProcessButton(lastBatchNode, templateId) {
        if (!addNextStageBtn) return;
        
        const stages = state.stagesByTemplate[templateId];
        const currentStage = stages.find(s => s.id === lastBatchNode.etapa_id);
        const nextStage = stages.find(s => s.orden === currentStage.orden + 1);
        
        const newBtn = addNextStageBtn.cloneNode(true);
        addNextStageBtn.parentNode.replaceChild(newBtn, addNextStageBtn);
        
        if (nextStage) {
            // MOSTRAR BOTÓN DE ACCIÓN: INICIAR SIGUIENTE ETAPA
            newBtn.innerHTML = `<i class="fas fa-play text-lg"></i> <span>Iniciar ${nextStage.nombre_etapa}</span>`;
            newBtn.classList.remove('hidden', 'bg-stone-400', 'cursor-default', 'bg-green-600', 'hover:bg-green-700');
            newBtn.classList.add('bg-amber-600', 'hover:bg-amber-700', 'text-white');
            newBtn.title = `Continuar el proceso creando la etapa de ${nextStage.nombre_etapa}`;
            
            newBtn.onclick = () => {
                const template = state.templates.find(t => t.id === templateId);
                // Abrir modal con herencia del último nodo (lastBatchNode)
                openFormModal('create', template, nextStage, lastBatchNode);
            };
        } else {
            // PROCESO FINALIZADO
            newBtn.innerHTML = `<i class="fas fa-check-circle"></i> <span>Proceso Finalizado</span>`;
            newBtn.classList.remove('bg-green-600', 'hover:bg-green-700', 'bg-amber-600', 'hover:bg-amber-700');
            newBtn.classList.add('bg-stone-400', 'cursor-default');
            newBtn.onclick = null; 
        }
    }

    function renderTimeline(rootBatch) {
        if (!batchTimeline) return;
        batchTimeline.innerHTML = '';
        const template = state.templates.find(t => t.id === rootBatch.plantilla_id);
        
        let flatList = [];
        const traverse = (node) => {
            flatList.push(node);
            if (node.children) node.children.forEach(traverse);
        };
        traverse(rootBatch);
        
        flatList.forEach(batch => {
            const stages = state.stagesByTemplate[template.id];
            const stage = stages.find(s => s.id === batch.etapa_id);
            const parent = flatList.find(b => b.id === batch.parent_id);
            
            const card = createBatchCard(batch, template, stage, parent);
            
            const wrapper = document.createElement('div');
            wrapper.className = 'relative pl-8 border-l-2 border-stone-200 pb-8 last:border-0 last:pb-0';
            const dot = document.createElement('div');
            dot.className = `absolute -left-[9px] top-6 w-5 h-5 rounded-full border-4 border-white ${batch.is_locked ? 'bg-green-500' : 'bg-amber-500'} shadow-sm`;
            
            wrapper.appendChild(dot);
            wrapper.appendChild(card);
            batchTimeline.appendChild(wrapper);
        });
    }

    // --- CREACIÓN DE TARJETAS DE LOTE (Timeline Item) ---
    function createBatchCard(batchData, template, stage, parentBatch = null) {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md border border-stone-200 overflow-hidden';
        
        const nextStage = state.stagesByTemplate[template.id]?.find(s => s.orden === stage.orden + 1);
        const isLocked = batchData.is_locked;
        
        // **REGLA DE INMUTABILIDAD:** // Si el lote no tiene padre, es un lote de ACOPIO.
        // Los lotes de Acopio NO se pueden editar/borrar/finalizar desde Producción, 
        // solo se usan como insumo (solo lectura).
        const isAcopioBatch = !batchData.parent_id;

        const processData = batchData.data || batchData;
        const variables = stage.campos_json.variables || [];
        const imageUrlField = variables.find(v => v.type === 'image');
        const imageUrl = imageUrlField ? (processData[imageUrlField.name]?.value || processData[imageUrlField.name]) : null;

        const getFieldValue = (data, fieldName) => {
            if (!data || !fieldName) return null;
            const field = data[fieldName];
            if (typeof field === 'object' && field !== null && field.hasOwnProperty('value')) return field.value;
            return field;
        };

        const fecha = getFieldValue(processData, 'fecha') || 'Sin fecha';
        
        let productBadge = '';
        if (batchData.producto_id) {
            const product = state.products.find(p => p.id === batchData.producto_id);
            if(product) productBadge = `<span class="bg-indigo-100 text-indigo-800 text-xs font-bold px-2 py-1 rounded border border-indigo-200"><i class="fas fa-tag"></i> ${product.nombre}</span>`;
        }

        // --- BOTONES DE ACCIÓN ---
        let actionButtons = '';
        
        const btnVer = `<button class="p-2 text-stone-500 hover:text-stone-800 transition public-link-btn" title="Ver Trazabilidad"><i class="fas fa-globe"></i></button>`;
        const btnQR = `<button class="p-2 text-stone-500 hover:text-stone-800 transition qr-btn" title="QR"><i class="fas fa-qrcode"></i></button>`;
        const btnPDF = `<button class="p-2 text-stone-500 hover:text-blue-600 transition pdf-btn" title="PDF"><i class="fas fa-file-pdf"></i></button>`;

        if (isLocked) {
             const hashShort = batchData.blockchain_hash ? batchData.blockchain_hash.substring(0, 8) + '...' : '...';
             actionButtons = `
                <div class="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-3 py-1 rounded text-xs font-bold">
                    <i class="fas fa-lock"></i> ${hashShort}
                </div>
                ${btnQR} ${btnPDF}
             `;
        } else if (isAcopioBatch) {
             // Lote de Acopio (Solo Lectura en este módulo)
             actionButtons = `
                <div class="flex items-center gap-2 bg-stone-100 border border-stone-200 text-stone-500 px-3 py-1 rounded text-xs font-bold" title="Gestionar en módulo Acopio">
                    <i class="fas fa-truck-loading"></i> Origen (Inmutable)
                </div>
                ${btnQR}
             `;
        } else {
             // Lote de Producción (Editable)
             actionButtons = `
                ${btnQR}
                <button class="p-2 text-stone-500 hover:text-amber-600 transition edit-btn" title="Editar"><i class="fas fa-pen"></i></button>
                <button class="p-2 text-stone-500 hover:text-red-600 transition delete-btn" title="Eliminar"><i class="fas fa-trash"></i></button>
             `;
        }

        // Botón "Continuar" dentro de la tarjeta (Opcional, ya está el header principal)
        let continueBtn = '';
        if (nextStage && !isLocked) {
             // Permitimos continuar desde cualquier punto (Ramificación)
             continueBtn = `
            <div class="mt-4 pt-3 border-t border-stone-100">
                <button class="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 add-sub-btn">
                    <i class="fas fa-code-branch"></i> Crear Rama: ${nextStage.nombre_etapa}
                </button>
            </div>`;
        } else if (!isLocked && !isAcopioBatch) {
             // Botón Finalizar (Solo para lotes de producción)
             continueBtn = `
            <div class="mt-4 pt-3 border-t border-stone-100">
                <button class="w-full py-2 bg-stone-800 hover:bg-black text-white rounded-lg font-bold text-sm shadow-sm transition flex items-center justify-center gap-2 finalize-btn">
                    <i class="fas fa-lock"></i> Generar Hash y Bloquear Lote
                </button>
            </div>`;
        }

        const variableList = variables.filter(v => v.type !== 'image').slice(0, 4).map(v => 
            `<div class="flex justify-between text-sm border-b border-stone-50 py-1 last:border-0">
                <span class="text-stone-500">${v.label}</span>
                <span class="font-medium text-stone-800">${getFieldValue(processData, v.name) || '-'}</span>
            </div>`
        ).join('');

        card.innerHTML = `
            <div class="p-5">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h4 class="font-bold text-lg text-amber-900">${stage.nombre_etapa}</h4>
                        <div class="flex gap-2 items-center mt-1">
                            <span class="text-xs text-stone-400"><i class="far fa-calendar"></i> ${fecha}</span>
                            ${productBadge}
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        ${actionButtons}
                    </div>
                </div>
                
                <div class="flex gap-4">
                    ${imageUrl ? `<img src="${imageUrl}" class="w-20 h-20 object-cover rounded-lg border border-stone-200 bg-stone-50 flex-shrink-0">` : ''}
                    <div class="flex-grow space-y-1">
                        ${variableList}
                    </div>
                </div>
                ${continueBtn}
            </div>
        `;
        
        // Listeners
        const editBtn = card.querySelector('.edit-btn');
        if(editBtn) editBtn.addEventListener('click', () => openFormModal('edit', template, stage, parentBatch, batchData));
        
        const delBtn = card.querySelector('.delete-btn');
        if(delBtn) delBtn.addEventListener('click', () => handleDelete(batchData.id));
        
        const subBtn = card.querySelector('.add-sub-btn');
        if(subBtn) subBtn.addEventListener('click', () => openFormModal('create', template, nextStage, batchData, {}, batchData.producto_id));
        
        const finBtn = card.querySelector('.finalize-btn');
        if(finBtn) finBtn.addEventListener('click', () => handleFinalize(batchData.id));

        const publicLinkBtn = card.querySelector('.public-link-btn');
        if(publicLinkBtn) publicLinkBtn.addEventListener('click', () => window.open(`/${batchData.id}`, '_blank'));

        const qrBtn = card.querySelector('.qr-btn');
        if(qrBtn) qrBtn.addEventListener('click', () => downloadQR(batchData.id));
        
        const pdfBtn = card.querySelector('.pdf-btn');
        if(pdfBtn) pdfBtn.addEventListener('click', () => generateQualityReport(batchData));

        return card;
    }

    // --- ACCIONES ---
    async function handleDelete(batchId) {
        if (confirm('¿Eliminar este lote de producción?')) {
            try {
                await api(`/api/batches/${batchId}`, { method: 'DELETE' });
                await loadBatches();
                if(state.activeRootBatch) openWorkstation(state.batches.find(b => b.id === state.activeRootBatch.id));
            } catch (error) { alert('Error: ' + error.message); }
        }
    }

    async function handleFinalize(batchId) {
        if (confirm('⚠️ ¿Generar Hash Inmutable y Bloquear?')) {
            try {
                await api(`/api/batches/${batchId}/finalize`, { method: 'POST' });
                await loadBatches();
                if(state.activeRootBatch) openWorkstation(state.batches.find(b => b.id === state.activeRootBatch.id));
                alert("✅ Certificado Exitosamente.");
            } catch (error) { alert("Error: " + error.message); }
        }
    }

    // --- FORMULARIO Y UTILS ---
    async function openFormModal(mode, template, stage, parentBatch = null, batchData = {}, preselectedProductId = null) {
        let currentProductId = preselectedProductId;
        if (mode === 'edit' && batchData.producto_id) { currentProductId = batchData.producto_id; } 
        else if (mode === 'create' && parentBatch && parentBatch.producto_id && !currentProductId) { currentProductId = parentBatch.producto_id; }

        const formHtml = await generateFormHTML(mode, template, stage, parentBatch, batchData.data);
        const productOptions = state.products.length > 0 ? '<option value="">-- Sin vincular --</option>' + state.products.map(p => `<option value="${p.id}" ${p.id === currentProductId ? 'selected' : ''}>${p.nombre} (${p.tipo_producto})</option>`).join('') : '<option value="">No hay productos registrados</option>';
        const productSelectorHtml = `<div class="mb-4 p-4 bg-indigo-50 border border-indigo-100 rounded-xl"><label class="block text-sm font-bold text-indigo-900 mb-1"><i class="fas fa-tag mr-1"></i> Asignar Producto (SKU)</label><select id="stage-product-selector" class="w-full p-2 border border-indigo-200 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none">${productOptions}</select><p class="text-xs text-indigo-800/70 mt-1">Vincula este lote a un producto de tu catálogo.</p></div>`;

        modalContent.innerHTML = formHtml;
        const formElement = modalContent.querySelector('form');
        formElement.insertAdjacentHTML('afterbegin', productSelectorHtml);
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

        const toggleBtn = document.getElementById('toggle-fields-btn');
        if (toggleBtn) {
             toggleBtn.addEventListener('click', () => {
                const container = document.getElementById('hidden-fields-container');
                const icon = document.getElementById('toggle-fields-icon');
                const text = document.getElementById('toggle-fields-text');
                const isHidden = container.classList.contains('hidden');
                if (isHidden) { container.classList.remove('hidden'); icon.classList.add('rotate-180'); text.textContent = 'Ocultar campos opcionales'; } else { container.classList.add('hidden'); icon.classList.remove('rotate-180'); text.textContent = 'Mostrar más campos'; }
            });
        }
        
        formElement.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = formElement.querySelector('button[type="submit"]');
            submitBtn.disabled = true; submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
            const formData = new FormData(formElement);
            const rawData = Object.fromEntries(formData.entries());
            const newData = {};
            for (const key in rawData) {
                if (!key.startsWith('visible_') && key !== 'stage-product-selector') {
                    newData[key] = { value: rawData[key], visible: formData.has(`visible_${key}`), nombre: rawData[key] };
                }
            }
            const selectedProdId = document.getElementById('stage-product-selector').value;
            try {
                if (mode === 'create') {
                    await api('/api/batches', { method: 'POST', body: JSON.stringify({ plantilla_id: template.id, etapa_id: stage.id, parent_id: parentBatch ? parentBatch.id : null, data: newData, producto_id: selectedProdId }) });
                } else {
                    newData.id = batchData.id;
                    await api(`/api/batches/${batchData.id}`, { method: 'PUT', body: JSON.stringify({ data: newData, producto_id: selectedProdId }) });
                }
                formModal.close();
                await loadBatches(); 
                if (state.activeRootBatch) { const freshRoot = state.batches.find(b => b.id === state.activeRootBatch.id); if(freshRoot) openWorkstation(freshRoot); }
            } catch (error) { alert('Error: ' + error.message); submitBtn.disabled = false; submitBtn.innerText = 'Guardar'; }
        });
        document.getElementById('cancel-btn').addEventListener('click', () => formModal.close());
    }

    async function generateFormHTML(mode, template, stage, parentBatch, data = {}) {
        let formFields = '';
        if (mode === 'edit') formFields += `<div><label class="block text-sm font-medium text-stone-700">ID Lote</label><p class="w-full p-3 bg-stone-100 rounded-xl font-mono text-sm">${(data.id?.value || data.id)}</p></div>`;
        const allFields = [...(stage.campos_json.entradas || []), ...(stage.campos_json.salidas || []), ...(stage.campos_json.variables || [])];
        let visibleHtml = ''; let hiddenHtml = '';
        for (const field of allFields) {
            if (field.type === 'selectProduct') continue; 
            let fieldDataToUse = data[field.name];
            if (mode === 'create' && !fieldDataToUse) {
                if (parentBatch && parentBatch.data && parentBatch.data[field.name]) fieldDataToUse = parentBatch.data[field.name];
                if (field.type === 'date') fieldDataToUse = { value: new Date().toISOString().split('T')[0], visible: true };
            }
            const html = await createFieldHTML(field, fieldDataToUse, template);
            if (field.popup === true) visibleHtml += html; else hiddenHtml += html;
        }
        formFields += visibleHtml;
        if (hiddenHtml) formFields += `<div class="mt-4 pt-4 border-t border-stone-100"><button type="button" id="toggle-fields-btn" class="flex items-center gap-2 text-sm font-bold text-amber-800 hover:text-amber-900 transition-colors focus:outline-none"><i class="fas fa-chevron-down transition-transform duration-300" id="toggle-fields-icon"></i><span id="toggle-fields-text">Mostrar más campos</span></button><div id="hidden-fields-container" class="hidden mt-4 space-y-4 border-l-2 border-stone-200 pl-4">${hiddenHtml}</div></div>`;
        return `<form id="batch-form"><h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">${mode === 'create' ? 'Crear' : 'Editar'} ${stage.nombre_etapa}</h2><div class="space-y-4 max-h-[60vh] overflow-y-auto p-1 custom-scrollbar">${formFields}</div><div class="flex justify-end gap-4 mt-6"><button type="button" id="cancel-btn" class="bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl transition-colors">Cancelar</button><button type="submit" class="bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 px-6 rounded-xl transition-colors shadow-md">Guardar</button></div></form>`;
    }

    async function createFieldHTML(field, fieldData, template) {
        const { label, name, type, options } = field;
        const value = (typeof fieldData === 'object' && fieldData !== null) ? fieldData.value : fieldData;
        const isVisible = (typeof fieldData === 'object' && fieldData !== null) ? fieldData.visible : true;
        const checkedAttr = isVisible ? 'checked' : '';
        let tipoProducto = 'otro';
        if(template) {
            const tName = template.nombre_producto.toLowerCase();
            if (tName.includes('cacao') || tName.includes('chocolate')) tipoProducto = 'cacao';
            else if (tName.includes('cafe') || tName.includes('café')) tipoProducto = 'cafe';
            else if (tName.includes('miel')) tipoProducto = 'miel';
        }

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
            default: inputHtml = createInputHTML(name, 'text', value);
        }
        return `<div><label for="${name}" class="block text-sm font-medium text-stone-700 mb-1">${label}</label><div class="flex items-center gap-3"><div class="flex-grow">${inputHtml}</div><div class="flex items-center space-x-2" title="Controla la visibilidad de este campo en la página pública"><input type="checkbox" id="visible_${name}" name="visible_${name}" ${checkedAttr} class="h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"><label for="visible_${name}" class="text-xs text-stone-500">Visible</label></div></div></div>`;
    }

    function createInputHTML(name, type, value) { return `<input type="${type}" id="${name}" name="${name}" value="${value||''}" class="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" step="0.01">`; }
    function createSelectHTML(name, options, selectedValue) { const opts = options.map(opt => `<option value="${opt}" ${opt === selectedValue ? 'selected':''}>${opt}</option>`).join(''); return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none"><option value="">Seleccionar...</option>${opts}</select>`; }
    function createTextAreaHTML(name, value) { return `<textarea id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none" rows="3">${value || ''}</textarea>`; }
    function createImageInputHTML(name, value) { return `<div class="pt-4 border-t"><div class="mt-1 flex items-center gap-4"><img src="${value||'https://placehold.co/100x100/e7e5e4/a8a29e?text=Foto'}" alt="Previsualización" class="h-24 w-24 rounded-lg object-cover bg-stone-100 border border-stone-200"><div class="w-full"><input type="file" class="image-upload-input block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" accept="image/*"><input type="hidden" name="${name}" value="${value||''}"><p class="text-xs text-stone-500 mt-2">Sube una imagen.</p></div></div></div>`; }
    async function createFincaSelectHTML(name, selectedValue) { try { const fincas = state.fincas.length > 0 ? state.fincas : await api('/api/fincas'); if (fincas.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay fincas. <a href="/app/fincas" class="text-sky-600 hover:underline">Registra una aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`; return createSelectHTML(name, fincas.map(f => f.nombre_finca), selectedValue); } catch (error) { return `<div class="text-red-500">Error al cargar fincas.</div>`; } }
    async function createProcesadoraSelectHTML(name, selectedValue) { try { const procesadoras = await api('/api/procesadoras'); if (procesadoras.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay procesadoras. <a href="/app/procesadoras" class="text-sky-600 hover:underline">Registra una aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`; return createSelectHTML(name, procesadoras.map(p => p.nombre_comercial || p.razon_social), selectedValue); } catch (error) { return `<div class="text-red-500">Error al cargar procesadoras.</div>`; } }
    async function createPerfilSelectHTML(name, selectedValue, tipoProducto) { try { const perfiles = await api('/api/perfiles'); const perfilesFiltradas = perfiles.filter(r => r.tipo === tipoProducto); return createSelectHTML(name, perfilesFiltradas.map(p => p.nombre), selectedValue); } catch (error) { return `<div class="text-red-500">Error al cargar perfiles.</div>`; } }
    async function createRuedaSaborSelectHTML(name, selectedValue, tipoProducto) { if (!state.ruedasSabor || state.ruedasSabor.length === 0) { await loadRuedasSabor(); } try { const ruedasFiltradas = state.ruedasSabor.filter(r => r.tipo === tipoProducto); if (ruedasFiltradas.length === 0) return `<div><div class="p-3 border rounded-xl bg-stone-50 text-stone-500 text-sm">No hay ruedas de sabor. <a href="/app/ruedas-sabores" class="text-sky-600 hover:underline">Crea una aquí</a>.</div><input type="hidden" name="${name}" value=""></div>`; const options = ruedasFiltradas.map(r => `<option value="${r.id}" ${r.id == selectedValue ? 'selected' : ''}>${r.nombre_rueda}</option>`).join(''); return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-amber-500 outline-none"><option value="">Seleccionar rueda...</option>${options}</select>`; } catch (error) { return `<div class="text-red-500">Error al cargar ruedas de sabor.</div>`; } }
    async function createLugarProcesoSelectHTML(name, selectedValue) { try { const fincas = state.fincas.length ? state.fincas : await api('/api/fincas'); const procesadoras = await api('/api/procesadoras'); let optionsHTML = '<option value="">Seleccionar lugar...</option>'; if(fincas.length > 0) optionsHTML += `<optgroup label="Fincas">${fincas.map(f => `<option value="${f.nombre_finca}" ${`${f.nombre_finca}` === selectedValue ? 'selected' : ''}>${f.nombre_finca}</option>`).join('')}</optgroup>`; if(procesadoras.length > 0) optionsHTML += `<optgroup label="Procesadoras">${procesadoras.map(p => `<option value="Procesadora: ${p.nombre_comercial || p.razon_social}" ${`Procesadora: ${p.nombre_comercial || p.razon_social}` === selectedValue ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('')}</optgroup>`; return `<select id="${name}" name="${name}" class="w-full p-3 border border-stone-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none">${optionsHTML}</select>`; } catch (error) { return `<div class="text-red-500">Error al cargar lugares.</div>`; } }
    function getTemplateColor(templateId, isLight = false) { const colors = [{ main: '#78350f', light: '#fed7aa' }, { main: '#166534', light: '#dcfce7' }, { main: '#991b1b', light: '#fee2e2' }, { main: '#1d4ed8', light: '#dbeafe' }, { main: '#86198f', light: '#fae8ff' }]; let index = 0; if (typeof templateId === 'number') { index = templateId; } else { index = templateId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0); } const color = colors[index % colors.length]; return isLight ? color.light : color.main; }
    function downloadQR(id) { const url = `${window.location.origin}/${id}`; const qr = qrcode(0, 'L'); qr.addData(url); qr.make(); const link = document.createElement('a'); link.href = qr.createDataURL(4, 2); link.download = `QR_${id}.png`; link.click(); }
    async function api(url, options = {}) { options.credentials = 'include'; options.headers = { ...options.headers, 'Content-Type': 'application/json' }; const res = await fetch(url, options); if(!res.ok) { const errorData = await res.json().catch(() => ({})); throw new Error(errorData.error || `Error HTTP ${res.status}`); } return res.json(); }
    async function generateQualityReport(batchNode) { /* ... lógica PDF igual ... */ }

});