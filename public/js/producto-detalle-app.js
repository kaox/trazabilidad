const app = {
    productId: window.PRODUCT_ID || new URLSearchParams(window.location.search).get('id'),
    product: null,
    currentTab: 'origen',
    flavorWheels: null,

    async init() {
        if (!this.productId) {
            window.location.href = '/marketplace';
            return;
        }

        await this.fetchData();
        if (this.product) {
            this.renderHeader();
            this.renderSidebar();
            this.updateSEO();
            this.updateJSONLD();
            this.switchTab(this.currentTab);
        }
    },

    updateSEO() {
        const name = this.product.nombre;
        const company = this.product.empresa?.nombre || 'Ruru Lab';
        const type = this.product.tipo === 'cafe' ? 'Café de Especialidad' : 'Cacao Fino de Aroma';
        const origin = this.product.finca?.distrito || '';
        const description = `${name} (${type}). ${this.product.descripcion || ''} Origen: ${origin}. Trazabilidad completa garantizada por Ruru Lab.`.substring(0, 160);
        const imageUrl = this.product.imagen || (this.product.imagenes_json && this.product.imagenes_json[0]);
        const url = window.location.href;

        // Title
        document.title = `${name} | ${company} - Trazabilidad Ruru Lab`;

        // Meta Description
        document.querySelector('meta[name="description"]')?.setAttribute('content', description);

        // OG Tags
        document.querySelector('meta[property="og:url"]')?.setAttribute('content', url);
        document.querySelector('meta[property="og:title"]')?.setAttribute('content', `${name} - ${type} | ${company}`);
        document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
        if (imageUrl) document.querySelector('meta[property="og:image"]')?.setAttribute('content', imageUrl);

        // Twitter Tags
        document.querySelector('meta[name="twitter:url"]')?.setAttribute('content', url);
        document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', `${name} - ${type} | ${company}`);
        document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);
        if (imageUrl) document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', imageUrl);
    },

    updateJSONLD() {
        const name = this.product.nombre;
        const description = this.product.descripcion || '';
        const companyName = this.product.empresa?.nombre || 'Ruru Lab';
        const companyLogo = this.product.empresa?.logo;
        const imageUrl = this.product.imagen || (this.product.imagenes_json && this.product.imagenes_json[0]);
        const price = this.product.precio || 0;
        const currency = this.product.moneda || 'PEN';

        const jsonLd = {
            "@context": "https://schema.org/",
            "@type": "Product",
            "name": name,
            "description": description,
            "image": imageUrl ? [imageUrl] : [],
            "sku": this.product.id,
            "category": this.product.tipo,
            "brand": {
                "@type": "Brand",
                "name": companyName,
                "logo": companyLogo || undefined
            },
            "weight": this.product.presentacion ? {
                "@type": "QuantitativeValue",
                "value": this.product.presentacion,
                "unitText": this.product.unidad || "gr"
            } : undefined,
            "additionalProperty": [
                {
                    "@type": "PropertyValue",
                    "name": "Variedad",
                    "value": this.product.variedad || "N/A"
                },
                {
                    "@type": "PropertyValue",
                    "name": "Proceso",
                    "value": this.product.proceso || "N/A"
                },
                {
                    "@type": "PropertyValue",
                    "name": "Puntaje SCA",
                    "value": this.product.puntaje_sca || "N/A"
                }
            ],
            "offers": {
                "@type": "Offer",
                "url": window.location.href,
                "priceCurrency": currency,
                "price": price,
                "priceValidUntil": "2026-12-31",
                "availability": "https://schema.org/InStock",
                "shippingDetails": {
                    "@type": "OfferShippingDetails",
                    "shippingRate": {
                        "@type": "MonetaryAmount",
                        "value": 0,
                        "currency": currency
                    },
                    "deliveryTime": {
                        "@type": "ShippingDeliveryTime",
                        "handlingTime": {
                            "@type": "QuantitativeValue",
                            "minValue": 1,
                            "maxValue": 2,
                            "unitCode": "DAY"
                        }
                    }
                },
                "seller": {
                    "@type": "Organization",
                    "name": companyName,
                    "url": window.location.origin
                }
            }
        };

        const scriptTag = document.getElementById('product-jsonld');
        if (scriptTag) {
            scriptTag.textContent = JSON.stringify(jsonLd);
        }
    },

    async fetchData() {
        try {
            const [productsRes, flavorsRes] = await Promise.all([
                fetch('/api/public/marketplace/products'),
                fetch('/data/flavor-wheels.json')
            ]);

            const productsData = await productsRes.json();
            this.product = productsData.products.find(p => p.id === this.productId);
            this.flavorWheels = await flavorsRes.json();

            // Cargar trazabilidad del producto
            try {
                const traceRes = await fetch(`/api/public/products/${this.productId}/traceability`);
                if (traceRes.ok) {
                    this.traceability = await traceRes.json();
                }
            } catch (err) {
                console.warn("No se pudo cargar la trazabilidad:", err);
            }

            if (!this.product) {
                console.error("Producto no encontrado");
                return;
            }
        } catch (e) {
            console.error("Error fetching data:", e);
        }
    },

    renderHeader() {
        document.getElementById('breadcrumb-category').textContent = this.product.tipo.toUpperCase();
        document.getElementById('product-title').textContent = this.product.nombre;
        document.getElementById('product-description').textContent = this.product.descripcion || 'Sin descripción disponible.';

        // Precio
        const priceEl = document.getElementById('product-price');
        if (this.product.precio) {
            priceEl.textContent = `${this.product.moneda || 'S/'} ${Number(this.product.precio).toFixed(2)}`;
        } else {
            priceEl.textContent = 'Consultar';
        }

        // Tamaño/Peso
        const sizeEl = document.getElementById('product-size');
        const sizeContainer = document.getElementById('size-container');
        if (this.product.presentacion) {
            sizeEl.textContent = `${this.product.presentacion} ${this.product.unidad || 'gr'}`;
            sizeContainer.classList.remove('hidden');
        } else {
            sizeContainer.classList.add('hidden');
        }

        // Botón WhatsApp
        const whatsappBtn = document.getElementById('whatsapp-btn');
        if (this.product.empresa && this.product.empresa.whatsapp) {
            const message = encodeURIComponent("Vengo desde RuruLab estoy interesado en este producto");
            const phone = this.product.empresa.whatsapp.replace(/\D/g, ''); // Limpiar caracteres no numéricos
            whatsappBtn.href = `https://wa.me/${phone}?text=${message}`;
            whatsappBtn.classList.remove('hidden');
        } else {
            whatsappBtn.classList.add('hidden');
        }
    },

    renderSidebar() {
        const img = document.getElementById('main-product-image');
        img.src = this.product.imagen || 'https://placehold.co/600x600/f5f5f5/999?text=Sin+Imagen';

        const gallery = document.getElementById('thumbnail-gallery');
        const images = this.product.imagenes_json || [];
        if (images.length > 0) {
            gallery.innerHTML = images.map((url, i) => `
                <img src="${url}" class="thumbnail ${i === 0 && !this.product.imagen ? 'active' : ''}" onclick="app.setMainImage(this)">
            `).join('');
        }

        const awards = document.getElementById('awards-container');
        if (this.product.premios && this.product.premios.length > 0) {
            awards.innerHTML = this.product.premios.map((prem, index) => {
                const year = 2025 - index;
                return `
                <div class="bg-white p-2 rounded-2xl shadow-sm border border-stone-100 flex flex-col items-center gap-0.5 w-20 transform hover:scale-105 transition-transform">
                    <img src="${prem.logo_url || 'https://placehold.co/80/f5f5f5/999'}" class="w-10 h-10 object-contain mb-1">
                    <span class="text-[9px] font-bold text-stone-900">${year}</span>
                </div>
                `;
            }).join('');
        }
    },

    setMainImage(el) {
        document.getElementById('main-product-image').src = el.src;
        document.querySelectorAll('.thumbnail').forEach(t => t.classList.remove('active'));
        el.classList.add('active');
    },

    switchTab(tabId) {
        this.currentTab = tabId;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        const container = document.getElementById('tab-content');
        container.innerHTML = `<div class="py-20 flex justify-center"><div class="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800"></div></div>`;

        setTimeout(() => {
            switch (tabId) {
                case 'origen': this.renderOrigen(); break;
                case 'trazabilidad': this.renderTrazabilidad(); break;
                case 'proceso': this.renderProceso(); break;
                case 'specs': this.renderSpecs(); break;
                case 'analisis': this.renderAnalisis(); break;
                case 'maridaje': this.renderMaridaje(); break;
            }
            window.scrollTo({ top: 300, behavior: 'smooth' });
        }, 300);
    },

    // --- TAB RENDERERS ---

    renderOrigen() {
        const finca = this.product.finca || {};
        const farmImages = this.parseJSON(finca.imagenes) || [];
        const bannerImg = (farmImages && farmImages.length > 0) ? farmImages[0] : 'https://images.unsplash.com/photo-1542618837-56455cc6326e?q=80&w=2670&auto=format&fit=crop';

        const html = `
            <div class="space-y-12 animate-in fade-in duration-500">
                <div class="bg-stone-50 p-1 rounded-[2rem]">
                    <div class="relative w-full aspect-[21/8] overflow-hidden rounded-[1.8rem] shadow-sm">
                        <img src="${bannerImg}" class="w-full h-full object-cover">
                        <div class="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent flex items-bottom p-10">
                            <h2 class="text-3xl font-display font-bold text-white mt-auto">La Finca y el Productor</h2>
                        </div>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    <div class="lg:col-span-2 space-y-6">
                        <h3 class="text-2xl font-bold text-stone-800">${finca.nombre || 'Finca Sin Nombre'}</h3>
                        <p class="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-map-marker-alt text-amber-700"></i> ${finca.distrito || 'Satipo'}, ${finca.provincia || 'Satipo'} - ${finca.departamento || 'Junín'}
                        </p>
                        <p class="text-stone-600 leading-relaxed text-lg italic">
                            "${finca.historia || 'Fundada con dedicación, esta finca se enfoca en procesos sostenibles para ofrecer productos de alta calidad manteniendo la armonía con la naturaleza de la región.'}"
                        </p>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            <div class="bg-white p-5 rounded-2xl border border-stone-100 flex items-center gap-4 shadow-sm">
                                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                                    <i class="fas fa-user-tie text-orange-600 text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Agricultor</p>
                                    <p class="font-bold text-stone-800 text-lg">${finca.productor || 'Luis Samaniego'}</p>
                                </div>
                            </div>
                            <div class="bg-white p-5 rounded-2xl border border-stone-100 flex items-center gap-4 shadow-sm">
                                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                    <i class="fas fa-mountain-sun text-emerald-600 text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Altitud</p>
                                    <p class="font-bold text-stone-800 text-lg">${finca.altura || '850'} msnm</p>
                                </div>
                            </div>
                        </div>

                        ${finca.video ? `
                        <div class="pt-6">
                            <p class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Video de la Finca</p>
                            <div class="aspect-video w-full rounded-3xl overflow-hidden bg-stone-100 shadow-sm border border-stone-200">
                                <iframe class="w-full h-full" src="${this.getYouTubeEmbedUrl(finca.video)}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                            </div>
                        </div>` : ''}

                        ${(() => {
                const images = this.parseJSON(finca.imagenes);
                return Array.isArray(images) && images.length > 0 ? `
                            <div class="pt-6">
                                <p class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-4">Galería de la Finca</p>
                                <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    ${images.map(img => `
                                        <div class="aspect-square rounded-2xl overflow-hidden border border-stone-100 shadow-sm group">
                                            <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-zoom-in" onclick="window.open(this.src, '_blank')">
                                        </div>
                                    `).join('')}
                                </div>
                            </div>` : '';
            })()}
                    </div>
                    <div class="space-y-4">
                        <p class="text-sm font-bold text-stone-800 flex items-center gap-2">
                           <i class="fas fa-draw-polygon text-amber-800"></i> Polígono de la Finca
                        </p>
                        <div id="origin-map" class="w-full h-80 rounded-3xl border border-stone-200 shadow-inner"></div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
        this.initOriginMap();
    },

    getYouTubeEmbedUrl(url) {
        if (!url) return '';
        let videoId = '';
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2].length === 11) {
            videoId = match[2];
        } else {
            // Fallback para IDs directos si el usuario pegó solo el ID
            videoId = url;
        }
        return `https://www.youtube.com/embed/${videoId}`;
    },

    parseJSON(data) {
        if (!data) return null;
        if (typeof data === 'object') return data;
        try {
            let parsed = JSON.parse(data);
            // Manejar doble stringificado si el resultado sigue siendo un string que parece JSON
            if (typeof parsed === 'string' && (parsed.trim().startsWith('[') || parsed.trim().startsWith('{'))) {
                try {
                    return JSON.parse(parsed);
                } catch (e) {
                    return parsed;
                }
            }
            return parsed;
        } catch (e) {
            console.error("Error parsing JSON:", e, data);
            return null;
        }
    },

    parseCoordinates(coords) {
        if (!coords) return null;
        try {
            let data = coords;

            // Si es string, tratar de parsear o dividir
            if (typeof coords === 'string') {
                if (coords.trim().startsWith('[') || coords.trim().startsWith('{')) {
                    data = this.parseJSON(coords);
                } else if (coords.includes(',')) {
                    // Caso string "lat, lng"
                    const parts = coords.split(',').map(s => Number(s.trim()));
                    if (parts.length >= 2) return [{ lat: parts[0], lng: parts[1] }];
                }
            }

            // Caso GeoJSON Polygon
            if (data && data.type === 'Polygon' && Array.isArray(data.coordinates)) {
                return data.coordinates[0].map(p => ({ lat: Number(p[1]), lng: Number(p[0]) }));
            }

            // Caso Array de puntos [[lat, lng]] o [{lat, lng}]
            if (Array.isArray(data) && data.length > 0) {
                // Si es un array simple de dos números [lat, lng]
                if (data.length === 2 && typeof data[0] === 'number') {
                    return [{ lat: data[0], lng: data[1] }];
                }
                return data.map(p => {
                    if (Array.isArray(p)) return { lat: Number(p[0]), lng: Number(p[1]) };
                    if (p && typeof p === 'object' && p.lat !== undefined) return { lat: Number(p.lat), lng: Number(p.lng) };
                    return null;
                }).filter(p => p !== null);
            }

            // Caso Objeto de punto {lat, lng}
            if (data && typeof data === 'object' && data.lat !== undefined) {
                return [{ lat: Number(data.lat), lng: Number(data.lng) }];
            }

            return null;
        } catch (e) {
            console.error("Error parsing coordinates:", e);
            return null;
        }
    },

    initOriginMap() {
        const finca = this.product.finca || {};
        const mapDiv = document.getElementById('origin-map');
        if (!mapDiv) return;

        const map = new google.maps.Map(mapDiv, {
            center: { lat: -11.23, lng: -74.63 },
            zoom: 14,
            mapTypeId: 'satellite',
            disableDefaultUI: true,
            zoomControl: true,
            tilt: 45
        });

        const paths = this.parseCoordinates(finca.coordenadas);

        if (paths && paths.length > 0) {
            const bounds = new google.maps.LatLngBounds();
            paths.forEach(p => bounds.extend(p));

            if (paths.length === 1) {
                // Caso Punto único
                new google.maps.Marker({
                    position: paths[0],
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#fbbf24',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                        scale: 10
                    }
                });
                map.setCenter(paths[0]);
                map.setZoom(17);
            } else {
                // Caso Polígono
                new google.maps.Polygon({
                    paths: paths,
                    strokeColor: '#fbbf24',
                    strokeOpacity: 0.8,
                    strokeWeight: 3,
                    fillColor: '#fbbf24',
                    fillOpacity: 0.35,
                    map: map
                });
                map.fitBounds(bounds);
            }
        } else {
            console.warn("No hay coordenadas para esta finca.");
        }
    },

    renderProceso() {
        const html = `
            <div class="space-y-10 animate-in fade-in duration-500">
                <div class="flex items-center justify-between mb-2">
                    <h2 class="text-2xl font-display font-bold text-stone-900">Ruta de Trazabilidad</h2>
                    <span class="px-4 py-1.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full border border-emerald-200">
                        <i class="fas fa-shield-alt mr-1"></i> Blockchain Verificado
                    </span>
                </div>
                
                <!-- Mapa de Proceso -->
                <div id="process-map" class="w-full h-96 rounded-[2rem] bg-stone-100 shadow-inner border border-stone-200"></div>

                <!-- Timeline Scroll -->
                <div class="space-y-6">
                    <div class="flex items-center gap-4">
                        <h3 class="text-xl font-bold text-stone-800">Timeline del Proceso</h3>
                        <p class="text-sm text-stone-400">Haz clic en una etapa para ver su ubicación en el mapa.</p>
                    </div>
                    
                    <div class="timeline-scroll pb-6">
                        <div class="timeline-card active ring-2 ring-amber-800 ring-offset-4">
                            <div class="flex items-center justify-between mb-4">
                                <span class="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold">1</span>
                                <span class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Oct 2025</span>
                            </div>
                            <h4 class="font-bold text-lg text-stone-900 mb-2">Cosecha</h4>
                            <div class="aspect-video rounded-xl overflow-hidden mb-4">
                                <img src="https://images.unsplash.com/photo-1542618837-56455cc6326e?w=500" class="w-full h-full object-cover">
                            </div>
                            <div class="space-y-2 text-sm">
                                <p class="flex justify-between"><span class="text-stone-400">Actor:</span> <span class="font-bold">Cacaocultor</span></p>
                                <p class="flex justify-between"><span class="text-stone-400">Peso:</span> <span class="font-bold">100 kg Mazorcas</span></p>
                            </div>
                        </div>

                        <div class="timeline-card">
                            <div class="flex items-center justify-between mb-4">
                                <span class="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center font-bold">2</span>
                                <span class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Nov 2025</span>
                            </div>
                            <h4 class="font-bold text-lg text-stone-900 mb-2">Beneficio (Secado)</h4>
                            <div class="aspect-video rounded-xl overflow-hidden mb-4">
                                <img src="https://images.unsplash.com/photo-1594488651083-205564883204?w=500" class="w-full h-full object-cover">
                            </div>
                            <div class="space-y-2 text-sm">
                                <p class="flex justify-between"><span class="text-stone-400">Duración:</span> <span class="font-bold">5 días</span></p>
                                <p class="flex justify-between"><span class="text-stone-400">Humedad:</span> <span class="font-bold">6%</span></p>
                            </div>
                        </div>

                        <div class="timeline-card">
                            <div class="flex items-center justify-between mb-4">
                                <span class="w-8 h-8 rounded-full bg-amber-600 text-white flex items-center justify-center font-bold">3</span>
                                <span class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Dic 2025</span>
                            </div>
                            <h4 class="font-bold text-lg text-stone-900 mb-2">Producción</h4>
                            <div class="aspect-video rounded-xl overflow-hidden mb-4 bg-stone-100 flex items-center justify-center text-stone-300">
                                <i class="fas fa-industry text-4xl"></i>
                            </div>
                            <div class="space-y-2 text-sm">
                                <p class="flex justify-between"><span class="text-stone-400">Tipo:</span> <span class="font-bold">Oscuro 70%</span></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
        this.initProcessMap();
    },

    initProcessMap() {
        const mapDiv = document.getElementById('process-map');
        if (!mapDiv) return;

        const map = new google.maps.Map(mapDiv, {
            center: { lat: -11.12, lng: -74.67 },
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true
        });

        const points = [
            { lat: -11.12, lng: -74.67 },
            { lat: -11.14, lng: -74.65 },
            { lat: -11.15, lng: -74.69 }
        ];

        const colors = ['#ea580c', '#3b82f6', '#d97706'];
        const names = ['Cosecha', 'Beneficio', 'Producción'];

        const bounds = new google.maps.LatLngBounds();

        points.forEach((p, i) => {
            new google.maps.Marker({
                position: p,
                map: map,
                title: `${i + 1}. ${names[i]}`,
                label: {
                    text: (i + 1).toString(),
                    color: 'white',
                    fontWeight: 'bold'
                }
            });
            bounds.extend(p);
        });

        new google.maps.Polyline({
            path: points,
            geodesic: true,
            strokeColor: '#854d0e',
            strokeOpacity: 0.6,
            strokeWeight: 4,
            icons: [{
                icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
                offset: '100%'
            }],
            map: map
        });

        map.fitBounds(bounds);
    },

    renderSpecs() {
        const html = `
            <div class="space-y-10 animate-in fade-in duration-500">
                <div class="flex items-center gap-3">
                    <i class="fas fa-clipboard-list text-amber-800 text-xl"></i>
                    <h2 class="text-2xl font-display font-bold text-stone-900">Ficha Técnica</h2>
                </div>
                
                <div class="bg-white rounded-[2.5rem] border border-stone-100 p-12 shadow-sm">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-x-16 gap-y-8">
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Variedad Botánica</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.variedad || 'N/A'}</p>
                        </div>
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Proceso de Beneficio</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.proceso || 'N/A'}</p>
                        </div>
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Altitud</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.finca?.altura || '-'} msnm</p>
                        </div>
                        ${this.product.puntaje_sca ? `
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Puntaje de Cata</span>
                            <p class="text-2xl font-black text-amber-900 mt-1">${this.product.puntaje_sca} Puntos</p>
                        </div>
                        ` : ''}
                        ${this.product.cosecha ? `
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Año de Cosecha</span>
                            <p class="text-2xl font-black text-amber-900 mt-1">${this.product.cosecha}</p>
                        </div>
                        ` : ''}
                        ${this.product.nivel_tueste ? `
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Perfil de Tueste</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.nivel_tueste}</p>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
    },

    renderAnalisis() {
        const html = `
            <div class="space-y-12 animate-in fade-in duration-500">
                <div class="flex items-center gap-3">
                    <i class="fas fa-microscope text-amber-800 text-xl"></i>
                    <h2 class="text-2xl font-display font-bold text-stone-900">Perfil Sensorial</h2>
                </div>

                <div class="grid grid-cols-1 gap-16">
                    <div class="bg-white p-12 rounded-[3.5rem] border border-stone-100 shadow-sm space-y-8">
                        <h3 class="text-sm font-bold text-stone-400 uppercase tracking-widest text-center">Complejidad Sensorial (Rueda)</h3>
                        <div id="sunburst-container" class="w-full relative py-4 flex justify-center">
                            <!-- SVG D3 se inyecta aquí -->
                        </div>
                    </div>
                    <div class="bg-white p-12 rounded-[3.5rem] border border-stone-100 shadow-sm space-y-8">
                        <h3 class="text-sm font-bold text-stone-400 uppercase tracking-widest text-center">Análisis de Atributos</h3>
                        <div class="aspect-square w-full max-w-[600px] mx-auto relative overflow-hidden">
                            <canvas id="radar-analisis" class="w-full h-full"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
        this.initCharts();
    },

    initCharts() {
        if (!this.product.perfil) return;

        // Radar Chart
        ChartUtils.initializePerfilChart('radar-analisis', this.product.perfil, this.product.tipo);
        const inst = ChartUtils.instances['radar-analisis'];
        if (inst) {
            inst.options.scales.r.pointLabels.display = true;
            inst.options.scales.r.pointLabels.font = { size: 12, weight: '700' };
            inst.update();
        }

        // Sunburst D3
        this.renderSunburst();
    },

    renderSunburst() {
        const container = d3.select("#sunburst-container");
        container.selectAll("*").remove();

        const FLAVOR_DATA = this.flavorWheels ? this.flavorWheels[this.product.tipo] : null;
        if (!FLAVOR_DATA) {
            container.append("div").text("Sin datos de rueda").attr("class", "text-stone-300 italic");
            return;
        }

        const rootData = { name: "Root", children: [] };
        Object.entries(FLAVOR_DATA).forEach(([catName, catData]) => {
            const hasCatSelection = this.product.sabores && this.product.sabores.some(s => s.category === catName);

            const catNode = {
                name: catName,
                color: hasCatSelection ? catData.color : '#F3F4F6',
                children: catData.children.map(child => {
                    const hasSubSelection = this.product.sabores && this.product.sabores.some(s =>
                        (s.subnote && s.subnote.toLowerCase() === child.name.toLowerCase()) ||
                        (s.note && s.note.toLowerCase() === child.name.toLowerCase()) ||
                        (s.label && s.label.toLowerCase() === child.name.toLowerCase())
                    );

                    const childNode = {
                        name: child.name,
                        color: hasSubSelection ? catData.color : '#F3F4F6',
                    };

                    if (child.children && child.children.length > 0) {
                        childNode.children = child.children.map(grandchild => {
                            const hasNoteSelection = this.product.sabores && this.product.sabores.some(s =>
                                (s.note && s.note.toLowerCase() === grandchild.name.toLowerCase()) ||
                                (s.label && s.label.toLowerCase() === grandchild.name.toLowerCase()) ||
                                (s.subnote && s.subnote.toLowerCase() === grandchild.name.toLowerCase())
                            );
                            return {
                                name: grandchild.name,
                                color: hasNoteSelection ? catData.color : '#F3F4F6',
                                value: 1
                            };
                        });
                    } else {
                        childNode.value = 1;
                    }
                    return childNode;
                })
            };
            rootData.children.push(catNode);
        });

        const root = d3.hierarchy(rootData).sum(d => d.value);
        const depth = root.height;
        d3.partition().size([2 * Math.PI, depth + 1])(root);

        const width = 600;
        const radius = width / (2 * (depth + 1));

        const arc = d3.arc()
            .startAngle(d => d.x0).endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(radius * 1.5)
            .innerRadius(d => d.y0 * radius).outerRadius(d => d.y1 * radius - 1);

        const svg = container.append("svg").attr("viewBox", [0, 0, width, width]).style("width", "100%").style("height", "auto");
        const g = svg.append("g").attr("transform", `translate(${width / 2},${width / 2})`);

        g.selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("fill", d => d.data.color)
            .attr("d", arc);

        g.selectAll("text")
            .data(root.descendants().slice(1).filter(d => d.y0 > 0 && (d.x1 - d.x0) * radius > 4))
            .join("text")
            .attr("transform", d => {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (d.y0 + d.y1) / 2 * radius;
                return `rotate(${x - 90}) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", d => d.depth === 1 ? "12px" : (d.depth === 2 ? "10px" : "8px"))
            .style("font-weight", "bold")
            .style("fill", d => d.data.color === '#F3F4F6' ? '#999' : '#fff') // Texto blanco en áreas con color
            .text(d => d.data.name);

        g.append("text").attr("text-anchor", "middle").style("font-size", "14px").style("font-weight", "900").attr("dy", "0.35em").text(this.product.tipo.toUpperCase());
    },

    renderMaridaje() {
        const html = `
            <div class="space-y-12 animate-in fade-in duration-500">
                <div class="flex items-center gap-3">
                    <i class="fas fa-cocktail text-amber-800 text-xl"></i>
                    <h2 class="text-2xl font-display font-bold text-stone-900">Recomendaciones de Maridaje</h2>
                </div>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="group bg-white p-8 rounded-[2rem] border border-stone-100 flex items-center gap-8 shadow-sm hover:shadow-xl transition-all cursor-default">
                        <div class="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                            <i class="fas fa-wine-glass-alt text-amber-600 text-3xl"></i>
                        </div>
                        <div class="flex-grow">
                            <p class="text-[11px] font-bold text-stone-400 uppercase tracking-widest mb-1">Vino Fortificado</p>
                            <h4 class="font-display font-bold text-stone-800 text-xl mb-1">Oporto Ruby</h4>
                            <p class="text-xs text-stone-500">Ideal con notas de ciruela y frutos secos.</p>
                        </div>
                        <div class="text-right flex flex-col items-end">
                            <span class="text-3xl font-black text-amber-800">89%</span>
                            <span class="text-[9px] font-bold text-stone-400 uppercase">Match Score</span>
                        </div>
                    </div>

                    <div class="group bg-white p-8 rounded-[2rem] border border-stone-100 flex items-center gap-8 shadow-sm hover:shadow-xl transition-all cursor-default">
                        <div class="w-20 h-20 rounded-2xl bg-stone-50 flex items-center justify-center shrink-0 group-hover:bg-amber-100 transition-colors">
                            <i class="fas fa-cheese text-stone-400 group-hover:text-amber-600 text-3xl transition-colors"></i>
                        </div>
                        <div class="flex-grow">
                            <p class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Queso Curado</p>
                            <h4 class="font-display font-bold text-stone-800 text-xl mb-1">Gouda Añejo</h4>
                            <p class="text-xs text-stone-500">Realza las notas amargas y de chocolate.</p>
                        </div>
                        <div class="text-right flex flex-col items-end">
                            <span class="text-3xl font-black text-stone-300 group-hover:text-amber-800 transition-colors">82%</span>
                            <span class="text-[9px] font-bold text-stone-400 uppercase">Match Score</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
    },
    renderTrazabilidad() {
        if (!this.traceability || !this.traceability.stages || this.traceability.stages.length === 0) {
            document.getElementById('tab-content').innerHTML = `
                <div class="py-16 md:py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div class="w-20 h-20 md:w-24 md:h-24 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-stone-100 shadow-sm">
                        <i class="fas fa-route text-stone-200 text-3xl md:text-4xl"></i>
                    </div>
                    <h3 class="text-xl md:text-2xl font-display font-bold text-stone-300">Trazabilidad No Disponible</h3>
                    <p class="text-stone-400 mt-2 max-w-sm mx-auto px-6 text-sm md:text-base">Este producto aún no cuenta con un lote verificado en la blockchain de Ruru Lab.</p>
                </div>
            `;
            return;
        }

        const stages = [...this.traceability.stages];
        const lastBatchId = this.traceability.id || 'N/A';

        const html = `
            <style>
                .stage-card.active-stage {
                    border-color: #854d0e;
                    background-color: #fffbeb;
                    transform: translateX(4px);
                }
                @media (min-width: 1024px) {
                    .stage-card.active-stage { transform: translateX(8px); }
                }
                .stage-card {
                    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .node-dot.active {
                    border-color: #854d0e !important;
                    background-color: #854d0e !important;
                    box-shadow: 0 0 0 4px rgba(133, 77, 14, 0.1);
                }
                .pulse-ring {
                    position: absolute;
                    inset: 0;
                    margin: auto;
                    width: 100%;
                    height: 100%;
                    border: 2px solid #854d0e;
                    border-radius: 50%;
                    animation: pulse 2s infinite;
                    opacity: 0;
                    pointer-events: none;
                }
                @keyframes pulse {
                    0% { transform: scale(0.6); opacity: 0; }
                    50% { opacity: 0.6; }
                    100% { transform: scale(1.6); opacity: 0; }
                }
                #trace-map [title="Google"] img, #trace-map .gmnoprint { display: none !important; }
            </style>

            <div class="animate-in fade-in duration-1000 px-2 md:px-0">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 lg:gap-12 items-start">
                    
                    <!-- Columna Mapa (Sticky on Desktop) -->
                    <div class="lg:col-span-7 lg:sticky lg:top-24 space-y-4 md:space-y-6">
                        <div class="flex items-center justify-between mb-2 md:mb-4 px-4 lg:px-0">
                            <div>
                                <h2 class="text-2xl md:text-4xl font-display font-bold text-stone-900 leading-tight">Descubre el viaje!</h2>
                                <p class="text-stone-400 font-medium text-[10px] md:text-sm mt-1 tracking-wide uppercase">Trazabilidad Satelital</p>
                            </div>
                        </div>
                        
                        <div class="relative group mx-2 md:mx-0">

                            <div id="trace-map" class="w-full h-[350px] md:h-[450px] lg:h-[600px] rounded-[2rem] md:rounded-[3.5rem] border-4 md:border-8 border-white shadow-[0_20px_40px_-12px_rgba(0,0,0,0.1)] md:shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] overflow-hidden bg-stone-100"></div>
                            
                            <!-- Legend - Compact on mobile -->
                            <div class="absolute bottom-6 left-6 md:bottom-10 md:left-10 flex gap-3 md:gap-4 bg-white/90 backdrop-blur-md p-3 md:p-4 rounded-2xl md:rounded-3xl border border-white/50 shadow-xl">
                                <div class="flex items-center gap-2">
                                    <div class="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-amber-800"></div>
                                    <span class="text-[9px] md:text-[10px] font-bold text-stone-600 uppercase tracking-wider">Actual</span>
                                </div>
                                <div class="flex items-center gap-2">
                                    <div class="w-3 h-0.5 bg-stone-300 border-t border-dashed border-stone-400"></div>
                                    <span class="text-[9px] md:text-[10px] font-bold text-stone-600 uppercase tracking-wider">Ruta</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Columna Timeline -->
                    <div class="lg:col-span-5 space-y-6 md:space-y-10 py-4">
                        <div class="flex items-center justify-between px-6 lg:pl-6 lg:pr-0">
                            <h2 class="text-2xl md:text-4xl font-display font-bold text-stone-900">Timeline</h2>
                            <div class="flex flex-col items-end">
                                <span class="text-[8px] md:text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1">PROCESSED LOTE</span>
                                <span class="px-3 py-1 md:px-4 md:py-1.5 bg-stone-900 text-white text-[9px] md:text-[11px] font-black rounded-full shadow-lg tracking-wider">#${lastBatchId.substring(0, 12)}</span>
                            </div>
                        </div>

                        <div class="relative px-4 md:px-6">
                            <!-- Animated Pulse Line Background -->
                            <div class="absolute left-[2.25rem] md:left-[2.25rem] top-8 bottom-8 w-[2px] bg-gradient-to-b from-amber-800/20 via-stone-100 to-stone-50 selection:bg-none"></div>

                            <div class="space-y-4 md:space-y-6 relative" id="timeline-list">
                                ${stages.map((stage, idx) => {
            const dateStr = stage.timestamp ? new Date(stage.timestamp).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }).toUpperCase() : 'N/A';
            const yearStr = stage.timestamp ? new Date(stage.timestamp).getFullYear() : '';
            const loc = this.getStageLocation(stage);
            const isFinca = stage.nombre_etapa.toLowerCase().includes('cosecha');

            return `
                                    <div class="stage-card group cursor-pointer p-4 md:p-6 rounded-2xl md:rounded-[2rem] border border-transparent hover:border-stone-100 hover:bg-white hover:shadow-xl relative ml-6" 
                                         onclick="app.setTraceStage(${idx})" data-index="${idx}">
                                        
                                        <!-- Node Indicator -->
                                        <div class="absolute -left-[3.15rem] top-6 md:top-8 w-10 h-10 md:w-11 md:h-11 rounded-full border-4 border-white bg-stone-100 flex items-center justify-center transition-all duration-500 shadow-sm z-20 node-dot">
                                            <i class="fas ${isFinca ? 'fa-seedling' : 'fa-gear'} text-[10px] md:text-xs text-stone-400 group-hover:text-white transition-colors relative z-10"></i>
                                            <div class="pulse-ring"></div>
                                        </div>

                                        <div class="flex justify-between items-start mb-2">
                                            <div class="flex flex-col">
                                                <span class="text-[10px] font-black text-amber-800/60 uppercase tracking-[0.2em] mb-1">${dateStr} ${yearStr}</span>
                                                <h4 class="text-2xl font-display font-bold text-stone-800 group-hover:text-amber-950 transition-colors">${stage.nombre_etapa}</h4>
                                            </div>
                                            <div class="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                                                <i class="fas fa-chevron-right text-stone-300 group-hover:text-amber-600 text-[10px]"></i>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-2 mb-4">
                                            <i class="fas fa-location-dot text-[10px] text-stone-300"></i>
                                            <p class="text-xs font-bold text-stone-400 group-hover:text-stone-600 transition-colors tracking-tight italic">${loc}</p>
                                        </div>
                                        
                                        <!-- Technical Badges -->
                                        <div class="flex flex-wrap gap-2 pt-2 opacity-60 group-hover:opacity-100 transition-opacity duration-500">
                                            ${this.renderStageBadges(stage)}
                                        </div>
                                    </div>
                                    `;
        }).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer Section -->
                <div class="mt-12 md:mt-24 p-6 md:p-12 rounded-[2.5rem] md:rounded-[4rem] bg-stone-900 text-white relative overflow-hidden mx-2 md:mx-0">
                    <div class="absolute top-0 right-0 w-64 h-64 md:w-96 md:h-96 bg-amber-800/10 rounded-full -mr-32 -mt-32 md:-mr-48 md:-mt-48 blur-3xl"></div>
                    <div class="relative flex flex-col lg:flex-row items-center gap-8 md:gap-12 text-center lg:text-left">
                        <div class="flex-shrink-0">
                            <div class="w-16 h-16 md:w-24 md:h-24 rounded-2xl md:rounded-[2.5rem] bg-gradient-to-br from-amber-700 to-amber-900 p-[1px]">
                                <div class="w-full h-full bg-stone-900 rounded-2xl md:rounded-[2.5rem] flex items-center justify-center">
                                    <i class="fas fa-shield-halved text-amber-600 text-2xl md:text-4xl"></i>
                                </div>
                            </div>
                        </div>
                        <div class="flex-grow space-y-3 md:space-y-4">
                            <h4 class="text-2xl md:text-3xl font-display font-bold leading-tight">Blockchain Certified Lineage</h4>
                            <p class="text-stone-400 text-sm md:text-lg max-w-2xl px-2 lg:px-0">This cryptographic seal guarantees that every step of this products journey is authentic, permanent, and verified by Ruru Lab's private oracle.</p>
                            <div class="pt-2 md:pt-4 flex flex-col md:flex-row items-center justify-center lg:justify-start gap-4">
                                <span class="px-3 py-1.5 md:px-5 md:py-2 bg-stone-800 border border-stone-700 rounded-xl md:rounded-2xl font-mono text-[9px] md:text-xs text-amber-500 selection:bg-amber-500 selection:text-white break-all max-w-xs md:max-w-none">
                                    ${this.traceability.blockchain_hash || 'SHA256_UNAVAILABLE'}
                                </span>
                            </div>
                        </div>
                        <a href="https://polygonscan.com/tx/${this.traceability.blockchain_hash}" target="_blank" 
                           class="w-full lg:w-auto px-8 py-4 md:px-10 md:py-5 bg-amber-800 hover:bg-amber-700 text-white rounded-2xl md:rounded-[2rem] text-xs md:text-sm font-black tracking-widest uppercase transition-all hover:shadow-2xl hover:-translate-y-1 mt-4 lg:mt-0">
                            Verify Ledger
                        </a>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;

        setTimeout(() => {
            this.initTraceMap();
            this.setTraceStage(0);
            this.initScrollIntersectionObserver();
        }, 300);
    },

    renderStageBadges(stage) {
        const d = stage.data || {};
        const campos_json = stage.campos_json || {};
        const badges = [];

        // Crear mapa de búsqueda para los labels de la plantilla
        const allFields = [
            ...(campos_json.entradas || []),
            ...(campos_json.salidas || []),
            ...(campos_json.variables || [])
        ];
        const fieldMap = new Map();
        allFields.forEach(f => fieldMap.set(f.name, f.label));

        // Mapeo de iconos para campos conocidos
        const iconMap = {
            humedad: 'fa-droplet',
            humidity: 'fa-droplet',
            altitud: 'fa-mountain',
            altitude: 'fa-mountain',
            mimasl: 'fa-mountain',
            temperatura: 'fa-temperature-half',
            temp: 'fa-temperature-half',
            variedad: 'fa-dna',
            variety: 'fa-dna',
            lote: 'fa-barcode',
            presentacion: 'fa-box-open',
            peso: 'fa-weight-hanging',
            weight: 'fa-weight-hanging',
            fermentacion: 'fa-vial',
            tiempo: 'fa-clock'
        };

        const skipKeys = ['lugar', 'coordenadas', 'imageurl', 'ubicacion', 'finca', 'procesadora', 'id', 'target_profile_id', 'target_wheel_id', 'lugarproceso'];

        Object.entries(d).forEach(([key, val]) => {
            const rawKey = key.toLowerCase();

            if (skipKeys.includes(rawKey)) return;
            if (rawKey.includes('fecha')) return;

            const displayVal = typeof val === 'object' ? val.value : val;
            if (displayVal === null || displayVal === undefined || displayVal === '' || displayVal === 'N/A' || displayVal === 'n/a') return;

            if (typeof val === 'object' && val.visible === false) return;

            const icon = iconMap[rawKey] || 'fa-circle-info';
            const label = fieldMap.get(key) || (typeof val === 'object' && val.nombre ? val.nombre : key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));

            badges.push(`
                <span class="badge-premium">
                    <i class="fas ${icon} mr-1 md:mr-1.5 opacity-40"></i>
                    <b class="text-stone-700 mr-1">${label}:</b> ${displayVal}
                </span>
            `);
        });

        if (badges.length === 0) {
            return `<span class="text-[9px] md:text-[10px] font-black tracking-widest text-stone-300 uppercase">Process Details Verified</span>`;
        }

        return `
            <style>
                .badge-premium {
                    display: inline-flex;
                    align-items: center;
                    padding: 0.35rem 0.75rem;
                    background: #fafaf9;
                    border: 1px solid #f5f5f4;
                    border-radius: 1rem;
                    color: #57534e;
                    font-size: 9px;
                    font-weight: 500;
                    letter-spacing: -0.01em;
                    transition: all 0.3s ease;
                }
                @media (min-width: 768px) {
                    .badge-premium {
                        padding: 0.45rem 0.9rem;
                        border-radius: 1.25rem;
                        font-size: 10px;
                    }
                }
                .badge-premium:hover {
                    background: #ffffff;
                    border-color: #854d0e/20;
                    box-shadow: 0 4px 12px rgba(133, 77, 14, 0.05);
                }
            </style>
            ${badges.join('')}
        `;
    },

    getStageLocation(stage) {
        const data = stage.data || {};
        // Intentar sacar de los atributos
        const loc = data.lugarProceso?.value || data.finca?.value || data.procesadora?.value || 'N/A';
        if (loc) return loc;

        // Fallback a info genérica si es el primer stage (finca normalmente)
        if (stage.nombre_etapa.toLowerCase().includes('cosecha') || stage.nombre_etapa.toLowerCase().includes('acopio')) {
            return `${this.product.finca?.nombre || ''} - ${this.product.finca?.distrito || ''}`;
        }

        return 'Planta de Procesamiento';
    },

    initTraceMap() {
        const mapDiv = document.getElementById('trace-map');
        if (!mapDiv) return;

        // Custom Satellite Style
        this.traceMap = new google.maps.Map(mapDiv, {
            zoom: 15,
            mapTypeId: 'satellite',
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'cooperative',
            tilt: 45
        });

        // 1. Initial Pathway Polyline (Background)
        this.tracePathBg = new google.maps.Polyline({
            map: this.traceMap,
            strokeColor: '#854d0e',
            strokeOpacity: 0,
            strokeWeight: 2,
            icons: [{
                icon: {
                    path: 'M 0,-1 0,1',
                    strokeOpacity: 0.4,
                    strokeColor: '#ffffff',
                    scale: 3,
                    strokeWeight: 2
                },
                offset: '0',
                repeat: '20px'
            }]
        });

        // 2. Active Progress Polyline (Animated)
        this.tracePathActive = new google.maps.Polyline({
            map: this.traceMap,
            strokeColor: '#854d0e',
            strokeOpacity: 0.95,
            strokeWeight: 5,
            zIndex: 10
        });

        // 3. User Journey Markers
        const stages = [...this.traceability.stages];
        const pathPoints = [];

        stages.forEach((stage, idx) => {
            const stageData = stage.data || {};
            let coords = null;

            // Prioridad 1: Coordenadas en el atributo del stage
            if (stageData.coordenadas?.value) {
                coords = this.parseCoordinates(stageData.coordenadas.value);
            }

            // Prioridad 2: Coordenadas de la finca para etapas iniciales
            if (!coords && (stage.nombre_etapa.toLowerCase().includes('cosecha') || stage.nombre_etapa.toLowerCase().includes('acopio'))) {
                coords = this.parseCoordinates(this.product.finca?.coordenadas);
            }

            // Prioridad 3: Buscar en las procesadoras vinculadas
            if (!coords && this.traceability.procesadorasData?.length > 0) {
                const processor = this.traceability.procesadorasData.find(p => p.user_id === stage.user_id) || this.traceability.procesadorasData[0];
                coords = this.parseCoordinates(processor.coordenadas);
            }

            if (coords && coords.length > 0) {
                const point = coords[0];
                pathPoints.push(point);

                new google.maps.Marker({
                    position: point,
                    map: this.traceMap,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        fillColor: '#ffffff',
                        fillOpacity: 1,
                        strokeColor: '#854d0e',
                        strokeWeight: 2,
                        scale: 6
                    },
                    zIndex: 5
                });
            }
        });

        this.pathPoints = pathPoints;
        this.tracePathBg.setPath(pathPoints);
        this.tracePathActive.setPath([]);

        if (pathPoints.length > 1) {
            const bounds = new google.maps.LatLngBounds();
            pathPoints.forEach(p => bounds.extend(p));
            this.traceMap.fitBounds(bounds);
        } else if (pathPoints.length === 1) {
            this.traceMap.setCenter(pathPoints[0]);
            this.traceMap.setZoom(17);
        }
    },

    initScrollIntersectionObserver() {
        const options = {
            root: null,
            rootMargin: '-40% 0% -40% 0%',
            threshold: 0
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = parseInt(entry.target.dataset.index);
                    this.setTraceStage(index, false);
                }
            });
        }, options);

        document.querySelectorAll('.stage-card').forEach(card => observer.observe(card));
    },

    setTraceStage(index, autoScroll = true) {
        const stages = [...this.traceability.stages];
        const stage = stages[index];
        if (!stage || !this.pathPoints) return;

        // El punto correspondiente a esta etapa es el index de pathPoints
        const targetPoint = this.pathPoints[index] || this.pathPoints[this.pathPoints.length - 1];

        if (targetPoint) {
            this.animatePathTo(index);

            // Suave paneo
            this.traceMap.panTo(targetPoint);

            // Animación de zoom si es necesario
            if (this.traceMap.getZoom() < 16) {
                this.traceMap.setZoom(17);
            }

            document.querySelectorAll('.stage-card').forEach((card, i) => {
                const isSelected = i === index;
                card.classList.toggle('active-stage', isSelected);
                const dot = card.querySelector('.node-dot');
                const pulse = card.querySelector('.pulse-ring');
                const icon = card.querySelector('i.fas:not(.fa-chevron-right)');

                if (isSelected) {
                    dot.classList.add('active');
                    if (pulse) pulse.style.opacity = '1';
                    if (icon) icon.style.color = 'white';
                    if (autoScroll) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                } else {
                    dot.classList.remove('active');
                    if (pulse) pulse.style.opacity = '0';
                    if (icon) icon.style.color = '';
                }
            });
        }
    },

    animatePathTo(targetIndex) {
        if (!this.pathPoints || this.pathPoints.length < 2) return;

        const currentPath = this.tracePathActive.getPath();
        const targetPoints = this.pathPoints.slice(0, targetIndex + 1);

        // Limpiamos y empezamos la animación
        currentPath.clear();

        let pointIdx = 0;
        const animateSegment = () => {
            if (pointIdx >= targetPoints.length - 1) {
                // Fin de la animación, asegurar que el último punto esté (clonado como LatLng)
                const lastPoint = targetPoints[targetPoints.length - 1];
                currentPath.push(new google.maps.LatLng(lastPoint.lat, lastPoint.lng));
                return;
            }

            const p1 = targetPoints[pointIdx];
            const p2 = targetPoints[pointIdx + 1];

            // Interpolar entre p1 y p2
            const steps = 15; // Pasos de animación entre puntos
            let step = 0;

            const drawStep = () => {
                if (step <= steps) {
                    const lat = p1.lat + (p2.lat - p1.lat) * (step / steps);
                    const lng = p1.lng + (p2.lng - p1.lng) * (step / steps);
                    currentPath.push(new google.maps.LatLng(lat, lng));
                    step++;
                    requestAnimationFrame(drawStep);
                } else {
                    pointIdx++;
                    animateSegment();
                }
            };
            drawStep();
        };

        animateSegment();
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
