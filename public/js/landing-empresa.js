/**
 * landing-empresa.js
 * Gestiona la visualización de la landing page pública de una empresa/finca.
 */

const app = {
    state: {
        gallery: { images: [], currentIndex: 0, isOpen: false },
        selectedCompany: null
    },

    init: async function () {
        // Inicializar referencias DOM
        this.container = document.getElementById('app-container');
        this.breadcrumbs = document.getElementById('breadcrumbs');
        this.wlHeader = document.getElementById('wl-header');
        this.wlLogo = document.getElementById('wl-logo');
        this.wlBrandName = document.getElementById('wl-brand-name');
        this.footerBrand = document.getElementById('footer-brand');

        try {
            const res = await fetch('/data/flavor-wheels.json');
            if (res.ok) this.state.flavorWheelsData = await res.json();
        } catch (e) { }

        // Soporte de teclado para galería
        window.addEventListener('keydown', (e) => {
            if (!this.state.gallery || !this.state.gallery.isOpen) return;
            if (e.key === 'ArrowRight') this.nextGalleryImage();
            if (e.key === 'ArrowLeft') this.prevGalleryImage();
            if (e.key === 'Escape') this.closeGallery();
        });

        // Escuchar cambios de hash para el router SPA
        window.addEventListener('hashchange', () => this.handleRouting());

        // CASO A: Subdominio (ej: finca-esperanza.rurulab.com)
        if (window.IS_SUBDOMAIN && window.CURRENT_COMPANY_ID) {
            // Ocultar la navegación de RuruLab
            if (this.breadcrumbs) this.breadcrumbs.style.display = 'none';
            const navPlaceholder = document.getElementById('public-nav-placeholder');
            if (navPlaceholder) navPlaceholder.style.display = 'none';

            // Cargar datos
            await this.loadLanding(window.CURRENT_COMPANY_ID);
        } else {
            const pathSegments = window.location.pathname.split('/').filter(Boolean);
            if (pathSegments.length > 1 && pathSegments[0] === 'origen-unico') {
                const slug = pathSegments[pathSegments.length - 1];
                await this.resolveSlugAndLoad(slug);
            } else {
                this.container.innerHTML = '<p class="text-center py-10">URL inválida.</p>';
            }
        }

        if (typeof ChartDataLabels !== 'undefined' && typeof Chart !== 'undefined') {
            Chart.register(ChartDataLabels);
        }
    },

    handleRouting: function () {
        const hash = window.location.hash || '#inicio';
        const page = hash.substring(1);

        // Actualizar links activos en el header
        document.querySelectorAll('.wl-nav-link').forEach(link => {
            if (link.getAttribute('data-page') === page) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Actualizar breadcrumb según la página activa
        this.updateBreadcrumb(page);

        // Renderizar la página correspondiente
        if (this.state.landingData) {
            this.renderPage(page);
        }
    },

    updateBreadcrumb: function (page) {
        // Ocultar todos los slots
        ['bc-inicio', 'bc-tienda', 'bc-contacto', 'bc-directorio'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.classList.replace('flex', 'hidden') || el.classList.add('hidden');
        });

        const isSubdomain = !!window.IS_SUBDOMAIN;

        if (isSubdomain) {
            // Subdominio: solo slots White Label (sin enlace a directorio)
            const slotId = page === 'tienda' ? 'bc-tienda'
                : page === 'contacto' ? 'bc-contacto'
                    : 'bc-inicio';
            const slot = document.getElementById(slotId);
            if (slot) {
                slot.classList.remove('hidden');
                slot.classList.add('flex');
            }
        } else {
            // Ruta /origen-unico/:slug: en Inicio mostramos directorio, en otras los slots WL
            if (page === 'inicio') {
                const slot = document.getElementById('bc-directorio');
                if (slot) { slot.classList.remove('hidden'); slot.classList.add('flex'); }
            } else {
                const slotId = page === 'tienda' ? 'bc-tienda' : 'bc-contacto';
                const slot = document.getElementById(slotId);
                if (slot) { slot.classList.remove('hidden'); slot.classList.add('flex'); }
            }
        }

        // Rellenar label con nombre de la empresa
        if (this.state.landingData) {
            const companyName = this.state.landingData.user?.name || 'Tienda';
            document.querySelectorAll('.bc-store-name').forEach(el => {
                el.textContent = companyName;
            });
        }
    },

    toggleMobileMenu: function () {
        const menu = document.getElementById('wl-mobile-menu');
        if (menu) menu.classList.toggle('open');
    },

    closeMobileMenu: function () {
        const menu = document.getElementById('wl-mobile-menu');
        if (menu) menu.classList.remove('open');
    },

    // --- UTILS ---
    toTitleCase: function (str) {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    },

    extractYoutubeId: function (url) {
        if (!url) return null;
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    trackEvent: async function (type, companyId, productId = null) {
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
        } catch (e) { }
    },

    // --- CARGA DE DATOS ---
    resolveSlugAndLoad: async function (slug) {
        let companyId = null;

        const sugIndex = slug.lastIndexOf('-SUG-');

        if (sugIndex !== -1) {
            companyId = slug.substring(sugIndex + 1);
        } else {
            const lastHyphenIndex = slug.lastIndexOf('-');
            if (lastHyphenIndex !== -1) {
                companyId = slug.substring(lastHyphenIndex + 1);
            } else {
                companyId = slug;
            }
        }

        this.loadLanding(companyId);
    },

    loadLanding: async function (userId) {
        this.trackEvent('landing_view', userId);

        try {
            let data;
            if (window.INITIAL_DATA && (String(window.INITIAL_DATA.user?.id) === String(userId))) {
                console.log("Usando INITIAL_DATA de SSR");
                data = window.INITIAL_DATA;
                // Limpiar para evitar problemas si se navega a otra empresa sin recargar (aunque sea raro en esta app)
                // window.INITIAL_DATA = null; 
            } else {
                const res = await fetch(`/api/public/companies/${userId}/landing`);
                data = await res.json();
            }

            if (data.error) {
                this.container.innerHTML = `<div class="text-center py-20"><h2 class="text-xl text-stone-600">${data.error}</h2><button onclick="app.loadCompanies(true)" class="text-amber-800 underline mt-4">Volver</button></div>`;
                return;
            }

            // Guardar datos en el estado para navegación SPA
            this.state.landingData = data;

            // 1. Activar UI White Label (si corresponde)
            this.applyWhiteLabelBranding(data.user);

            // 2. Renderizar la página inicial (según el hash)
            this.handleRouting();

            // 3. Inyectar JSON-LD
            const { user, entity, products } = data;
            const isFinca = user.type === 'finca';
            const entityName = isFinca ? (entity.nombre_finca || user.name) : (entity.nombre_comercial || user.name);
            const locationStr = [entity.distrito, entity.provincia, entity.departamento, entity.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación no registrada';
            let coverImage = user.cover || (entity.imagenes && entity.imagenes.length > 0 ? entity.imagenes[0] : 'https://images.unsplash.com/photo-1511537632536-b7a4896848a5?auto=format&fit=crop&q=80&w=1000');

            this.injectJsonLd({ user, entity, products, isFinca, entityName, locationStr, coverImage });

        } catch (e) { console.error(e); }
    },

    applyWhiteLabelBranding: function (user) {
        const navPlaceholder = document.getElementById('public-nav-placeholder');
        const breadcrumbs = document.getElementById('breadcrumbs');
        const wlHeader = document.getElementById('wl-header');

        if (wlHeader) {
            wlHeader.classList.remove('hidden');
            if (this.wlLogo) this.wlLogo.src = user.logo || 'https://placehold.co/100x100?text=Logo';
            if (this.wlBrandName) this.wlBrandName.textContent = user.name || 'Empresa';
            if (this.footerBrand) this.footerBrand.textContent = user.name || 'Empresa';

            // Ajustar posición si el menú de RuruLab está visible
            if (!window.IS_SUBDOMAIN) {
                wlHeader.style.position = 'relative';
                wlHeader.style.top = '0';
                document.documentElement.style.setProperty('--nav-offset', '0px');
            } else {
                wlHeader.style.position = 'sticky';
                wlHeader.style.top = '0';
                document.documentElement.style.setProperty('--nav-offset', '0px');
            }
        }

        if (window.IS_SUBDOMAIN) {
            if (navPlaceholder) navPlaceholder.style.display = 'none';
            // Subdomain: breadcrumb visible con slots White Label
            if (breadcrumbs) breadcrumbs.classList.remove('hidden');
        } else {
            if (navPlaceholder) navPlaceholder.style.display = 'block';
            // Ruta /origen-unico/:slug: breadcrumb visible
            if (breadcrumbs) breadcrumbs.classList.remove('hidden');
            // Rellenar slot directorio con el nombre de la empresa
            const bcDirectorio = document.getElementById('bc-directorio');
            const bcCompany = document.getElementById('breadcrumb-company');
            if (bcCompany) bcCompany.textContent = user.name || '';
            // El slot directorio se mostrará en handleRouting() para 'inicio'
            // pero en las páginas internas se oculta y se usan los slots WL
        }
    },

    renderPage: function (page) {
        window.scrollTo(0, 0);
        this.container.innerHTML = ''; // Limpiar contenedor

        switch (page) {
            case 'inicio':
                this.renderInicio();
                break;
            case 'tienda':
                this.renderTienda();
                break;
            case 'contacto':
                this.renderContacto();
                break;
            default:
                this.renderInicio();
        }
    },

    renderInicio: function () {
        const { user, entity, products } = this.state.landingData;
        const isSuggested = user.is_suggested;
        const isFinca = user.type === 'finca';
        const entityName = isFinca ? (entity.nombre_finca || user.name) : (entity.nombre_comercial || user.name);
        const typeLabel = isFinca ? 'Finca de Origen' : 'Planta de Procesamiento';
        const locationStr = [entity.distrito, entity.provincia, entity.departamento, entity.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación no registrada';
        const historyText = user.history || entity.historia || 'Comprometidos con la calidad y la transparencia en cada grano.';

        const instagram = user.instagram || entity.social_instagram;
        const facebook = user.facebook || entity.social_facebook;

        let coverImage = user.cover || (entity.imagenes && entity.imagenes.length > 0 ? entity.imagenes[0] : 'https://images.unsplash.com/photo-1511537632536-b7a4896848a5?auto=format&fit=crop&q=80&w=1000');

        const mediaItems = [];
        if (entity.imagenes && entity.imagenes.length > 0) {
            entity.imagenes.forEach(img => mediaItems.push({ type: 'image', src: img }));
        } else {
            mediaItems.push({ type: 'image', src: coverImage });
        }
        if (entity.video_link) {
            const videoId = this.extractYoutubeId(entity.video_link);
            if (videoId) mediaItems.push({ type: 'video', src: entity.video_link, videoId: videoId, thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` });
        }

        const mediaJson = JSON.stringify(mediaItems).replace(/"/g, '&quot;');
        const thumbnailsToShow = mediaItems.slice(1, 4);

        let galleryHtml = '';
        if (thumbnailsToShow.length > 0) {
            galleryHtml = `<div class="grid grid-cols-3 gap-2 mt-4">` +
                thumbnailsToShow.map((item, idx) => {
                    const realIndex = idx + 1;
                    const thumbImg = item.type === 'video' ? item.thumb : item.src;
                    return `
                    <div class="relative group cursor-pointer overflow-hidden rounded-lg border border-stone-100 h-20" onclick="app.openGallery(${realIndex}, ${mediaJson})">
                        <img src="${thumbImg}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500 ${item.type === 'video' ? 'filter brightness-75' : ''}">
                        ${item.type === 'video' ? '<div class="absolute inset-0 flex items-center justify-center"><i class="fas fa-play-circle text-white text-3xl"></i></div>' : ''}
                    </div>`;
                }).join('') + `</div>`;
        }
        const cleanPhone = user.celular ? user.celular.replace(/\D/g, '') : (user.contact_phone ? user.contact_phone.replace(/\D/g, '') : '');
        const waBase = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

        let socialHtml = '';
        if (instagram || facebook) {
            socialHtml += `<div class="flex gap-3 justify-center mt-6 pt-4 border-t border-stone-100">`;
            if (instagram) socialHtml += `<a href="${instagram.startsWith('http') ? instagram : 'https://instagram.com/' + instagram.replace('@', '')}" target="_blank" class="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center hover:bg-pink-100 transition shadow-sm"><i class="fab fa-instagram text-xl"></i></a>`;
            if (facebook) socialHtml += `<a href="${facebook.startsWith('http') ? facebook : 'https://facebook.com/' + facebook}" target="_blank" class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition shadow-sm"><i class="fab fa-facebook text-xl"></i></a>`;
            socialHtml += `</div>`;
        }

        let claimBanner = '';
        let tiendaHTML = '';
        let fomoHTML = '';
        let badgeHTML = '';

        if (isSuggested) {
            badgeHTML = `
                <div class="absolute top-0 right-0 bg-stone-100 text-stone-500 px-4 py-1 rounded-bl-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                    <i class="fas fa-eye-slash"></i> Perfil sin verificar
                </div>
            `;
            claimBanner = `
                <div class="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 mb-8 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                    <div class="flex items-center gap-3">
                        <i class="fas fa-exclamation-circle text-2xl text-amber-600"></i>
                        <div>
                            <p class="font-bold">¿Eres el dueño de ${entityName}? </p>
                            <p class="text-sm">Este perfil se generó automáticamente y está listo para ser oficial.</p>
                        </div>
                    </div>
                    <a href="/onboarding.html?claim_id=${user.id}" class="btn-accent px-6 py-2 rounded-lg font-bold">Reclamar Perfil gratis</a>
                </div>`;

            tiendaHTML = `
                <style>
                    .locked-content { filter: blur(4px); user-select: none; opacity: 0.6; }
                    .glass-overlay { background: rgba(255, 255, 255, 0.85); backdrop-filter: blur(2px); }
                    .modal-enter { opacity: 0; transform: scale(0.95) translateY(10px); transition: all 0.3s ease-out; }
                    .modal-enter-active { opacity: 1; transform: scale(1) translateY(0); }
                </style>
                <div class="bg-white rounded-2xl border border-stone-200 overflow-hidden relative">
                    <div class="p-6">
                        <h3 class="font-bold text-stone-800 mb-4">Marketplace y Productos</h3>
                        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 locked-content">
                            <div class="bg-stone-50 rounded-lg p-3"><div class="w-full h-24 bg-stone-200 rounded mb-2"></div><div class="h-4 bg-stone-200 rounded w-3/4 mb-1"></div><div class="h-3 bg-stone-200 rounded w-1/2"></div></div>
                            <div class="bg-stone-50 rounded-lg p-3"><div class="w-full h-24 bg-stone-200 rounded mb-2"></div><div class="h-4 bg-stone-200 rounded w-3/4 mb-1"></div><div class="h-3 bg-stone-200 rounded w-1/2"></div></div>
                            <div class="bg-stone-50 rounded-lg p-3 hidden sm:block"><div class="w-full h-24 bg-stone-200 rounded mb-2"></div><div class="h-4 bg-stone-200 rounded w-3/4 mb-1"></div><div class="h-3 bg-stone-200 rounded w-1/2"></div></div>
                        </div>
                    </div>
                    
                    <div class="absolute inset-0 glass-overlay flex flex-col items-center justify-center p-6 text-center">
                        <div class="bg-white w-12 h-12 rounded-full shadow-md flex items-center justify-center text-stone-400 mb-3">
                            <i class="fas fa-shopping-cart text-xl"></i>
                        </div>
                        <h3 class="font-bold text-stone-800 mb-1">Tienda no activada</h3>
                        <p class="text-sm text-stone-600 mb-4 max-w-sm">Publica tus productos gratis, genera Pasaportes Digitales y conecta directamente con compradores sin intermediarios.</p>
                        <button onclick="app.openClaimModal()" class="bg-amber-700 hover:bg-amber-800 text-white px-6 py-2 rounded-lg font-medium transition-colors shadow-sm">
                            Activar Tienda Online
                        </button>
                    </div>
                </div>
            `;

            fomoHTML = `
                <div class="space-y-6">
                    <div class="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                        <h3 class="text-lg font-bold text-amber-900 mb-4 flex items-center gap-2">
                            <i class="fas fa-gift text-amber-600"></i> Al reclamar obtienes:
                        </h3>
                        <ul class="space-y-3 text-sm text-amber-900">
                            <li class="flex items-start gap-2"><i class="fas fa-check text-green-600 mt-0.5"></i><span>Check de <strong>Perfil Oficial Verificado</strong>.</span></li>
                            <li class="flex items-start gap-2"><i class="fas fa-check text-green-600 mt-0.5"></i><span>Publicación de <strong>productos ilimitados</strong>.</span></li>
                            <li class="flex items-start gap-2"><i class="fas fa-check text-green-600 mt-0.5"></i><span>Acceso a métricas de <strong>quién visita tu perfil</strong>.</span></li>
                            <li class="flex items-start gap-2"><i class="fas fa-check text-green-600 mt-0.5"></i><span>Generador de Pasaporte Digital de Producto con <strong>códigos QR GS1 Digital Link</strong> para tus empaques.</span></li>
                            <li class="flex items-start gap-2"><i class="fas fa-check text-green-600 mt-0.5"></i><span>Vitrina para mostrar tus <strong>certificaciones y premios</strong> obtenidos.</span></li>
                            <li class="flex items-start gap-2"><i class="fas fa-check text-green-600 mt-0.5"></i><span>Publica tus <strong>Ruedas de Sabor y Perfil Sensorial</strong> en el detalle de tu producto.</span></li>
                        </ul>
                        <div class="mt-6">
                            <button onclick="app.openClaimModal()" class="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-bold shadow-md transition-all transform hover:-translate-y-0.5">
                                Reclamar ahora (Toma 2 min)
                            </button>
                        </div>
                    </div>
                </div>
            `;

        }

        // Ubicación y Botón de Mapa
        let mapQuery = entity.direccion ? encodeURIComponent(entity.direccion + ', ' + locationStr) : '';
        if (entity.coordenadas) {
            const lat = Array.isArray(entity.coordenadas) ? entity.coordenadas[0] : (entity.coordenadas.lat || null);
            const lng = Array.isArray(entity.coordenadas) ? entity.coordenadas[1] : (entity.coordenadas.lng || null);
            if (lat && lng) mapQuery = `${lat},${lng}`;
        }

        const fullAddressHtml = `
            <div class="text-center mt-4">
                <p class="font-bold text-stone-800 text-sm mb-1 flex items-center justify-center gap-2">
                    <i class="fas fa-map-marker-alt text-red-500"></i> ${locationStr}
                </p>
                ${entity.direccion ? `<p class="text-[11px] text-stone-500 uppercase tracking-tight">${entity.direccion}</p>` : ''}
            </div>
        `;

        let mapButtonHtml = '';
        if (mapQuery) {
            mapButtonHtml = `
                <a href="https://www.google.com/maps/dir/?api=1&destination=${mapQuery}" target="_blank" class="mt-6 block w-full text-center bg-white border border-stone-200 text-stone-800 font-bold py-3 rounded-2xl text-base hover:bg-stone-50 transition shadow-sm flex items-center justify-center gap-3 group">
                    <i class="fas fa-location-arrow text-red-500 group-hover:animate-pulse"></i> Cómo llegar
                </a>`;
        }

        let html = `
            <div class="container mx-auto px-6 py-8 fade-in">
                ${claimBanner}
                
                <!-- HERO -->
                <div class="relative w-full h-64 md:h-96 rounded-3xl overflow-hidden mb-12 shadow-2xl group cursor-pointer" onclick="app.openGallery(0, ${mediaJson})">
                    ${badgeHTML}
                   <img src="${coverImage}" class="w-full h-full object-cover transform group-hover:scale-105 transition duration-700">
                   <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
                   <div class="absolute bottom-0 left-0 w-full p-8 flex items-end gap-6">
                       <img src="${user.logo || 'https://placehold.co/100x100?text=Logo'}" class="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-white shadow-lg bg-white object-contain">
                       <div class="text-white mb-2">
                           <span class="bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block shadow-lg">${typeLabel}</span>
                           <h1 class="text-3xl md:text-5xl font-display font-bold leading-tight">${entityName}</h1>
                           <p class="text-white/80 flex items-center gap-2 text-sm md:text-base"><i class="fas fa-map-marker-alt text-accent"></i> ${locationStr}</p>
                       </div>
                   </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div class="lg:col-span-1 space-y-8">
                        <div class="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 about-section">
                            <h3 class="text-2xl font-display font-bold text-stone-900 mb-6 border-b border-stone-100 pb-4">Nuestra Historia</h3>
                            <div class="prose prose-sm text-stone-600 mb-6 italic leading-relaxed text-lg">"${historyText}"</div>
                            ${galleryHtml}
                            ${socialHtml}
                        </div>

                        <div class="bg-stone-50 p-8 rounded-3xl border border-stone-200">
                            <h3 class="text-xl font-bold text-stone-800 mb-6 flex items-center gap-3">
                                <i class="fas fa-mountain text-accent"></i> ${isFinca ? 'Terroir & Origen' : 'Ubicación'}
                            </h3>
                            <div id="mini-map" class="w-full h-56 bg-stone-200 rounded-2xl mb-6 shadow-inner"></div>
                            ${fullAddressHtml}
                            ${mapButtonHtml}
                        </div>

                        <!-- Certificaciones & Premios Section -->
                        ${(entity.certificaciones?.length > 0 || entity.premios?.length > 0) ? `
                        <div class="space-y-6">
                            <h3 class="text-2xl font-display font-bold text-stone-900 border-b border-stone-100 pb-4">Reconocimientos</h3>
                            <div class="grid grid-cols-1 gap-4">
                                ${(entity.certificaciones || []).map(c => `
                                    <div class="flex items-center gap-4 bg-white p-5 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition">
                                        <div class="w-16 h-16 flex-shrink-0 bg-stone-50 rounded-2xl p-2 flex items-center justify-center">
                                            <img src="${c.logo_url}" class="max-w-full max-h-full object-contain">
                                        </div>
                                        <div>
                                            <h4 class="font-bold text-stone-900">${c.nombre}</h4>
                                            <p class="text-xs text-stone-500 leading-tight">${c.descripcion || 'Certificación de calidad garantizada.'}</p>
                                        </div>
                                    </div>
                                `).join('')}
                                ${(entity.premios || []).map(p => `
                                    <div class="flex items-center gap-4 bg-white p-5 rounded-3xl border border-stone-100 shadow-sm hover:shadow-md transition">
                                        <div class="w-16 h-16 flex-shrink-0 bg-amber-50 rounded-2xl p-2 flex items-center justify-center">
                                            ${p.logo_url ? `<img src="${p.logo_url}" class="max-w-full max-h-full object-contain">` : `<i class="fas fa-medal text-amber-500 text-2xl"></i>`}
                                        </div>
                                        <div>
                                            <div class="flex items-center gap-2">
                                                <h4 class="font-bold text-stone-900">${p.nombre}</h4>
                                                <span class="text-[10px] font-black bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">${p.ano || p.year || ''}</span>
                                            </div>
                                            <p class="text-xs text-stone-500 leading-tight">${p.descripcion || 'Reconocimiento a la excelencia y consistencia.'}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>` : ''}
                    </div>

                    <div class="lg:col-span-2">
                        <div class="flex items-center justify-between mb-8">
                            <h3 class="text-3xl font-display font-bold text-stone-900">Productos Destacados</h3>
                            <a href="#tienda" class="text-accent font-bold hover:underline">Ver todo el catálogo <i class="fas fa-arrow-right ml-1"></i></a>
                        </div>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            ${(isSuggested && (!products || products.length === 0)) ? tiendaHTML : this.renderProductCards(products.slice(0, 4), user.celular || user.contact_phone, user.id, user.name)}
                            ${isSuggested ? fomoHTML : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;
        if (entity.coordenadas) setTimeout(() => this.initMiniMap(entity.coordenadas), 500);
        setTimeout(() => this.initProductCharts(products.slice(0, 4)), 100);
    },

    renderTienda: function () {
        const { products, user } = this.state.landingData;
        const html = `
            <div class="container mx-auto px-6 py-12 fade-in">
                <div class="max-w-3xl mb-12">
                    <h1 class="text-4xl md:text-5xl font-display font-bold text-stone-900 mb-4">Nuestra Tienda</h1>
                    <p class="text-lg text-stone-600">Explora nuestra selección exclusiva de productos con trazabilidad garantizada directamente desde el origen.</p>
                </div>
                
                <div class="product-grid">
                    ${this.renderProductCards(products, user.celular || user.contact_phone, user.id, user.name)}
                </div>
            </div>
        `;
        this.container.innerHTML = html;
        setTimeout(() => this.initProductCharts(products), 100);
    },

    renderContacto: function () {
        const { user, entity } = this.state.landingData;
        const cleanPhone = user.celular ? user.celular.replace(/\D/g, '') : (user.contact_phone ? user.contact_phone.replace(/\D/g, '') : '');
        const waBase = cleanPhone ? `https://wa.me/${cleanPhone}` : null;
        const displayPhone = user.celular || user.contact_phone || null;

        const instagram = user.instagram || entity.social_instagram || null;
        const facebook = user.facebook || entity.social_facebook || null;

        const instagramUrl = instagram
            ? (instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`)
            : null;
        const facebookUrl = facebook
            ? (facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`)
            : null;

        const hasSocials = instagramUrl || facebookUrl;

        const socialsHtml = hasSocials ? `
            <div class="mt-8 pt-8 border-t border-stone-100">
                <h4 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Síguenos en redes</h4>
                <div class="flex flex-wrap gap-3">
                    ${instagramUrl ? `
                    <a href="${instagramUrl}" target="_blank" rel="noopener"
                        class="flex items-center gap-3 px-5 py-3 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 text-white font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <i class="fab fa-instagram text-xl"></i>
                        <span>${instagram.replace('@', '')}</span>
                    </a>` : ''}
                    ${facebookUrl ? `
                    <a href="${facebookUrl}" target="_blank" rel="noopener"
                        class="flex items-center gap-3 px-5 py-3 rounded-2xl bg-blue-600 text-white font-bold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all">
                        <i class="fab fa-facebook text-xl"></i>
                        <span>${facebook}</span>
                    </a>` : ''}
                </div>
            </div>` : '';

        const html = `
            <div class="container mx-auto px-6 py-16 fade-in">
                <div class="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
                    <div>
                        <h1 class="text-4xl md:text-5xl font-display font-bold text-stone-900 mb-6">Ponte en contacto</h1>
                        <p class="text-lg text-stone-600 mb-10">¿Tienes dudas sobre nuestros procesos o te gustaría realizar un pedido especial? Estamos aquí para ayudarte.</p>
                        
                        <div class="space-y-4">
                            ${user.email ? `
                            <div class="flex items-center gap-4 bg-stone-50 rounded-2xl p-4 border border-stone-100">
                                <div class="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
                                    <i class="fas fa-envelope text-xl"></i>
                                </div>
                                <div>
                                    <h4 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-0.5">Email</h4>
                                    <a href="mailto:${user.email}" class="font-semibold text-stone-800 hover:text-accent transition-colors">${user.email}</a>
                                </div>
                            </div>` : ''}

                            ${waBase ? `
                            <div class="bg-stone-50 rounded-2xl p-4 border border-stone-100">
                                <div class="flex items-center gap-4 mb-4">
                                    <div class="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                                        <i class="fab fa-whatsapp text-2xl"></i>
                                    </div>
                                    <div>
                                        <h4 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-0.5">WhatsApp</h4>
                                        <p class="font-semibold text-stone-800">${displayPhone}</p>
                                    </div>
                                </div>
                                <a href="${waBase}" target="_blank" rel="noopener"
                                    class="flex items-center justify-center gap-3 w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md shadow-green-100 hover:shadow-green-200 hover:-translate-y-0.5 transition-all">
                                    <i class="fab fa-whatsapp text-2xl"></i>
                                    Enviar mensaje por WhatsApp
                                </a>
                            </div>` : ''}
                        </div>

                        ${socialsHtml}
                    </div>

                    <div class="bg-white p-8 md:p-10 rounded-3xl shadow-2xl border border-stone-100">
                        <form id="contact-form" class="space-y-6" onsubmit="app.handleContactSubmit(event)">
                            <div class="space-y-2">
                                <label class="text-sm font-bold text-stone-700">Nombre completo</label>
                                <input type="text" name="name" required class="contact-input" placeholder="Ej. Juan Pérez">
                            </div>
                            <div class="space-y-2">
                                <label class="text-sm font-bold text-stone-700">Correo electrónico</label>
                                <input type="email" name="email" required class="contact-input" placeholder="juan@ejemplo.com">
                            </div>
                            <div class="space-y-2">
                                <label class="text-sm font-bold text-stone-700">Mensaje</label>
                                <textarea name="message" required rows="5" class="contact-input" placeholder="¿En qué podemos ayudarte?"></textarea>
                            </div>
                            <button type="submit" class="w-full btn-accent py-4 rounded-xl font-bold text-lg shadow-lg">Enviar mensaje</button>
                        </form>
                    </div>
                </div>
            </div>
        `;
        this.container.innerHTML = html;
    },

    handleContactSubmit: async function (e) {
        e.preventDefault();
        const btn = e.target.querySelector('button');
        const originalText = btn.textContent;
        btn.textContent = 'Enviando...';
        btn.disabled = true;

        const formData = new FormData(e.target);
        const payload = {
            company_id: this.state.landingData.user.id,
            name: formData.get('name'),
            email: formData.get('email'),
            message: formData.get('message')
        };

        try {
            const res = await fetch('/api/public/contact', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                this.container.innerHTML = `
                    <div class="container mx-auto px-6 py-24 text-center fade-in">
                        <div class="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"><i class="fas fa-check text-4xl"></i></div>
                        <h1 class="text-4xl font-display font-bold text-stone-900 mb-4">¡Mensaje enviado!</h1>
                        <p class="text-lg text-stone-600 mb-8">Gracias por contactarnos. Nos comunicaremos contigo a la brevedad.</p>
                        <a href="#inicio" class="btn-accent px-8 py-3 rounded-xl font-bold inline-block">Volver al inicio</a>
                    </div>
                `;
            } else {
                throw new Error('Error al enviar');
            }
        } catch (err) {
            alert('Hubo un problema al enviar tu mensaje. Por favor intenta de nuevo.');
            btn.textContent = originalText;
            btn.disabled = false;
        }
    },

    renderProductCards: function (products, phone, userId, companyName) {
        if (!products || products.length === 0) {
            return `<div class="col-span-full text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200"><p class="text-stone-500 italic">No hay productos disponibles.</p></div>`;
        }

        return products.map(prod => {
            const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
            const hasTraceability = prod.recent_batches && prod.recent_batches.length > 0;
            const compSlug = `${this.createSlug(companyName || '')}-${userId}`;
            const prodSlug = `${this.createSlug(prod.nombre)}-${(prod.id || '').substring(0, 8)}`;
            const detailLink = `/origen-unico/${compSlug}/${prodSlug}`;
            const fullDetailLink = window.location.origin + detailLink;
            const buyLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa este producto: ${prod.nombre}. Link: ${fullDetailLink}`)}` : '#';

            const tipo = (prod.tipo_producto || '').toLowerCase();
            const typeIcon = tipo === 'cafe' ? 'fa-mug-hot' : (tipo === 'cacao' ? 'fa-cookie-bite' : 'fa-jar');
            const typeLabel = this.toTitleCase(prod.tipo_producto || 'Producto');
            const score = prod.puntaje_sca || null;

            const perf = prod.perfil_data || {};
            const weight = `${prod.peso || ''} ${prod.unidad || 'G'}`;

            // Atributos específicos según tipo
            let attrHtml = '';
            if (tipo === 'cafe') {
                attrHtml = `
                    <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                        ${perf.variedad ? `<span class="flex items-center gap-1.5"><i class="fas fa-seedling text-stone-400"></i> ${perf.variedad}</span>` : ''}
                        ${perf.proceso ? `<span class="flex items-center gap-1.5"><i class="fas fa-sync text-stone-400"></i> ${perf.proceso}</span>` : ''}
                        ${perf.tueste ? `<span class="flex items-center gap-1.5"><i class="fas fa-fire text-stone-400"></i> ${perf.tueste}</span>` : ''}
                    </div>
                `;
            } else if (tipo === 'cacao') {
                attrHtml = `
                    <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                        ${perf.genetica ? `<span class="flex items-center gap-1.5"><i class="fas fa-dna text-stone-400"></i> ${perf.genetica}</span>` : ''}
                        ${perf.porcentaje_cacao ? `<span class="flex items-center gap-1.5"><i class="fas fa-percent text-stone-400"></i> ${perf.porcentaje_cacao}% CACAO</span>` : ''}
                    </div>
                `;
            }

            // Información de Origen (Finca)
            const fincaName = prod.nombre_finca || 'Origen Verificado';
            const fincaLoc = [prod.finca_distrito, prod.finca_provincia, prod.finca_departamento].filter(Boolean).map(p => this.toTitleCase(p)).join(', ');
            const fincaAltura = prod.finca_altura ? `${prod.finca_altura} msnm` : '';

            return `
            <div class="product-card fade-in">
                <div class="h-64 relative overflow-hidden group">
                    <img src="${prodImage}" class="w-full h-full object-cover transition duration-500 group-hover:scale-110">
                    
                    <!-- Badges superiores -->
                    <div class="absolute top-4 left-4">
                        <span class="bg-white/95 backdrop-blur shadow-sm text-stone-800 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                            <i class="fas ${typeIcon} text-amber-800"></i> ${typeLabel}
                        </span>
                    </div>
                    ${score ? `
                    <div class="absolute top-4 right-4">
                        <span class="bg-amber-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                            <i class="fas fa-star text-[9px]"></i> ${score} PTS
                        </span>
                    </div>` : ''}
                    
                    <!-- Traceability Badge (Overlay inferior) -->
                    ${hasTraceability ? `
                    <div class="absolute bottom-4 left-4">
                        <span class="bg-emerald-500/90 backdrop-blur text-white text-[9px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1">
                            <i class="fas fa-check-circle"></i> TRAZABLE
                        </span>
                    </div>` : ''}
                </div>

                <div class="p-6 flex-grow flex flex-col">
                    <div class="mb-4">
                        <h4 class="text-2xl font-display font-bold text-stone-900 leading-tight mb-1">${prod.nombre}</h4>
                        <div class="flex items-baseline gap-2">
                            <p class="text-stone-900 font-black text-2xl">${prod.moneda || 'S/'} ${prod.precio || '0.00'}</p>
                            <span class="text-stone-400 font-bold text-sm uppercase">${weight}</span>
                        </div>
                        ${attrHtml}
                    </div>

                    <!-- Finca Card -->
                    <div class="bg-stone-50 rounded-2xl p-4 border border-stone-100 mb-6">
                        <div class="flex items-start gap-3">
                            <div class="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center flex-shrink-0 text-stone-400">
                                <i class="fas fa-map-marker-alt text-red-500/70 text-xs"></i>
                            </div>
                            <div>
                                <h5 class="font-bold text-stone-800 text-sm leading-tight">${fincaName}</h5>
                                <p class="text-[10px] text-stone-500 mt-0.5 line-clamp-1">${fincaLoc || 'Perú'}</p>
                                ${fincaAltura ? `<p class="text-[10px] font-bold text-amber-900 mt-1 flex items-center gap-1"><i class="fas fa-mountain text-[8px]"></i> ${fincaAltura}</p>` : ''}
                            </div>
                        </div>
                    </div>

                    <div class="mt-auto flex flex-col gap-3">
                        ${this.state.landingData?.user?.is_suggested ? `
                            <button disabled class="w-full bg-stone-200 text-stone-400 py-3 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 cursor-not-allowed" title="Reclama tu perfil para activar ventas">
                                <i class="fab fa-whatsapp"></i> Comprar ahora (No disponible)
                            </button>
                            <button disabled class="block w-full text-center bg-stone-100 text-stone-400 py-2.5 rounded-xl font-bold text-sm cursor-not-allowed">Ver detalles (No disponible)</button>
                        ` : `
                            <a id="whatsapp-btn" href="${buyLink}" target="_blank" onclick="app.trackEvent('buy_click', '${userId}', '${prod.id}')" class="btn-accent py-3 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2">
                                <i class="fab fa-whatsapp"></i> Comprar ahora
                            </a>
                            <a href="${detailLink}" class="block w-full text-center bg-stone-100 hover:bg-stone-200 text-stone-700 py-2.5 rounded-xl font-bold text-sm transition">Ver detalles</a>
                        `}
                    </div>
                </div>
            </div>`;
        }).join('');
    },

    createSlug: function (text) {
        return (text || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
    },

    // --- JSON-LD ---
    injectJsonLd: function ({ user, entity, products, isFinca, entityName, locationStr, coverImage }) {
        // Eliminar script previo si existe (por si se recarga)
        const existing = document.getElementById('json-ld-landing');
        if (existing) existing.remove();

        // Construir dirección estructurada
        const addressParts = {
            streetAddress: entity.direccion || '',
            addressLocality: this.toTitleCase(entity.distrito || entity.provincia || ''),
            addressRegion: this.toTitleCase(entity.departamento || ''),
            addressCountry: this.toTitleCase(entity.pais || 'PE')
        };

        // Coordenadas para geo (si existen como {lat, lng} o como primer punto de polígono)
        let geoSchema = null;
        if (entity.coordenadas) {
            let lat, lng;
            if (entity.coordenadas.lat && entity.coordenadas.lng) {
                lat = entity.coordenadas.lat;
                lng = entity.coordenadas.lng;
            } else if (Array.isArray(entity.coordenadas) && entity.coordenadas.length > 0) {
                if (Array.isArray(entity.coordenadas[0])) {
                    lat = entity.coordenadas[0][0];
                    lng = entity.coordenadas[0][1];
                }
            }
            if (lat && lng) {
                geoSchema = { '@type': 'GeoCoordinates', latitude: lat, longitude: lng };
            }
        }

        // URL canónica de la página
        const pageUrl = window.location.href;

        // Teléfono limpio
        const phone = user.celular ? user.celular.replace(/\D/g, '') : null;

        // Redes sociales
        const sameAs = [];
        const instagram = user.instagram || entity.social_instagram;
        const facebook = user.facebook || entity.social_facebook;
        if (instagram) sameAs.push(instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`);
        if (facebook) sameAs.push(facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`);

        // Tipo de schema según si es finca o procesadora
        const schemaType = isFinca ? 'Organization' : 'LocalBusiness';

        const jsonLd = {
            '@context': 'https://schema.org',
            '@type': schemaType,
            name: entityName,
            description: user.history || entity.historia || 'Trazabilidad y origen único para productos de especialidad.',
            url: pageUrl,
            image: coverImage || undefined,
            ...(phone && { telephone: `+${phone}` }),
            ...(sameAs.length && { sameAs }),
            address: {
                '@type': 'PostalAddress',
                ...addressParts
            },
            ...(geoSchema && { geo: geoSchema }),
            // Productos como ItemList
            ...(products && products.length > 0 && {
                hasOfferCatalog: {
                    '@type': 'OfferCatalog',
                    name: `Catálogo de ${entityName}`,
                    itemListElement: products.map((prod, idx) => ({
                        '@type': 'Offer',
                        position: idx + 1,
                        itemOffered: {
                            '@type': 'Product',
                            name: prod.nombre,
                            description: prod.descripcion || undefined,
                            image: (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : undefined,
                            review: {
                                '@type': 'Review',
                                reviewRating: {
                                    '@type': 'Rating',
                                    ratingValue: 5,
                                    bestRating: 5
                                },
                                author: {
                                    '@type': 'Organization',
                                    name: entityName
                                }
                            }
                        }
                    }))
                }
            })
        };

        const script = document.createElement('script');
        script.id = 'json-ld-landing';
        script.type = 'application/ld+json';
        script.textContent = JSON.stringify(jsonLd);
        document.head.appendChild(script);
    },

    renderProductList: function (products, phone, userId) {
        if (!products || products.length === 0) {
            return `<div class="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200"><p class="text-stone-500 italic">No hay productos disponibles.</p></div>`;
        }

        return products.map(prod => {
            const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
            const hasTraceability = prod.recent_batches && prod.recent_batches.length > 0;
            const hasSensory = prod.perfil_data && Object.values(prod.perfil_data).some(v => v > 0);
            const hasWheel = prod.notas_rueda && prod.notas_rueda.length > 0;
            const buyLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=Hola vi esto en RuruLab, me interesa: ${encodeURIComponent(prod.nombre)}` : '#';

            const createSlug = text => (text || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
            const productName = createSlug(prod.nombre) || 'producto';
            const fincaSlug = prod.finca && prod.finca.nombre ? createSlug(prod.finca.nombre) : 'origen';
            const { user } = this.state.landingData;
            const compSlug = `${createSlug(user.name || '')}-${user.id}`;
            const detailLink = `/origen-unico/${compSlug}/${productName}-${(prod.id || '').substring(0, 8)}`;

            const showTabs = hasSensory || hasWheel;
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

            return `
            <div class="bg-white rounded-2xl ${cardClasses} shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition duration-300 flex flex-col md:flex-row">
                <!-- Imagen -->
                <div class="md:w-1/3 h-56 md:h-auto relative group overflow-hidden bg-stone-100 flex-shrink-0">
                    <img src="${prodImage}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
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

                <!-- Contenido -->
                <div class="md:w-2/3 flex flex-col">
                    <!-- Cabecera -->
                    <div class="p-6 pb-2">
                        <div class="flex justify-between items-start mb-1">
                            <div>
                                <h4 class="text-xl font-bold text-stone-900 leading-tight">${prod.nombre}</h4>
                                <div class="flex items-center gap-2 mt-1">
                                    <span class="text-lg font-black text-amber-900">${prod.moneda || 'S/'} ${prod.precio || '0.00'}</span>
                                    <p class="text-xs text-stone-400 font-bold mt-1 bg-stone-50 inline-block px-2 py-0.5 rounded border border-stone-100">
                                        ${prod.peso || ''} ${prod.unidad || ''}
                                    </p>
                                </div>
                            </div>
                            <div class="flex flex-wrap gap-1.5 justify-end ml-2">
                                ${(prod.premios || []).map(pr => `
                                    <div class="flex flex-col items-center justify-center bg-white p-1.5 rounded-lg border border-stone-100 shadow-sm min-w-[3rem]" title="${pr.nombre || pr.name}">
                                        ${pr.logo_url ? `<img src="${pr.logo_url}" class="h-12 w-12 object-contain mb-0.5">` : `<i class="fas fa-medal text-amber-400 text-lg mb-0.5"></i>`}
                                        <span class="text-[9px] font-bold text-stone-600 leading-none">${pr.year || pr.ano || ''}</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>

                    <!-- Pestañas -->
                    ${showTabs ? `
                    <div class="px-6 border-b border-stone-100 flex gap-4 text-sm font-medium">
                        <button onclick="app.switchTab(this, 'info-${prod.id}')" class="tab-btn active pb-2 border-b-2 border-amber-800 text-amber-900 transition hover:text-amber-700">Detalles</button>
                        ${hasSensory ? `<button onclick="app.switchTab(this, 'sensory-${prod.id}')" class="tab-btn pb-2 border-b-2 border-transparent text-stone-400 hover:text-stone-600 transition flex items-center gap-1"><i class="fas fa-chart-radar text-xs"></i> Perfil</button>` : ''}
                        ${hasWheel ? `<button onclick="app.switchTab(this, 'wheel-${prod.id}')" class="tab-btn pb-2 border-b-2 border-transparent text-stone-400 hover:text-stone-600 transition flex items-center gap-1"><i class="fas fa-chart-pie text-xs"></i> Rueda</button>` : ''}
                    </div>
                    ` : ''}

                    <!-- Contenedor de Pestañas (Clase tab-container para identificación) -->
                    <div class="p-6 pt-4 flex-grow relative tab-container">
                        
                        <!-- TAB 1: INFORMACIÓN -->
                        <div id="info-${prod.id}" class="tab-content active space-y-4 block opacity-100">
                            <p class="text-stone-600 text-sm leading-relaxed line-clamp-4">${prod.descripcion || 'Sin descripción detallada.'}</p>
                        </div>

                        <!-- TAB 2: PERFIL SENSORIAL o Taza -->
                        ${hasSensory ? `
                        <div id="sensory-${prod.id}" class="tab-content hidden opacity-0 h-48 w-full flex items-center justify-center">
                            <div class="w-full h-full max-w-md relative">
                                <canvas id="canvas-radar-${prod.id}"></canvas>
                            </div>
                        </div>` : ''}

                        <!-- TAB 3: RUEDA SABOR (Placeholder for client-side D3 Sunburst) -->
                        ${hasWheel ? `
                        <div id="wheel-${prod.id}" class="tab-content hidden opacity-0 h-auto w-full flex flex-col items-center justify-center">
                            <div id="sunburst-${prod.id}" class="w-full h-[300px] flex items-center justify-center"></div>
                        </div>` : ''}
                    </div>
                    
                    <!-- AREA DE ACCIÓN (Siempre visible abajo) -->
                    <div class="px-6 pb-4">
                        <div class="flex items-center justify-between pt-3 border-t border-stone-100">
                            <span class="text-xs font-bold text-stone-400 uppercase tracking-widest">
                                ${hasTraceability ? `<i class="fas fa-cubes text-emerald-500"></i> ${prod.recent_batches.length} Lotes` : ''}
                            </span>
                            <div class="flex gap-2">
                                ${this.state.landingData?.user?.is_suggested ? `
                                    <button disabled class="bg-stone-100 text-stone-400 border border-stone-200 px-4 py-2 rounded-xl text-sm font-bold cursor-not-allowed shadow-sm" title="Reclama tu perfil">
                                        Detalle (No disponible)
                                    </button>
                                    <button disabled class="bg-stone-200 text-stone-400 px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2 cursor-not-allowed shadow-sm">
                                        <i class="fas fa-shopping-cart"></i> Comprar (No disp.)
                                    </button>
                                ` : `
                                    <a href="${detailLink}" class="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 hover:border-amber-300 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center shadow-sm">
                                        Ver Detalle
                                    </a>
                                    <a href="${buyLink}" target="_blank" class="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg">
                                        <i class="fas fa-shopping-cart"></i> Comprar
                                    </a>
                                `}
                            </div>
                        </div>
                    </div>

                    <!-- Footer Lotes (Opcional, si quieres mantenerlo) -->
                    ${batchesHtml ? `<div class="bg-emerald-50/50 p-4 border-t border-emerald-100/50 backdrop-blur-sm"><p class="text-[10px] font-bold text-stone-400 mb-3 uppercase tracking-widest"><i class="fas fa-history text-emerald-500 mr-1"></i> Lotes con Trazabilidad</p><div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">${batchesHtml}</div></div>` : ''}
                </div>
            </div>`;
        }).join('');
    },

    // --- UTILIDAD TABS ---
    switchTab: function (btn, targetId) {
        const parent = btn.parentElement;
        // Buscamos el contenedor de tabs explícitamente por clase
        const productCard = parent.parentElement;
        const container = productCard.querySelector('.tab-container');

        if (!container) return;

        // 1. Estilos Botones
        parent.querySelectorAll('.tab-btn').forEach(b => {
            b.classList.remove('active', 'border-amber-800', 'text-amber-900');
            b.classList.add('border-transparent', 'text-stone-400');
        });
        btn.classList.add('active', 'border-amber-800', 'text-amber-900');
        btn.classList.remove('border-transparent', 'text-stone-400');

        // 2. Ocultar todos los contenidos dentro de este contenedor
        container.querySelectorAll('.tab-content').forEach(c => {
            c.classList.add('hidden', 'opacity-0');
            c.classList.remove('block', 'opacity-100');
        });

        // 3. Mostrar target seleccionado
        const target = document.getElementById(targetId);
        if (target) {
            target.classList.remove('hidden');
            target.classList.add('block');

            setTimeout(() => {
                target.classList.remove('opacity-0');
                target.classList.add('opacity-100');

                // Redibujar gráficos si existen en esta pestaña
                const canvas = target.querySelector('canvas');
                if (canvas && productChartInstances[canvas.id]) {
                    productChartInstances[canvas.id].resize();
                }
            }, 10);
        }
    },

    // --- GRÁFICOS ---
    initProductCharts: function (products) {
        products.forEach(p => {
            // Radar (Chart.js)
            if (p.perfil_data && document.getElementById(`canvas-radar-${p.id}`)) {
                if (typeof ChartUtils !== 'undefined') {
                    ChartUtils.initializePerfilChart(`canvas-radar-${p.id}`, p.perfil_data, p.tipo_producto);
                }
            }

            // Flavor Wheel (D3 Sunburst - Tastify Style)
            if (p.notas_rueda && document.getElementById(`sunburst-${p.id}`)) {
                if (typeof SunburstChart !== 'undefined' && this.state.flavorWheelsData) {
                    const type = (p.tipo_producto || '').toLowerCase();
                    const wheelData = this.state.flavorWheelsData[type] || this.state.flavorWheelsData['cacao'];

                    if (wheelData) {
                        SunburstChart.render(`#sunburst-${p.id}`, wheelData, {
                            selection: p.notas_rueda,
                            isWidget: true, // ESTILO TASTIFY: Poda jerárquica
                            width: 300,
                            height: 300
                        });
                    }
                }
            }
        });
    },

    // --- CAROUSEL FUNCTIONS (from origen-unico-app.js) ---
    openGallery: function (index, items) {
        if (!this.state.gallery) { this.state.gallery = { images: [], currentIndex: 0, isOpen: false }; }
        this.state.gallery.images = items.map(item => { if (typeof item === 'string') return { type: 'image', src: item }; return item; });
        this.state.gallery.currentIndex = index;
        this.state.gallery.isOpen = true;
        this.renderGalleryModal();
    },
    closeGallery: function () {
        if (this.state.gallery) this.state.gallery.isOpen = false;
        const modal = document.getElementById('gallery-overlay');
        if (modal) modal.remove();
    },
    nextGalleryImage: function () {
        if (!this.state.gallery || !this.state.gallery.images.length) return;
        this.state.gallery.currentIndex = (this.state.gallery.currentIndex + 1) % this.state.gallery.images.length;
        this.updateGalleryUI();
    },
    prevGalleryImage: function () {
        if (!this.state.gallery || !this.state.gallery.images.length) return;
        this.state.gallery.currentIndex = (this.state.gallery.currentIndex - 1 + this.state.gallery.images.length) % this.state.gallery.images.length;
        this.updateGalleryUI();
    },
    updateGalleryUI: function () {
        const contentContainer = document.getElementById('gallery-content');
        const counter = document.getElementById('gallery-counter');
        const item = this.state.gallery.images[this.state.gallery.currentIndex];
        if (contentContainer) { contentContainer.innerHTML = this.getMediaHtml(item); }
        if (counter) { counter.textContent = `${this.state.gallery.currentIndex + 1} / ${this.state.gallery.images.length}`; }
    },
    getMediaHtml: function (item) {
        if (item.type === 'video') {
            return `<div style="position: relative; width: 100%; max-width: 960px; padding-bottom: 56.25%; background: #000; border-radius: 12px; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);"><iframe src="https://www.youtube.com/embed/${item.videoId}?autoplay=1&rel=0" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;
        } else {
            return `<img src="${item.src}" style="max-height: 85vh; max-width: 90vw; object-fit: contain; border-radius: 8px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);" class="animate-fade-in">`;
        }
    },
    renderGalleryModal: function () {
        const items = this.state.gallery.images;
        const index = this.state.gallery.currentIndex;
        const currentItem = items[index];
        const html = `
            <div id="gallery-overlay" style="position: fixed; inset: 0; z-index: 9999; background: rgba(0,0,0,0.95); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center;">
                <button onclick="app.closeGallery()" style="position: absolute; top: 20px; right: 20px; z-index: 10001; width: 50px; height: 50px; border-radius: 50%; border: none; background: rgba(255,255,255,0.1); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.8)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'"><i class="fas fa-times" style="font-size: 24px;"></i></button>
                <div style="position: absolute; top: 25px; left: 25px; z-index: 10001; color: white; font-family: monospace; font-size: 14px; background: rgba(0,0,0,0.5); padding: 5px 15px; border-radius: 20px;"><span id="gallery-counter">${index + 1} / ${items.length}</span></div>
                <button onclick="app.prevGalleryImage()" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); z-index: 10001; width: 50px; height: 50px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s;"><i class="fas fa-chevron-left" style="font-size: 20px;"></i></button>
                <div id="gallery-content" style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; padding: 20px;">${this.getMediaHtml(currentItem)}</div>
                <button onclick="app.nextGalleryImage()" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); z-index: 10001; width: 50px; height: 50px; border-radius: 50%; border: none; background: rgba(0,0,0,0.5); color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.3s;"><i class="fas fa-chevron-right" style="font-size: 20px;"></i></button>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', html);
    },

    initMiniMap: function (coords) {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') return;
        try {
            let paths = coords;
            if (typeof coords === 'string') { try { paths = JSON.parse(coords); } catch (e) { return; } }
            if (!paths) return;
            const mapOptions = { zoom: 13, mapTypeId: 'satellite', disableDefaultUI: true, draggable: false, zoomControl: false, scrollwheel: false, disableDoubleClickZoom: true };
            const map = new google.maps.Map(document.getElementById('mini-map'), mapOptions);
            if (Array.isArray(paths) && paths.length > 0 && Array.isArray(paths[0])) {
                const polygonPaths = paths.map(p => ({ lat: parseFloat(p[0]), lng: parseFloat(p[1]) }));
                map.setCenter(polygonPaths[0]);
                new google.maps.Polygon({ paths: polygonPaths, strokeColor: "#10b981", strokeOpacity: 0.8, strokeWeight: 2, fillColor: "#10b981", fillOpacity: 0.35, map: map });
                const bounds = new google.maps.LatLngBounds();
                polygonPaths.forEach(p => bounds.extend(p));
                map.fitBounds(bounds);
            } else {
                let position = null;
                if (paths.lat && paths.lng) position = { lat: parseFloat(paths.lat), lng: parseFloat(paths.lng) };
                else if (Array.isArray(paths) && paths.length === 2 && !Array.isArray(paths[0])) { position = { lat: parseFloat(paths[0]), lng: parseFloat(paths[1]) }; }
                if (position) { map.setCenter(position); map.setZoom(15); new google.maps.Marker({ position: position, map: map, title: "Ubicación" }); }
            }
        } catch (e) { console.error("Error mapa:", e); }
    }
};

window.app = app;

document.addEventListener('DOMContentLoaded', () => {
    app.init();
});