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
                    const isSelected = state.selectedFlavors.includes(child.name);

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

                    // Si prendemos, prendemos también a los descendientes explícitos de este nodo pulsado
                    const turnOnDescendants = (node) => {
                        if (node.children) {
                            node.children.forEach(child => {
                                toggleFlavor(child.data.name, true);
                                turnOnDescendants(child);
                            });
                        }
                    };
                    turnOnDescendants(d);
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

                    // Si apagamos, verificamos si el padre debe apagarse o quedarse encendido si tiene otros hijos activos
                    let current = d.parent;
                    while (current && current.depth > 0) {
                        const hasActiveDescendant = (node) => {
                            if (!node.children) return false;
                            for (let child of node.children) {
                                if (state.selectedFlavors.includes(child.data.name) || hasActiveDescendant(child)) {
                                    return true;
                                }
                            }
                            return false;
                        };

                        if (!hasActiveDescendant(current)) {
                            toggleFlavor(current.data.name, false);
                        } else {
                            break;
                        }
                        current = current.parent;
                    }
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
            .style("font-size", d => d.depth === 1 ? "24px" : d.depth === 2 ? "22px" : "20px")
            .style("font-weight", "600")
            .style("font-family", "Arial, sans-serif")
            .style("fill", d => {
                if (d.data.color === '#E5E7EB') return '#6b7280';
                return d.depth === 1 || d.depth === 2 || d.depth === 3 ? "#E5E7EB" : "#333";
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

            // Badge de Tipo
            let typeBadge = '';
            if (p.tipo === 'cafe') {
                typeBadge = `<div class="type-badge"><i class="fas fa-mug-hot text-amber-900"></i> Café</div>`;
            } else if (p.tipo === 'cacao') {
                typeBadge = `<div class="type-badge"><i class="fas fa-cookie-bite text-amber-900"></i> Chocolate</div>`;
            }

            // Badge de Puntos
            let scoreBadge = '';
            if (p.puntaje_sca) {
                scoreBadge = `<div class="score-badge"><i class="fas fa-star"></i> ${p.puntaje_sca} pts</div>`;
            }

            // Precio y Presentación
            let precioHtml = '';
            if (p.precio) {
                const currency = p.moneda || 'S/';
                const unit = p.presentacion + ' ' + (p.unidad || 'g');
                precioHtml = `
                    <div class="flex items-baseline gap-1 mt-1 mb-2">
                        <span class="text-xl font-bold text-stone-900">${currency} ${Number(p.precio).toFixed(2)}</span>
                        ${unit ? `<span class="text-[10px] text-stone-400 font-bold uppercase tracking-wider ml-1">${unit}</span>` : ''}
                    </div>
                `;
            }

            // Detalles Específicos (Café vs Cacao)
            let detallesHtml = '';
            if (p.tipo === 'cafe') {
                const variedadText = p.variedad ? p.variedad : '';
                const procesoText = p.proceso ? p.proceso : '';
                if (variedadText || procesoText) {
                    detallesHtml = `<p class="text-[10px] text-stone-500 font-bold mb-3 uppercase tracking-widest">${variedadText} ${variedadText && procesoText ? '&bull;' : ''} ${procesoText}</p>`;
                }
            }

            // Finca Origen
            let fincaHtml = '';
            if (p.finca) {
                const location = [p.finca.provincia, p.finca.departamento].filter(Boolean).join(', ');
                fincaHtml = `
                    <div class="flex items-start gap-2 mb-4 text-xs text-stone-600 bg-stone-50/50 p-2.5 rounded-lg border border-stone-100/50">
                        <i class="fas fa-map-marker-alt text-amber-700/50 mt-0.5"></i>
                        <div>
                            <p class="font-bold text-stone-800 text-[11px] leading-tight">${p.finca.nombre}</p>
                            ${location ? `<p class="text-[10px] text-stone-500 mt-0.5">${location}, Perú</p>` : ''}
                        </div>
                    </div>
                `;
            }

            // Perfil Sensorial (Barras)
            let sensoryBarsHtml = '';
            if (p.perfil) {
                const attrs = p.tipo === 'cafe' 
                    ? [['Sabor', 'sabor', 'bar-sabor'], ['Acidez', 'acidez', 'bar-acidez'], ['Cuerpo', 'cuerpo', 'bar-cuerpo']]
                    : [['Cacao', 'cacao', 'bar-cacao'], ['Acidez', 'acidez', 'bar-acidez'], ['Amargor', 'amargor', 'bar-amargor']];

                sensoryBarsHtml = `
                    <div class="mb-5">
                        <div class="flex items-center justify-between mb-3">
                            <h4 class="text-[10px] font-bold text-stone-400 uppercase tracking-widest">Perfil en Taza</h4>
                            <div class="radar-tooltip">
                                <i class="fas fa-info-circle text-stone-300 hover:text-amber-600 transition-colors"></i>
                                <div class="tooltip-content">
                                    <canvas id="radar-${p.id}"></canvas>
                                </div>
                            </div>
                        </div>
                        <div class="space-y-3">
                            ${attrs.map(([label, key, colorClass]) => {
                                const val = p.perfil[key] || 0;
                                const percent = (val / 10) * 100;
                                return `
                                    <div class="sensory-row">
                                        <div class="flex justify-between items-center mb-1">
                                            <span class="sensory-label">${label}</span>
                                        </div>
                                        <div class="sensory-bar-bg">
                                            <div class="sensory-bar-fill ${colorClass}" style="width: ${percent}%"></div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                `;
            }

            // Etiquetas de sabor (Max 3)
            let flavorBadges = '';
            if (p.sabores && Array.isArray(p.sabores)) {
                const cats = [...new Set(p.sabores.map(n => n.category).filter(Boolean))].slice(0, 3);
                flavorBadges = cats.map(cat => {
                    return `<span class="px-2 py-0.5 bg-stone-100 text-stone-600 rounded-md text-[10px] font-bold uppercase tracking-wider">${cat}</span>`;
                }).join('');
            }

            // Premios
            let premiosHtml = '';
            if (p.premios && p.premios.length > 0) {
                premiosHtml = `<div class="absolute top-12 right-12 flex flex-col gap-1 z-10">` +
                    p.premios.map(prem => {
                        const premNombre = prem.nombre || prem.name || '';
                        const def = state.premiosData && state.premiosData[state.tipo] ? state.premiosData[state.tipo].find(dp => dp.nombre === premNombre) : null;
                        const url = def ? def.logo_url : (prem.logo_url || '');
                        if (!url) return '';
                        return `<img src="${url}" alt="${premNombre}" class="w-8 h-8 object-contain drop-shadow" title="${premNombre}">`;
                    }).join('') + `</div>`;
            }

            return `
                <div class="product-card bg-white rounded-3xl overflow-hidden border border-stone-100 shadow-sm flex flex-col h-full relative p-5">
                    
                    ${typeBadge}
                    ${scoreBadge}
                    ${premiosHtml}

                    <!-- Foto Producto -->
                    <div class="w-full aspect-[4/3] relative flex justify-center items-center overflow-hidden mb-6 rounded-2xl bg-stone-50">
                        ${p.imagen ? `<img src="${p.imagen}" loading="lazy" class="w-full h-full object-cover">` : `<div class="text-stone-300 w-full h-full flex justify-center items-center"><i class="fas fa-image text-4xl"></i></div>`}
                    </div>
                    
                    <!-- Nombre -->
                    <h3 class="font-bold text-lg text-stone-900 leading-tight mb-1">${p.nombre}</h3>
                    
                    <!-- Precio y Detalles -->
                    ${precioHtml}
                    ${detallesHtml}
                    
                    <!-- Finca Info -->
                    ${fincaHtml}
                    
                    <!-- Perfil Sensorial -->
                    ${sensoryBarsHtml}

                    <!-- Tags de Sabor -->
                    <div class="flex flex-wrap gap-1.5 mb-6">
                        ${flavorBadges}
                    </div>

                    <div class="mt-auto"></div>

                    <!-- Empresa -->
                    <div class="flex items-center gap-2.5 pt-4 border-t border-stone-100">
                        <div class="w-7 h-7 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center overflow-hidden shrink-0">
                            ${p.empresa.logo ? `<img src="${p.empresa.logo}" class="w-full h-full object-cover">` : `<i class="fas fa-store text-stone-400 text-[10px]"></i>`}
                        </div>
                        <span class="font-bold text-stone-500 text-[11px] truncate uppercase tracking-wider">${p.empresa.nombre}</span>
                    </div>

                    <!-- Boton Ver Detalle (Si quieres un botón similar al de la imagen) -->
                    <a href="/origen-unico/${companySlug}" class="mt-4 w-full text-center bg-[#92400e] hover:bg-amber-900 text-white font-bold py-3 rounded-2xl transition-all shadow-lg shadow-amber-900/10 flex items-center justify-center gap-2">
                        <i class="fas fa-shopping-bag text-sm"></i>
                        Ver Detalles
                    </a>
                </div>
            `;
        }).join('');

        productsGrid.innerHTML = html;

        // Inicializar los mini radares después del render
        state.products.forEach(p => {
            if (p.perfil) {
                if (typeof ChartUtils !== 'undefined' && ChartUtils.initializePerfilChart) {
                    ChartUtils.initializePerfilChart(`radar-${p.id}`, p.perfil, p.tipo);

                    // Ajustar opciones del radar mini
                    const inst = ChartUtils.instances[`radar-${p.id}`];
                    if (inst) {
                        // En el nuevo diseño, SÍ queremos mostrar los labels (atributos) del gráfico
                        inst.options.scales.r.pointLabels.display = true;
                        inst.options.scales.r.pointLabels.font = { size: 9 };
                        // Ocultamos los números internos
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