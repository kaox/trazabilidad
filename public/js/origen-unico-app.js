const app = {
    state: {
        view: 'companies',
        selectedCompany: null
    },

    container: document.getElementById('app-container'),
    breadcrumbs: document.getElementById('breadcrumbs'),
    
    init: async function() {
        // Manejar navegación del navegador (Atrás/Adelante)
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view === 'landing') {
                this.loadLanding(event.state.userId, false);
            } else {
                this.loadCompanies(false);
            }
        });

        // Detectar si hay un slug en la URL inicial (Ej: /origen-unico/finca-la-esperanza)
        // Asumimos que la ruta base es algo como .../origen-unico/...
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const baseIndex = pathSegments.indexOf('origen-unico');
        
        // Si encontramos 'origen-unico' y hay un segmento después, es el slug de la empresa
        if (baseIndex !== -1 && pathSegments.length > baseIndex + 1) {
            const slug = pathSegments[baseIndex + 1];
            await this.resolveSlugAndLoad(slug);
        } else {
            await this.loadCompanies(false); // Carga inicial normal
        }
    },

    // --- UTILS: SLUGIFY ---
    createSlug: function(text) {
        return text.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
            .replace(/\s+/g, '-')           // Espacios a guiones
            .replace(/[^\w\-]+/g, '')       // Eliminar caracteres no alfanuméricos
            .replace(/\-\-+/g, '-');        // Eliminar guiones dobles
    },

    // --- NUEVO: RESOLVER SLUG A ID ---
    resolveSlugAndLoad: async function(slug) {
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';
        try {
            // Obtenemos todas las empresas para encontrar cual coincide con el slug
            const res = await fetch('/api/public/companies');
            const companies = await res.json();
            
            const company = companies.find(c => this.createSlug(c.empresa) === slug);
            
            if (company) {
                // Encontramos la empresa, cargamos su landing sin empujar estado (ya estamos en la URL)
                this.loadLanding(company.id, false);
            } else {
                this.container.innerHTML = `
                    <div class="text-center py-20">
                        <i class="fas fa-search-location text-4xl text-stone-300 mb-4"></i>
                        <h2 class="text-2xl font-bold text-stone-700">Empresa no encontrada</h2>
                        <p class="text-stone-500 mb-6">La dirección web no corresponde a ninguna empresa verificada.</p>
                        <button onclick="app.loadCompanies(true)" class="bg-amber-800 text-white px-6 py-2 rounded-lg hover:bg-amber-900 transition">Ir al Directorio</button>
                    </div>`;
            }
        } catch(e) {
            console.error("Error resolviendo slug:", e);
            this.loadCompanies(false);
        }
    },

    // --- NIVEL 1: LISTADO DE EMPRESAS ---
    loadCompanies: async function(pushState = true) {
        this.state.view = 'companies';
        this.updateBreadcrumbs();
        
        // Actualizar URL a la raíz si se solicita
        if (pushState) {
            history.pushState({ view: 'companies' }, "Directorio", "/origen-unico");
        }

        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        try {
            const res = await fetch('/api/public/companies');
            const companies = await res.json();

            if (companies.length === 0) {
                this.container.innerHTML = `
                    <div class="text-center text-stone-500 py-10 bg-stone-50 rounded-xl border-2 border-dashed border-stone-200">
                        <i class="fas fa-users text-4xl text-stone-300 mb-4"></i>
                        <p class="mb-4">Aún no hay empresas públicas.</p>
                        <a href="/login.html" class="text-amber-700 font-bold hover:underline">Registrar mi Empresa</a>
                    </div>`;
                return;
            }

            let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;
            
            companies.forEach(c => {
                const logo = c.company_logo || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.empresa)}&background=f5f5f4&color=78350f&size=128`;
                const count = c.total_lotes_certificados || 0;
                
                let badgeHtml = '';
                if (count > 0) {
                    badgeHtml = `
                    <p class="text-xs font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full inline-block mt-1 border border-green-100">
                        <i class="fas fa-check-circle mr-1"></i> ${count} Lotes Certificados
                    </p>`;
                } else {
                    badgeHtml = `
                    <p class="text-xs font-bold text-stone-500 bg-stone-100 px-2 py-1 rounded-full inline-block mt-1 border border-stone-200">
                        <i class="fas fa-clock mr-1"></i> En Proceso
                    </p>`;
                }

                // Usamos app.loadLanding con pushState = true al hacer clic
                html += `
                    <div onclick="app.loadLanding('${c.id}', true)" class="bg-white rounded-2xl shadow-sm border border-stone-200 p-6 cursor-pointer card-hover transition-all duration-300 group">
                        <div class="flex items-center gap-4 mb-4">
                            <img src="${logo}" alt="${c.empresa}" class="w-16 h-16 rounded-full object-cover border border-stone-100 group-hover:border-amber-200 transition">
                            <div>
                                <h3 class="text-xl font-display font-bold text-stone-900 group-hover:text-amber-800 transition line-clamp-1" title="${c.empresa}">${c.empresa}</h3>
                                ${badgeHtml}
                            </div>
                        </div>
                        <div class="text-right">
                            <span class="text-sm font-bold text-amber-700 group-hover:underline">Ver Perfil <i class="fas fa-arrow-right ml-1"></i></span>
                        </div>
                    </div>
                `;
            });
            
            // Card de Growth
            html += `
                <a href="/login.html" class="flex flex-col items-center justify-center p-6 rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-all group opacity-80 hover:opacity-100">
                    <div class="w-16 h-16 rounded-full bg-white border border-amber-200 flex items-center justify-center mb-4 shadow-sm group-hover:scale-110 transition">
                        <i class="fas fa-plus text-2xl text-amber-500"></i>
                    </div>
                    <h3 class="text-xl font-display font-bold text-amber-900 mb-2">¿Tu Marca Aquí?</h3>
                    <p class="text-sm text-amber-700 text-center mb-4">Únete al directorio de empresas verificadas.</p>
                    <span class="bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-md hover:bg-amber-700 transition">Crear Perfil Gratis</span>
                </a>
            </div>`;
            this.container.innerHTML = html;

        } catch (e) { console.error(e); }
    },

    // --- NIVEL 2: LANDING PAGE DE EMPRESA ---
    loadLanding: async function(userId, pushState = true) {
        this.state.view = 'landing';
        this.updateBreadcrumbs();
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

        try {
            const res = await fetch(`/api/public/companies/${userId}/landing`);
            const data = await res.json();
            const { user, entity, products } = data;
            
            this.state.selectedCompany = { name: user.empresa };
            this.updateBreadcrumbs();

            // CAMBIO: Actualizar URL con Slug amigable
            if (pushState) {
                const slug = this.createSlug(user.empresa);
                const newUrl = `/origen-unico/${slug}`;
                history.pushState({ view: 'landing', userId: userId }, user.empresa, newUrl);
            }

            // -- 1. DETERIMAR TIPO DE ENTIDAD (Finca vs Procesadora) --
            const isFinca = user.company_type === 'finca';
            const entityName = isFinca ? (entity.nombre_finca || user.empresa) : (entity.nombre_comercial || entity.razon_social || user.empresa);
            const typeLabel = isFinca ? 'Finca de Origen' : 'Planta de Procesamiento';
            
            // Construir Ubicación: Distrito, Departamento, Pais
            const locationParts = [];
            if (entity.distrito) locationParts.push(entity.distrito);
            if (entity.departamento) locationParts.push(entity.departamento);
            if (entity.pais) locationParts.push(entity.pais);
            const locationStr = locationParts.join(', ') || 'Ubicación no registrada';
            
            // Storytelling vars
            const historyText = entity.historia || user.historia_empresa || 'Comprometidos con la calidad y la transparencia en cada grano.';
            const producerName = entity.propietario || user.nombre + ' ' + user.apellido;
            const producerPhoto = entity.foto_productor || 'https://placehold.co/150x150/e0e0e0/757575?text=Productor';
            
            // Imagen de portada
            let coverImage = 'https://images.unsplash.com/photo-1511537632536-b7a4896848a5?auto=format&fit=crop&q=80&w=1000';
            let galleryHtml = '';
            if (entity.imagenes && entity.imagenes.length > 0) {
                coverImage = entity.imagenes[0];
                // Generar galería pequeña
                if (entity.imagenes.length > 1) {
                    galleryHtml = `<div class="grid grid-cols-3 gap-2 mt-4">` + 
                        entity.imagenes.slice(1, 4).map(img => `<img src="${img}" class="h-20 w-full object-cover rounded-lg cursor-pointer hover:opacity-90 transition" onclick="window.open('${img}')">`).join('') +
                        `</div>`;
                }
            }

            // WhatsApp Link
            const cleanPhone = user.celular ? user.celular.replace(/\D/g,'') : '';
            const waBase = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

            // -- HTML TEMPLATE --
            let html = `
                <!-- HERO SECTION -->
                <div class="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-8 shadow-xl group">
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

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    <!-- COLUMNA IZQUIERDA: IDENTIDAD & TERROIR -->
                    <div class="lg:col-span-1 space-y-8">
                        
                        <!-- 1. Identidad y Storytelling -->
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                            <h3 class="text-xl font-display font-bold text-amber-900 mb-4 border-b pb-2">Identidad</h3>
                            
                            ${isFinca ? `
                            <!-- Solo Fincas: Productor -->
                            <div class="flex items-center gap-4 mb-4 bg-stone-50 p-3 rounded-xl border border-stone-100">
                                <img src="${producerPhoto}" class="w-14 h-14 rounded-full object-cover border-2 border-white shadow-sm">
                                <div>
                                    <p class="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Productor</p>
                                    <p class="font-bold text-stone-800 text-sm">${producerName}</p>
                                </div>
                            </div>` : ''}

                            <div class="prose prose-sm text-stone-600 mb-4">
                                <p class="italic">"${historyText}"</p>
                            </div>
                            
                            ${galleryHtml}

                            <div class="flex gap-2 mt-6">
                                <button onclick="if(navigator.share) navigator.share({title: '${entityName}', url: window.location.href}); else alert('URL copiada al portapapeles: ' + window.location.href);" class="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm">
                                    <i class="fas fa-share-alt"></i> Compartir
                                </button>
                                ${waBase !== '#' ? `
                                <a href="${waBase}" target="_blank" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-center transition flex items-center justify-center gap-2 text-sm">
                                    <i class="fab fa-whatsapp text-lg"></i> Contactar
                                </a>` : ''}
                            </div>
                        </div>

                        <!-- 2. Ficha Técnica (Terroir) -->
                        <div class="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                            <h3 class="text-lg font-bold text-stone-700 mb-4 flex items-center gap-2">
                                <i class="fas fa-mountain text-amber-600"></i> ${isFinca ? 'Terroir & Origen' : 'Ubicación & Calidad'}
                            </h3>
                            
                            <!-- Mini Mapa -->
                            <div id="mini-map" class="w-full h-48 bg-stone-200 rounded-xl mb-3 overflow-hidden shadow-inner border border-stone-300 relative">
                                ${entity.coordenadas ? '' : '<div class="absolute inset-0 flex items-center justify-center text-stone-400 text-xs"><i class="fas fa-map-slash mr-1"></i> Sin coordenadas</div>'}
                            </div>
                            
                            <!-- Ubicación debajo del mapa -->
                            <div class="mb-6 text-center">
                                 <p class="text-sm font-bold text-stone-800"><i class="fas fa-map-pin text-red-500 mr-1"></i> ${locationStr}</p>
                            </div>

                            <!-- Altitud (Solo Finca) -->
                            ${isFinca ? `
                            <div class="flex justify-between items-center border-b border-stone-200 pb-2 mb-4">
                                <span class="text-stone-500 text-sm">Altitud</span>
                                <span class="font-bold text-stone-800 text-sm">${entity.altura ? entity.altura + ' msnm' : 'N/D'}</span>
                            </div>` : ''}

                            <!-- Certificaciones (Solo Imagen) -->
                            <div class="mb-4">
                                <span class="text-xs font-bold text-stone-400 uppercase block mb-2">Certificaciones</span>
                                <div class="flex flex-wrap gap-2">
                                    ${(entity.certificaciones || []).map(c => `
                                        <div class="bg-white p-1.5 rounded-lg border border-stone-200 shadow-sm" title="${c.nombre}">
                                            <img src="${c.logo_url}" class="w-10 h-10 object-contain" alt="${c.nombre}">
                                        </div>
                                    `).join('')}
                                    ${(!entity.certificaciones || entity.certificaciones.length === 0) ? '<span class="text-stone-400 text-xs italic">No registradas</span>' : ''}
                                </div>
                            </div>

                            <!-- Premios (Imagen + Año) -->
                            <div>
                                <span class="text-xs font-bold text-stone-400 uppercase block mb-2">Premios</span>
                                <div class="flex flex-wrap gap-3">
                                    ${(entity.premios || []).map(p => `
                                        <div class="flex flex-col items-center">
                                            <div class="bg-white p-1.5 rounded-lg border border-stone-200 shadow-sm mb-1" title="${p.nombre}">
                                                <img src="${p.logo_url}" class="w-10 h-10 object-contain" alt="${p.nombre}">
                                            </div>
                                            <!-- Fallback para el año -->
                                            <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 rounded">${p.ano || p.year || ''}</span>
                                        </div>
                                    `).join('')}
                                    ${(!entity.premios || entity.premios.length === 0) ? '<span class="text-stone-400 text-xs italic">No registrados</span>' : ''}
                                </div>
                            </div>
                            
                            <!-- Insignia EUDR (Solo Fincas) -->
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

                    <!-- COLUMNA DERECHA: CATÁLOGO DE PRODUCTOS -->
                    <div class="lg:col-span-2">
                        <h3 class="text-2xl font-display font-bold text-stone-800 mb-6 flex items-center gap-2">
                            <i class="fas fa-store text-amber-600"></i> Catálogo Disponible
                        </h3>

                        <div class="space-y-8">
                            ${products.length === 0 ? `
                                <div class="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200">
                                    <i class="fas fa-box-open text-3xl text-stone-300 mb-2"></i>
                                    <p class="text-stone-500 italic">No hay productos disponibles por el momento.</p>
                                </div>` : ''}
                            
                            ${products.map(prod => {
                                const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
                                
                                // Renderizar Lotes Inmutables
                                const batchesHtml = prod.recent_batches.map(b => {
                                    // Datos del lote
                                    const batchDate = new Date(b.fecha_finalizacion || Date.now()).toLocaleDateString();
                                    const batchLocation = [b.finca_origen, b.provincia, b.departamento].filter(Boolean).join(', ') || 'Origen único';
                                    
                                    return `
                                    <a href="/${b.id}" target="_blank" class="flex-shrink-0 w-64 bg-stone-50 border border-stone-200 rounded-xl p-3 hover:border-amber-400 hover:shadow-md transition group no-underline text-left">
                                        <div class="flex justify-between items-start mb-2">
                                            <span class="font-mono text-[10px] font-bold text-stone-500 bg-white px-2 py-1 rounded border border-stone-100">${b.id}</span>
                                            <i class="fas fa-external-link-alt text-stone-300 group-hover:text-amber-500 text-xs"></i>
                                        </div>
                                        <p class="text-xs text-stone-600 font-bold mb-0.5 line-clamp-1" title="${b.finca_origen}">${b.finca_origen || 'Origen Protegido'}</p>
                                        <p class="text-[10px] text-stone-400 mb-2 truncate"><i class="fas fa-map-marker-alt mr-1"></i> ${batchLocation}</p>
                                        
                                        <div class="text-[10px] text-stone-400 flex justify-between mt-2 pt-2 border-t border-stone-200">
                                            <span><i class="far fa-calendar-check mr-1"></i> ${batchDate}</span>
                                            <span class="text-green-600 font-bold" title="Blockchain Verified"><i class="fas fa-shield-alt"></i></span>
                                        </div>
                                    </a>
                                    `;
                                }).join('');

                                // Link de Compra Directa
                                const buyLink = waBase !== '#' ? `${waBase}?text=Hola, estoy interesado en comprar el producto: *${encodeURIComponent(prod.nombre)}*` : '#';

                                return `
                                <div class="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-lg transition duration-300">
                                    <div class="flex flex-col md:flex-row">
                                        <div class="md:w-1/3 h-56 md:h-auto relative">
                                            <img src="${prodImage}" class="w-full h-full object-cover">
                                            <div class="absolute top-2 left-2 bg-black/70 text-white text-[10px] font-bold px-2 py-1 rounded backdrop-blur uppercase tracking-wider">
                                                ${prod.tipo_producto || 'Especialidad'}
                                            </div>
                                        </div>
                                        <div class="p-6 md:w-2/3 flex flex-col justify-between">
                                            <div>
                                                <div class="flex justify-between items-start mb-2">
                                                    <div>
                                                        <h4 class="text-xl font-bold text-stone-900 leading-tight">${prod.nombre}</h4>
                                                        <p class="text-xs text-stone-400 font-mono mt-1">Peso: ${prod.peso || 'Variable'}</p>
                                                    </div>
                                                </div>
                                                <p class="text-stone-600 text-sm mb-4 line-clamp-3 leading-relaxed">${prod.descripcion || 'Sin descripción disponible.'}</p>
                                            </div>
                                            
                                            <div class="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                                                <span class="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1">
                                                    <i class="fas fa-cubes"></i> ${prod.recent_batches.length} Lotes Disponibles
                                                </span>
                                                ${waBase !== '#' ? `
                                                <a href="${buyLink}" target="_blank" class="bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg transform hover:-translate-y-0.5">
                                                    <i class="fas fa-shopping-cart"></i> Comprar
                                                </a>` : '<button disabled class="bg-stone-100 text-stone-400 px-4 py-2 rounded-lg text-sm font-bold cursor-not-allowed">No disponible</button>'}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Carrusel de Lotes -->
                                    ${batchesHtml ? `
                                    <div class="bg-stone-50/80 p-4 border-t border-stone-100 backdrop-blur-sm">
                                        <p class="text-[10px] font-bold text-stone-400 mb-3 uppercase tracking-widest flex items-center gap-1"><i class="fas fa-history text-amber-500"></i> Trazabilidad Inmutable Reciente</p>
                                        <div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">
                                            ${batchesHtml}
                                        </div>
                                    </div>` : ''}
                                </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>
            `;
            
            this.container.innerHTML = html;
            window.scrollTo(0, 0);

            // Inicializar Mapa si hay coordenadas
            if (entity.coordenadas) {
                setTimeout(() => this.initMiniMap(entity.coordenadas), 500);
            }

        } catch (e) {
            console.error(e);
            this.container.innerHTML = `<div class="text-center text-red-500 py-10">Error al cargar el perfil de la empresa.</div>`;
        }
    },

    // --- FUNCIÓN DE MAPA (CORREGIDA) ---
    initMiniMap: function(coords) {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') return;
        
        try {
            // CORRECCIÓN: Validación robusta del tipo de datos
            let paths = coords;
            if (typeof coords === 'string') {
                try { paths = JSON.parse(coords); } catch(e) { return; }
            }
            
            // Validación para asegurar que hay datos para mostrar
            if (!paths) return;

            // Configuración base del mapa
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

            // CASO 1: POLÍGONO (Array de arrays)
            if (Array.isArray(paths) && paths.length > 0 && Array.isArray(paths[0])) {
                const polygonPaths = paths.map(p => ({ lat: parseFloat(p[0]), lng: parseFloat(p[1]) }));
                const center = polygonPaths[0]; // Centrar en el primer punto
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
            // CASO 2: PUNTO ÚNICO (Objeto {lat, lng} o Array simple)
            else {
                let position = null;
                // Si viene como {lat: x, lng: y}
                if (paths.lat && paths.lng) position = { lat: parseFloat(paths.lat), lng: parseFloat(paths.lng) };
                // Si viene como [lat, lng] (inusual pero posible)
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

        } catch (e) {
            console.error("Error mapa:", e);
        }
    },

    // --- UTILIDADES ---
    updateBreadcrumbs: function() {
        if (this.state.view === 'companies') {
            this.breadcrumbs.classList.add('hidden');
        } else {
            this.breadcrumbs.classList.remove('hidden');
            const compSpan = document.getElementById('breadcrumb-company');
            compSpan.textContent = this.state.selectedCompany?.name || 'Perfil';
            document.getElementById('breadcrumb-product-part').classList.add('hidden');
        }
    },

    resetToCompanies: function() {
        this.loadCompanies();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());