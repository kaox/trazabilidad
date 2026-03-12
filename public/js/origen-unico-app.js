const app = {
    state: {
        view: 'companies',
        selectedCompany: null,
        companies: [], // Almacén para evitar peticiones repetidas
        currentFilter: 'all',        // Filtro de Entidad (Finca/Procesadora)
        currentProductFilter: 'all',  // Filtro de Producto (Cafe/Cacao/Miel)
        currentSubtypeFilter: 'all',  // Filtro de Subtipo (depende del tipo)
        organizaciones: []            // Almacenar datos de organizaciones/subtipos
    },

    // Mapeo de iconos FontAwesome para subtipos
    subtypeIcons: {
        // Finca subtipos
        'Individual': 'fas fa-user text-amber-600',
        'Cooperativa': 'fas fa-users text-green-600',
        'Asociación': 'fas fa-handshake text-blue-600',
        // Procesadora subtipos
        'Acopiadora': 'fas fa-warehouse text-purple-600',
        'Tostadora': 'fas fa-fire text-orange-600',
        'Chocolateria': 'fas fa-candy-cane text-pink-600',
        'Cafeteria': 'fas fa-mug-hot text-amber-700',
        'Laboratorio': 'fas fa-flask text-indigo-600',
        'Exportadora': 'fas fa-globe text-cyan-600'
    },

    container: document.getElementById('app-container'),
    breadcrumbs: document.getElementById('breadcrumbs'),

    // Variables para el mapa de sugerencias y visualización
    map: null,
    markers: [],
    infoWindow: null,

    init: async function () {
        if (typeof google !== 'undefined' && google.maps) {
            this.infoWindow = new google.maps.InfoWindow();
        }
        // Cargar datos de organizaciones (subtipos)
        await this.loadOrganizaciones();
        // En esta vista solo cargamos las empresas y configuramos el formulario
        await this.loadCompanies();
        this.setupSuggestForm();
    },

    // --- ANALYTICS ---
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

    // --- CARGAR ORGANIZACIONES (SUBTIPOS) ---
    loadOrganizaciones: async function () {
        try {
            const res = await fetch('/data/organizaciones.json');
            this.state.organizaciones = await res.json();
        } catch (e) {
            console.error('Error al cargar organizaciones:', e);
            this.state.organizaciones = [];
        }
    },

    // --- UTILS ---
    createSlug: function (text) {
        if (!text) return '';
        return text.toString().toLowerCase().trim()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/\s+/g, '-')
            .replace(/[^\w\-]+/g, '')
            .replace(/\-\-+/g, '-');
    },

    toTitleCase: function (str) {
        if (!str) return '';
        return str.toLowerCase().split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    },

    // --- MANEJO DE FILTROS ---
    setFilter: function (filterType) {
        this.state.currentFilter = filterType;

        // Actualizar UI de botones de Entidad
        document.querySelectorAll('.filter-btn').forEach(btn => {
            if (btn.getAttribute('data-filter') === filterType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Actualizar subtipos disponibles
        this.updateSubtypeButtons();
        
        // Resetear filtro de subtipo al cambiar tipo
        this.state.currentSubtypeFilter = 'all';

        this.renderCompanies();
        this.renderMap();
    },

    setSubtypeFilter: function (subtypeValue) {
        this.state.currentSubtypeFilter = subtypeValue.toLowerCase();
        
        // Actualizar UI de botones de Subtipo
        document.querySelectorAll('.subtype-filter-btn').forEach(btn => {
            if (btn.getAttribute('data-subtype-filter') === subtypeValue.toLowerCase()) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderCompanies();
        this.renderMap();
    },

    updateSubtypeButtons: function () {
        const subtypesFilterSection = document.getElementById('subtypes-filter');
        const subtypesContainer = document.getElementById('subtypes-container');
        const currentType = this.state.currentFilter;

        // Si el filtro es 'all', ocultar el selector de subtipos
        if (currentType === 'all') {
            subtypesFilterSection.classList.add('hidden');
            return;
        }

        // Encontrar el objeto del tipo actual en las organizaciones
        const tipoData = this.state.organizaciones.find(org => org.tipo === currentType);
        
        if (!tipoData || !tipoData.subtipos || tipoData.subtipos.length === 0) {
            subtypesFilterSection.classList.add('hidden');
            return;
        }

        // Mostrar el selector de subtipos
        subtypesFilterSection.classList.remove('hidden');

        // Limpiar botones anteriores
        subtypesContainer.innerHTML = '';

        // Crear botones para cada subtipo
        tipoData.subtipos.forEach(subtipo => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'subtype-filter-btn whitespace-nowrap px-4 py-1.5 rounded-full border border-stone-200 bg-white text-stone-600 font-bold text-xs transition-all flex items-center gap-1.5';
            const subtypeNormalized = subtipo.toLowerCase();
            btn.setAttribute('data-subtype-filter', subtypeNormalized);
            
            // Obtener icono para este subtipo
            const iconClass = this.subtypeIcons[subtipo] || 'fas fa-tag text-stone-600';
            
            // Crear contenido con icono
            btn.innerHTML = `<i class="${iconClass}"></i> ${subtipo}`;
            btn.onclick = () => this.setSubtypeFilter(subtypeNormalized);
            subtypesContainer.appendChild(btn);
        });
    },

    setProductFilter: function(prodFilterType) {
        this.state.currentProductFilter = prodFilterType;
        
        // Actualizar UI de botones de Producto
        document.querySelectorAll('.prod-filter-btn').forEach(btn => {
            if (btn.getAttribute('data-prod-filter') === prodFilterType) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this.renderCompanies();
        this.renderMap();
    },

    // Función Helper para obtener empresas filtradas por todos los criterios
    getFilteredCompanies: function() {
        const typeFilter = this.state.currentFilter;
        const prodFilter = this.state.currentProductFilter;
        const subtypeFilter = this.state.currentSubtypeFilter;
        
        return this.state.companies.filter(c => {
            // 1. Filtro por Tipo de Entidad
            const matchType = typeFilter === 'all' || c.type === typeFilter;
            
            // 2. Filtro por Categoría de Producto
            let matchProduct = true;
            if (prodFilter !== 'all') {
                let categories = [];
                if (typeof c.product_categories === 'string') {
                    try { categories = JSON.parse(c.product_categories); } catch(e) {}
                } else if (Array.isArray(c.product_categories)) {
                    categories = c.product_categories;
                }
                
                matchProduct = categories && categories.includes(prodFilter);
            }

            // 3. Filtro por Subtipo (si está disponible)
            let matchSubtype = true;
            if (subtypeFilter !== 'all') {
                const cSubtype = c.sub_type ? String(c.sub_type).toLowerCase() : '';
                matchSubtype = cSubtype === subtypeFilter;
            }

            return matchType && matchProduct && matchSubtype;
        });
    },

    // --- NIVEL 1: LISTADO DE EMPRESAS (DISEÑO MEJORADO) ---
    loadCompanies: async function () {
        if (this.state.companies.length > 0) { 
            this.renderCompanies(); 
            this.renderMap();
            return; 
        }
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';
        try {
            const res = await fetch('/api/public/companies');
            this.state.companies = await res.json();
            this.renderCompanies();
            this.renderMap();
        } catch (e) { this.container.innerHTML = '<p class="text-center py-20 text-stone-400">No se pudo cargar el directorio.</p>'; }
    },

    renderCompanies: function () {
        const filtered = this.getFilteredCompanies();

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;

        if (filtered.length > 0) {
            filtered.forEach(c => {
                const logoSrc = c.logo || c.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f5f5f4&color=78350f&size=128`;
                const isFinca = c.type === 'finca';
                const typeColor = isFinca ? 'amber' : 'blue';
                const locationStr = [c.distrito, c.provincia, c.departamento, c.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación por verificar';

                // Mostrar mini tags de productos en la tarjeta si los tiene
                let tagsHtml = '';
                let categories = [];
                try { categories = typeof c.product_categories === 'string' ? JSON.parse(c.product_categories) : (c.product_categories || []); } catch(e){}
                
                if (categories.length > 0) {
                    const topTags = categories.slice(0, 2).map(cat => {
                        let icon = '';
                        if(cat==='cafe') icon = '☕ ';
                        if(cat==='cacao') icon = '🍫 ';
                        if(cat==='miel') icon = '🍯 ';
                        return `<span class="text-[9px] font-bold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200 capitalize">${icon}${cat}</span>`;
                    }).join(' ');
                    const moreTag = categories.length > 2 ? `<span class="text-[9px] font-bold text-stone-400">+${categories.length-2}</span>` : '';
                    tagsHtml = `<div class="flex gap-1 mt-2">${topTags}${moreTag}</div>`;
                }

                const slug = this.createSlug(c.name) + '-' + c.id;
                const linkUrl = `/origen-unico/${slug}`;
                html += `
                    <a href="${linkUrl}" class="group relative bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full text-left no-underline">
                        <div class="h-2 w-full bg-${typeColor}-600/20 group-hover:bg-${typeColor}-600 transition-colors duration-500"></div>
                        <div class="p-6 flex flex-col h-full">
                            <div class="flex justify-between items-start mb-6">
                                <img src="${logoSrc}" class="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md bg-white">
                                ${c.status === 'pending' ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">Sugerido</span>' : '<span class="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100"><i class="fas fa-check-circle"></i> Verificado</span>'}
                            </div>
                            <div class="flex-grow">
                                <span class="text-[10px] font-black uppercase tracking-[0.15em] text-${typeColor}-600 mb-1 block">${isFinca ? '<i class="fas fa-leaf mr-1"></i> Productor' : '<i class="fas fa-industry mr-1"></i> Procesadora'}</span>
                                <h3 class="text-2xl font-display font-black text-stone-900 leading-tight group-hover:text-amber-900 transition-colors line-clamp-2">${c.name}</h3>
                                <p class="text-sm text-stone-500 mt-1 flex items-center gap-2 font-medium"><i class="fas fa-map-marker-alt text-stone-300 group-hover:text-amber-600 transition-colors"></i> ${locationStr}</p>
                                ${tagsHtml}
                            </div>
                            <div class="mt-6 pt-5 border-t border-stone-100 flex items-center justify-between">
                                <div class="flex flex-col"><span class="text-[10px] font-bold text-stone-400 uppercase"></span><span class="text-lg font-black text-stone-800"></span></div>
                                <div class="text-sm font-bold text-amber-800 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">Ver Perfil <i class="fas fa-arrow-right ml-1"></i></div>
                            </div>
                        </div>
                    </a>`;
            });
        } else {
            html += `<div class="col-span-full py-20 text-center">
                        <i class="fas fa-search text-stone-200 text-5xl mb-4"></i>
                        <p class="text-stone-400 font-medium">No se encontraron empresas con esos filtros.</p>
                     </div>`;
        }

        // Tarjeta "Tu Marca Aquí"
        html += `
            <div onclick="app.openSuggestModal()" class="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/30 hover:bg-amber-50 hover:border-amber-400 cursor-pointer transition-all duration-500 min-h-[280px]">
                <div class="w-16 h-16 rounded-2xl bg-white border border-amber-100 flex items-center justify-center mb-4 shadow-sm"><i class="fas fa-plus text-3xl text-amber-500"></i></div>
                <h3 class="text-xl font-display font-bold text-amber-900 mb-2">¿Tu Marca Aquí?</h3>
                <p class="text-sm text-stone-600 text-center mb-6 max-w-[200px]">Únete a la red de transparencia global.</p>
                <span class="bg-amber-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-amber-900 transition-all">Sugerir Empresa</span>
            </div></div>`;

        this.container.innerHTML = html;
    },

    renderMap: function () {
        if (typeof google === 'undefined' || !google.maps) {
            console.error("Google Maps API no está cargada.");
            return;
        }

        const mapContainer = document.getElementById('map-world-container');
        if (!mapContainer) return;

        if (!this.infoWindow) {
            this.infoWindow = new google.maps.InfoWindow();
        }

        // Inicializar mapa si no existe
        if (!this.map) {
            this.map = new google.maps.Map(mapContainer, {
                center: { lat: -9.19, lng: -75.0152 }, // Perú por defecto
                zoom: 5,
                styles: [
                    { "featureType": "administrative", "elementType": "labels.text.fill", "stylers": [{ "color": "#444444" }] },
                    { "featureType": "landscape", "elementType": "all", "stylers": [{ "color": "#f2f2f2" }] },
                    { "featureType": "poi", "elementType": "all", "stylers": [{ "visibility": "off" }] },
                    { "featureType": "road", "elementType": "all", "stylers": [{ "saturation": -100 }, { "lightness": 45 }] },
                    { "featureType": "road.highway", "elementType": "all", "stylers": [{ "visibility": "simplified" }] },
                    { "featureType": "road.arterial", "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
                    { "featureType": "transit", "elementType": "all", "stylers": [{ "visibility": "off" }] },
                    { "featureType": "water", "elementType": "all", "stylers": [{ "color": "#c1c1c1" }, { "visibility": "on" }] }
                ]
            });
        }

        // Limpiar marcadores existentes
        if (this.markers && this.markers.length > 0) {
            for (let i = 0; i < this.markers.length; i++) {
                this.markers[i].setMap(null);
            }
            this.markers = [];
        }

        // Obtener la misma lista filtrada que se usa para las tarjetas
        const filtered = this.getFilteredCompanies();

        const bounds = new google.maps.LatLngBounds();
        let hasValidCoords = false;

        filtered.forEach(c => {
            if (c.coordenadas && c.coordenadas.lat && c.coordenadas.lng) {
                const lat = parseFloat(c.coordenadas.lat);
                const lng = parseFloat(c.coordenadas.lng);

                if (isNaN(lat) || isNaN(lng)) return;

                const position = { lat, lng };
                bounds.extend(position);
                hasValidCoords = true;

                const isFinca = c.type === 'finca';
                const typeColor = isFinca ? '#d97706' : '#2563eb'; // amber-600 o blue-600
                const iconPath = 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z';

                const marker = new google.maps.Marker({
                    position: position,
                    map: this.map,
                    title: c.name,
                    icon: {
                        path: iconPath,
                        fillColor: typeColor,
                        fillOpacity: 1,
                        strokeWeight: 2,
                        strokeColor: '#FFFFFF',
                        scale: 1.5,
                        anchor: new google.maps.Point(12, 24)
                    }
                });

                // InfoWindow Content
                const logoSrc = c.logo || c.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f5f5f4&color=78350f&size=128`;
                const locationStr = [c.distrito, c.provincia, c.departamento, c.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación por verificar';
                const slug = this.createSlug(c.name) + '-' + c.id;
                const linkUrl = `/origen-unico/${slug}`;
                const statusBadge = c.status === 'pending'
                    ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100">Sugerido</span>'
                    : '<span class="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-100"><i class="fas fa-check-circle"></i> Verificado</span>';

                const typeSpan = isFinca ? '<span class="text-[10px] font-black uppercase tracking-[0.1em] text-amber-600"><i class="fas fa-leaf mr-1"></i> Productor</span>' : '<span class="text-[10px] font-black uppercase tracking-[0.1em] text-blue-600"><i class="fas fa-industry mr-1"></i> Procesadora</span>';

                const contentString = `
                    <div class="p-2 max-w-[240px] font-sans">
                        <div class="flex justify-between items-start mb-3 gap-2">
                            <img src="${logoSrc}" class="w-12 h-12 rounded-lg object-cover border border-stone-200 shadow-sm" alt="Logo">
                            ${statusBadge}
                        </div>
                        ${typeSpan}
                        <h3 class="text-base font-bold text-stone-900 leading-tight mt-1 mb-1">${c.name}</h3>
                        <p class="text-xs text-stone-500 mb-3"><i class="fas fa-map-marker-alt text-stone-300"></i> ${locationStr}</p>
                        <a href="${linkUrl}" class="block text-center w-full bg-amber-800 text-white text-xs font-bold py-2 rounded-lg hover:bg-amber-900 transition-colors" style="text-decoration:none;">
                            Ver Perfil &rarr;
                        </a>
                    </div>
                `;

                marker.addListener("click", () => {
                    this.infoWindow.setContent(contentString);
                    this.infoWindow.open(this.map, marker);
                });

                this.markers.push(marker);
            }
        });

        if (hasValidCoords && filtered.length > 1) {
            this.map.fitBounds(bounds);
        } else if (hasValidCoords && filtered.length === 1) {
            this.map.setCenter(bounds.getCenter());
            this.map.setZoom(12);
        } else {
            // Si no hay coordenadas tras filtrar, volver a la vista general de Perú
            this.map.setCenter({ lat: -9.19, lng: -75.0152 });
            this.map.setZoom(5);
        }
    },

    // --- RESTO DE FUNCIONES (MAPAS, MODALES, ETC.) ---
    openSuggestModal: function () {
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

    bindLogoEvents: function () {
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

    setupSuggestForm: function () {
        const form = document.getElementById('suggest-form');
        if (!form) return;

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

            if (data.coordenadas) {
                try { data.coordenadas = JSON.parse(data.coordenadas); } catch (e) { data.coordenadas = null; }
            }

            try {
                const res = await fetch('/api/public/suggest', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });

                if (!res.ok) throw new Error("Error al enviar la sugerencia");

                // Limpiar estado
                this.pendingLogoBase64 = null;
                e.target.reset();
                const preview = document.getElementById('logo-preview');
                if (preview) preview.innerHTML = '<i class="fas fa-image text-stone-300"></i>';

                alert("¡Gracias! Tu sugerencia ha sido enviada con éxito.");
                document.getElementById('suggest-modal').close();
                this.loadCompanies();

            } catch (err) {
                alert("Hubo un problema: " + err.message);
            } finally {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-paper-plane mr-2"></i> Enviar Sugerencia';
            }
        });
    },

    resetToCompanies: function () {
        this.loadCompanies();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());