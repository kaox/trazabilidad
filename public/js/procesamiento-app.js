document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        acquisitions: [], // Materia prima
        batches: [],      // Procesos (Árbol)
        templates: [],    // Plantillas del SISTEMA (JSON)
        userTemplates: [], 
        stagesByTemplate: {},
        acopioConfig: [],
        fincas: [],
        procesadoras: [],
        products: [], 
        perfilesSensoriales: [], 
        ruedasSabor: [],         
        
        // UI State
        currentView: 'acopios', 
        filterProduct: 'all',   
        filterStatus: 'active', 
        
        // Contexto de Trabajo
        activeRootBatch: null,
        currentAcopio: null,
        currentSystemTemplate: null,
        nextStage: null, 
        extraFields: []
    };

    let imagesMap = {}; 

    // DOM Elements
    const viewAcopios = document.getElementById('view-acopios');
    const viewProcesos = document.getElementById('view-procesos');
    const acopiosList = document.getElementById('acopios-list');
    const procesosGrid = document.getElementById('procesos-grid');
    const filtersContainer = document.getElementById('filters-container');
    const viewTabs = document.querySelectorAll('.view-tab');
    
    // Modal
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');

    // Contenedor dinámico Workstation
    let viewWorkstation = null;

    init();

    async function init() {
        try {
            await Promise.all([
                loadConfig(),
                loadSystemTemplates(),
                loadUserTemplates(),
                loadData(), 
                loadFincas(),
                loadProcesadoras(),
                loadProducts(),
                loadPerfilesSensoriales(), 
                loadRuedasSabor()          
            ]);
            
            createWorkstationView(); 
            setupEventListeners();
            
            const hash = window.location.hash.substring(1);
            if (hash) {
                if (!hash.startsWith('acopio=')) {
                    const targetBatch = state.batches.find(b => b.id === hash);
                    if (targetBatch) openWorkstation(targetBatch);
                }
            }
            updateView();
            
        } catch (e) {
            console.error("Error init:", e);
        }
    }

    // --- CARGA DE DATOS ---
    async function loadConfig() {
        const res = await fetch('/data/acopio_config.json');
        const data = await res.json();
        state.acopioConfig = data.acopios;
    }
    async function loadSystemTemplates() { state.templates = await api('/api/templates/system'); }
    
    async function loadUserTemplates() { 
        try { 
            state.userTemplates = await api('/api/templates'); 
            for (const t of state.userTemplates) {
                try {
                    state.stagesByTemplate[t.id] = await api(`/api/templates/${t.id}/stages`);
                } catch (errStage) {
                    console.warn(`Error etapas plantilla ${t.id}`, errStage);
                    state.stagesByTemplate[t.id] = [];
                }
            }
        } catch(e) { state.userTemplates = []; } 
    }

    async function loadFincas() { try { state.fincas = await api('/api/fincas'); } catch(e){ state.fincas = []; } }
    async function loadProcesadoras() { try { state.procesadoras = await api('/api/procesadoras'); } catch(e){ state.procesadoras = []; } }
    async function loadProducts() { try { state.products = await api('/api/productos'); } catch(e){ state.products = []; } }
    async function loadPerfilesSensoriales() { try { state.perfilesSensoriales = await api('/api/perfiles'); } catch(e){ state.perfilesSensoriales = []; } }
    async function loadRuedasSabor() { try { state.ruedasSabor = await api('/api/ruedas-sabores'); } catch(e){ state.ruedasSabor = []; } }

    async function loadData() {
        const [acq, batchTree] = await Promise.all([
            api('/api/acquisitions'),
            api('/api/batches/tree')
        ]);
        state.acquisitions = acq || []; 
        state.batches = batchTree || [];
    }

    async function loadBatches() {
        try {
            state.batches = await api('/api/batches/tree');
        } catch (e) {
            console.error("Error cargando lotes:", e);
        }
    }

    async function refreshData() {
        await Promise.all([loadUserTemplates(), loadData()]);
        if (state.currentView === 'workstation' && state.activeRootBatch) {
            const freshRoot = state.batches.find(b => b.id === state.activeRootBatch.id);
            if (freshRoot) openWorkstation(freshRoot);
            else { state.currentView = 'procesos'; updateView(); }
        } else {
            updateView(); 
        }
    }

    // --- GESTIÓN DE VISTAS ---
    function createWorkstationView() {
        const mainContainer = document.getElementById('main-app-container'); 
        
        if (!mainContainer) {
            console.error("No se encontró el contenedor principal 'main-app-container'");
            return;
        }

        viewWorkstation = document.createElement('div');
        viewWorkstation.id = 'view-workstation';
        viewWorkstation.className = 'view-section hidden fade-in';
        viewWorkstation.innerHTML = `
            <div class="mb-4">
                <button id="btn-back-main" class="text-stone-500 hover:text-stone-800 font-bold flex items-center gap-2 mb-4">
                    <i class="fas fa-arrow-left"></i> Volver a la lista
                </button>
                <div id="workstation-header" class="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 mb-6"></div>
                <div id="workstation-timeline" class="space-y-6 pl-4 md:pl-8 border-l-2 border-stone-200 ml-4 md:ml-6"></div>
            </div>
        `;
        mainContainer.appendChild(viewWorkstation);
        
        document.getElementById('btn-back-main').addEventListener('click', () => {
            state.currentView = 'procesos';
            history.pushState("", document.title, window.location.pathname + window.location.search);
            updateView();
        });
    }

    function setupEventListeners() {
        viewTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                viewTabs.forEach(t => {
                    t.classList.remove('bg-white', 'text-stone-800', 'shadow-sm');
                    t.classList.add('text-stone-500', 'hover:text-stone-700');
                });
                tab.classList.add('bg-white', 'text-stone-800', 'shadow-sm');
                tab.classList.remove('text-stone-500', 'hover:text-stone-700');

                state.currentView = tab.dataset.view;
                updateView();
            });
        });
    }

    function updateView() {
        renderFilters();
        
        viewAcopios.classList.add('hidden');
        viewProcesos.classList.add('hidden');
        if(viewWorkstation) viewWorkstation.classList.add('hidden');
        filtersContainer.classList.remove('hidden');

        if (state.currentView === 'acopios') {
            viewAcopios.classList.remove('hidden');
            renderAcopiosView();
        } else if (state.currentView === 'procesos') {
            viewProcesos.classList.remove('hidden');
            renderProcesosView();
        } else if (state.currentView === 'workstation') {
            viewWorkstation.classList.remove('hidden');
            filtersContainer.classList.add('hidden'); 
        }
    }

    function renderFilters() {
        filtersContainer.innerHTML = '';
        if (state.currentView === 'acopios') {
            ['all', 'Cacao', 'Café'].forEach(f => {
                const isActive = state.filterProduct === f;
                const btn = document.createElement('button');
                btn.className = `px-4 py-1.5 rounded-full text-sm font-medium border transition ${isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`;
                btn.innerText = f === 'all' ? 'Todos' : f;
                btn.onclick = () => { state.filterProduct = f; renderAcopiosView(); }; 
                filtersContainer.appendChild(btn);
            });
        } else if (state.currentView === 'procesos') {
            const filters = [{ id: 'active', label: 'En Curso' }, { id: 'finished', label: 'Finalizados' }, { id: 'all', label: 'Todos' }];
            filters.forEach(f => {
                const isActive = state.filterStatus === f.id;
                const btn = document.createElement('button');
                btn.className = `px-4 py-1.5 rounded-full text-sm font-medium border transition ${isActive ? 'bg-stone-800 text-white border-stone-800' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`;
                btn.innerText = f.label;
                btn.onclick = () => { state.filterStatus = f.id; renderProcesosView(); };
                filtersContainer.appendChild(btn);
            });
        }
    }

    // --- VISTA 1: ACOPIOS ---
    function renderAcopiosView() {
        acopiosList.innerHTML = '';
        let filtered = state.acquisitions;
        if (state.filterProduct !== 'all') {
            filtered = filtered.filter(a => a.nombre_producto.includes(state.filterProduct));
        }

        if (filtered.length === 0) {
            acopiosList.innerHTML = `<div class="text-center py-12 bg-white rounded-xl border border-dashed border-stone-300 text-stone-400">No hay lotes de acopio que coincidan.</div>`;
            return;
        }

        filtered.forEach(acop => {
            const childBatches = state.batches.filter(b => String(b.acquisition_id) === String(acop.id));
            const hasChildren = childBatches.length > 0;
            
            const card = document.createElement('div');
            card.className = "bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden transition-all duration-300 mb-4";
            
            let iconClass = 'fa-box';
            let colorClass = 'text-stone-700 bg-stone-100';
            if (acop.nombre_producto.includes('Cacao')) { iconClass = 'fa-cookie-bite'; colorClass = 'text-amber-800 bg-amber-50'; }
            if (acop.nombre_producto.includes('Café')) { iconClass = 'fa-mug-hot'; colorClass = 'text-red-800 bg-red-50'; }

            const fecha = new Date(acop.fecha_acopio).toLocaleDateString();
            const tipoLabel = acop.subtipo ? `${acop.tipo_acopio} (${acop.subtipo})` : acop.tipo_acopio;

            let childrenHtml = '';
            if (hasChildren) {
                childrenHtml = childBatches.map(b => {
                    const analysis = analyzeBatchChain(b);
                    return `
                    <div class="flex justify-between items-center bg-stone-50 p-2 rounded border border-stone-100 text-sm mb-1">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-code-branch text-stone-400"></i>
                            <div>
                                <span class="font-bold text-stone-700">${analysis.lastStageName}</span>
                                <span class="text-xs text-stone-400 ml-1">#${b.id.substring(0,8)}</span>
                            </div>
                        </div>
                        <div class="flex items-center gap-2">
                            <span class="text-xs font-bold text-stone-600">${analysis.lastWeight} kg</span>
                            <button class="text-blue-600 hover:text-blue-800 font-bold bg-blue-50 px-2 py-1 rounded text-xs view-process-btn" data-id="${b.id}">
                                Gestionar <i class="fas fa-arrow-right"></i>
                            </button>
                        </div>
                    </div>`;
                }).join('');
            } else {
                childrenHtml = `<p class="text-xs text-stone-400 italic pl-2">Sin procesos iniciados.</p>`;
            }

            card.innerHTML = `
                <div class="p-5 cursor-pointer hover:bg-stone-50 transition acopio-header" data-id="${acop.id}">
                    <div class="flex justify-between items-center">
                        <div class="flex items-center gap-4">
                            <div class="w-12 h-12 rounded-full flex items-center justify-center text-xl ${colorClass}"><i class="fas ${iconClass}"></i></div>
                            <div>
                                <h3 class="font-bold text-lg text-stone-800">${acop.nombre_producto} - ${tipoLabel}</h3>
                                <p class="text-xs text-stone-500 font-medium">ID: <span class="font-mono">${acop.id}</span> • ${fecha}</p>
                            </div>
                        </div>
                        <div class="text-right">
                            <p class="text-xl font-display font-bold text-stone-900">${acop.peso_kg} <span class="text-sm font-sans text-stone-500 font-normal">kg</span></p>
                            <span class="text-xs font-bold ${hasChildren ? 'text-green-600' : 'text-amber-600'}">
                                ${hasChildren ? `${childBatches.length} Proceso(s)` : 'Disponible'}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div id="children-${acop.id}" class="hidden border-t border-stone-100 bg-stone-50/50 p-4">
                    <div class="flex justify-between items-center mb-3">
                        <h4 class="text-xs font-bold text-stone-500 uppercase tracking-widest">Procesos Derivados</h4>
                        <button class="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 new-process-btn">
                            <i class="fas fa-plus"></i> Iniciar Nuevo Proceso
                        </button>
                    </div>
                    <div class="space-y-1 children-list">
                        ${childrenHtml}
                    </div>
                </div>
            `;

            const header = card.querySelector('.acopio-header');
            const panel = card.querySelector(`#children-${acop.id}`);
            const newProcBtn = card.querySelector('.new-process-btn');

            header.addEventListener('click', (e) => {
                if (e.target.closest('button')) return; 
                panel.classList.toggle('hidden');
                header.classList.toggle('bg-stone-100');
            });

            newProcBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                prepareProcessing(acop);
            });
            
            card.querySelectorAll('.view-process-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const batchId = e.target.dataset.id;
                    const batch = state.batches.find(b => b.id === batchId);
                    if(batch) openWorkstation(batch);
                });
            });

            acopiosList.appendChild(card);
        });
    }

    // --- VISTA 2: PROCESOS ---
    function renderProcesosView() {
        procesosGrid.innerHTML = '';
        const roots = state.batches.filter(b => !b.parent_id);
        
        const filtered = roots.filter(batch => {
            const analysis = analyzeBatchChain(batch);
            const isFinished = analysis.lastNode.is_locked;
            if (state.filterStatus === 'active' && isFinished) return false;
            if (state.filterStatus === 'finished' && !isFinished) return false;
            return true;
        });

        if (filtered.length === 0) {
            procesosGrid.innerHTML = `<div class="col-span-full text-center py-12 text-stone-400 italic">No hay procesos en esta categoría.</div>`;
            return;
        }

        filtered.reverse().forEach(root => {
            const analysis = analyzeBatchChain(root);
            const startDate = new Date(root.created_at).toLocaleDateString();
            
            const card = document.createElement('div');
            card.className = "bg-white rounded-xl shadow-sm border border-stone-200 hover:shadow-md transition p-5 flex flex-col";
            card.innerHTML = `
                <div class="flex justify-between items-start mb-3">
                    <span class="text-xs font-bold uppercase tracking-wider text-white px-2 py-1 rounded-full bg-stone-600">
                        ${analysis.productName}
                    </span>
                    <span class="text-xs text-stone-400 font-mono">${root.id}</span>
                </div>
                
                <div class="flex-grow mb-4">
                    <h3 class="text-lg font-bold text-stone-800 mb-1">${analysis.lastStageName}</h3>
                    <p class="text-xs text-stone-500 flex items-center gap-1">
                        <i class="fas fa-map-marker-alt"></i> ${analysis.finca}
                    </p>
                    <p class="text-xs text-stone-400 mt-1">Iniciado: ${startDate}</p>
                </div>

                <div class="pt-3 border-t border-stone-100 flex justify-between items-center">
                    <span class="text-sm font-bold text-stone-700">${analysis.lastWeight} kg</span>
                    <button class="manage-btn text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        Gestionar <i class="fas fa-arrow-right text-xs"></i>
                    </button>
                </div>
            `;
            
            card.querySelector('.manage-btn').addEventListener('click', () => openWorkstation(root));
            procesosGrid.appendChild(card);
        });
    }

    // --- LOGIC HELPERS ---
    function analyzeBatchChain(rootBatch) {
        let lastNode = rootBatch;
        const findLast = (node) => {
            if (node.children && node.children.length > 0) {
                const child = node.children[node.children.length - 1]; 
                lastNode = child;
                findLast(child);
            }
        };
        findLast(rootBatch);

        const tmpl = state.userTemplates.find(t => t.id === rootBatch.plantilla_id);
        const stageList = state.stagesByTemplate[rootBatch.plantilla_id] || []; 
        
        let stageName = 'Procesamiento';
        if (stageList.length > 0) {
            const stageObj = stageList.find(s => s.id === lastNode.etapa_id);
            if (stageObj) stageName = stageObj.nombre_etapa;
        }

        const d = lastNode.data || {};
        let weight = 0;
        const outputKeys = Object.keys(d).filter(k => k.toLowerCase().includes('salida') || k.toLowerCase().includes('peso') || k.toLowerCase().includes('unidades'));
        if(outputKeys.length > 0) weight = parseFloat(d[outputKeys[0]]?.value || 0);

        const finca = rootBatch.data.finca?.value || rootBatch.data.lugarProceso?.value || 'N/A';

        return {
            lastNode,
            lastStageName: stageName,
            productName: tmpl ? tmpl.nombre_producto : 'Producto',
            finca: finca,
            lastWeight: isNaN(weight) ? 0 : weight.toFixed(2),
            is_locked: lastNode.is_locked
        };
    }

    // --- VISTA 3: WORKSTATION (DETALLE) ---
    function openWorkstation(rootBatch) {
        state.activeRootBatch = rootBatch;
        state.currentView = 'workstation';
        updateView(); 

        const analysis = analyzeBatchChain(rootBatch);
        const header = document.getElementById('workstation-header');
        
        // Recuperar configuraciones guardadas en el rootBatch (data)
        const currentSkuId = rootBatch.producto_id;
        const currentProfileId = rootBatch.data.target_profile_id?.value; 
        const currentWheelId = rootBatch.data.target_wheel_id?.value;

        // Buscar nombres
        const productObj = state.products.find(p => p.id === currentSkuId);
        const skuName = productObj ? productObj.nombre : 'Sin SKU';
        const gtin = productObj ? productObj.gtin : null;
        const profileName = state.perfilesSensoriales.find(p => p.id == currentProfileId)?.nombre || 'Sin Perfil';
        const wheelName = state.ruedasSabor.find(r => r.id == currentWheelId)?.nombre_rueda || 'Sin Rueda';

        // URL GS1 Digital Link
        // Si hay GTIN, usar formato GS1 /01/GTIN/10/LOTE
        // Si no, usar URL genérica de plataforma
        let publicTraceUrl = `${window.location.origin}/${analysis.lastNode.id}`;
        if (gtin) {
            publicTraceUrl = `${window.location.origin}/01/${gtin}/10/${analysis.lastNode.id}`;
        }

        // --- ENCABEZADO MEJORADO CON CONFIGURACIÓN Y TRAZABILIDAD ---
        header.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div class="flex-grow">
                    <div class="flex items-center gap-3">
                        <h2 class="text-2xl font-display font-bold text-stone-900">${analysis.productName}</h2>
                        <span class="bg-stone-100 text-stone-600 px-2 py-1 rounded text-xs font-mono font-bold">${rootBatch.id}</span>
                        
                        <!-- BOTÓN CONFIGURAR -->
                        <button id="btn-config-batch" class="text-stone-400 hover:text-amber-600 transition p-1 rounded-full hover:bg-stone-50" title="Configurar Producto y Calidad">
                            <i class="fas fa-cog text-lg"></i>
                        </button>
                        
                        <!-- NUEVOS BOTONES: TRAZABILIDAD Y QR -->
                        <div class="flex items-center gap-1 ml-2 pl-2 border-l border-stone-300">
                            <button id="btn-view-trace" class="text-stone-400 hover:text-blue-600 transition p-1.5 rounded-full hover:bg-blue-50" title="Ver Trazabilidad Pública (GS1)">
                                <i class="fas fa-globe text-lg"></i>
                            </button>
                            <button id="btn-download-qr" class="text-stone-400 hover:text-stone-800 transition p-1.5 rounded-full hover:bg-stone-100" title="Descargar QR">
                                <i class="fas fa-qrcode text-lg"></i>
                            </button>
                        </div>
                    </div>
                    <p class="text-sm text-stone-500 mt-1"><i class="fas fa-map-marker-alt"></i> ${analysis.finca} • Iniciado: ${new Date(rootBatch.created_at).toLocaleDateString()}</p>
                    
                    <!-- BADGES DE CONFIGURACIÓN -->
                    <div class="flex flex-wrap gap-2 mt-3">
                        ${currentSkuId ? `<span class="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded border border-indigo-100 font-medium" title="SKU Vinculado"><i class="fas fa-tag mr-1"></i> ${skuName}</span>` : '<span class="text-xs text-stone-400 border border-stone-200 border-dashed px-2 py-1 rounded">Sin SKU</span>'}
                        
                        ${currentProfileId ? `<span class="text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded border border-purple-100 font-medium" title="Perfil Objetivo"><i class="fas fa-chart-radar mr-1"></i> ${profileName}</span>` : ''}
                        
                        ${currentWheelId ? `<span class="text-xs bg-pink-50 text-pink-700 px-2 py-1 rounded border border-pink-100 font-medium" title="Rueda de Sabor"><i class="fas fa-bullseye mr-1"></i> ${wheelName}</span>` : ''}
                    </div>
                </div>
                <div class="text-right">
                     <p class="text-xs font-bold text-stone-400 uppercase tracking-widest">Peso Actual</p>
                     <p class="text-3xl font-bold text-stone-800">${analysis.lastWeight} kg</p>
                </div>
            </div>
            <div class="mt-6 pt-4 border-t border-stone-100" id="ws-action-container"></div>
        `;
        
        // Listeners Trazabilidad y QR
        document.getElementById('btn-view-trace').addEventListener('click', () => window.open(publicTraceUrl, '_blank'));
        
        document.getElementById('btn-download-qr').addEventListener('click', () => {
            // Verificar si qrcode.js está disponible
            if (typeof qrcode === 'undefined') {
                // Intento de fallback o mensaje si la librería no está en el HTML
                alert("Error: Librería de QR no cargada. Recarga la página.");
                return;
            }
            try {
                console.log(publicTraceUrl);
                const qr = qrcode(0, 'L');
                qr.addData(publicTraceUrl);
                qr.make();
                const link = document.createElement('a');
                link.href = qr.createDataURL(4, 2);
                link.download = `QR_${gtin ? 'GS1_' : ''}${rootBatch.id}.png`;
                link.click();
            } catch (e) {
                console.error("Error generando QR", e);
                alert("Error generando QR.");
            }
        });

        // Listener Configuración
        document.getElementById('btn-config-batch').addEventListener('click', () => openBatchConfigModal(rootBatch));

        configureNextStageButton(analysis.lastNode, rootBatch.plantilla_id);
        renderTimeline(rootBatch);
    }

    // --- NUEVO MODAL: CONFIGURAR LOTE ---
    function openBatchConfigModal(rootBatch) {
        // Filtrar opciones por tipo de producto (Cacao/Cafe)
        const tmpl = state.userTemplates.find(t => t.id === rootBatch.plantilla_id);
        const tipoProd = tmpl ? (tmpl.nombre_producto.toLowerCase().includes('cafe') ? 'cafe' : 'cacao') : 'otro';

        // Filtrar listas
        const filteredProducts = state.products.filter(p => p.tipo_producto.includes(tipoProd));
        const filteredProfiles = state.perfilesSensoriales.filter(p => p.tipo === tipoProd);
        const filteredWheels = state.ruedasSabor.filter(r => r.tipo === tipoProd);

        const currentSkuId = rootBatch.producto_id || "";
        const currentProfileId = rootBatch.data.target_profile_id?.value || "";
        const currentWheelId = rootBatch.data.target_wheel_id?.value || "";

        // Generar HTML para los selects con links si están vacíos
        const productsInput = filteredProducts.length === 0
            ? `<div class="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">No hay productos de ${tipoProd}. <a href="/app/productos" target="_blank" class="underline font-bold">Crear aquí</a></div>`
            : `<select name="producto_id" class="w-full p-2 border rounded-lg text-sm bg-white"><option value="">-- Sin asignar --</option>${filteredProducts.map(p => `<option value="${p.id}" ${p.id === currentSkuId ? 'selected' : ''}>${p.nombre}</option>`).join('')}</select>`;

        const profilesInput = filteredProfiles.length === 0
            ? `<div class="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">No hay perfiles de ${tipoProd}. <a href="/app/perfiles" target="_blank" class="underline font-bold">Crear aquí</a></div>`
            : `<select name="target_profile_id" class="w-full p-2 border rounded-lg text-sm bg-white"><option value="">-- Sin asignar --</option>${filteredProfiles.map(p => `<option value="${p.id}" ${String(p.id) === String(currentProfileId) ? 'selected' : ''}>${p.nombre}</option>`).join('')}</select>`;

        const wheelsInput = filteredWheels.length === 0
            ? `<div class="text-sm text-red-500 bg-red-50 p-2 rounded border border-red-100">No hay ruedas de ${tipoProd}. <a href="/app/ruedas-sabores" target="_blank" class="underline font-bold">Crear aquí</a></div>`
            : `<select name="target_wheel_id" class="w-full p-2 border rounded-lg text-sm bg-white"><option value="">-- Sin asignar --</option>${filteredWheels.map(r => `<option value="${r.id}" ${String(r.id) === String(currentWheelId) ? 'selected' : ''}>${r.nombre_rueda}</option>`).join('')}</select>`;

        modalContent.innerHTML = `
            <h2 class="text-xl font-bold text-stone-800 border-b pb-3 mb-4">Configuración del Proceso</h2>
            <p class="text-sm text-stone-500 mb-4">Define los estándares de calidad y el producto final objetivo para este lote.</p>
            
            <form id="config-batch-form" class="space-y-4">
                <div>
                    <label class="block text-xs font-bold text-stone-600 mb-1 uppercase">Producto Final (SKU)</label>
                    ${productsInput}
                </div>
                <div>
                    <label class="block text-xs font-bold text-stone-600 mb-1 uppercase">Perfil Sensorial Objetivo</label>
                    ${profilesInput}
                </div>
                <div>
                    <label class="block text-xs font-bold text-stone-600 mb-1 uppercase">Rueda de Sabor</label>
                    ${wheelsInput}
                </div>

                <div class="flex justify-end gap-3 mt-6 pt-4 border-t">
                    <button type="button" onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg">Cancelar</button>
                    <button type="submit" class="px-6 py-2 bg-amber-800 text-white font-bold rounded-lg hover:bg-amber-900 shadow-sm">Guardar Cambios</button>
                </div>
            </form>
        `;

        document.getElementById('config-batch-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const productId = formData.get('producto_id');
            const profileId = formData.get('target_profile_id');
            const wheelId = formData.get('target_wheel_id');
            
            // Actualizar datos del lote raíz
            // Necesitamos actualizar 'data' (para perfiles) y 'producto_id' (columna)
            // Preservamos la data existente
            const currentData = rootBatch.data || {};
            
            // Actualizar campos específicos en data
            const newData = { ...currentData };
            if (profileId) newData.target_profile_id = { value: profileId, visible: false, nombre: 'Perfil Objetivo' };
            else delete newData.target_profile_id;
            
            if (wheelId) newData.target_wheel_id = { value: wheelId, visible: false, nombre: 'Rueda Sabor' };
            else delete newData.target_wheel_id;

            try {
                await api(`/api/batches/${rootBatch.id}`, { 
                    method: 'PUT', 
                    body: JSON.stringify({ 
                        data: newData, 
                        producto_id: productId 
                    }) 
                });
                
                formModal.close();
                await loadBatches(); // Recargar para actualizar state
                // Refrescar vista
                const updatedRoot = state.batches.find(b => b.id === rootBatch.id);
                openWorkstation(updatedRoot);
                
            } catch(err) {
                console.error(err);
                alert("Error guardando configuración: " + err.message);
            }
        });

        formModal.showModal();
    }

    function configureNextStageButton(lastBatchNode, templateId) {
        const container = document.getElementById('ws-action-container');
        container.innerHTML = ''; 

        const stages = state.stagesByTemplate[templateId];
        if (!stages) return;

        const currentStage = stages.find(s => s.id === lastBatchNode.etapa_id);
        const nextStage = stages.find(s => s.orden === (currentStage ? currentStage.orden + 1 : 0));

        if (nextStage && !lastBatchNode.is_locked) {
            const btn = document.createElement('button');
            btn.className = "bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition w-full md:w-auto justify-center";
            btn.innerHTML = `<i class="fas fa-play"></i> Iniciar ${nextStage.nombre_etapa}`;
            btn.onclick = () => {
                const template = state.userTemplates.find(t => t.id === templateId);
                openBatchForm('create', template, nextStage, lastBatchNode, {}, lastBatchNode.producto_id);
            };
            container.appendChild(btn);
        } else if (lastBatchNode.is_locked) {
            container.innerHTML = `<div class="bg-green-50 text-green-700 p-3 rounded-lg text-center font-bold border border-green-200"><i class="fas fa-check-circle"></i> Proceso Finalizado / Certificado</div>`;
        } else {
            const btn = document.createElement('button');
            btn.className = "bg-stone-800 hover:bg-black text-white font-bold py-3 px-6 rounded-xl shadow-md flex items-center gap-2 transition w-full md:w-auto justify-center";
            btn.innerHTML = `<i class="fas fa-lock"></i> Finalizar Proceso`;
            btn.onclick = () => handleFinalize(lastBatchNode.id);
            container.appendChild(btn);
        }
    }

    function renderTimeline(rootBatch) {
        const timeline = document.getElementById('workstation-timeline');
        timeline.innerHTML = '';

        let flatList = [];
        const traverse = (node) => {
            flatList.push(node);
            if (node.children) node.children.forEach(traverse);
        };
        traverse(rootBatch);

        const template = state.userTemplates.find(t => t.id === rootBatch.plantilla_id);
        const stages = state.stagesByTemplate[template.id] || [];

        flatList.forEach(batch => {
            const stage = stages.find(s => s.id === batch.etapa_id);
            const d = batch.data || {};
            let weight = 0;
            // Buscar peso principal
            Object.keys(d).forEach(k => { if(k.includes('peso') || k.includes('salida') || k.includes('unidades')) weight = d[k]?.value || weight; });
            
            // Buscar imagen
            let imageUrl = null;
            Object.keys(d).forEach(k => { if(k.includes('image') && d[k]?.value) imageUrl = d[k].value; });
            
            // Generar detalles completos
            let detailsHtml = '';
            if (stage && batch.data) {
                // Combinar todos los campos para iterar
                const allFields = [
                    ...(stage.campos_json.entradas || []),
                    ...(stage.campos_json.salidas || []),
                    ...(stage.campos_json.variables || [])
                ];

                allFields.forEach(field => {
                    if (field.type === 'image') return; // Se muestra aparte
                    const valObj = batch.data[field.name];
                    let val = valObj ? valObj.value : '';
                    
                    if (val !== undefined && val !== null && val !== '') {
                        detailsHtml += `
                            <div class="flex justify-between text-xs border-b border-stone-100 py-1 last:border-0">
                                <span class="text-stone-500 font-medium">${field.label}:</span>
                                <span class="text-stone-800 text-right max-w-[60%] truncate" title="${val}">${val}</span>
                            </div>
                        `;
                    }
                });
            }

            const card = document.createElement('div');
            card.className = "bg-white p-4 rounded-xl border border-stone-200 shadow-sm relative mb-4";
            card.innerHTML = `
                <div class="absolute -left-[41px] top-6 w-4 h-4 rounded-full border-2 border-white ${batch.is_locked ? 'bg-green-500' : 'bg-amber-500'} shadow-sm"></div>
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-stone-800">${stage ? stage.nombre_etapa : 'Etapa'}</h4>
                    <span class="text-xs text-stone-400 bg-stone-50 px-2 py-0.5 rounded">${new Date(batch.created_at).toLocaleDateString()}</span>
                </div>
                
                <div class="flex flex-col sm:flex-row gap-4">
                    ${imageUrl ? `<img src="${imageUrl}" class="w-24 h-24 rounded-lg object-cover border border-stone-100 bg-stone-50 flex-shrink-0 cursor-pointer hover:opacity-90" onclick="window.open('${imageUrl}')">` : ''}
                    <div class="flex-grow space-y-2">
                         <div class="text-sm text-stone-700 font-bold border-b border-stone-200 pb-2 mb-2">
                            ${weight} <span class="text-xs font-normal text-stone-500">kg/un</span>
                         </div>
                         <div class="space-y-1">
                            ${detailsHtml}
                         </div>
                    </div>
                </div>

                ${!batch.is_locked ? `
                <div class="flex justify-end gap-2 border-t border-stone-100 pt-3 mt-3">
                    <button class="text-xs text-stone-500 hover:text-amber-600 font-bold edit-batch-btn border border-stone-200 px-3 py-1.5 rounded-lg transition hover:bg-amber-50">Editar</button>
                    <button class="text-xs text-stone-500 hover:text-red-600 font-bold delete-batch-btn border border-stone-200 px-3 py-1.5 rounded-lg transition hover:bg-red-50">Eliminar</button>
                </div>` : 
                `<div class="text-xs text-green-600 font-bold border-t border-green-50 pt-3 mt-3 flex items-center gap-1 justify-end"><i class="fas fa-lock"></i> Certificado</div>`}
            `;
            
            if(!batch.is_locked) {
                card.querySelector('.edit-batch-btn').addEventListener('click', () => openBatchForm('edit', template, stage, null, batch));
                card.querySelector('.delete-batch-btn').addEventListener('click', () => handleDeleteBatch(batch.id));
            }
            timeline.appendChild(card);
        });
    }

    // --- ACCIONES SECUNDARIAS ---
    async function prepareProcessing(acopio) {
        state.currentAcopio = acopio;
        const template = state.templates.find(t => t.nombre_producto === acopio.nombre_producto);
        if (!template) {
            alert(`Error: No se encontró plantilla de sistema para ${acopio.nombre_producto}.`);
            return;
        }
        state.currentSystemTemplate = template;

        const pConfig = state.acopioConfig.find(c => c.nombre_producto === acopio.nombre_producto);
        let aConfig = pConfig.acopio.find(a => a.nombre_acopio === acopio.tipo_acopio);
        let completedStages = aConfig.etapas_acopio;
        if (acopio.subtipo && aConfig.tipo_acopio) {
             const sub = aConfig.tipo_acopio.find(s => s.nombre === acopio.subtipo);
             if(sub) completedStages = sub.etapas_acopio;
        }

        const maxStageId = Math.max(...(completedStages || [0]), 0);
        const allStages = [...(template.acopio||[]), ...(template.etapas||[])];
        
        const nextStage = allStages.find(s => (s.id_etapa !== undefined ? s.id_etapa : s.orden) === maxStageId + 1);

        if (!nextStage) return alert("Este producto ya completó todas las etapas configuradas.");
        state.nextStage = nextStage;

        const prefillData = {
            pesoEntrada: acopio.peso_kg,
            finca: acopio.finca_origen,
            fecha: new Date().toISOString().split('T')[0]
        };

        openProcessingForm(nextStage, prefillData);
    }

    // --- FORMULARIO DE PROCESAMIENTO ---
    async function openProcessingForm(stage, prefillData) {
        imagesMap = {};
        let formFieldsHtml = '';
        const stageFields = [...(stage.campos_json.entradas || []), ...(stage.campos_json.variables || [])];

        for (const field of stageFields) {
            let val = '';
            if (field.type !== 'image' && prefillData[field.name]) val = prefillData[field.name];
            formFieldsHtml += await createFieldHTML(field, field.name, val);
        }

        modalContent.innerHTML = `
            <div class="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
                <div class="flex justify-between items-center">
                    <div>
                        <p class="text-xs font-bold text-amber-800 uppercase">Lote Origen</p>
                        <p class="font-mono text-sm text-amber-900 font-bold">${state.currentAcopio.id}</p>
                    </div>
                    <div class="text-right">
                        <p class="text-xs font-bold text-amber-800 uppercase">Materia Prima</p>
                        <p class="text-sm text-amber-900">${state.currentAcopio.tipo_acopio} (${state.currentAcopio.peso_kg} kg)</p>
                    </div>
                </div>
            </div>
            <h2 class="text-2xl font-display text-stone-800 border-b pb-2 mb-4">Nuevo Proceso: ${stage.nombre_etapa}</h2>
            <form id="processing-form" class="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar space-y-4">
                ${formFieldsHtml}
                <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100 sticky bottom-0 bg-white">
                    <button type="button" onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg">Cancelar</button>
                    <button type="submit" class="px-8 py-2 bg-amber-800 text-white font-bold rounded-lg hover:bg-amber-900 shadow-md transition transform active:scale-95">Iniciar</button>
                </div>
            </form>
        `;

        setupFormListeners();

        document.getElementById('processing-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true; btn.innerText = 'Guardando...';
            
            const formData = new FormData(e.target);
            const rawData = Object.fromEntries(formData.entries());
            const newData = {};
            for (const key in rawData) {
                if (!key.startsWith('imageUrl')) newData[key] = { value: rawData[key], visible: true, nombre: key };
            }
            if (imagesMap['imageUrl']) newData.imageUrl = { value: imagesMap['imageUrl'], visible: true, nombre: 'Foto' };

            try {
                // 1. Sincronizar plantilla y OBTENER ID
                const tmplRes = await api('/api/templates/clone', { 
                    method: 'POST', 
                    body: JSON.stringify({ nombre_producto_sistema: state.currentSystemTemplate.nombre_producto }) 
                });

                if (!tmplRes || !tmplRes.id) throw new Error("Error al sincronizar plantilla.");

                // 2. BUSCAR EL ID REAL DE LA ETAPA EN LA DB
                const dbStages = await api(`/api/templates/${tmplRes.id}/stages`);
                const targetDbStage = dbStages.find(s => s.nombre_etapa === stage.nombre_etapa && s.orden === stage.orden);

                if (!targetDbStage) throw new Error(`La etapa "${stage.nombre_etapa}" no se encontró en la base de datos.`);

                // 3. Crear Lote vinculado al Acopio
                const response = await api('/api/batches', { 
                    method: 'POST', 
                    body: JSON.stringify({ 
                        plantilla_id: tmplRes.id,
                        etapa_id: targetDbStage.id,
                        parent_id: null, 
                        acquisition_id: state.currentAcopio.id, 
                        data: newData 
                    }) 
                });
                
                formModal.close();
                await refreshData();
                
                // Abrir directamente la estación de trabajo del nuevo lote
                const newBatch = state.batches.find(b => b.id === response.id);
                if (newBatch) openWorkstation(newBatch);

            } catch(err) { 
                console.error(err); 
                alert("Error al iniciar proceso: " + err.message); 
                btn.disabled = false; btn.innerText = "Iniciar";
            }
        });

        formModal.showModal();
    }

    // --- FORMULARIO CONTINUAR PROCESO (Batch Form) ---
    async function openBatchForm(mode, template, stage, parentBatch = null, batchData = {}, preselectedProductId = null) {
        imagesMap = {};
        let initialData = {};
        if (mode === 'edit') initialData = batchData.data || {};
        
        let formFieldsHtml = '';
        const stageFields = [...(stage.campos_json.entradas || []), ...(stage.campos_json.salidas || []), ...(stage.campos_json.variables || [])];

        for (const field of stageFields) {
            let val = initialData[field.name]?.value || '';
            if (field.type === 'image' && val) imagesMap[field.name] = val;
            formFieldsHtml += await createFieldHTML(field, field.name, val);
        }

        modalContent.innerHTML = `
            <h2 class="text-2xl font-display text-stone-800 border-b pb-2 mb-4">${mode === 'edit' ? 'Editar' : 'Nuevo'}: ${stage.nombre_etapa}</h2>
            <form id="batch-form" class="max-h-[60vh] overflow-y-auto pr-4 custom-scrollbar space-y-4">
                ${formFieldsHtml}
                <div class="flex justify-end gap-3 mt-6 pt-4 border-t border-stone-100 sticky bottom-0 bg-white">
                    <button type="button" onclick="document.getElementById('form-modal').close()" class="px-4 py-2 text-stone-500 font-bold hover:bg-stone-100 rounded-lg">Cancelar</button>
                    <button type="submit" class="px-8 py-2 bg-amber-800 text-white font-bold rounded-lg hover:bg-amber-900 shadow-md">Guardar</button>
                </div>
            </form>
        `;

        setupFormListeners();

        document.getElementById('batch-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = e.target.querySelector('button[type="submit"]');
            btn.disabled = true; btn.innerText = 'Guardando...';
            
            const formData = new FormData(e.target);
            const rawData = Object.fromEntries(formData.entries());
            const newData = {};
            
            for (const key in rawData) {
                if (!key.startsWith('imageUrl')) newData[key] = { value: rawData[key], visible: true, nombre: key };
            }
            for (const [key, base64] of Object.entries(imagesMap)) {
                newData[key] = { value: base64, visible: true, nombre: 'Foto' };
            }

            try {
                if (mode === 'create') {
                    const payload = { 
                        plantilla_id: template.id, 
                        etapa_id: stage.id, 
                        parent_id: parentBatch.id, 
                        data: newData,
                        producto_id: preselectedProductId 
                    };
                    await api('/api/batches', { method: 'POST', body: JSON.stringify(payload) });
                } else {
                    await api(`/api/batches/${batchData.id}`, { method: 'PUT', body: JSON.stringify({ data: newData }) });
                }
                
                formModal.close();
                await refreshData();
            } catch(err) { 
                console.error(err); alert("Error: " + err.message); btn.disabled = false; btn.innerText = "Guardar";
            }
        });

        formModal.showModal();
    }

    async function handleDeleteBatch(id) {
        if(confirm("¿Eliminar esta etapa?")) {
            try {
                await api(`/api/batches/${id}`, { method: 'DELETE' });
                await refreshData();
            } catch(e) { alert(e.message); }
        }
    }
    
    async function handleFinalize(id) {
        if(confirm("¿Finalizar y Certificar?")) {
            try {
                console.log(id);
                await api(`/api/batches/${id}/finalize`, { method: 'POST' });
                await refreshData();
            } catch(e) { alert(e.message); }
        }
    }

    // --- HELPERS CAMPOS (Versión Completa) ---
    async function createFieldHTML(field, uniqueName, value = '') {
        const fieldName = uniqueName || field.name;
        let inputHtml = `<input type="${field.type === 'number' ? 'number' : 'text'}" id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 outline-none transition" step="0.01" value="${value}">`;
        
        if (field.type === 'selectFinca') {
             const opts = state.fincas.map(f => `<option value="${f.nombre_finca}" ${f.nombre_finca === value ? 'selected' : ''}>${f.nombre_finca}</option>`).join('');
             inputHtml = `<select id="${fieldName}" name="${fieldName}" class="w-full p-2.5 border border-stone-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-amber-500 outline-none finca-selector"><option value="">Seleccionar Finca...</option>${opts}</select>`;
        } 
        else if (field.type === 'selectLugar') {
             let opts = '<option value="">Seleccionar Lugar...</option>';
             if (state.fincas.length > 0) opts += `<optgroup label="Fincas">${state.fincas.map(f => `<option value="${f.nombre_finca}" ${f.nombre_finca === value ? 'selected' : ''}>${f.nombre_finca}</option>`).join('')}</optgroup>`;
             if (state.procesadoras.length > 0) opts += `<optgroup label="Procesadoras">${state.procesadoras.map(p => `<option value="${p.nombre_comercial || p.razon_social}" ${(p.nombre_comercial || p.razon_social) === value ? 'selected' : ''}>${p.nombre_comercial || p.razon_social}</option>`).join('')}</optgroup>`;
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
        } else if (field.type === 'image') {
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

    function setupFormListeners() {
        const fileInputs = modalContent.querySelectorAll('input[type="file"]');
        fileInputs.forEach(input => {
            input.addEventListener('change', e => {
                const file = e.target.files[0];
                const fieldName = e.target.name; 
                const container = e.target.closest('div').parentElement; 
                const fileNameSpan = container.querySelector('.file-name-display');
                const previewImg = container.querySelector('.file-preview-img');
                if(file) {
                    const reader = new FileReader();
                    reader.onload = () => { imagesMap[fieldName] = reader.result; previewImg.src = reader.result; previewImg.classList.remove('hidden'); };
                    reader.readAsDataURL(file);
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