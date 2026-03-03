const app = {
    state: {
        view: 'companies',
        selectedCompany: null,
        companies: [], // Almacén para evitar peticiones repetidas
        currentFilter: 'all',
        displayMode: 'grid'
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

    setFilter: function (filterType) {
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
        if (this.state.displayMode === 'map') {
            this.renderMap();
        }
    },

    setDisplayMode: function (mode) {
        if (this.state.displayMode === mode) return;
        this.state.displayMode = mode;

        const btnGrid = document.getElementById('btn-view-grid');
        const btnMap = document.getElementById('btn-view-map');
        const gridContainer = document.getElementById('app-container');
        const mapContainer = document.getElementById('map-world-container');

        if (!btnGrid || !btnMap || !gridContainer || !mapContainer) return;

        if (mode === 'grid') {
            btnGrid.classList.replace('text-stone-500', 'text-amber-900');
            btnGrid.classList.replace('hover:text-stone-800', 'bg-white');
            btnGrid.classList.add('shadow-sm');

            btnMap.classList.replace('text-amber-900', 'text-stone-500');
            btnMap.classList.replace('bg-white', 'hover:text-stone-800');
            btnMap.classList.remove('shadow-sm');

            gridContainer.classList.remove('hidden');
            mapContainer.classList.add('hidden');
        } else {
            btnMap.classList.replace('text-stone-500', 'text-amber-900');
            btnMap.classList.replace('hover:text-stone-800', 'bg-white');
            btnMap.classList.add('shadow-sm');

            btnGrid.classList.replace('text-amber-900', 'text-stone-500');
            btnGrid.classList.replace('bg-white', 'hover:text-stone-800');
            btnGrid.classList.remove('shadow-sm');

            gridContainer.classList.add('hidden');
            mapContainer.classList.remove('hidden');

            this.renderMap();
        }
    },

    // --- NIVEL 1: LISTADO DE EMPRESAS (DISEÑO MEJORADO) ---
    loadCompanies: async function () {
        if (this.state.companies.length > 0) { this.renderCompanies(); return; }
        this.container.innerHTML = '<div class="flex justify-center py-20"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-900"></div></div>';
        try {
            const res = await fetch('/api/public/companies');
            this.state.companies = await res.json();
            this.renderCompanies();
        } catch (e) { this.container.innerHTML = '<p class="text-center py-20 text-stone-400">No se pudo cargar el directorio.</p>'; }
    },

    renderCompanies: function () {
        const filter = this.state.currentFilter;

        // Filtrar datos
        const filtered = filter === 'all'
            ? this.state.companies
            : this.state.companies.filter(c => c.type === filter);

        let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;

        if (filtered.length > 0) {
            filtered.forEach(c => {
                const logoSrc = c.logo || c.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f5f5f4&color=78350f&size=128`;
                const isFinca = c.type === 'finca';
                const typeColor = isFinca ? 'amber' : 'blue';
                const locationStr = [c.distrito, c.provincia, c.departamento, c.pais].filter(Boolean).map(p => this.toTitleCase(p)).join(', ') || 'Ubicación por verificar';

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
                                <p class="text-sm text-stone-500 mt-2 flex items-center gap-2 font-medium"><i class="fas fa-map-marker-alt text-stone-300 group-hover:text-amber-600 transition-colors"></i> ${locationStr}</p>
                            </div>
                            <div class="mt-8 pt-5 border-t border-stone-100 flex items-center justify-between">
                                <div class="flex flex-col"><span class="text-[10px] font-bold text-stone-400 uppercase"></span><span class="text-lg font-black text-stone-800"></span></div>
                                <div class="text-sm font-bold text-amber-800 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">Ver Perfil <i class="fas fa-arrow-right ml-1"></i></div>
                            </div>
                        </div>
                    </a>`;
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

        const filter = this.state.currentFilter;

        // Filtrar datos
        const filtered = filter === 'all'
            ? this.state.companies
            : this.state.companies.filter(c => c.type === filter);

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