const app = {
    productId: new URLSearchParams(window.location.search).get('id'),
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
                <div class="bg-white p-3 rounded-2xl shadow-sm border border-stone-100 flex flex-col items-center gap-1 w-[110px] transform hover:scale-105 transition-transform">
                    <img src="${prem.logo_url || 'https://placehold.co/80/f5f5f5/999'}" class="w-12 h-12 object-contain mb-1">
                    <span class="text-[10px] font-bold text-stone-900">${year}</span>
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
            let data = this.parseJSON(coords);

            // Caso GeoJSON Polygon
            if (data && data.type === 'Polygon' && Array.isArray(data.coordinates)) {
                // GeoJSON es [lng, lat], Google Maps es {lat, lng}
                return data.coordinates[0].map(p => ({ lat: Number(p[1]), lng: Number(p[0]) }));
            }

            // Caso Array de arrays [[lat, lng], ...] o [{lat, lng}, ...]
            if (Array.isArray(data) && data.length > 0) {
                return data.map(p => {
                    if (Array.isArray(p)) return { lat: Number(p[0]), lng: Number(p[1]) };
                    if (p && typeof p === 'object' && p.lat !== undefined) return { lat: Number(p.lat), lng: Number(p.lng) };
                    return null;
                }).filter(p => p !== null);
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
            zoomControl: true
        });

        const paths = this.parseCoordinates(finca.coordenadas);

        if (paths && paths.length > 0) {
            new google.maps.Polygon({
                paths: paths,
                strokeColor: '#fbbf24',
                strokeOpacity: 0.8,
                strokeWeight: 3,
                fillColor: '#fbbf24',
                fillOpacity: 0.35,
                map: map
            });

            const bounds = new google.maps.LatLngBounds();
            paths.forEach(p => bounds.extend(p));
            map.fitBounds(bounds);
        } else {
            console.warn("No hay coordenadas de polígono para esta finca.");
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
                <div class="py-20 text-center animate-in fade-in duration-500">
                    <i class="fas fa-route text-stone-200 text-6xl mb-4"></i>
                    <h3 class="text-xl font-bold text-stone-400">Trazabilidad No Disponible</h3>
                    <p class="text-stone-400 mt-2">Este producto aún no cuenta con un lote verificado en blockchain.</p>
                </div>
            `;
            return;
        }

        const stages = [...this.traceability.stages].reverse(); // Clonar y revertir para mostrar desde el origen al final
        const lastBatchId = this.traceability.id || 'N/A';

        const html = `
            <div class="animate-in fade-in duration-700">
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <!-- Columna Mapa -->
                    <div class="space-y-6">
                        <div class="flex items-center justify-between">
                            <h2 class="text-3xl font-display font-bold text-stone-900">Geographic Coordinates</h2>
                        </div>
                        <div class="relative group">
                            <div id="trace-map" class="w-full h-[500px] rounded-[2.5rem] border border-stone-200 shadow-inner overflow-hidden"></div>
                            <div id="map-overlay-info" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white/95 backdrop-blur-sm p-8 rounded-3xl shadow-2xl border border-stone-100 text-center min-w-[240px] pointer-events-none transition-all duration-500 opacity-0 scale-90">
                                <span class="text-[10px] font-bold text-stone-400 uppercase tracking-widest block mb-2">ELEVATION</span>
                                <p id="overlay-elevation" class="text-3xl font-black text-amber-900 mb-1">2300 MSNM</p>
                                <p id="overlay-coords" class="text-[10px] font-medium text-stone-400 font-mono italic">8.5273° N, 38.4111° E</p>
                            </div>
                        </div>
                    </div>

                    <!-- Columna Timeline -->
                    <div class="space-y-8">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-4">
                                <h2 class="text-3xl font-display font-bold text-stone-900">Tree to Cup Timeline</h2>
                                <span class="px-3 py-1 bg-amber-50 text-amber-800 text-[10px] font-bold rounded-full border border-amber-100 uppercase tracking-wider">LOTE ${lastBatchId}</span>
                            </div>
                        </div>

                        <div class="relative">
                            <!-- Línea vertical del timeline -->
                            <div class="absolute left-4 top-2 bottom-2 w-0.5 bg-stone-100"></div>

                            <div class="space-y-10 pl-12 relative" id="timeline-list">
                                ${stages.map((stage, idx) => {
                                    const dateStr = stage.timestamp ? new Date(stage.timestamp).toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' }) : 'N/A';
                                    const loc = this.getStageLocation(stage);
                                    
                                    return `
                                    <div class="timeline-item group cursor-pointer relative" onclick="app.setTraceStage(${idx})" data-index="${idx}">
                                        <!-- Punto indicator -->
                                        <div class="absolute left-0 top-1 w-8 h-8 rounded-full border-2 border-stone-200 bg-white flex items-center justify-center -ml-[3.1rem] transition-all group-hover:border-amber-500 group-hover:bg-amber-50 z-10 node-dot">
                                            <div class="w-2.5 h-2.5 rounded-full bg-stone-200 transition-all group-hover:bg-amber-600 inner-dot"></div>
                                        </div>
                                        
                                        <div class="space-y-1">
                                            <span class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">${dateStr}</span>
                                            <h4 class="text-xl font-bold text-stone-800 group-hover:text-amber-900 transition-colors">${stage.nombre_etapa}</h4>
                                            <p class="text-sm text-stone-500 max-w-md">${loc}</p>
                                            
                                            <!-- Atributos compactos -->
                                            <div class="flex flex-wrap gap-2 mt-3 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                                                ${Object.entries(stage.data || {}).slice(0, 3).map(([key, val]) => {
                                                    const displayVal = typeof val === 'object' ? val.value : val;
                                                    if (!displayVal || key === 'imageUrl') return '';
                                                    return `
                                                        <span class="px-2.5 py-1 bg-stone-50 text-stone-500 text-[10px] font-medium rounded-lg border border-stone-100">
                                                            <b class="text-stone-700">${key}:</b> ${displayVal}
                                                        </span>
                                                    `;
                                                }).join('')}
                                            </div>
                                        </div>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Blockchain Verification Footer -->
                <div class="mt-20 p-8 border border-stone-200 rounded-[2rem] bg-stone-50/50 flex flex-col md:flex-row items-center gap-8">
                    <div class="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center border border-stone-100">
                        <i class="fas fa-shield-halved text-emerald-600 text-3xl"></i>
                    </div>
                    <div class="flex-grow text-center md:text-left">
                        <h4 class="font-bold text-stone-800 text-lg">Blockchain Proof of Authenticity</h4>
                        <p class="text-stone-500 text-sm">This timeline is backed by an immutable blockchain registry. Every stage was verified and locked by the responsible producer.</p>
                        <p class="mt-2 font-mono text-[10px] text-stone-400 break-all">${this.traceability.blockchain_hash || ''}</p>
                    </div>
                    <a href="https://polygonscan.com/tx/${this.traceability.blockchain_hash}" target="_blank" class="px-6 py-3 bg-white border border-stone-200 rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-50 transition-colors whitespace-nowrap">
                        VERIFY TRANSACTION
                    </a>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;

        // Inicializar mapa y seleccionar primera etapa
        setTimeout(() => {
            this.initTraceMap();
            this.setTraceStage(0);
        }, 100);
    },

    getStageLocation(stage) {
        const data = stage.data || {};
        // Intentar sacar de los atributos
        const loc = data.lugar?.value || data.ubicacion?.value || data.finca?.value || data.procesadora?.value;
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

        this.traceMap = new google.maps.Map(mapDiv, {
            zoom: 15,
            mapTypeId: 'satellite',
            disableDefaultUI: true,
            zoomControl: true,
            styles: [
                { "featureType": "all", "elementType": "labels.text.fill", "stylers": [{ "color": "#ffffff" }] },
                { "featureType": "all", "elementType": "labels.text.stroke", "stylers": [{ "visibility": "off" }] }
            ]
        });

        // Crear marcador único
        this.traceMarker = new google.maps.Marker({
            map: this.traceMap,
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                fillColor: '#854d0e',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 2,
                scale: 8
            }
        });
    },

    setTraceStage(index) {
        const stages = [...this.traceability.stages].reverse(); 
        const stage = stages[index];
        if (!stage) return;

        const stageData = stage.data || {};
        let coords = null;

        // 1. Buscar coordenadas en el stage data
        if (stageData.coordenadas?.value) {
            coords = this.parseCoordinates(stageData.coordenadas.value);
        }

        // 2. Si no hay coords, usar las de la finca para etapas iniciales
        if (!coords && (stage.nombre_etapa.toLowerCase().includes('cosecha') || stage.nombre_etapa.toLowerCase().includes('acopio'))) {
            coords = this.parseCoordinates(this.product.finca?.coordenadas);
        }

        // 3. Si sigue sin haber, usar las de la empresa (procesadora) para etapas finales
        if (!coords && this.traceability.procesadorasData?.length > 0) {
            coords = this.parseCoordinates(this.traceability.procesadorasData[0].coordenadas);
        }

        if (coords && coords.length > 0) {
            const point = coords[0];
            this.traceMap.panTo(point);
            this.traceMarker.setPosition(point);

            // Actualizar Overlay Info
            const overlay = document.getElementById('map-overlay-info');
            const elevationEl = document.getElementById('overlay-elevation');
            const coordsEl = document.getElementById('overlay-coords');
            
            if (overlay) {
                overlay.style.opacity = '1';
                overlay.style.transform = 'translate(-50%, -50%) scale(1)';
                
                const alt = stageData.altitud?.value || stageData.altura?.value || this.product.finca?.altura || '---';
                elevationEl.textContent = `${alt} MSNM`;
                coordsEl.textContent = `${point.lat.toFixed(4)}° N, ${point.lng.toFixed(4)}° E`;
            }
        }

        // UI Feedback en el timeline
        document.querySelectorAll('.timeline-item').forEach(item => {
            const isSelected = parseInt(item.dataset.index) === index;
            item.classList.toggle('active-stage', isSelected);
            const dot = item.querySelector('.node-dot');
            const inner = item.querySelector('.inner-dot');
            
            if (isSelected) {
                dot.style.borderColor = '#854d0e';
                dot.style.backgroundColor = '#fffbeb';
                inner.style.backgroundColor = '#854d0e';
                inner.style.transform = 'scale(1.2)';
            } else {
                dot.style.borderColor = '';
                dot.style.backgroundColor = '';
                inner.style.backgroundColor = '';
                inner.style.transform = '';
            }
        });
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
