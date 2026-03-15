/**
 * marketplace.js
 * Lógica del Marketplace para filtrar y mostrar productos
 */

const state = {
    tipo: 'cafe',          // tipo de producto activo
    explicitCategories: [], // categorías seleccionadas explícitamente (nivel 1)
    selectedSubnotes: [],  // subnotas (nivel 2) seleccionadas en la rueda
    perfilMin: {},         // { acidez: 0, cuerpo: 0, ... }
    products: [],          // productos actualmente mostrados
    flavorWheelsData: null,
    perfilesData: null,
    premiosData: null,
    wheelChart: null,      // instancia Chart.js de la rueda interactiva
    perfilSliders: {},     // referencias a sliders
    page: 1,
    hasMore: true,
    total: 0
};

function getEffectiveSelectedCategories(flavorData) {
    const fromSubnotes = state.selectedSubnotes
        .map(sn => findCategoryForSubnote(sn, flavorData))
        .filter(Boolean);

    return Array.from(new Set([...state.explicitCategories, ...fromSubnotes]));
}


// Encuentra categoría asociada a una subnota
function findCategoryForSubnote(subnote, flavorData) {
    for (const [category, data] of Object.entries(flavorData)) {
        if (data.children.some(c => c.name === subnote)) {
            return category;
        }
    }
    return null;
}


// Inicialización
async function init() {
    try {
        // Cargar datos estáticos
        state.flavorWheelsData = await fetch('/data/flavor-wheels.json').then(r => r.json()).catch(err => {
            console.error('Error loading flavor wheels:', err);
            return null;
        });
        state.premiosData = await fetch('/data/premios.json').then(r => r.json()).catch(err => {
            console.error('Error loading premios:', err);
            return null;
        });
        state.perfilesData = await fetch('/data/perfiles.json').then(r => r.json()).catch(err => {
            console.error('Error loading perfiles:', err);
            return null;
        });

        // Inicializar filtros
        renderInteractiveWheel();
        renderPerfilSliders();

        // Cargar productos iniciales
        await fetchProducts();
    } catch (error) {
        console.error('Error initializing marketplace:', error);
    }
}

// Cambiar tipo de producto
function setTipo(tipo) {
    state.tipo = tipo;
    state.explicitCategories = [];
    state.selectedSubnotes = [];
    state.perfilMin = {};
    state.page = 1;
    state.hasMore = true;

    // Actualizar botones
    document.querySelectorAll('.tipo-btn').forEach(btn => btn.classList.remove('active', 'bg-amber-600'));
    document.querySelector(`[onclick="setTipo('${tipo}')"]`).classList.add('active', 'bg-amber-600');

    // Re-renderizar filtros
    renderInteractiveWheel();
    renderPerfilSliders();

    // Recargar productos
    fetchProducts();
}

// Renderizar rueda interactiva
function renderInteractiveWheel() {
    const container = document.getElementById('flavor-wheel-container');
    const canvas = document.getElementById('flavor-wheel-l1');
    if (!canvas) {
        console.error('Canvas not found');
        return;
    }

    if (!state.flavorWheelsData || !state.flavorWheelsData[state.tipo]) {
        // Don't remove canvas, just don't create chart
        return;
    }

    // Destruir chart anterior
    if (state.wheelChart) {
        state.wheelChart.destroy();
    }

    const ruedaData = { notas_json: [], tipo: state.tipo };
    const effectiveCategories = getEffectiveSelectedCategories(state.flavorWheelsData[state.tipo]);

    state.wheelChart = ChartUtils.initializeRuedaChart('flavor-wheel', ruedaData, state.flavorWheelsData, {
        selectedCategories: effectiveCategories,
        selectedSubnotes: state.selectedSubnotes,
        showAllLabels: true,
        onClick: (event, elements) => {
            if (elements.length > 0) {
                const element = elements[0];
                const datasetIndex = element.datasetIndex;
                const index = element.index;

                const FLAVOR_DATA = state.flavorWheelsData[state.tipo];
                const l1_labels = Object.keys(FLAVOR_DATA);

                if (datasetIndex === 1) { // outer ring, categories
                    const category = l1_labels[index];

                    // Toggle selección de categoría
                    if (state.explicitCategories.includes(category)) {
                        state.explicitCategories = state.explicitCategories.filter(c => c !== category);
                        // Quitar subnotas asociadas
                        state.selectedSubnotes = state.selectedSubnotes.filter(sn => {
                            const cat = findCategoryForSubnote(sn, FLAVOR_DATA);
                            return cat !== category;
                        });
                    } else {
                        state.explicitCategories.push(category);
                    }
                } else if (datasetIndex === 0) { // inner ring, subnotas
                    const subnote = state.wheelChart.data.labels[index];

                    // Toggle selección de subnota
                    if (state.selectedSubnotes.includes(subnote)) {
                        state.selectedSubnotes = state.selectedSubnotes.filter(s => s !== subnote);
                    } else {
                        state.selectedSubnotes.push(subnote);
                    }

                    // No marcar automáticamente la categoría cuando se selecciona una subnota
                    // (para que el color se aplique solo al segmento interno)
                }

                // Update colors
                updateWheelColors();

                // Reset pagination
                state.page = 1;
                state.hasMore = true;

                fetchProducts();
            }
        }
    });
}

// Actualizar colores de la rueda según selección
function updateWheelColors() {
    if (!state.wheelChart || !state.flavorWheelsData || !state.flavorWheelsData[state.tipo]) return;

    const FLAVOR_DATA = state.flavorWheelsData[state.tipo];
    const l1_labels = Object.keys(FLAVOR_DATA);

    // Determine categories to color based on selected explicit categories + subnotes
    const effectiveCategories = getEffectiveSelectedCategories(FLAVOR_DATA);

    // Colores para el primer nivel (categorías)
    const l1_colors = l1_labels.map(label => effectiveCategories.includes(label) ? FLAVOR_DATA[label].color : '#E5E7EB');

    // Colores para el segundo nivel (subnotas)
    const subnoteToColor = {};
    l1_labels.forEach(label => {
        const color = FLAVOR_DATA[label].color;
        FLAVOR_DATA[label].children.forEach(child => {
            subnoteToColor[child.name] = color;
        });
    });

    const l2_labels = state.wheelChart.data.labels || [];
    const l2_colors = l2_labels.map(name => state.selectedSubnotes.includes(name) ? subnoteToColor[name] || '#E5E7EB' : '#E5E7EB');

    state.wheelChart.data.datasets[0].backgroundColor = l2_colors;
    state.wheelChart.data.datasets[1].backgroundColor = l1_colors;
    state.wheelChart.update();
}

// Renderizar sliders de perfil
function renderPerfilSliders() {
    const container = document.getElementById('perfil-sliders');

    if (!state.perfilesData || !state.perfilesData[state.tipo]) {
        container.innerHTML = '<p>No hay atributos de perfil para este tipo</p>';
        return;
    }

    const atributos = state.perfilesData[state.tipo];
    let html = '';

    atributos.forEach(attr => {
        const value = state.perfilMin[attr.id] || 0;
        html += `
            <div class="mb-4">
                <label class="block text-sm font-medium mb-2">${attr.label}</label>
                <input type="range" min="0" max="10" step="0.5" value="${value}"
                       class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                       oninput="updatePerfilMin('${attr.id}', this.value)"
                       onchange="fetchProducts()">
                <div class="flex justify-between text-xs text-gray-300 mt-1">
                    <span>0</span>
                    <span id="perfil-${attr.id}-value">${value}</span>
                    <span>10</span>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

// Actualizar valor mínimo de perfil
function updatePerfilMin(attrId, value) {
    state.perfilMin[attrId] = parseFloat(value);
    document.getElementById(`perfil-${attrId}-value`).textContent = value;
    // Reset pagination on filter change
    state.page = 1;
    state.hasMore = true;
}

// Cargar más productos
function loadMore() {
    state.page++;
    fetchProducts(state.page);
}

// Cargar productos desde API
async function fetchProducts(page = 1) {
    const effectiveCategories = getEffectiveSelectedCategories(state.flavorWheelsData?.[state.tipo] || {});

    const params = new URLSearchParams({
        tipo: state.tipo,
        limit: 20,
        offset: (page - 1) * 20,
        ...(effectiveCategories.length > 0 && { categorias: effectiveCategories }),
        ...(state.selectedSubnotes.length > 0 && { sabores: state.selectedSubnotes }),
        ...Object.fromEntries(
            Object.entries(state.perfilMin)
                .filter(([_, v]) => v > 0)
                .map(([k, v]) => [`perfil_min[${k}]`, v])
        )
    });

    try {
        const response = await fetch(`/api/public/marketplace/products?${params}`);
        const data = await response.json();
        if (page === 1) {
            state.products = data.products || [];
        } else {
            state.products.push(...(data.products || []));
        }
        console.log(data);
        state.total = data.total || 0;
        state.hasMore = state.products.length < state.total;
        renderProductCards();
    } catch (error) {
        console.error('Error fetching products:', error);
        document.getElementById('products-container').innerHTML = '<p class="col-span-full text-center text-red-500">Error al cargar productos</p>';
    }
}

// Renderizar tarjetas de productos
function renderProductCards() {
    const container = document.getElementById('products-container');

    if (state.products.length === 0) {
        container.className = 'text-center py-12';
        container.innerHTML = '<p class="text-stone-600">No se encontraron productos con los filtros seleccionados</p>';
        return;
    }

    container.className = 'product-grid';
    const html = state.products.map(product => renderProductCard(product)).join('');
    const loadMoreHtml = state.hasMore ? '<div class="col-span-full text-center mt-8"><button onclick="loadMore()" class="bg-amber-600 hover:bg-amber-700 text-white px-6 py-3 rounded-lg font-semibold">Cargar Más</button></div>' : '';
    container.innerHTML = html + loadMoreHtml;

    // Inicializar mini radares
    state.products.forEach(product => {
        const radarId = `mini-radar-${product.id}`;
        if (product.perfil) {
            ChartUtils.initializePerfilChart(radarId, product.perfil, state.tipo);
        }
    });
}

// Renderizar una tarjeta de producto
function renderProductCard(p) {
    const companySlug = p.empresa.slug || p.empresa.id;
    const productLink = `/${companySlug}`;
    console.log(p);
    // Tags de sabor
    const flavorTags = (p.sabores || []).slice(0, 3).map(s => `<span class="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded">${s.category || s.subnote}</span>`).join('');

    // Premios
    const premiosHtml = (p.premios || []).slice(0, 3).map(premio => {
        const premioData = state.premiosData?.premios?.[state.tipo]?.find(pr => pr.nombre === premio.nombre);
        if (premioData) {
            return `<img src="${premioData.logo_url}" alt="${premio.nombre}" class="h-6 w-6" title="${premio.nombre}">`;
        }
        return '';
    }).join('');

    // Puntuación SCA
    const scaBadge = p.puntaje_sca ? `<span class="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded font-bold">SCA ${p.puntaje_sca}</span>` : '';

    // Mini radar
    const radarId = `mini-radar-${p.id}`;

    const normalizeImageValue = (value) => {
        if (!value) return null;
        if (typeof value === 'string') {
            const trimmed = value.trim();
            // Si viene como JSON (p.ej. '["data:image/..."]' o '{"url":"..."}')
            if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
                try {
                    const parsed = JSON.parse(trimmed);
                    return normalizeImageValue(parsed);
                } catch (e) {
                    // No es JSON válido, usar el string tal cual
                }
            }
            return value;
        }
        if (Array.isArray(value) && value.length > 0) return normalizeImageValue(value[0]);
        if (typeof value === 'object') return value.url || value.src || value.image || null;
        return null;
    };

    // Preferimos usar el valor directo, luego el primer elemento de imagenes_json y finalmente una URL que sirve la imagen desde el backend.
    const imageSrc = [
        normalizeImageValue(p.imagen),
        normalizeImageValue(p.imagenes_json),
        `/api/public/products/${p.id}/image`
    ].find(Boolean);

    return `
        <div class="bg-white rounded-lg shadow-md overflow-hidden card-hover">
            <div class="aspect-w-16 aspect-h-9 bg-gray-200">
                ${imageSrc ? `<img src="${imageSrc}" alt="${p.nombre}" class="w-full h-48 object-cover">` : '<div class="w-full h-48 flex items-center justify-center text-gray-400"><i class="fas fa-image text-4xl"></i></div>'}
            </div>
            <div class="p-6">
                <h3 class="text-xl font-bold text-stone-800 mb-2">${p.nombre}</h3>
                <p class="text-stone-600 text-sm mb-3">${p.descripcion || 'Sin descripción'}</p>

                <div class="mb-3">
                    <canvas id="${radarId}" width="150" height="150" class="mx-auto"></canvas>
                </div>

                <div class="flex flex-wrap gap-1 mb-3">
                    ${flavorTags}
                </div>

                <div class="flex items-center justify-between mb-3">
                    <div class="flex items-center gap-2">
                        ${p.empresa.logo ? `<img src="${p.empresa.logo}" alt="${p.empresa.nombre}" class="h-8 w-8 rounded-full object-cover">` : '<div class="h-8 w-8 bg-gray-200 rounded-full flex items-center justify-center"><i class="fas fa-building text-gray-400"></i></div>'}
                        <span class="text-sm font-medium text-stone-700">${p.empresa.nombre}</span>
                    </div>
                    ${scaBadge}
                </div>

                <div class="flex items-center justify-between mb-4">
                    <div class="text-sm text-stone-500">
                        ${p.proceso ? `<span class="mr-2">${p.proceso}</span>` : ''}
                        ${p.nivel_tueste ? `<span>${p.nivel_tueste}</span>` : ''}
                        ${p.variedad ? `<span class="block">${p.variedad}</span>` : ''}
                    </div>
                    <div class="flex gap-1">
                        ${premiosHtml}
                    </div>
                </div>

                <a href="${productLink}" class="block w-full bg-amber-600 hover:bg-amber-700 text-white text-center py-2 px-4 rounded-lg font-semibold transition">
                    Ver Detalle
                </a>
            </div>
        </div>
    `;
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', init);