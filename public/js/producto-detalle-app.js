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
            this.switchTab(this.currentTab);
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
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Puntaje de Cata</span>
                            <p class="text-2xl font-black text-amber-900 mt-1">${this.product.puntaje_sca || '-'} Puntos</p>
                        </div>
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Año de Cosecha</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.cosecha || '-'} </p>
                        </div>
                        <div class="spec-row">
                            <span class="text-[11px] font-bold text-stone-400 uppercase tracking-widest">Perfil de Tueste</span>
                            <p class="text-xl font-bold text-stone-800 mt-1">${this.product.nivel_tueste || '-'} </p>
                        </div>
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

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-16">
                    <div class="space-y-8">
                        <h3 class="text-sm font-bold text-stone-400 uppercase tracking-widest text-center lg:text-left">Complejidad Sensorial (Rueda)</h3>
                        <div id="sunburst-container" class="w-full relative py-4">
                            <!-- SVG D3 se inyecta aquí -->
                        </div>
                    </div>
                    <div class="space-y-8">
                        <h3 class="text-sm font-bold text-stone-400 uppercase tracking-widest text-center lg:text-left">Análisis de Atributos</h3>
                        <div class="aspect-square w-full max-w-[500px] mx-auto bg-white p-8 rounded-[3rem] border border-stone-50 shadow-sm relative overflow-hidden">
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

        const width = 600;
        const radius = width / 6;

        const rootData = { name: "Root", children: [] };
        Object.entries(FLAVOR_DATA).forEach(([catName, catData]) => {
            const hasSelection = this.product.sabores && this.product.sabores.some(s => s.category === catName);
            const catNode = {
                name: catName,
                color: hasSelection ? catData.color : '#F3F4F6',
                children: catData.children.map(child => ({
                    name: child.name,
                    color: (this.product.sabores && this.product.sabores.some(s => s.subnote === child.name)) ? catData.color : '#F3F4F6',
                    value: 1
                }))
            };
            rootData.children.push(catNode);
        });

        const root = d3.hierarchy(rootData).sum(d => d.value);
        d3.partition().size([2 * Math.PI, root.height + 1])(root);

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
            .data(root.descendants().slice(1).filter(d => d.y0 > 0 && (d.x1 - d.x0) * radius > 10))
            .join("text")
            .attr("transform", d => {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (d.y0 + d.y1) / 2 * radius;
                return `rotate(${x - 90}) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
            })
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", d => d.depth === 1 ? "12px" : "10px")
            .style("font-weight", "bold")
            .style("fill", "#333")
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
    }
};

document.addEventListener('DOMContentLoaded', () => app.init());
