const app = {
    state: {
        view: 'companies',
        selectedCompany: null,
        companies: [], // Almacén para evitar peticiones repetidas
        currentFilter: 'all'
    },

    container: document.getElementById('app-container'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    
    // Variables para el mapa de sugerencias
    map: null,
    drawingManager: null,
    currentOverlay: null,
    geocoder: null,

    init: async function() {
        // Inicializar listeners de navegación y slug
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view === 'landing') {
                this.loadLanding(event.state.userId, false);
            } else {
                this.loadCompanies(false);
            }
        });

        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const baseIndex = pathSegments.indexOf('origen-unico');
        
        if (baseIndex !== -1 && pathSegments.length > baseIndex + 1) {
            const slug = pathSegments[baseIndex + 1];
            await this.resolveSlugAndLoad(slug);
        } else {
            await this.loadCompanies(false);
        }

        this.setupSuggestForm();
    },

    // --- ANALYTICS ---
    trackEvent: async function(type, companyId, productId = null) { 
        try { 
            await fetch('/api/public/analytics', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    event_type: type, 
                    target_user_id: companyId, 
                    target_product_id: productId, 
                    meta_data: { 
                        referrer: document.referrer, 
                        url: window.location.href, 
                        timestamp: new Date().toISOString() 
                    } 
                }) 
            }); 
        } catch(e){} 
    },

    // --- UTILS ---
    createSlug: function(text) { 
        if (!text) return '';
        return text.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-'); 
    },

    toTitleCase: function(str) {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    },
    
    resolveSlugAndLoad: async function(slug) {
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';
        try {
            const res = await fetch('/api/public/companies');
            const companies = await res.json();
            const company = companies.find(c => this.createSlug(c.name) === slug);
            if (company) {
                this.loadLanding(company.id, false);
            } else {
                this.container.innerHTML = `
                    <div class="text-center py-20">
                        <h2 class="text-2xl font-bold text-stone-700">Empresa no encontrada</h2>
                        <button onclick="app.loadCompanies(true)" class="bg-amber-800 text-white px-6 py-2 rounded-lg mt-4">Ir al Directorio</button>
                    </div>`;
            }
        } catch(e) { this.loadCompanies(false); }
    },

    setFilter: function(filterType) {
        this.state.currentFilter = filterType;
        
        // Actualizar UI de botones
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.getAttribute('data-filter') === filterType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderCompanies();
    },

    // --- NIVEL 1: LISTADO DE EMPRESAS (DISEÑO MEJORADO) ---
    loadCompanies: async function(pushState = true) {
        this.state.view = 'companies';
        this.updateBreadcrumbs();

        // Mostrar barra de filtros si estamos en vista de empresas
        document.getElementById('filters-section')?.classList.remove('hidden');
        
        if (pushState) history.pushState({ view: 'companies' }, "Directorio", "/origen-unico");

        // Si ya tenemos los datos, solo renderizamos
        if (this.state.companies.length > 0) {
            this.renderCompanies();
            return;
        }

        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        try {
            const res = await fetch('/api/public/companies');
            this.state.companies = await res.json();
            this.renderCompanies();
        } catch (e) { 
            console.error(e);
            this.container.innerHTML = '<p class="text-center py-20 text-stone-400 font-medium">No se pudo cargar el directorio. Reintenta en unos momentos.</p>';
        }
    },

    renderCompanies: function() {
        const filter = this.state.currentFilter;
        
        // Filtrar datos
        const filtered = filter === 'all' 
            ? this.state.companies 
            : this.state.companies.filter(c => c.type === filter);

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;
        
        if (filtered.length > 0) {
            filtered.forEach(c => {
                const logo = c.logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f5f5f4&color=78350f&size=128`;
                const isFinca = c.type === 'finca';
                const typeColor = isFinca ? 'amber' : 'blue';
                const locationStr = [c.departamento, c.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación por verificar';
                
                html += `
                    <div onclick="app.loadLanding('${c.id}', true)" 
                         class="group relative bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full">
                        <div class="h-2 w-full bg-${typeColor}-600/20 group-hover:bg-${typeColor}-600 transition-colors duration-500"></div>
                        <div class="p-6 flex flex-col h-full">
                            <div class="flex justify-between items-start mb-6">
                                <img src="${logo}" class="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md bg-white">
                                ${c.status === 'pending' ? 
                                    '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">Sugerido</span>' : 
                                    '<span class="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100"><i class="fas fa-check-circle"></i> Verificado</span>'}
                            </div>
                            <div class="flex-grow">
                                <span class="text-[10px] font-black uppercase tracking-[0.15em] text-${typeColor}-600 mb-1 block">
                                    ${isFinca ? '<i class="fas fa-leaf mr-1"></i> Productor' : '<i class="fas fa-industry mr-1"></i> Procesadora'}
                                </span>
                                <h3 class="text-2xl font-display font-black text-stone-900 leading-tight group-hover:text-amber-900 transition-colors line-clamp-2">${c.name}</h3>
                                <p class="text-sm text-stone-500 mt-2 flex items-center gap-2 font-medium"><i class="fas fa-map-marker-alt text-stone-300 group-hover:text-amber-600 transition-colors"></i> ${locationStr}</p>
                            </div>
                            <div class="mt-8 pt-5 border-t border-stone-100 flex items-center justify-between">
                                <div class="flex flex-col"><span class="text-[10px] font-bold text-stone-400 uppercase">Lotes</span><span class="text-lg font-black text-stone-800">${c.total_lotes_certificados || 0}</span></div>
                                <div class="text-sm font-bold text-amber-800 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">Ver Perfil <i class="fas fa-arrow-right ml-1"></i></div>
                            </div>
                        </div>
                    </div>`;
            });
        } else {
            html += `<div class="col-span-full py-20 text-center">
                        <i class="fas fa-search text-stone-200 text-5xl mb-4"></i>
                        <p class="text-stone-400 font-medium">No se encontraron empresas en esta categoría.</p>
                     </div>`;
        }

        // Tarjeta "Tu Marca Aquí" (Solo aparece si filtramos 'all' o categorías específicas según desees)
        html += `
            <div onclick="app.openSuggestModal()" class="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/30 hover:bg-amber-50 hover:border-amber-400 cursor-pointer transition-all duration-500 min-h-[280px]">
                <div class="w-16 h-16 rounded-2xl bg-white border border-amber-100 flex items-center justify-center mb-4 shadow-sm"><i class="fas fa-plus text-3xl text-amber-500"></i></div>
                <h3 class="text-xl font-display font-bold text-amber-900 mb-2">¿Tu Marca Aquí?</h3>
                <p class="text-sm text-stone-600 text-center mb-6 max-w-[200px]">Únete a la red de transparencia global.</p>
                <span class="bg-amber-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-amber-900 transition-all">Sugerir Empresa</span>
            </div></div>`;

        this.container.innerHTML = html;
    },

    // --- NIVEL 2: LANDING PAGE DE EMPRESA ---
    loadLanding: async function(userId, pushState = true) {
        this.state.view = 'landing';
        this.updateBreadcrumbs();

        // Ocultar filtros en la landing
        document.getElementById('filters-section')?.classList.add('hidden');
        
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        // Tracking
        this.trackEvent('landing_view', userId);

        try {
            const res = await fetch(`/api/public/companies/${userId}/landing`);
            const data = await res.json();

            if (data.error) {
                 this.container.innerHTML = `<div class="text-center py-20"><h2 class="text-xl text-stone-600">${data.error}</h2><button onclick="app.loadCompanies(true)" class="text-amber-800 underline mt-4">Volver</button></div>`;
                 return;
            }

            const { user, entity, products } = data;
            
            this.state.selectedCompany = { name: user.empresa };
            this.updateBreadcrumbs();

            if (pushState) {
                const slug = this.createSlug(user.empresa);
                history.pushState({ view: 'landing', userId: userId }, user.empresa, `/origen-unico/${slug}`);
            }

            // --- LÓGICA DE VISUALIZACIÓN ---
            const isSuggested = user.is_suggested;
            const isFinca = user.company_type === 'finca';
            const entityName = isFinca ? (entity.nombre_finca || user.empresa) : (entity.nombre_comercial || user.empresa);
            const typeLabel = isFinca ? 'Finca de Origen' : 'Planta de Procesamiento';
            
            const locationParts = [];
            if (entity.distrito) locationParts.push(this.toTitleCase(entity.distrito));
            if (entity.departamento) locationParts.push(this.toTitleCase(entity.departamento));
            if (entity.pais) locationParts.push(this.toTitleCase(entity.pais));
            const locationStr = locationParts.join(', ') || 'Ubicación no registrada';
            
            const historyText = entity.historia || user.historia_empresa || 'Comprometidos con la calidad y la transparencia en cada grano.';
            const producerName = entity.propietario || (user.nombre ? user.nombre + ' ' + user.apellido : 'Productor');
            const producerPhoto = entity.foto_productor || 'https://placehold.co/150x150/e0e0e0/757575?text=Productor';
            
            let coverImage = 'https://images.unsplash.com/photo-1511537632536-b7a4896848a5?auto=format&fit=crop&q=80&w=1000';
            let galleryHtml = '';
            if (entity.imagenes && entity.imagenes.length > 0) {
                coverImage = entity.imagenes[0];
                if (entity.imagenes.length > 1) {
                    galleryHtml = `<div class="grid grid-cols-3 gap-2 mt-4">` + 
                        entity.imagenes.slice(1, 4).map(img => `<img src="${img}" class="h-20 w-full object-cover rounded-lg border border-stone-100">`).join('') +
                        `</div>`;
                }
            }

            const cleanPhone = user.celular ? user.celular.replace(/\D/g,'') : '';
            const waBase = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

            let claimBanner = '';
            if (isSuggested) {
                claimBanner = `
                    <div class="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 mb-8 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div class="flex items-center gap-3">
                            <i class="fas fa-exclamation-circle text-2xl text-amber-600"></i>
                            <div>
                                <p class="font-bold">Perfil Sugerido por la Comunidad</p>
                                <p class="text-sm text-amber-800">Esta información ha sido generada por usuarios. ¿Eres el dueño de ${entityName}?</p>
                            </div>
                        </div>
                        <a href="/register.html?claim_id=${user.id}" class="bg-amber-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-900 transition whitespace-nowrap shadow-md">
                            Reclamar Perfil
                        </a>
                    </div>
                `;
            }

            const unverifiedStyle = isSuggested ? 'opacity-80 grayscale-[0.2]' : '';

            let html = `
                ${claimBanner}
                
                <!-- HERO SECTION -->
                <div class="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-8 shadow-xl group ${unverifiedStyle}">
                   <img src="${coverImage}" class="w-full h-full object-cover transform group-hover:scale-105 transition duration-700">
                   <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                   <div class="absolute bottom-0 left-0 w-full p-6 md:p-8 flex items-end gap-6">
                       <img src="${user.company_logo || 'https://placehold.co/100x100?text=Logo'}" class="w-24 h-24 md:w-32 md:h-32 rounded-xl border-4 border-white shadow-lg bg-white object-contain">
                       <div class="text-white mb-2">
                           <span class="bg-amber-500 text-amber-900 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block shadow-sm">${typeLabel}</span>
                           <h1 class="text-3xl md:text-5xl font-display font-bold leading-tight">${entityName}</h1>
                           <p class="text-amber-100 flex items-center gap-2 text-sm md:text-base opacity-90"><i class="fas fa-map-marker-alt"></i> ${locationStr}</p>
                       </div>
                   </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 ${unverifiedStyle}">
                    
                    <!-- COLUMNA IZQUIERDA: IDENTIDAD -->
                    <div class="lg:col-span-1 space-y-8">
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                            <h3 class="text-xl font-display font-bold text-amber-900 mb-4 border-b pb-2">Identidad</h3>
                            ${isFinca ? `
                            <div class="flex items-center gap-4 mb-4 bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <img src="${producerPhoto}" class="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm">
                                <div>
                                    <p class="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Productor</p>
                                    <p class="font-bold text-stone-800 text-sm">${producerName}</p>
                                </div>
                            </div>` : ''}
                            <div class="prose prose-sm text-stone-600 mb-4"><p class="italic">"${historyText}"</p></div>
                            ${galleryHtml}
                            <div class="flex gap-2 mt-6">
                                <button onclick="if(navigator.share) navigator.share({title: '${entityName}', url: window.location.href}); else alert('URL: ' + window.location.href);" class="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"><i class="fas fa-share-alt"></i> Compartir</button>
                                ${waBase !== '#' ? `<a href="${waBase}" target="_blank" onclick="app.trackEvent('buy_click', '${userId}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-center transition flex items-center justify-center gap-2 text-sm"><i class="fab fa-whatsapp text-lg"></i> Contactar</a>` : ''}
                            </div>
                        </div>

                        <!-- FICHA TÉCNICA (TERROIR) -->
                        <div class="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                            <h3 class="text-lg font-bold text-stone-700 mb-4 flex items-center gap-2">
                                <i class="fas fa-mountain text-amber-600"></i> ${isFinca ? 'Terroir & Origen' : 'Ubicación & Calidad'}
                            </h3>
                            
                            <div id="mini-map" class="w-full h-48 bg-stone-200 rounded-xl mb-3 relative"></div>
                            <p class="text-center font-bold text-stone-800 text-sm mb-4"><i class="fas fa-map-pin text-red-500 mr-1"></i> ${locationStr}</p>
                            
                            <ul class="space-y-3 text-sm">
                                ${isFinca && entity.altura ? `<li class="flex justify-between border-b border-stone-200 pb-2"><span class="text-stone-500">Altitud</span><span class="font-bold text-stone-800">${entity.altura} msnm</span></li>` : ''}
                            </ul>

                            <div class="mt-4">
                                <span class="text-xs font-bold text-stone-400 uppercase block mb-2">Certificaciones</span>
                                <div class="flex flex-wrap gap-2">
                                    ${(entity.certificaciones || []).map(c => `<div class="bg-white p-1.5 rounded border border-stone-200 shadow-sm" title="${c.nombre}"><img src="${c.logo_url}" class="h-8 w-8 object-contain"></div>`).join('')}
                                    ${(!entity.certificaciones?.length) ? '<span class="text-stone-400 text-xs italic">--</span>' : ''}
                                </div>
                            </div>
                            
                            <div class="mt-4">
                                <span class="text-xs font-bold text-stone-400 uppercase block mb-2">Premios</span>
                                <div class="flex flex-wrap gap-3">
                                    ${(entity.premios || []).map(p => `
                                        <div class="flex flex-col items-center">
                                            <div class="bg-white p-1.5 rounded-lg border border-stone-200 shadow-sm mb-1" title="${p.nombre}">
                                                <img src="${p.logo_url}" class="h-8 w-8 object-contain" alt="${p.nombre}">
                                            </div>
                                            <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 rounded">${p.ano || p.year || ''}</span>
                                        </div>
                                    `).join('')}
                                    ${(!entity.premios?.length) ? '<span class="text-stone-400 text-xs italic">--</span>' : ''}
                                </div>
                            </div>

                            ${isFinca ? `
                            <div class="mt-6 bg-green-100 border border-green-200 p-3 rounded-xl flex items-center gap-3">
                                <div class="bg-white p-1.5 rounded-full text-green-600 border border-green-100"><i class="fas fa-satellite"></i></div>
                                <div>
                                    <p class="text-xs font-bold text-green-800 uppercase">Monitoreo Satelital</p>
                                    <p class="text-[10px] text-green-700 leading-tight">Predio verificado EUDR Ready</p>
                                </div>
                            </div>` : ''}
                        </div>
                    </div>

                    <!-- COLUMNA DERECHA: CATÁLOGO -->
                    <div class="lg:col-span-2">
                        <h3 class="text-2xl font-display font-bold text-stone-800 mb-6 flex items-center gap-2"><i class="fas fa-store text-amber-600"></i> Catálogo Disponible</h3>
                        <div class="space-y-8">
                            ${products.length === 0 ? `<div class="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200"><i class="fas fa-box-open text-3xl text-stone-300 mb-2"></i><p class="text-stone-500 italic">No hay productos disponibles por el momento.</p></div>` : ''}
                            
                            ${products.map(prod => {
                                const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
                                const batchesHtml = prod.recent_batches.map(b => {
                                    const batchDate = new Date(b.fecha_finalizacion || Date.now()).toLocaleDateString();
                                    const batchLocation = [b.finca_origen, b.provincia].filter(Boolean).join(', ') || 'Origen único';
                                    return `
                                    <a href="/${b.id}" target="_blank" onclick="app.trackEvent('trace_view', '${userId}', '${prod.id}')" class="flex-shrink-0 w-64 bg-stone-50 border border-stone-200 rounded-xl p-3 hover:border-amber-400 hover:shadow-md transition group no-underline text-left">
                                        <div class="flex justify-between items-start mb-2"><span class="font-mono text-[10px] font-bold text-stone-500 bg-white px-2 py-1 rounded border border-stone-100">${b.id}</span><i class="fas fa-external-link-alt text-stone-300 group-hover:text-amber-500 text-xs"></i></div>
                                        <p class="text-xs text-stone-600 font-bold mb-0.5 truncate">${b.finca_origen || 'Origen Protegido'}</p>
                                        <div class="text-[10px] text-stone-400 flex justify-between mt-2 pt-2 border-t border-stone-200"><span>${batchDate}</span><span class="text-green-600 font-bold"><i class="fas fa-shield-alt"></i> Inmutable</span></div>
                                    </a>`;
                                }).join('');

                                const buyLink = waBase !== '#' ? `${waBase}?text=Hola, estoy interesado en comprar el producto: *${encodeURIComponent(prod.nombre)}*` : '#';

                                return `
                                <div class="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-lg transition duration-300">
                                    <div class="flex flex-col md:flex-row">
                                        <div class="md:w-1/3 h-56 md:h-auto relative">
                                            <img src="${prodImage}" class="w-full h-full object-cover">
                                            <div class="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur uppercase tracking-wider">${prod.tipo_producto || 'Especialidad'}</div>
                                        </div>
                                        <div class="p-6 md:w-2/3 flex flex-col justify-between">
                                            <div>
                                                <div class="flex justify-between items-start mb-2">
                                                    <h4 class="text-xl font-bold text-stone-900 leading-tight">${prod.nombre}</h4>
                                                    <div class="flex gap-1">${(prod.premios || []).map(pr => `<i class="fas fa-medal text-yellow-500 text-xl" title="${pr.nombre}"></i>`).join('')}</div>
                                                </div>
                                                <p class="text-stone-600 text-sm mb-4 line-clamp-3">${prod.descripcion || 'Sin descripción.'}</p>
                                            </div>
                                            <div class="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                                                <span class="text-xs font-bold text-stone-400 uppercase tracking-widest"><i class="fas fa-cubes mr-1"></i> ${prod.recent_batches.length} Lotes</span>
                                                ${waBase !== '#' ? `<a href="${buyLink}" target="_blank" onclick="app.trackEvent('buy_click', '${userId}', '${prod.id}')" class="bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg"><i class="fas fa-shopping-cart"></i> Comprar</a>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    ${batchesHtml ? `<div class="bg-stone-50/80 p-4 border-t border-stone-100 backdrop-blur-sm"><p class="text-[10px] font-bold text-stone-400 mb-3 uppercase tracking-widest"><i class="fas fa-history text-amber-500 mr-1"></i> Trazabilidad</p><div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">${batchesHtml}</div></div>` : ''}
                                </div>`;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            this.container.innerHTML = html;
            window.scrollTo(0, 0);

            if (entity.coordenadas) setTimeout(() => this.initMiniMap(entity.coordenadas), 500);

        } catch (e) { console.error(e); }
    },

    // --- RESTO DE FUNCIONES (MAPAS, MODALES, ETC.) ---
    openSuggestModal: function() {
        const modal = document.getElementById('suggest-modal');
        if (!modal) return;

        // Inyectar dinámicamente el campo de logo si no existe en el HTML
        // Esto evita tener que editar el HTML manualmente si prefieres gestionarlo desde JS
        const form = document.getElementById('suggest-form');
        if (form && !document.getElementById('logo-container')) {
            const logoHtml = `
                <div id="logo-container" class="space-y-2">
                    <label class="block text-xs font-bold text-stone-500 uppercase">Logo de la Empresa (Máx 5MB)</label>
                    <div class="flex items-center gap-4">
                        <div id="logo-preview" class="w-16 h-16 rounded-xl border-2 border-dashed border-stone-200 flex items-center justify-center bg-stone-50 overflow-hidden">
                            <i class="fas fa-image text-stone-300"></i>
                        </div>
                        <div class="flex-grow">
                            <input type="file" id="input-logo" accept="image/*" class="block w-full text-xs text-stone-500
                                file:mr-4 file:py-2 file:px-4
                                file:rounded-full file:border-0
                                file:text-xs file:font-semibold
                                file:bg-amber-50 file:text-amber-700
                                hover:file:bg-amber-100 cursor-pointer">
                        </div>
                    </div>
                    <p id="logo-error" class="text-[10px] text-red-500 hidden font-bold">El archivo es demasiado grande (Máx 5MB)</p>
                </div>
            `;
            // Insertar antes de los campos de redes sociales
            const nameLabel = document.getElementById('name-label')?.parentElement;
            if (nameLabel) nameLabel.insertAdjacentHTML('afterend', logoHtml);
            
            this.bindLogoEvents();
        }

        modal.showModal();
    },

    bindLogoEvents: function() {
        const input = document.getElementById('input-logo');
        const preview = document.getElementById('logo-preview');
        const errorMsg = document.getElementById('logo-error');

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validación de tamaño (5MB = 5242880 bytes)
            if (file.size > 5 * 1024 * 1024) {
                errorMsg.classList.remove('hidden');
                input.value = "";
                this.pendingLogoBase64 = null;
                preview.innerHTML = '<i class="fas fa-times text-red-300"></i>';
                return;
            }

            errorMsg.classList.add('hidden');
            const reader = new FileReader();
            reader.onload = (event) => {
                this.pendingLogoBase64 = event.target.result;
                preview.innerHTML = `<img src="${this.pendingLogoBase64}" class="w-full h-full object-cover">`;
            };
            reader.readAsDataURL(file);
        });
    },

    toggleMapMode: function() {
        const typeEl = document.querySelector('input[name="suggest_type"]:checked');
        if(!typeEl) return;
        
        const type = typeEl.value;
        const mapLabel = document.getElementById('map-mode-label');
        const instruction = document.getElementById('map-instruction');
        const areaContainer = document.getElementById('calc_area_container');

        if (this.drawingManager) {
            this.drawingManager.setDrawingMode(null);
            
            if (type === 'finca') {
                if(mapLabel) mapLabel.textContent = "Modo: Dibujar Polígono";
                if(instruction) instruction.textContent = "Dibuja el perímetro de la finca.";
                this.drawingManager.setOptions({
                    drawingMode: google.maps.drawing.OverlayType.POLYGON,
                    drawingControl: true,
                    drawingControlOptions: { drawingModes: ['polygon'] }
                });
                if(areaContainer) areaContainer.parentElement.classList.remove('hidden');
            } else {
                if(mapLabel) mapLabel.textContent = "Modo: Marcar Punto";
                if(instruction) instruction.textContent = "Haz clic para ubicar la planta.";
                this.drawingManager.setOptions({
                    drawingMode: google.maps.drawing.OverlayType.MARKER,
                    drawingControl: true,
                    drawingControlOptions: { drawingModes: ['marker'] }
                });
                if(areaContainer) areaContainer.parentElement.classList.add('hidden');
            }
        }
    },

    setupSuggestForm: function() {
        const form = document.getElementById('suggest-form');
        if(!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('btn-submit-suggest');
            btn.disabled = true; 
            btn.innerHTML = '<i class="fas fa-spinner animate-spin mr-2"></i> Enviando...';

            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData.entries());
            
            // Mapear campos y agregar el logo
            data.type = data.suggest_type;
            data.logo = this.pendingLogoBase64; // Agregar el Base64
            delete data.suggest_type;

            if(data.coordenadas) {
                try { data.coordenadas = JSON.parse(data.coordenadas); } catch(e) { data.coordenadas = null; }
            }

            try {
                const res = await fetch('/api/public/suggest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if(!res.ok) throw new Error("Error al enviar la sugerencia");
                
                // Limpiar estado
                this.pendingLogoBase64 = null;
                e.target.reset();
                const preview = document.getElementById('logo-preview');
                if (preview) preview.innerHTML = '<i class="fas fa-image text-stone-300"></i>';

                alert("¡Gracias! Tu sugerencia ha sido enviada con éxito.");
                document.getElementById('suggest-modal').close();
                this.loadCompanies(); 

            } catch(err) {
                alert("Hubo un problema: " + err.message);
            } finally {
                btn.disabled = false; 
                btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Enviar Sugerencia';
            }
        });
    },

    initMiniMap: function(coords) {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') return;
        
        try {
            let paths = coords;
            if (typeof coords === 'string') {
                try { paths = JSON.parse(coords); } catch(e) { return; }
            }
            if (!paths) return;

            const mapOptions = {
                zoom: 13,
                mapTypeId: 'satellite',
                disableDefaultUI: true, 
                draggable: false,       
                zoomControl: false,
                scrollwheel: false,
                disableDoubleClickZoom: true
            };
            const map = new google.maps.Map(document.getElementById('mini-map'), mapOptions);

            if (Array.isArray(paths) && paths.length > 0 && Array.isArray(paths[0])) {
                const polygonPaths = paths.map(p => ({ lat: parseFloat(p[0]), lng: parseFloat(p[1]) }));
                const center = polygonPaths[0]; 
                map.setCenter(center);

                new google.maps.Polygon({
                    paths: polygonPaths,
                    strokeColor: "#10b981", 
                    strokeOpacity: 0.8,
                    strokeWeight: 2,
                    fillColor: "#10b981",
                    fillOpacity: 0.35,
                    map: map
                });

                const bounds = new google.maps.LatLngBounds();
                polygonPaths.forEach(p => bounds.extend(p));
                map.fitBounds(bounds);
            } 
            else {
                let position = null;
                if (paths.lat && paths.lng) position = { lat: parseFloat(paths.lat), lng: parseFloat(paths.lng) };
                else if (Array.isArray(paths) && paths.length === 2 && !Array.isArray(paths[0])) {
                    position = { lat: parseFloat(paths[0]), lng: parseFloat(paths[1]) };
                }

                if (position) {
                    map.setCenter(position);
                    map.setZoom(15);
                    new google.maps.Marker({
                        position: position,
                        map: map,
                        title: "Ubicación"
                    });
                }
            }

        } catch (e) { console.error("Error mapa:", e); }
    },

    updateBreadcrumbs: function() {
        if (!this.breadcrumbs) return;
        if (this.state.view === 'companies') {
            this.breadcrumbs.classList.add('hidden');
        } else {
            this.breadcrumbs.classList.remove('hidden');
            const compSpan = document.getElementById('breadcrumb-company');
            if(compSpan) compSpan.textContent = this.state.selectedCompany?.name || 'Perfil';
        }
    },

    resetToCompanies: function() {
        this.loadCompanies();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());