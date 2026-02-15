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

    init: async function() {
        // Inicializar listeners de navegación y slug
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.view === 'landing') {
                this.loadLanding(event.state.userId, false);
            } else {
                this.loadCompanies(false);
            }
        });

        window.addEventListener('keydown', (e) => {
            // Verificación segura de gallery
            if (!this.state.gallery || !this.state.gallery.isOpen) return;
            if (e.key === 'ArrowRight') this.nextGalleryImage();
            if (e.key === 'ArrowLeft') this.prevGalleryImage();
            if (e.key === 'Escape') this.closeGallery();
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

    extractYoutubeId: function(url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    // --- CAROUSEL LOGIC ---
    openGallery: function(index, items) {
        if (!this.state.gallery) {
            this.state.gallery = { images: [], currentIndex: 0, isOpen: false };
        }
        
        this.state.gallery.images = items.map(item => {
            if (typeof item === 'string') return { type: 'image', src: item };
            return item;
        });
        
        this.state.gallery.currentIndex = index;
        this.state.gallery.isOpen = true;
        this.renderGalleryModal();
    },

    closeGallery: function() {
        if (this.state.gallery) this.state.gallery.isOpen = false;
        const modal = document.getElementById('gallery-overlay');
        if (modal) modal.remove();
        
        // Detener videos al cerrar (limpiando el contenido)
    },

    nextGalleryImage: function() {
        this.state.gallery.currentIndex = (this.state.gallery.currentIndex + 1) % this.state.gallery.images.length;
        this.updateGalleryUI();
    },

    prevGalleryImage: function() {
        this.state.gallery.currentIndex = (this.state.gallery.currentIndex - 1 + this.state.gallery.images.length) % this.state.gallery.images.length;
        this.updateGalleryUI();
    },

    updateGalleryUI: function() {
        const contentContainer = document.getElementById('gallery-content');
        const counter = document.getElementById('gallery-counter');
        const item = this.state.gallery.images[this.state.gallery.currentIndex];
        
        if (contentContainer) {
            contentContainer.innerHTML = this.getMediaHtml(item);
        }
        if (counter) {
            counter.textContent = `${this.state.gallery.currentIndex + 1} / ${this.state.gallery.images.length}`;
        }
    },

    getMediaHtml: function(item) {
        if (item.type === 'video') {
            // Contenedor responsivo con padding-bottom para forzar 16:9
            return `
                <div style="position: relative; width: 100%; max-width: 960px; padding-bottom: 56.25%; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
                    <iframe 
                        src="https://www.youtube.com/embed/${item.videoId}?autoplay=1&rel=0" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>`;
        } else {
            return `<img src="${item.src}" style="max-height: 85vh; max-width: 90vw; object-fit: contain; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);" class="animate-fade-in">`;
        }
    },

    renderGalleryModal: function() {
        const items = this.state.gallery.images;
        const index = this.state.gallery.currentIndex;
        const currentItem = items[index];
        
        // Estructura simplificada sin capas superpuestas que bloqueen el mouse
        const modalHtml = `
            <div id="gallery-overlay" style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.95); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;">
                
                <button onclick="app.closeGallery()" style="position: absolute; top: 20px; right: 20px; z-index: 10001; width: 50px; height: 50px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.8)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                    <i class="fas fa-times" style="font-size: 24px;"></i>
                </button>

                <div style="position: absolute; top: 25px; left: 25px; z-index: 10001; color: white; font-family: monospace; font-size: 14px; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px;">
                    <span id="gallery-counter">${index + 1} / ${items.length}</span>
                </div>

                <button onclick="app.prevGalleryImage()" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); z-index: 10001; width: 50px; height: 50px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s;">
                    <i class="fas fa-chevron-left" style="font-size: 20px;"></i>
                </button>

                <div id="gallery-content" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px;">
                    ${this.getMediaHtml(currentItem)}
                </div>

                <button onclick="app.nextGalleryImage()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10001; width: 50px; height: 50px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s;">
                    <i class="fas fa-chevron-right" style="font-size: 20px;"></i>
                </button>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    },
    
    resolveSlugAndLoad: async function(slug) {
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';
        try {
            const res = await fetch('/api/public/companies');
            const companies = await res.json();
            
            let company = companies.find(c => slug.endsWith(`-${c.id}`));

            // 2. Fallback: Buscar por nombre convertido a slug (para URLs antiguas)
            if (!company) {
                company = companies.find(c => this.createSlug(c.name) === slug);
            }

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
                const locationStr = [c.distrito, c.provincia, c.departamento, c.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación por verificar';
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
                                <div class="flex flex-col"><span class="text-[10px] font-bold text-stone-400 uppercase"></span><span class="text-lg font-black text-stone-800"></span></div>
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
        // ... (Mantener lógica de carga, estado, breadcrumbs, tracking) ...
        this.state.view = 'landing';
        this.updateBreadcrumbs();
        document.getElementById('filters-section')?.classList.add('hidden');
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';

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
                const slug = this.createSlug(user.empresa) + '-' + user.id;
                history.pushState({ view: 'landing', userId: userId }, user.empresa, `/origen-unico/${slug}`);
            }

            // Datos de la empresa
            const isSuggested = user.is_suggested;
            const isFinca = user.company_type === 'finca';
            const entityName = isFinca ? (entity.nombre_finca || user.empresa) : (entity.nombre_comercial || user.empresa);
            const typeLabel = isFinca ? 'Finca de Origen' : 'Planta de Procesamiento';
            const locationStr = [entity.distrito, entity.provincia, entity.departamento, entity.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación no registrada';
            const historyText = entity.historia || user.historia_empresa || 'Comprometidos con la calidad y la transparencia en cada grano.';
            
            const instagram = user.social_instagram || entity.social_instagram;
            const facebook = user.social_facebook || entity.social_facebook;

            let coverImage = 'https://images.unsplash.com/photo-1511537632536-b7a4896848a5?auto=format&fit=crop&q=80&w=1000';
            
            const mediaItems = [];
            
            // 1. Agregar imágenes
            if (entity.imagenes && entity.imagenes.length > 0) {
                coverImage = entity.imagenes[0];
                entity.imagenes.forEach(img => mediaItems.push({ type: 'image', src: img }));
            } else {
                // Imagen por defecto si no hay ninguna
                mediaItems.push({ type: 'image', src: coverImage });
            }

            // 2. Agregar video si existe
            if (entity.video_link) {
                const videoId = this.extractYoutubeId(entity.video_link);
                if (videoId) {
                    mediaItems.push({
                        type: 'video',
                        src: entity.video_link,
                        videoId: videoId,
                        thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` // Miniatura de YT
                    });
                }
            }

            // Serializar para pasar al evento onclick
            const mediaJson = JSON.stringify(mediaItems).replace(/"/g, '&quot;');

            // 3. Renderizar Miniaturas (Debajo de la portada)
            let galleryHtml = '';
            // Excluimos el item 0 (que ya está de portada) y mostramos los siguientes 3
            // Si hay video, queremos que salga.
            const thumbnailsToShow = mediaItems.slice(1, 4);

            if (thumbnailsToShow.length > 0) {
                galleryHtml = `<div class="grid grid-cols-3 gap-2 mt-4">` + 
                    thumbnailsToShow.map((item, idx) => {
                        // El índice real en el array 'mediaItems' es idx + 1 porque hicimos slice(1)
                        const realIndex = idx + 1;
                        if (item.type === 'video') {
                            return `
                            <div class="relative group cursor-pointer overflow-hidden rounded-lg border border-stone-100 h-20" onclick="app.openGallery(${realIndex}, ${mediaJson})">
                                <img src="${item.thumb}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500 filter brightness-75">
                                <div class="absolute inset-0 flex items-center justify-center">
                                    <i class="fas fa-play-circle text-white text-3xl shadow-sm"></i>
                                </div>
                            </div>`;
                        } else {
                            return `
                            <div class="relative group cursor-pointer overflow-hidden rounded-lg border border-stone-100 h-20" onclick="app.openGallery(${realIndex}, ${mediaJson})">
                                <img src="${item.src}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                                <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                            </div>`;
                        }
                    }).join('') +
                    `</div>`;
            }

            const cleanPhone = user.celular ? user.celular.replace(/\D/g,'') : '';
            const waBase = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

            let socialHtml = '';
            if (instagram || facebook) {
                socialHtml += `<div class="flex gap-3 justify-center mt-6 pt-4 border-t border-stone-100">`;
                if (instagram) {
                    const instaUrl = instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`;
                    socialHtml += `<a href="${instaUrl}" target="_blank" class="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center hover:bg-pink-100 transition shadow-sm" title="Instagram"><i class="fab fa-instagram text-xl"></i></a>`;
                }
                if (facebook) {
                    const fbUrl = facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`;
                    socialHtml += `<a href="${fbUrl}" target="_blank" class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition shadow-sm" title="Facebook"><i class="fab fa-facebook text-xl"></i></a>`;
                }
                socialHtml += `</div>`;
            }

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
                        <a href="/onboarding.html?claim_id=${user.id}" class="bg-amber-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-900 transition whitespace-nowrap shadow-md">Reclamar Perfil</a>
                    </div>`;
            }

            const unverifiedStyle = isSuggested ? 'opacity-80 grayscale-[0.2]' : '';

            // --- NUEVO BLOQUE: DIRECCIÓN Y BOTÓN CÓMO LLEGAR (Solo procesadoras) ---
            let fullAddressHtml = '';
            let mapButtonHtml = '';

            if (!isFinca) {
                if (entity.direccion) {
                    fullAddressHtml = `<p class="text-center text-xs text-stone-500 mb-4 px-2 leading-tight">${entity.direccion}</p>`;
                }
                
                let mapQuery = '';
                if (entity.coordenadas) {
                    let lat, lng;
                    if (Array.isArray(entity.coordenadas) && entity.coordenadas.length > 0) {
                         if (Array.isArray(entity.coordenadas[0])) { lat = entity.coordenadas[0][0]; lng = entity.coordenadas[0][1]; }
                    } else if (entity.coordenadas.lat) {
                         lat = entity.coordenadas.lat; lng = entity.coordenadas.lng;
                    }
                    if (lat && lng) mapQuery = `${lat},${lng}`;
                }
                
                if (!mapQuery && entity.direccion) {
                    mapQuery = encodeURIComponent(`${entity.direccion}, ${locationStr}`);
                }
                
                if (mapQuery) {
                    mapButtonHtml = `
                        <a href="https://www.google.com/maps/dir/?api=1&destination=${mapQuery}" target="_blank" class="block w-full text-center bg-white border border-stone-300 text-stone-700 font-bold py-2 rounded-lg text-sm hover:bg-stone-50 transition mb-4 shadow-sm group/btn">
                            <i class="fas fa-location-arrow mr-2 text-red-500 group-hover/btn:animate-pulse"></i> Cómo llegar
                        </a>`;
                }
            }

            let html = `
                ${claimBanner}
                
                <!-- HERO SECTION -->
                <div class="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-8 shadow-xl group ${unverifiedStyle} cursor-pointer" onclick="app.openGallery(0, ${JSON.stringify(entity.imagenes || [coverImage]).replace(/"/g, '&quot;')})">
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
                   <div class="absolute top-4 right-4 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-white text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                       <i class="fas fa-expand-alt mr-1"></i> Ver Galería
                   </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 ${unverifiedStyle}">
                    
                    <!-- COLUMNA IZQUIERDA: IDENTIDAD -->
                    <div class="lg:col-span-1 space-y-8">
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                            <h3 class="text-xl font-display font-bold text-amber-900 mb-4 border-b pb-2">Identidad</h3>
                            <div class="prose prose-sm text-stone-600 mb-4"><p class="italic">"${historyText}"</p></div>
                            ${galleryHtml}
                            ${socialHtml}
                            <div class="flex gap-2 mt-6">
                                <button onclick="if(navigator.share) navigator.share({title: '${entityName}', url: window.location.href}); else alert('URL: ' + window.location.href);" class="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"><i class="fas fa-share-alt"></i> Compartir</button>
                                ${waBase !== '#' ? `<a href="${waBase}" target="_blank" onclick="app.trackEvent('buy_click', '${userId}')" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-center transition flex items-center justify-center gap-2 text-sm"><i class="fab fa-whatsapp text-lg"></i> Contactar</a>` : ''}
                            </div>
                        </div>

                        <!-- FICHA TÉCNICA -->
                        <div class="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                            <h3 class="text-lg font-bold text-stone-700 mb-4 flex items-center gap-2">
                                <i class="fas fa-mountain text-amber-600"></i> ${isFinca ? 'Terroir & Origen' : 'Ubicación & Calidad'}
                            </h3>
                            <div id="mini-map" class="w-full h-48 bg-stone-200 rounded-xl mb-3 relative"></div>

                            <p class="text-center font-bold text-stone-800 text-sm ${fullAddressHtml ? 'mb-1' : 'mb-4'}">
                                <i class="fas fa-map-pin text-red-500 mr-1"></i> ${locationStr}
                            </p>
                            
                            <!-- Dirección y Botón (NUEVO) -->
                            ${fullAddressHtml}
                            ${mapButtonHtml}

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

                            <!-- SECCIÓN RESTAURADA: PREMIOS -->
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
                            <!--div class="mt-6 bg-green-100 border border-green-200 p-3 rounded-xl flex items-center gap-3">
                                <div class="bg-white p-1.5 rounded-full text-green-600 border border-green-100"><i class="fas fa-satellite"></i></div>
                                <div>
                                    <p class="text-xs font-bold text-green-800 uppercase">Monitoreo Satelital</p>
                                    <p class="text-[10px] text-green-700 leading-tight">Predio verificado EUDR Ready</p>
                                </div>
                            </div-->` : ''}
                        </div>
                    </div>

                    <!-- COLUMNA DERECHA: CATÁLOGO ACTUALIZADO -->
                    <div class="lg:col-span-2">
                        <h3 class="text-2xl font-display font-bold text-stone-800 mb-6 flex items-center gap-2"><i class="fas fa-store text-amber-600"></i> Catálogo Disponible</h3>
                        <div class="space-y-8">
                            ${products.length === 0 ? `<div class="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200"><i class="fas fa-box-open text-3xl text-stone-300 mb-2"></i><p class="text-stone-500 italic">No hay productos disponibles por el momento.</p></div>` : ''}
                            
                            ${products.map(prod => {
                                const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
                                const hasTraceability = prod.recent_batches && prod.recent_batches.length > 0;
                                
                                const cardClasses = hasTraceability 
                                    ? 'border-2 border-emerald-500/30 shadow-xl hover:shadow-2xl ring-1 ring-emerald-50/50' 
                                    : 'border border-stone-200 shadow-sm hover:shadow-lg';

                                const batchesHtml = hasTraceability ? prod.recent_batches.map(b => {
                                    const batchDate = new Date(b.fecha_finalizacion || Date.now()).toLocaleDateString();
                                    return `
                                    <a href="/${b.id}" target="_blank" onclick="app.trackEvent('trace_view', '${userId}', '${prod.id}')" class="flex-shrink-0 w-64 bg-stone-50 border border-stone-200 rounded-xl p-3 hover:border-amber-400 hover:shadow-md transition group no-underline text-left">
                                        <div class="flex justify-between items-start mb-2"><span class="font-mono text-[10px] font-bold text-stone-500 bg-white px-2 py-1 rounded border border-stone-100">${b.id}</span><i class="fas fa-external-link-alt text-stone-300 group-hover:text-amber-500 text-xs"></i></div>
                                        <p class="text-xs text-stone-600 font-bold mb-0.5 truncate">${b.finca_origen || 'Origen Protegido'}</p>
                                        <div class="text-[10px] text-stone-400 flex justify-between mt-2 pt-2 border-t border-stone-200"><span>${batchDate}</span><span class="text-green-600 font-bold"><i class="fas fa-shield-alt"></i> Inmutable</span></div>
                                    </a>`;
                                }).join('') : '';

                                const buyLink = waBase !== '#' ? `${waBase}?text=Hola, estoy interesado en comprar el producto: *${encodeURIComponent(prod.nombre)}*` : '#';

                                return `
                                <div class="bg-white rounded-2xl ${cardClasses} overflow-hidden transition-all duration-300 transform hover:-translate-y-1 relative">
                                    <div class="flex flex-col md:flex-row">
                                        <div class="md:w-1/3 h-64 md:h-auto relative group overflow-hidden">
                                            <img src="${prodImage}" class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110">
                                            
                                            <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
                                            
                                            <div class="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 uppercase tracking-wider">
                                                ${prod.tipo_producto || 'Especialidad'}
                                            </div>

                                            ${hasTraceability ? 
                                                `<div class="absolute top-0 right-0 z-20">
                                                    <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-bl-2xl shadow-lg flex items-center gap-1.5">
                                                        <i class="fas fa-check-circle text-emerald-100 animate-pulse"></i>
                                                        <span class="tracking-wider">VERIFICADO</span>
                                                    </div>
                                                </div>
                                                <div class="absolute bottom-3 left-3 right-3 z-20">
                                                    <div class="bg-white/95 backdrop-blur-md p-2.5 rounded-xl shadow-xl border border-emerald-100 flex items-center gap-3">
                                                        <div class="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                                                            <i class="fas fa-link text-lg"></i>
                                                        </div>
                                                        <div class="flex flex-col leading-none">
                                                            <span class="text-[9px] text-stone-400 uppercase tracking-widest font-bold">Insignia Digital</span>
                                                            <span class="font-bold text-stone-800 text-sm">Trazabilidad Blockchain</span>
                                                        </div>
                                                    </div>
                                                </div>` : ''}
                                        </div>
                                        <div class="p-6 md:w-2/3 flex flex-col justify-between">
                            <div>
                                <div class="flex justify-between items-start mb-2">
                                    <h4 class="text-xl font-bold text-stone-900 leading-tight">${prod.nombre}</h4>
                                    
                                    <!-- SECCIÓN PREMIOS ACTUALIZADA -->
                                    <div class="flex flex-wrap gap-1.5 justify-end ml-2">
                                        ${(prod.premios || []).map(pr => `
                                            <div class="flex flex-col items-center justify-center bg-white p-1.5 rounded-lg border border-stone-100 shadow-sm min-w-[3rem]" title="${pr.nombre || pr.name}">
                                                ${pr.logo_url ? `<img src="${pr.logo_url}" class="h-6 w-6 object-contain mb-0.5">` : `<i class="fas fa-medal text-amber-400 text-lg mb-0.5"></i>`}
                                                <span class="text-[9px] font-bold text-stone-600 leading-none">${pr.year || pr.ano || ''}</span>
                                            </div>
                                        `).join('')}
                                    </div>

                                </div>
                                <p class="text-stone-600 text-sm mb-4 line-clamp-3">${prod.descripcion || 'Sin descripción.'}</p>
                            </div>
                            <div class="flex items-center justify-between mt-4 pt-4 border-t border-stone-100">
                                                ${hasTraceability ? 
                                                    `<span class="text-xs font-bold text-emerald-600 uppercase tracking-widest flex items-center gap-1"><i class="fas fa-cubes"></i> ${prod.recent_batches.length} Lotes Disponibles</span>` : 
                                                    `<span class="text-xs font-bold text-stone-400 uppercase tracking-widest italic">Sin historial público</span>`
                                                }
                                                ${waBase !== '#' ? `<a href="${buyLink}" target="_blank" onclick="app.trackEvent('buy_click', '${userId}', '${prod.id}')" class="bg-stone-900 hover:bg-stone-800 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg"><i class="fas fa-shopping-cart"></i> Comprar</a>` : ''}
                                            </div>
                                        </div>
                                    </div>
                                    ${batchesHtml ? `<div class="bg-emerald-50/50 p-4 border-t border-emerald-100/50 backdrop-blur-sm"><p class="text-[10px] font-bold text-stone-400 mb-3 uppercase tracking-widest"><i class="fas fa-history text-emerald-500 mr-1"></i> Historial de Lotes</p><div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">${batchesHtml}</div></div>` : ''}
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
                streetViewControl: false
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