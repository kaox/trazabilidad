const app = {
    productId: window.PRODUCT_ID || new URLSearchParams(window.location.search).get('id'),
    product: null,
    currentTab: 'origen',
    flavorWheels: null,
    activeLoteEtapasCount: 0,

    trackEvent: async function (type, companyId, productId = null) {
        console.log("Guardando analytics... ", type, companyId, productId);
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
        } catch (e) {
            console.error('Error tracking event:', e);
        }
    },

    async loadGoogleMaps() {
        if (window.google && window.google.maps) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyAM37iJTRcIoSAxESlDzB2DxlNJWKasW5U&libraries=geometry&v=weekly";
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async loadD3() {
        if (window.d3) return;
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = "https://d3js.org/d3.v7.min.js";
            script.onload = () => {
                const loadScript = (src) => new Promise((res, rej) => {
                    const s = document.createElement('script');
                    s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
                });
                Promise.all([
                    loadScript('/js/d3-utils.js'),
                    loadScript('/js/d3-sunburst.js')
                ]).then(resolve).catch(reject);
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    },

    async init() {
        if (!this.productId) {
            window.location.href = '/marketplace';
            return;
        }

        await this.fetchData();
        if (this.product) {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('source') === 'qr') {
                const compId = this.product.id_empresa || (this.product.empresa && this.product.empresa.id) || null;
                this.trackEvent('qr_view', compId, this.product.id);
            }

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
            const [productsRes, flavorsRes, perfilesRes] = await Promise.all([
                fetch('/api/public/marketplace/products'),
                fetch('/data/flavor-wheels.json'),
                fetch('/data/perfiles.json')
            ]);

            const productsData = await productsRes.json();
            this.product = productsData.products.find(p => p.id === this.productId);
            this.flavorWheels = await flavorsRes.json();
            this.sensoryConfig = await perfilesRes.json();

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

        // Brand Header
        const brandHeader = document.getElementById('brand-header');
        const brandLogo = document.getElementById('brand-logo');
        const brandName = document.getElementById('brand-name');

        if (this.product.empresa) {
            brandName.textContent = this.product.empresa.nombre || 'Productor';
            brandLogo.src = this.product.empresa.logo || 'https://placehold.co/100/f5f5f5/999?text=Logo';
            brandHeader.classList.remove('hidden');
        }

        // Breadcrumb
        const breadcrumb = document.getElementById('product-breadcrumb');
        const breadcrumbStore = document.getElementById('breadcrumb-store');
        const breadcrumbStoreName = document.getElementById('breadcrumb-store-name');
        const breadcrumbStoreProducts = document.getElementById('breadcrumb-store-products');
        const breadcrumbProduct = document.getElementById('breadcrumb-product');

        if (breadcrumb && breadcrumbStore && breadcrumbProduct) {
            const companyName = this.product.empresa?.nombre || 'Tienda';
            breadcrumbProduct.textContent = this.product.nombre;

            // Derive the store URL: take the first two path segments of the canonical URL
            // e.g. /origen-unico/burgos-chocolate-1  from /origen-unico/burgos-chocolate-1/blend-satipo-07b5ec9a
            let storeHref = '#';
            const canonical = window.PRODUCT_CANONICAL_URL || window.location.pathname;
            const segments = canonical.split('/').filter(Boolean);
            if (segments.length >= 2) {
                storeHref = '/' + segments[0] + '/' + segments[1];
            }

            breadcrumbStore.href = storeHref;
            if (breadcrumbStoreName) breadcrumbStoreName.textContent = companyName;

            if (breadcrumbStoreProducts) {
                breadcrumbStoreProducts.href = storeHref + '#tienda';
            }

            breadcrumb.classList.remove('hidden');
        }

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
            whatsappBtn.onclick = () => {
                const compId = this.product.id_empresa || (this.product.empresa && this.product.empresa.id) || null;
                this.trackEvent('buy_click', compId, this.product.id);
            };
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

        const awards = document.getElementById('awards-overlay');
        if (this.product.premios && this.product.premios.length > 0) {
            awards.innerHTML = this.product.premios.map((prem) => {
                const year = prem.year || '';
                return `
                <div class="bg-white/95 backdrop-blur p-2 rounded-xl shadow-lg border border-white/50 flex flex-col items-center gap-0.5 w-16 md:w-20 transform hover:scale-110 transition-transform">
                    <img src="${prem.logo_url || 'https://placehold.co/80/f5f5f5/999'}" class="w-8 h-8 md:w-10 md:h-10 object-contain">
                    ${year ? `<span class="text-[8px] md:text-[10px] font-bold text-stone-900">${year}</span>` : ''}
                </div>
                `;
            }).join('');
        } else {
            awards.innerHTML = '';
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
        const finca = this.product.finca;

        if (!finca || !finca.nombre) {
            document.getElementById('tab-content').innerHTML = `
                <div class="py-16 md:py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div class="w-20 h-20 md:w-24 md:h-24 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-stone-100 shadow-sm">
                        <i class="fas fa-mountain-sun text-stone-200 text-3xl md:text-4xl"></i>
                    </div>
                    <h3 class="text-xl md:text-2xl font-display font-bold text-stone-300">Sin información de origen</h3>
                    <p class="text-stone-400 mt-2 max-w-sm mx-auto px-6 text-sm md:text-base">Este producto aún no tiene vinculada la información detallada de la finca de origen.</p>
                </div>
            `;
            return;
        }

        const farmImages = this.parseJSON(finca.imagenes) || [];
        const bannerImg = (farmImages && farmImages.length > 0) ? farmImages[0] : 'https://images.unsplash.com/photo-1542618837-56455cc6326e?q=80&w=2670&auto=format&fit=crop';

        const locationParts = [finca.distrito, finca.provincia, finca.departamento].filter(p => p && p.trim() !== "");
        const locationStr = locationParts.join(', ');

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
                        <h3 class="text-2xl font-bold text-stone-800">Finca ${finca.nombre}</h3>
                        ${locationStr ? `
                        <p class="text-xs font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                            <i class="fas fa-map-marker-alt text-amber-700"></i> ${locationStr}
                        </p>` : ''}
                        
                        ${finca.historia ? `
                        <p class="text-stone-600 leading-relaxed text-lg italic">
                            "${finca.historia}"
                        </p>` : ''}
                        
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                            ${finca.productor ? `
                            <div class="bg-white p-5 rounded-2xl border border-stone-100 flex items-center gap-4 shadow-sm">
                                <div class="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                                    <i class="fas fa-user-tie text-orange-600 text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Agricultor</p>
                                    <p class="font-bold text-stone-800 text-lg">${finca.productor}</p>
                                </div>
                            </div>` : ''}
                            
                            ${finca.altura ? `
                            <div class="bg-white p-5 rounded-2xl border border-stone-100 flex items-center gap-4 shadow-sm">
                                <div class="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                                    <i class="fas fa-mountain-sun text-emerald-600 text-xl"></i>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Altitud</p>
                                    <p class="font-bold text-stone-800 text-lg">${finca.altura} msnm</p>
                                </div>
                            </div>` : ''}
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
                                            <img src="${img}" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 cursor-zoom-in" >
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

    async initOriginMap() {
        const finca = this.product.finca || {};
        const mapDiv = document.getElementById('origin-map');
        if (!mapDiv) return;

        try {
            await this.loadGoogleMaps();
        } catch (e) {
            console.error("Error loading Google Maps", e);
            return;
        }

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

    async initProcessMap() {
        const mapDiv = document.getElementById('process-map');
        if (!mapDiv) return;

        try {
            await this.loadGoogleMaps();
        } catch (e) {
            console.error("Error loading Google Maps", e);
            return;
        }

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
                        ${this.product.variedad ? `
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Variedad Botánica</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.variedad}</p>
                        </div>
                        ` : ''}
                        ${this.product.grupo_genetico ? `
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Grupo Genético</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.grupo_genetico}</p>
                        </div>
                        ` : ''}
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
        const hasPerfil = this.product.perfil && Object.keys(this.product.perfil).length > 0;
        const rawNotes = this.product.sabores || this.product.rueda_notas;
        let selectedNotes = [];
        if (rawNotes) {
            try {
                selectedNotes = typeof rawNotes === 'string' ? JSON.parse(rawNotes) : rawNotes;
            } catch (e) { }
        }
        const hasSabores = Array.isArray(selectedNotes) && selectedNotes.length > 0;

        const html = `
            <div class="space-y-12 animate-in fade-in duration-500">
                <div class="flex items-center gap-3">
                    <i class="fas fa-microscope text-amber-800 text-xl"></i>
                    <h2 class="text-2xl font-display font-bold text-stone-900">Perfil Sensorial</h2>
                </div>

                <div class="grid grid-cols-1 gap-16">
                    <!-- Rueda de Sabores -->
                    <div class="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border border-stone-100 shadow-sm space-y-8">
                        <h3 class="text-sm font-bold text-stone-400 uppercase tracking-widest text-center">Complejidad Sensorial (Rueda)</h3>
                        <div id="sunburst-container" class="w-full relative py-4 flex justify-center min-h-[300px] flex items-center">
                            ${hasSabores ? '<!-- SVG D3 se inyecta aquí -->' : `
                                <div class="text-center py-10">
                                    <i class="fas fa-certificate text-stone-100 text-6xl mb-4"></i>
                                    <p class="text-stone-300 italic">Sin notas de sabor registradas</p>
                                </div>
                            `}
                        </div>
                    </div>

                    <!-- Radar de Atributos -->
                    <div class="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[3.5rem] border border-stone-100 shadow-sm space-y-8">
                        <h3 class="text-sm font-bold text-stone-400 uppercase tracking-widest text-center">Análisis de Atributos</h3>
                        <div class="aspect-square w-full max-w-[600px] mx-auto relative flex items-center justify-center">
                            ${hasPerfil ? '<svg id="radar-analisis" class="w-full h-full"></svg>' : `
                                <div class="text-center py-10">
                                    <i class="fas fa-chart-area text-stone-100 text-6xl mb-4"></i>
                                    <p class="text-stone-300 italic">Análisis de atributos no disponible</p>
                                </div>
                            `}
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
        this.initCharts(hasPerfil, hasSabores);
    },

    async initCharts(hasPerfil, hasSabores) {
        if (hasPerfil || hasSabores) {
            try {
                await this.loadD3();
            } catch (e) {
                console.error("Error loading D3", e);
                return;
            }
        }

        // Radar Chart
        if (hasPerfil && this.product.perfil && this.sensoryConfig) {
            const configList = this.sensoryConfig[this.product.tipo];
            if (configList) {
                const labels = configList.map(attr => attr.label);
                const values = configList.map(attr => parseFloat(this.product.perfil[attr.id]) || 0);

                const colors = {
                    cafe: '#d97706',
                    cacao: '#7c2d12',
                    miel: '#fbbf24'
                };

                const config = {
                    labels: labels,
                    datasets: [{
                        data: values,
                        color: colors[this.product.tipo] || '#3b82f6'
                    }]
                };

                if (typeof renderRadarChart !== 'undefined') {
                    renderRadarChart('#radar-analisis', config, { maxValue: 10 });
                }
            }
        }

        // Sunburst D3
        if (hasSabores) {
            this.renderSunburst();
        }
    },

    renderSunburst() {
        const container = document.getElementById('sunburst-container');
        if (!container) return;

        const type = (this.product.tipo || '').toLowerCase();
        const wheelData = this.flavorWheels ? this.flavorWheels[type] : null;
        if (!wheelData) {
            container.innerHTML = `<div class="py-12 text-center text-stone-300 italic"><p>Configuración sensorial no disponible</p></div>`;
            return;
        }

        // Parseamos las notas seleccionadas (vienen como 'sabores' desde el API del marketplace)
        let selectedNotes = [];
        const rawNotes = this.product.sabores || this.product.rueda_notas;
        if (rawNotes) {
            try {
                selectedNotes = typeof rawNotes === 'string'
                    ? JSON.parse(rawNotes)
                    : rawNotes;
            } catch (e) {
                console.error("Error parsing flavor notes:", e);
                selectedNotes = [];
            }
        }

        // Usamos la nueva librería compartida con lógica de "poda" (pruning)
        SunburstChart.render('#sunburst-container', wheelData, {
            selection: selectedNotes,
            isWidget: true, // Importante: Esto oculta lo no seleccionado (estilo Tastify)
            width: 600,
            height: 600
        });
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
                            <span class="text-[9px] font-bold text-stone-400 uppercase">Nivel de Afinidad</span>
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
                            <span class="text-[9px] font-bold text-stone-400 uppercase">Nivel de Afinidad</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        document.getElementById('tab-content').innerHTML = html;
    },

    async loadTrazabilidadData() {
        try {
            // Reemplaza esta URL con el endpoint real de tu API pública para lotes de un producto
            // Ej: /api/public/productos/${this.productId}/trazabilidad
            const response = await fetch(`/api/public/productos/${this.productId}/trazabilidad`);
            console.log("response", response);
            if (!response.ok) {
                console.warn("Endpoint de trazabilidad no disponible o producto sin lotes.");
                return null;
            }

            const backendLotes = await response.json();

            if (!backendLotes || backendLotes.length === 0) return null;

            // Mapeamos los datos del backend a la estructura visual que requiere la UI
            return backendLotes.map(lote => {
                return {
                    id_lote: lote.id || lote.codigo_lote,
                    nombre_lote: lote.codigo_lote + (lote.is_locked ? ' (Sellado)' : ''),
                    blockchain_hash: lote.blockchain_hash,
                    etapas: lote.etapas.map(etapa => {
                        // 1. Extraer nombre del actor y ubicación
                        let actorNombre = "Actor Desconocido";
                        let ubicacionStr = "Ubicación no especificada";
                        let coords = { lat: -9.189, lng: -75.015 }; // Default (Centro Perú)

                        const parseCoordenadas = (coordData) => {
                            if (!coordData) return null;
                            try {
                                const parsed = typeof coordData === 'string' ? JSON.parse(coordData) : coordData;
                                if (Array.isArray(parsed) && parsed.length > 0) {
                                    if (Array.isArray(parsed[0])) {
                                        let latSum = 0, lngSum = 0;
                                        parsed.forEach(p => {
                                            latSum += parseFloat(p[0]);
                                            lngSum += parseFloat(p[1]);
                                        });
                                        return { lat: latSum / parsed.length, lng: lngSum / parsed.length };
                                    } else if (typeof parsed[0] === 'number') {
                                        return { lat: parseFloat(parsed[0]), lng: parseFloat(parsed[1]) };
                                    } else if (parsed[0].lat !== undefined) {
                                        let latSum = 0, lngSum = 0;
                                        parsed.forEach(p => {
                                            latSum += parseFloat(p.lat);
                                            lngSum += parseFloat(p.lng);
                                        });
                                        return { lat: latSum / parsed.length, lng: lngSum / parsed.length };
                                    }
                                } else if (parsed && parsed.lat !== undefined && parsed.lng !== undefined) {
                                    return { lat: parseFloat(parsed.lat), lng: parseFloat(parsed.lng) };
                                }
                            } catch (e) {
                                console.error("Error parseando coordenadas:", e);
                            }
                            return null;
                        };

                        if (etapa.finca_id && etapa.finca) {
                            actorNombre = etapa.finca.nombre_finca || actorNombre;
                            ubicacionStr = `${etapa.finca.distrito || ''}, ${etapa.finca.departamento || ''}`.replace(/^, |, $/g, '');
                            const pCoords = parseCoordenadas(etapa.finca.coordenadas);
                            if (pCoords) coords = pCoords;
                        } else if (etapa.procesadora_id && etapa.procesadora) {
                            actorNombre = etapa.procesadora.razon_social || etapa.procesadora.nombre_comercial || actorNombre;
                            ubicacionStr = `${etapa.procesadora.distrito || ''}, ${etapa.procesadora.departamento || ''}`.replace(/^, |, $/g, '');
                            const pCoords = parseCoordenadas(etapa.procesadora.coordenadas);
                            if (pCoords) coords = pCoords;
                        }

                        // 2. Extraer clases visuales del catálogo de etapas
                        const colorClass = etapa.color || 'text-stone-600';
                        // Generar bg basado en el text-color (ej. text-green-600 -> bg-green-100)
                        const bgClass = colorClass.replace('text-', 'bg-').replace('-600', '-100').replace('-700', '-100').replace('-500', '-100');
                        const iconClass = etapa.icono ? (etapa.icono.startsWith('fa-') ? etapa.icono : `fa-${etapa.icono.toLowerCase()}`) : 'fa-check-circle';

                        // 3. Formatear Fecha
                        const fechaObj = new Date(etapa.fecha);
                        const fechaFormateada = isNaN(fechaObj) ? etapa.fecha : fechaObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

                        return {
                            nombre: etapa.etapa_nombre || etapa.tipo_etapa || 'Etapa',
                            fecha: fechaFormateada,
                            actor: actorNombre,
                            ubicacion: ubicacionStr || 'Ubicación local',
                            coordenadas: coords,
                            descripcion: etapa.notas || 'Paso procesado y registrado correctamente en la cadena de trazabilidad.',
                            icono: iconClass,
                            color: colorClass,
                            bg: bgClass,
                            foto: etapa.foto || null
                        };
                    })
                };
            });
        } catch (error) {
            console.error("Error obteniendo datos de trazabilidad:", error);
            return null;
        }
    },

    async renderTrazabilidad() {
        const container = document.getElementById('tab-content');

        // Estado de carga inicial mientras vamos al backend
        container.innerHTML = `
            <div class="py-24 text-center animate-pulse">
                <i class="fas fa-circle-notch fa-spin text-4xl text-stone-300 mb-4"></i>
                <p class="text-stone-400 font-medium">Cargando hoja de ruta blockchain...</p>
            </div>
        `;

        // Forzar limpieza absoluta de mapas y marcadores previos para evitar fugas de memoria o referencias rotas
        this.map = null;
        this.markers = [];
        this.mapPolyline = null;
        this.activePolyline = null;

        // 1. Intentamos cargar los lotes mapeados desde el backend
        let lotesData = await this.loadTrazabilidadData();
        console.log("lotes data", lotesData);
        // 2. Si no hay datos en la API, usamos los lotes pre-cargados en this.product o el Mock de respaldo
        if (!lotesData || lotesData.length === 0) {
            lotesData = (this.product && this.product.lotes && this.product.lotes.length > 0)
                ? this.product.lotes
                : null; // Fallback temporal
        }

        if (!lotesData || lotesData.length === 0) {
            container.innerHTML = `
                <div class="py-16 md:py-24 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div class="w-20 h-20 md:w-24 md:h-24 bg-stone-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-stone-100 shadow-sm">
                        <i class="fas fa-route text-stone-200 text-3xl md:text-4xl"></i>
                    </div>
                    <h3 class="text-xl md:text-2xl font-display font-bold text-stone-300">Trazabilidad No Disponible</h3>
                    <p class="text-stone-400 mt-2 max-w-sm mx-auto px-6 text-sm md:text-base">Este producto aún no cuenta con un lote verificado en la blockchain.</p>
                </div>
            `;
            return;
        }

        // Diseño App-Like optimizado para evitar desbordamiento o recortes
        const html = `
            <style>
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
                
                /* Tarjeta de Trazabilidad con sombreado premium y transiciones estables */
                .stage-card {
                    transition: opacity 0.5s ease-out, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.4s ease, border-color 0.4s ease;
                    opacity: 0.3;
                    transform: translateY(15px) scale(0.97);
                    border-color: transparent;
                }
                .stage-card.active-stage {
                    opacity: 1;
                    transform: translateY(0) scale(1);
                    box-shadow: 0 20px 40px -10px rgba(139, 69, 19, 0.12);
                    border-color: rgba(139, 69, 19, 0.25);
                }
                
                #mapa-publico [title="Google"] img, #mapa-publico .gmnoprint { display: none !important; }
            </style>

            <!-- Contenedor principal: overflow-visible para que cards activas no se recorten en ningún viewport -->
            <div class="animate-in fade-in duration-1000 w-full bg-[#fdfaf6] rounded-[2.5rem] border border-stone-200 shadow-sm flex flex-col my-4 overflow-visible relative" style="min-height:680px;">
                
                <!-- CABECERA FIJA -->
                <div class="bg-white px-6 py-5 border-b border-stone-200 shrink-0 z-20 shadow-sm rounded-t-[2.5rem]">
                    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                        <div>
                            <h2 class="text-2xl md:text-3xl font-display font-bold text-stone-900 leading-tight">El viaje del producto</h2>
                        </div>
                        <div class="bg-stone-50 px-4 py-2 rounded-xl border border-stone-200 md:min-w-[260px]">
                            <label class="block font-bold text-stone-400 text-[9px] mb-0.5 uppercase tracking-widest">Seleccionar Lote</label>
                            <select id="selector-lote" class="w-full bg-transparent font-mono text-sm font-bold text-stone-800 outline-none cursor-pointer">
                                ${lotesData.map(lote => `<option value="${lote.id_lote}">${lote.nombre_lote}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- STEPPER DE ETAPAS: overflow-x-auto visible, con padding-bottom para que los textos absolutos no se corten -->
                    <div id="stepper-container" class="w-full relative"></div>
                </div>

                <!-- LAYOUT INTERACTIVO -->
                <div class="flex flex-col md:flex-row bg-stone-50/20 p-4 md:p-5 gap-5" style="flex:1 1 auto; min-height:420px;">
                    
                    <!-- Lado Izquierdo: MAPA -->
                    <!-- Altura explícita en mobile; en desktop ocupa el flex restante -->
                    <div class="w-full md:w-1/2 lg:w-3/5 shrink-0 relative rounded-3xl overflow-hidden shadow-md border-4 border-white bg-stone-200 z-10" style="height:300px;" id="mapa-wrapper">
                        <div id="mapa-publico" style="width:100%;height:100%;"></div>
                        <div class="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-md flex items-center gap-2 border border-stone-100">
                            <div class="w-2 h-2 rounded-full bg-amber-600 animate-pulse"></div>
                            <span class="text-[10px] font-bold text-stone-700 uppercase tracking-wider" id="map-status">Cargando mapa...</span>
                        </div>
                    </div>

                    <!-- Lado Derecho: LISTA DE TARJETAS -->
                    <!-- scroll horizontal en mobile, scroll vertical en desktop. Sin max-height para no cortar cards -->
                    <!-- px-4 en móvil asegura que las sombras/bordes no se corten contra el límite del contenedor -->
                    <div id="timeline-container" class="w-full md:w-1/2 lg:w-2/5 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto flex md:flex-col gap-4 md:gap-6 snap-x snap-mandatory md:snap-y px-4 md:px-2 pb-6 md:pb-16 no-scrollbar items-start md:items-stretch z-10">
                        <!-- Se llena vía JS -->
                    </div>
                </div>
            </div>
        `;
        container.innerHTML = html;

        this.loadGoogleMaps().then(() => {
            const selector = document.getElementById('selector-lote');
            selector.addEventListener('change', (e) => this.cambiarLote(e.target.value, lotesData));

            if (lotesData.length > 0) {
                // Pequeño retardo para asegurar que el DOM cargó y los tamaños estén calculados
                setTimeout(() => this.cambiarLote(lotesData[0].id_lote, lotesData), 150);
            }
        });
    },

    cambiarLote(loteId, lotesData) {
        const lote = lotesData.find(l => l.id_lote === loteId);
        if (!lote) return;

        this.activeLoteEtapasCount = lote.etapas.length;

        // 1. Inyectar Stepper Horizontal
        const stepperContainer = document.getElementById('stepper-container');
        if (stepperContainer) this.renderHorizontalStepper(lote.etapas, stepperContainer);

        // 2. Limpiar y renderizar tarjetas
        const container = document.getElementById('timeline-container');
        container.innerHTML = '';

        if (this.currentObserver) this.currentObserver.disconnect();

        this.renderTimelineElements(lote.etapas, container);

        // Destruir mapa anterior y forzar recreación
        this.map = null;
        this.drawMapRoute(lote.etapas);
        this.setupScrollObserver(lote);

        this.activeMarkerIndex = -1;

        // Iniciar el viaje en la primera etapa con un delay seguro para que se calculen los offsets reales
        setTimeout(() => {
            this.updateStepperProgressLine(0);
            this.activateEtapa(0, lote);
        }, 200);
    },

    renderHorizontalStepper(etapas, container) {
        // El wrapper tiene overflow-x-auto y padding-bottom suficiente para que los textos
        // posicionados con absolute (top-12) nunca queden ocultos por overflow
        let html = `
            <div class="relative w-full overflow-x-auto no-scrollbar" style="padding-bottom:2.5rem; padding-top:0.5rem;">
                <div class="relative flex gap-10 md:gap-16 px-4 md:px-10 py-3 mx-auto w-max">
                    
                    <!-- Línea base gris -->
                    <div id="stepper-bg-line" class="absolute h-1 bg-stone-200 rounded-full z-0 transition-all duration-300" style="top:1.5rem;"></div>
                    
                    <!-- Línea naranja de progreso -->
                    <div id="stepper-progress" class="absolute h-1 bg-amber-600 rounded-full z-0 transition-all duration-700 ease-in-out" style="top:1.5rem; width:0px;"></div>
        `;

        etapas.forEach((etapa, index) => {
            html += `
                <div class="relative flex flex-col items-center cursor-pointer group z-10" style="width:3.5rem;" onclick="document.getElementById('etapa-${index}').scrollIntoView({behavior: 'smooth', block: 'nearest', inline: 'center'})">
                    <div id="step-icon-${index}" class="w-10 h-10 rounded-full flex items-center justify-center border-4 border-white bg-stone-100 text-stone-400 shadow-sm transition-all duration-500 group-hover:scale-110">
                        <i class="fas ${etapa.icono} text-sm"></i>
                    </div>
                    <!-- top-11 fijo para que el texto nunca tape los iconos ni sea recortado -->
                    <p id="step-text-${index}" class="text-[10px] font-bold text-center text-stone-400 transition-colors leading-tight px-1 mt-1.5" style="width:5rem; word-break:break-word; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${etapa.nombre}</p>
                </div>
            `;
        });

        html += `
                </div>
            </div>
        `;
        container.innerHTML = html;
    },

    renderTimelineElements(etapas, container) {
        etapas.forEach((etapa, index) => {
            const fotoHtml = etapa.foto
                ? `<div class="mt-4 rounded-2xl overflow-hidden shadow-sm h-36 md:h-48 relative border border-stone-100 shrink-0"><img src="${etapa.foto}" class="w-full h-full object-cover transition-transform duration-700 hover:scale-105" alt="Imagen etapa ${etapa.nombre}"></div>`
                : '';

            // min-h en móvil (no h fija) para que el contenido nunca se recorte
            const html = `
                <div id="etapa-${index}" class="stage-card snap-center shrink-0 w-[82vw] md:w-full flex flex-col bg-white rounded-[2rem] p-5 md:p-6 border-2 mx-auto md:mx-0 relative z-10" style="min-height:260px;" data-index="${index}">
                    
                    <div class="flex items-start gap-4 mb-3">
                        <div id="card-icon-${index}" class="w-12 h-12 md:w-14 md:h-14 rounded-2xl flex items-center justify-center bg-stone-50 text-stone-400 transition-colors duration-500 shrink-0 border border-stone-100">
                            <i class="fas ${etapa.icono} text-lg md:text-xl"></i>
                        </div>
                        <div class="flex-grow pt-1 min-w-0">
                            <h3 class="text-base md:text-xl font-display font-bold text-stone-800 leading-tight">${etapa.nombre}</h3>
                            <span class="text-[10px] font-black text-amber-600 uppercase tracking-widest mt-0.5 block">${etapa.fecha}</span>
                        </div>
                    </div>

                    <div class="flex flex-col gap-1.5 mb-3 p-3 bg-stone-50/80 rounded-2xl text-xs md:text-sm border border-stone-100/80">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-location-dot w-4 text-center text-amber-700 opacity-80 shrink-0"></i>
                            <p class="font-bold text-stone-700 tracking-tight truncate">${etapa.actor}</p>
                        </div>
                        <div class="flex items-center gap-2">
                            <i class="fas fa-map w-4 text-center text-stone-400 shrink-0"></i>
                            <p class="text-stone-500 text-[11px] md:text-xs truncate">${etapa.ubicacion}</p>
                        </div>
                    </div>
                    
                    <!-- Descripción completa: sin overflow-hidden para que nunca se recorte -->
                    <div class="text-sm text-stone-600 leading-relaxed">
                        <p>${etapa.descripcion}</p>
                        ${fotoHtml}
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('beforeend', html);
        });

        // Espaciador inferior para permitir scroll hasta la última tarjeta
        container.insertAdjacentHTML('beforeend', '<div class="shrink-0 w-4 md:w-auto h-4 md:h-16 pointer-events-none"></div>');
    },

    drawMapRoute(etapas) {
        const mapEl = document.getElementById('mapa-publico');
        if (!mapEl) return;

        // Asegurar que el wrapper tenga altura real en desktop (md y superior)
        const wrapper = document.getElementById('mapa-wrapper');
        if (wrapper && window.innerWidth >= 768) {
            // Hacer que el wrapper ocupe el 100% de la columna flex del padre
            wrapper.style.height = 'auto';
            wrapper.style.flex = '1 1 0%';
        }

        this.map = null;
        this.map = new google.maps.Map(mapEl, {
            zoom: 6, center: { lat: -9.189, lng: -75.015 },
            mapTypeId: 'terrain', disableDefaultUI: true, zoomControl: true, scrollwheel: false
        });

        if (this.markers) this.markers.forEach(m => m.setMap(null));
        this.markers = [];

        if (this.mapPolyline) this.mapPolyline.setMap(null);
        if (this.activePolyline) this.activePolyline.setMap(null);

        if (etapas.length === 0) return;

        const pathCoords = [];
        const bounds = new google.maps.LatLngBounds();

        etapas.forEach((etapa, index) => {
            const pos = { lat: parseFloat(etapa.coordenadas.lat), lng: parseFloat(etapa.coordenadas.lng) };
            pathCoords.push(pos);
            bounds.extend(pos);

            const marker = new google.maps.Marker({
                position: pos, map: this.map,
                label: { text: (index + 1).toString(), color: 'white', fontWeight: 'bold', fontSize: '12px' },
                title: etapa.nombre,
                icon: { path: google.maps.SymbolPath.CIRCLE, fillColor: '#d6d3d1', fillOpacity: 1, strokeWeight: 2, strokeColor: '#FFFFFF', scale: 12 },
                zIndex: 1
            });
            this.markers.push(marker);
        });

        if (pathCoords.length > 1) {
            this.mapPolyline = new google.maps.Polyline({
                path: pathCoords, geodesic: true, strokeColor: '#d6d3d1', strokeOpacity: 0.8, strokeWeight: 3, map: this.map,
                icons: [{ icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 }, offset: '0', repeat: '20px' }]
            });
            this.activePolyline = new google.maps.Polyline({
                path: [], geodesic: true, strokeColor: '#d97706', strokeOpacity: 1, strokeWeight: 5, map: this.map
            });
        }

        if (pathCoords.length > 0) {
            this.map.fitBounds(bounds);
            if (pathCoords.length === 1) setTimeout(() => this.map.setZoom(12), 100);
        }

        // Forzar resize para que Google Maps calcule las dimensiones reales del container
        setTimeout(() => {
            google.maps.event.trigger(this.map, 'resize');
            if (pathCoords.length > 0) this.map.fitBounds(bounds);
        }, 200);
    },

    setupScrollObserver(loteActivo) {
        // threshold 0.35 para activar en mobile donde la tarjeta visible es parcial
        const options = { root: document.getElementById('timeline-container'), rootMargin: '0px', threshold: 0.35 };

        this.currentObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const index = parseInt(entry.target.getAttribute('data-index'));
                    this.activateEtapa(index, loteActivo);
                }
            });
        }, options);

        document.querySelectorAll('.stage-card').forEach(card => this.currentObserver.observe(card));
    },

    updateStepperProgressLine(index) {
        const startNode = document.getElementById('step-icon-0');
        const activeNode = document.getElementById(`step-icon-${index}`);
        const lastNode = document.getElementById(`step-icon-${this.activeLoteEtapasCount - 1}`);
        const progressLine = document.getElementById('stepper-progress');
        const bgLine = document.getElementById('stepper-bg-line');

        // Usar getBoundingClientRect relativo al contenedor scrollable para precision exacta
        const scrollWrapper = document.getElementById('stepper-container')?.querySelector('[style*="padding-bottom"]');
        const wrapperScrollLeft = scrollWrapper ? scrollWrapper.scrollLeft : 0;

        if (startNode && lastNode && bgLine) {
            const startLeft = startNode.offsetLeft + startNode.offsetWidth / 2;
            const lastLeft = lastNode.offsetLeft + lastNode.offsetWidth / 2;
            bgLine.style.left = `${startLeft}px`;
            bgLine.style.width = `${Math.max(0, lastLeft - startLeft)}px`;
        }

        if (startNode && activeNode && progressLine) {
            const startLeft = startNode.offsetLeft + startNode.offsetWidth / 2;
            const activeLeft = activeNode.offsetLeft + activeNode.offsetWidth / 2;
            progressLine.style.left = `${startLeft}px`;
            progressLine.style.width = `${Math.max(0, activeLeft - startLeft)}px`;
        }
    },

    activateEtapa(index, loteActivo) {
        if (this.activeMarkerIndex === index) return;
        this.activeMarkerIndex = index;

        const mapStatus = document.getElementById('map-status');
        if (mapStatus) mapStatus.innerText = index === 0 ? 'Origen del Lote' : `Viajando a: ${loteActivo.etapas[index].actor}`;

        // 1. Iluminación de Tarjetas
        document.querySelectorAll('.stage-card').forEach((card, i) => {
            const cardIcon = document.getElementById(`card-icon-${i}`);

            if (i === index) {
                card.classList.add('active-stage');
                card.classList.add('shadow-[0_20px_50px_rgba(139,69,19,0.12)]', 'border-amber-600/30');
                if (cardIcon) {
                    cardIcon.classList.remove('bg-stone-50', 'text-stone-400');
                    cardIcon.classList.add('bg-amber-100', 'text-amber-700');
                }
            } else {
                card.classList.remove('active-stage');
                card.classList.remove('shadow-[0_20px_50px_rgba(139,69,19,0.12)]', 'border-amber-600/30');
                if (cardIcon) {
                    cardIcon.classList.add('bg-stone-50', 'text-stone-400');
                    cardIcon.classList.remove('bg-amber-100', 'text-amber-700');
                }
            }
        });

        // 2. Progreso de Flujo Horizontal
        this.updateStepperProgressLine(index);

        loteActivo.etapas.forEach((_, i) => {
            const iconDiv = document.getElementById(`step-icon-${i}`);
            const textP = document.getElementById(`step-text-${i}`);
            if (!iconDiv || !textP) return;

            if (i === index) { // Activa
                iconDiv.className = `w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-lg transition-all duration-500 scale-125 bg-amber-600 text-white z-10`;
                textP.className = `absolute top-12 text-[10px] md:text-xs font-black text-center w-24 md:w-28 transition-colors leading-tight line-clamp-2 mt-1 px-1 text-amber-700`;
            } else if (i < index) { // Pasada
                iconDiv.className = `w-10 h-10 rounded-full flex items-center justify-center border-4 border-white shadow-sm transition-all duration-500 bg-amber-600 text-white z-10`;
                textP.className = `absolute top-12 text-[10px] md:text-xs font-bold text-center w-24 md:w-28 transition-colors leading-tight line-clamp-2 mt-1 px-1 text-stone-700`;
            } else { // Futura
                iconDiv.className = `w-10 h-10 rounded-full flex items-center justify-center border-4 border-white bg-stone-100 text-stone-400 shadow-sm transition-all duration-500 hover:scale-110 z-10`;
                textP.className = `absolute top-12 text-[10px] md:text-xs font-medium text-center w-24 md:w-28 transition-colors leading-tight line-clamp-2 mt-1 px-1 text-stone-400`;
            }
        });

        // Deslizar horizontalmente el Stepper para que el nodo activo permanezca a la vista en pantallas angostas
        const stepperWrapper = document.getElementById('stepper-container')?.querySelector('div.overflow-x-auto');
        const activeNode = document.getElementById(`step-icon-${index}`);
        if (stepperWrapper && activeNode) {
            const nodeOffset = activeNode.parentElement.offsetLeft;
            stepperWrapper.scrollTo({ left: nodeOffset - (stepperWrapper.clientWidth / 2) + 20, behavior: 'smooth' });
        }

        // 3. Simulación de Viaje en el Mapa (Pan & Interpolación de Ruta)
        if (this.map && this.markers[index]) {
            const currentPos = {
                lat: parseFloat(loteActivo.etapas[index].coordenadas.lat),
                lng: parseFloat(loteActivo.etapas[index].coordenadas.lng)
            };

            this.map.panTo(currentPos);
            if (this.map.getZoom() < 10) this.map.setZoom(11);

            // Resaltar nodo activo y atenuar inactivos
            this.markers.forEach((marker, i) => {
                let newColor = i <= index ? "#d97706" : "#d6d3d1";
                let newScale = i === index ? 18 : 12;
                let zIndex = i === index ? 100 : (i < index ? 50 : 1);

                if (i === index) {
                    marker.setAnimation(google.maps.Animation.BOUNCE);
                    setTimeout(() => marker.setAnimation(null), 1400);
                }

                marker.setIcon({
                    path: google.maps.SymbolPath.CIRCLE, fillColor: newColor, fillOpacity: 1, strokeWeight: 2, strokeColor: "#FFFFFF", scale: newScale
                });
                marker.setZIndex(zIndex);
            });

            // Re-trazar línea de viaje
            if (this.activePolyline) {
                this.animateJourney(loteActivo, index);
            }
        }
    },

    animateJourney(loteActivo, targetIndex) {
        if (!this.map || !this.activePolyline) return;

        const targetPoints = loteActivo.etapas.slice(0, targetIndex + 1).map(e => new google.maps.LatLng(e.coordenadas.lat, e.coordenadas.lng));

        const path = this.activePolyline.getPath();
        path.clear();

        if (targetPoints.length === 0) return;
        path.push(targetPoints[0]);

        if (targetIndex === 0) return;

        let currentSegment = 0;
        const framesPerSegment = 15;
        let frame = 0;

        const animate = () => {
            if (currentSegment >= targetPoints.length - 1) {
                const finalPoint = targetPoints[targetPoints.length - 1];
                if (path.getLength() > currentSegment + 1) {
                    path.setAt(currentSegment + 1, finalPoint);
                } else {
                    path.push(finalPoint);
                }
                return;
            }

            const p1 = targetPoints[currentSegment];
            const p2 = targetPoints[currentSegment + 1];

            frame++;
            const progress = frame / framesPerSegment;

            const lat = p1.lat() + (p2.lat() - p1.lat()) * progress;
            const lng = p1.lng() + (p2.lng() - p1.lng()) * progress;
            const intermediatePoint = new google.maps.LatLng(lat, lng);

            if (path.getLength() > currentSegment + 1) {
                path.setAt(currentSegment + 1, intermediatePoint);
            } else {
                path.push(intermediatePoint);
            }

            if (frame >= framesPerSegment) {
                frame = 0;
                currentSegment++;
            }

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
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
