document.addEventListener('DOMContentLoaded', () => {

    // --- ESTADO ---
    const state = {
        tipo: 'cafe',
        selectedFlavors: [],
        perfilMin: {},
        products: [],
        flavorData: null,
        premiosData: null
    };

    // --- DOM Elements ---
    const tipoFiltrosContainer = document.getElementById('tipo-filtros');
    const productsGrid = document.getElementById('products-grid');
    const loadingIndicator = document.getElementById('loading-indicator');
    const emptyState = document.getElementById('empty-state');
    const resultsCount = document.getElementById('results-count');
    const perfilSlidersContainer = document.getElementById('perfil-sliders');
    const selectedFlavorsContainer = document.getElementById('selected-flavors');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    // Mapeo inicial de atributos para el perfil
    const perfilAtributos = {
        cafe: ['fraganciaAroma', 'sabor', 'postgusto', 'acidez', 'cuerpo', 'dulzura', 'balance', 'limpieza', 'impresionGeneral'],
        cacao: ['cacao', 'acidez', 'amargor', 'astringencia', 'frutaFresca', 'frutaMarron', 'vegetal', 'floral', 'madera', 'especia', 'nuez', 'caramelo']
    };

    async function init() {
        showLoading(true);
        try {
            const [flavorRes, premiosRes] = await Promise.all([
                fetch('/data/flavor-wheels.json').catch(() => ({ json: () => ({}) })),
                fetch('/data/premios.json').catch(() => ({ json: () => ({}) }))
            ]);

            state.flavorData = await flavorRes.json();
            state.premiosData = await premiosRes.json();

            setupEventListeners();
            renderPerfilSliders();
            renderInteractiveWheel();
            await fetchProducts();

        } catch (error) {
            console.error("Error al inicializar marketplace:", error);
        } finally {
            showLoading(false);
        }
    }

    function setupEventListeners() {
        tipoFiltrosContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.filter-chip');
            if (!btn) return;

            tipoFiltrosContainer.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            state.tipo = btn.dataset.tipo;
            state.selectedFlavors = []; // Reset sabores al cambiar tipo
            state.perfilMin = {}; // Reset perfil

            renderInteractiveWheel();
            renderPerfilSliders();
            fetchProducts();
        });

        clearFiltersBtn.addEventListener('click', () => {
            state.selectedFlavors = [];
            state.perfilMin = {};
            renderInteractiveWheel();
            renderPerfilSliders();
            fetchProducts();
        });

        perfilSlidersContainer.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
                const val = parseFloat(e.target.value);
                const attr = e.target.dataset.attr;
                e.target.nextElementSibling.textContent = val;

                if (val > 0) {
                    state.perfilMin[attr] = val;
                } else {
                    delete state.perfilMin[attr];
                }
            }
        });

        perfilSlidersContainer.addEventListener('change', (e) => {
            if (e.target.tagName === 'INPUT' && e.target.type === 'range') {
                fetchProducts(); // Hacemos fetch al soltar el slider
            }
        });
    }

    function renderPerfilSliders() {
        perfilSlidersContainer.innerHTML = '';
        if (state.tipo === 'miel' || state.tipo === 'todos') {
            document.getElementById('perfil-container').classList.add('hidden');
            return;
        }

        document.getElementById('perfil-container').classList.remove('hidden');

        const attrs = perfilAtributos[state.tipo] || [];

        perfilSlidersContainer.innerHTML = attrs.map(attr => {
            const val = state.perfilMin[attr] || 0;
            const label = attr.charAt(0).toUpperCase() + attr.slice(1).replace(/([A-Z])/g, ' $1').trim();
            return `
                <div class="mb-3">
                    <div class="flex justify-between items-center mb-1">
                        <label class="text-xs font-medium text-stone-600">${label}</label>
                        <span class="text-xs font-bold text-amber-800">${val}</span>
                    </div>
                    <input type="range" min="0" max="10" step="0.5" value="${val}" data-attr="${attr}"
                           class="w-full h-1 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-800">
                </div>
            `;
        }).join('');
    }

    function renderInteractiveWheel() {
        const chartContainer = d3.select("#flavor-wheel-chart");
        chartContainer.selectAll("*").remove();

        const FLAVOR_DATA = state.flavorData ? state.flavorData[state.tipo] : null;

        if (!FLAVOR_DATA) {
            document.getElementById('rueda-container').classList.add('hidden');
            renderSelectedFlavorsTags();
            return;
        }

        document.getElementById('rueda-container').classList.remove('hidden');

        const rootData = { name: "Root", children: [] };

        Object.entries(FLAVOR_DATA).forEach(([catName, catData]) => {
            const isCatSelected = state.selectedFlavors.includes(catName);

            const catNode = {
                name: catName,
                color: (state.selectedFlavors.length === 0 || isCatSelected) ? catData.color : '#E5E7EB',
                baseColor: catData.color,
                children: []
            };

            const processChildren = (childrenArray, parentNode) => {
                if (!childrenArray || childrenArray.length === 0) return;

                childrenArray.forEach(child => {
                    const isSelected = state.selectedFlavors.includes(child.name) || isCatSelected;

                    const childNode = {
                        name: child.name,
                        color: (state.selectedFlavors.length === 0 || isSelected) ? catData.color : '#E5E7EB',
                        baseColor: catData.color,
                        children: []
                    };

                    if (child.children && child.children.length > 0) {
                        processChildren(child.children, childNode);
                    }
                    parentNode.children.push(childNode);
                });
            };

            processChildren(catData.children, catNode);
            rootData.children.push(catNode);
        });

        const width = 800;

        const root = d3.hierarchy(rootData)
            .sum(d => d.children && d.children.length > 0 ? 0 : 1)
            .sort((a, b) => b.value - a.value);

        const maxDepth = root.height + 1;
        const maxPixelRadius = width / 2;
        const centerRadius = maxPixelRadius * 0.15;

        const getRadius = (y) => {
            if (y === 0) return 0;
            return centerRadius + (y - 1) * (maxPixelRadius - centerRadius) / (maxDepth - 1);
        };

        d3.partition().size([2 * Math.PI, maxDepth])(root);

        const arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .innerRadius(d => d.y0 === 0 ? 0 : getRadius(d.y0))
            .outerRadius(d => Math.max(0, getRadius(d.y1) - 1));

        const svg = chartContainer.append("svg")
            .attr("viewBox", [-40, -40, width + 80, width + 80])
            .style("width", "100%")
            .style("height", "auto")
            .style("overflow", "visible")
            .append("g")
            .attr("transform", `translate(${width / 2},${width / 2})`);

        svg.selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("class", "arc")
            .attr("fill", d => d.data.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", "1px")
            .attr("d", arc)
            .style("cursor", "pointer")
            .on("click", (event, d) => {
                const isTurningOn = !state.selectedFlavors.includes(d.data.name);

                // Función helper para encender apagar del array de selectedFlavors
                const toggleFlavor = (name, turnOn) => {
                    const idx = state.selectedFlavors.indexOf(name);
                    if (turnOn && idx === -1) {
                        state.selectedFlavors.push(name);
                    } else if (!turnOn && idx > -1) {
                        state.selectedFlavors.splice(idx, 1);
                    }
                };

                toggleFlavor(d.data.name, isTurningOn);

                if (isTurningOn) {
                    // Si prendemos, prendamos también a los ancestros (padres)
                    let current = d.parent;
                    while (current && current.depth > 0) {
                        toggleFlavor(current.data.name, true);
                        current = current.parent;
                    }
                } else {
                    // Si apagamos, apagamos también a los descendientes (hijos)
                    const turnOffDescendants = (node) => {
                        if (node.children) {
                            node.children.forEach(child => {
                                toggleFlavor(child.data.name, false);
                                turnOffDescendants(child);
                            });
                        }
                    };
                    turnOffDescendants(d);
                }

                renderInteractiveWheel();
                fetchProducts();
            });

        svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants().slice(1).filter(d => (d.x1 - d.x0) > 0.04))
            .join("text")
            .style("font-size", d => d.depth === 1 ? "32px" : d.depth === 2 ? "24px" : "18px")
            .style("font-weight", "600")
            .style("font-family", "Arial, sans-serif")
            .style("fill", d => {
                if (d.data.color === '#E5E7EB') return '#6b7280';
                return d.depth === 1 ? "white" : "#333";
            })
            .attr("transform", function (d) {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (getRadius(d.y0) + getRadius(d.y1)) / 2;
                return `rotate(${x - 90}) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
            })
            .attr("dy", "0.35em")
            .text(d => d.data.name.length > 18 ? d.data.name.substring(0, 15) + "..." : d.data.name);

        // Centro hueco
        svg.append("circle").attr("r", centerRadius - 2).attr("fill", "#fff");
        // Texto central del tipo de producto
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .style("fill", "#333")
            .style("font-size", "24px")
            .attr("dy", "0.35em")
            .text(state.tipo.toUpperCase());

        renderSelectedFlavorsTags();
    }

    function renderSelectedFlavorsTags() {
        if (state.selectedFlavors.length === 0) {
            selectedFlavorsContainer.innerHTML = '';
            return;
        }

        selectedFlavorsContainer.innerHTML = state.selectedFlavors.map(f => `
            <span class="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs font-medium rounded-md">
                ${f}
                <button class="remove-flavor hover:text-amber-900" data-flavor="${f}">&times;</button>
            </span>
        `).join('');

        selectedFlavorsContainer.querySelectorAll('.remove-flavor').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const flavor = e.target.dataset.flavor;
                state.selectedFlavors = state.selectedFlavors.filter(f => f !== flavor);
                renderInteractiveWheel();
                fetchProducts();
            });
        });
    }

    async function fetchProducts() {
        showLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('tipo', state.tipo);

            state.selectedFlavors.forEach(f => params.append('sabores[]', f));

            Object.entries(state.perfilMin).forEach(([key, val]) => {
                params.append(`perfil_min[${key}]`, val);
            });

            const res = await fetch(`/api/public/marketplace/products?${params.toString()}`);
            console.log(res);
            if (!res.ok) throw new Error("Error fetching products");
            const data = await res.json();

            state.products = data.products;
            resultsCount.textContent = data.total;
            renderProductCards();

        } catch (error) {
            console.error(error);
            emptyState.classList.remove('hidden');
        } finally {
            showLoading(false);
        }
    }

    function renderProductCards() {
        productsGrid.innerHTML = '';
        if (state.products.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }
        emptyState.classList.add('hidden');

        const html = state.products.map(p => {
            const companySlug = p.empresa.slug || p.empresa.id;

            // Badges principales
            const procesBadge = p.proceso ? `<span class="bg-stone-100 px-2 py-1 rounded text-[10px] uppercase font-bold text-stone-600">${p.proceso}</span>` : '';
            const variedadBadge = p.variedad ? `<span class="bg-amber-100 text-amber-800 px-2 py-1 rounded text-[10px] uppercase font-bold">${p.variedad}</span>` : '';
            const tuesteBadge = p.nivel_tueste ? `<span class="bg-stone-800 text-stone-200 px-2 py-1 rounded text-[10px] uppercase font-bold">${p.nivel_tueste}</span>` : '';

            // Etiquetas de sabor (Max 3)
            let flavorBadges = '';
            if (p.sabores && p.sabores.notas_json) {
                const cats = [...new Set(p.sabores.notas_json.map(n => n.category))].slice(0, 3);
                flavorBadges = cats.map(cat => {
                    const color = state.flavorData && state.flavorData[state.tipo] && state.flavorData[state.tipo][cat] ? state.flavorData[state.tipo][cat].color : '#a8a29e';
                    return `<span class="px-2 py-0.5 rounded-full text-[10px] text-white font-medium" style="background-color: ${color}">${cat}</span>`;
                }).join('');
            }

            // Premios (Logos flotantes)
            let premiosHtml = '';
            if (p.premios && p.premios.length > 0) {
                premiosHtml = `<div class="absolute top-2 right-2 flex flex-col gap-1 z-10">` +
                    p.premios.map(prem => {
                        const def = state.premiosData && state.premiosData[state.tipo] ? state.premiosData[state.tipo].find(dp => dp.nombre === prem.nombre) : null;
                        const url = def ? def.logo_url : (prem.logo_url || '');
                        if (!url) return '';
                        return `<img src="${url}" alt="${prem.nombre}" class="w-8 h-8 object-contain drop-shadow" title="${prem.nombre}">`;
                    }).join('') + `</div>`;
            }

            // Radar Chart Canvas
            const canvasId = `radar-${p.id}`;

            return `
                <div class="product-card bg-white rounded-2xl overflow-hidden border border-stone-200 flex flex-col h-full relative group">
                    ${premiosHtml}
                    
                    <div class="h-48 w-full bg-stone-100 relative overflow-hidden">
                        ${p.imagen ? `<img src="${p.imagen}" loading="lazy" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-stone-300"><i class="fas fa-image text-4xl"></i></div>`}
                        <div class="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-stone-900/80 to-transparent">
                            <h3 class="text-white font-bold text-lg leading-tight truncate">${p.nombre}</h3>
                            <p class="text-stone-300 text-xs truncate">${p.empresa.nombre}</p>
                        </div>
                    </div>
                    
                    <div class="p-4 flex-grow flex flex-col">
                        <div class="flex flex-wrap gap-1 mb-3">
                            ${variedadBadge}
                            ${procesBadge}
                            ${tuesteBadge}
                        </div>
                        
                        <div class="flex flex-wrap gap-1 mb-4">
                            ${flavorBadges}
                        </div>

                        <!-- Mini Radar Container -->
                        <div class="w-full h-32 mt-auto mb-4 relative" style="height: 120px;">
                           ${p.perfil ? `<canvas id="${canvasId}"></canvas>` : `<p class="text-xs text-stone-400 text-center italic mt-10">Sin perfil de taza</p>`}
                        </div>
                    </div>
                    
                    <div class="px-4 py-3 bg-stone-50 border-t flex justify-between items-center group-hover:bg-amber-50 transition-colors">
                        ${p.puntaje_sca ? `
                            <div class="flex items-center text-amber-700 font-bold text-lg">
                                ${p.puntaje_sca} <span class="text-xs text-stone-500 font-normal ml-1">SCA</span>
                            </div>
                        ` : '<div></div>'}
                        
                        <a href="/origen-unico/${companySlug}" class="text-sm font-bold text-amber-800 hover:text-amber-900 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-amber-200">
                            Ver Productor <i class="fas fa-arrow-right text-[10px]"></i>
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        productsGrid.innerHTML = html;

        // Inicializar los mini radares después del render
        state.products.forEach(p => {
            if (p.perfil) {
                // Usamos la función global provista por chart-utils.js
                // Solo le pasamos una versión reducida/limpia de los datos
                if (typeof ChartUtils !== 'undefined' && ChartUtils.initializePerfilChart) {
                    ChartUtils.initializePerfilChart(`radar-${p.id}`, p.perfil, state.tipo);

                    // Ajustar opciones del radar mini (ocultar etiquetas en el pequeño)
                    const inst = ChartUtils.instances[`radar-${p.id}`];
                    if (inst) {
                        inst.options.scales.r.pointLabels.display = false;
                        inst.options.scales.r.ticks.display = false;
                        inst.update();
                    }
                }
            }
        });
    }

    function showLoading(show) {
        if (show) {
            loadingIndicator.classList.remove('hidden');
            productsGrid.classList.add('hidden');
            emptyState.classList.add('hidden');
        } else {
            loadingIndicator.classList.add('hidden');
            productsGrid.classList.remove('hidden');
        }
    }

    init();
});