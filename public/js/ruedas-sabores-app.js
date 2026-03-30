document.addEventListener('DOMContentLoaded', () => {

    // --- ESTADO ---
    let state = {
        ruedas: [],
        selectedRuedaId: null,
        currentType: 'cafe', // 'cafe', 'cacao', 'miel'
        flavorData: null,
        selectedNotes: [] // Array de {category, subnote}
    };
    let charts = {};

    // --- SELECTORES DEL DOM ---
    const form = document.getElementById('rueda-form');
    const listContainer = document.getElementById('ruedas-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const legendContainer = document.getElementById('chart-legend');
    const ruedaTypeSelector = document.getElementById('rueda-type-selector');
    const newRuedaBtn = document.getElementById('new-rueda-btn');

    Chart.register(ChartDataLabels);

    async function init() {
        await Promise.all([
            loadRuedas(),
            loadFlavorData() // Cargar datos externos
        ]);
        setupEventListeners();
        renderRuedas(); // Render inicial


        if (state.ruedas.filter(r => r.tipo === state.currentType).length > 0) {
            selectRueda(state.ruedas.filter(r => r.tipo === state.currentType)[0].id);
        } else {
            updateChart(null);
        }
    }

    function setupEventListeners() {
        form.addEventListener('submit', handleFormSubmit);
        listContainer.addEventListener('click', handleListClick);
        cancelEditBtn.addEventListener('click', () => {
            state.selectedRuedaId = null;
            resetForm();
        });
        if (newRuedaBtn) {
            newRuedaBtn.addEventListener('click', () => {
                state.selectedRuedaId = null;
                resetForm();
            });
        }
        ruedaTypeSelector.addEventListener('change', handleTypeChange);
    }

    async function loadFlavorData() {
        try {
            const response = await fetch('/data/flavor-wheels.json');
            state.flavorData = await response.json();
        } catch (error) {
            console.error("Error al cargar datos de sabores:", error);
            // Fallback básico en caso de error de carga
            state.flavorData = { cafe: {}, cacao: {}, miel: {} };
        }
    }

    async function loadRuedas() {
        try {
            state.ruedas = await api('/api/ruedas-sabores');
        } catch (error) {
            console.error("Error al cargar las ruedas de sabores:", error);
        }
    }

    function handleTypeChange() {
        state.currentType = ruedaTypeSelector.value;
        state.selectedRuedaId = null;
        resetForm();
        renderRuedas();

        const firstRuedaOfType = state.ruedas.find(r => r.tipo === state.currentType);
        if (firstRuedaOfType) {
            selectRueda(firstRuedaOfType.id);
        } else {
            updateChart(null);
        }
    }

    function renderRuedas() {
        const filteredRuedas = state.ruedas.filter(r => r.tipo === state.currentType);
        listContainer.innerHTML = filteredRuedas.map(r => `
            <div class="p-3 border rounded-xl cursor-pointer hover:bg-amber-50 ${r.id === state.selectedRuedaId ? 'bg-amber-100 border-amber-800' : ''}" data-id="${r.id}">
                <div class="flex justify-between items-center">
                    <span class="font-semibold flex-grow">${r.nombre_rueda}</span>
                    <div class="flex items-center flex-shrink-0">
                        <button data-id="${r.id}" class="edit-btn text-sky-600 hover:text-sky-800 p-1 rounded-full"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg></button>
                        <button data-id="${r.id}" class="delete-btn text-red-500 hover:text-red-700 text-xl font-bold leading-none p-1">&times;</button>
                    </div>
                </div>
            </div>
        `).join('');

        if (state.ruedas.length === 0) {
            listContainer.innerHTML = `<p class="text-stone-500 text-center">No hay ruedas de sabor para ${state.currentType}.</p>`;
        }
    }

    function selectRueda(id) {
        state.selectedRuedaId = id;
        const rueda = state.ruedas.find(r => r.id === id);
        if (rueda) {
            state.selectedNotes = [...rueda.notas_json];
            updateChart();
            renderRuedas();
        }
    }

    // Ya no usamos renderInteractiveWheel con botones de texto.
    // La rueda D3 es ahora la interfaz de selección.

    function updateChart() {
        const notes = state.selectedNotes;
        const FLAVOR_DATA = state.flavorData ? state.flavorData[state.currentType] : {};

        // Limpiar contenedor D3
        const chartContainer = d3.select("#flavor-wheel-chart");
        chartContainer.selectAll("*").remove();

        if (!FLAVOR_DATA || Object.keys(FLAVOR_DATA).length === 0) return;

        // Construir jerarquía para D3
        const rootData = { name: "Root", children: [] };
        const selectedCategories = {};

        Object.entries(FLAVOR_DATA).forEach(([catName, catData]) => {
            const isCatSelected = notes.some(n => n.category === catName);
            if (isCatSelected) {
                selectedCategories[catName] = { color: catData.color, children: [] };
            }

            const catNode = {
                name: catName,
                category: catName,
                color: isCatSelected ? catData.color : '#F3F4F6',
                active: isCatSelected,
                baseColor: catData.color,
                children: [],
                icon: catData.icon
            };

            const processChildren = (childrenArray, parentNode) => {
                if (!childrenArray || childrenArray.length === 0) return;

                childrenArray.forEach(child => {
                    const isSelected = notes.some(n => n.category === catName && n.subnote === child.name);
                    if (isSelected && selectedCategories[catName] && !selectedCategories[catName].children.includes(child.name)) {
                        selectedCategories[catName].children.push(child.name);
                    }

                    const childNode = {
                        name: child.name,
                        category: catName,
                        color: isSelected ? catData.color : '#F3F4F6',
                        active: isSelected,
                        baseColor: catData.color,
                        children: [],
                        icon: child.icon
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
        const centerRadius = maxPixelRadius * 0.25;

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

        // Arcos Interactivos
        const arcs = svg.selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("class", "arc")
            .attr("fill", d => d.data.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", "2px")
            .attr("d", arc)
            .style("cursor", "pointer")
            .style("transition", "all 0.2s ease")
            .on("click", (event, d) => {
                const noteName = d.data.name;
                const categoryName = d.data.category;
                const isActive = d.data.active;

                if (!isActive) {
                    // ACTIVAR: él y todos sus ancestros
                    const ancestors = d.ancestors().slice(0, -1); // Excluir Root
                    ancestors.forEach(node => {
                        const exists = state.selectedNotes.some(n => n.category === node.data.category && n.subnote === node.data.name);
                        if (!exists) {
                            state.selectedNotes.push({ category: node.data.category, subnote: node.data.name });
                        }
                    });
                } else {
                    // DESACTIVAR: él y todos sus descendientes
                    const descendants = d.descendants();
                    const descendantNames = descendants.map(node => node.data.name);
                    state.selectedNotes = state.selectedNotes.filter(n => 
                        !(n.category === categoryName && descendantNames.includes(n.subnote))
                    );
                }

                updateChart();
            })
            .on("mouseenter", (event, d) => {
                d3.select(event.currentTarget).style("filter", "brightness(0.9)");
                const info = document.getElementById("flavor-wheel-info");
                if (info) {
                    document.getElementById("flavor-wheel-info-title").innerText = d.data.name;
                    document.getElementById("flavor-wheel-info-path").innerText = d.ancestors().reverse().slice(1).map(a => a.data.name).join(" > ");
                    info.style.display = "block";
                    
                    // Posicionar cerca del mouse pero dentro del contenedor
                    const [mx, my] = d3.pointer(event, chartContainer.node());
                    info.style.left = `${mx + 20}px`;
                    info.style.top = `${my + 20}px`;
                    info.style.borderLeftColor = d.data.baseColor;
                }
            })
            .on("mouseleave", (event) => {
                d3.select(event.currentTarget).style("filter", "none");
                const info = document.getElementById("flavor-wheel-info");
                if (info) info.style.display = "none";
            });

        // Etiquetas
        svg.append("g")
            .attr("pointer-events", "none")
            .attr("text-anchor", "middle")
            .selectAll("text")
            .data(root.descendants().slice(1).filter(d => (d.x1 - d.x0) > 0.04))
            .join("text")
            .style("font-size", d => d.depth === 1 ? "18px" : "14px")
            .style("font-weight", "700")
            .style("font-family", "'Inter', sans-serif")
            .style("fill", d => d.data.active ? (d.depth === 1 ? "white" : "#333") : "#9ca3af")
            .attr("transform", function (d) {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (getRadius(d.y0) + getRadius(d.y1)) / 2;
                return `rotate(${x - 90}) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
            })
            .attr("dy", "0.35em")
            .text(d => d.data.name.length > 20 ? d.data.name.substring(0, 17) + "..." : d.data.name);

        // Centro con Texto
        svg.append("circle").attr("r", centerRadius - 4).attr("fill", "#fff").attr("stroke", "#f3f4f6").attr("stroke-width", "2");
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("font-weight", "800")
            .style("fill", "#78350f")
            .style("font-family", "'Playfair Display', serif")
            .style("font-size", "32px")
            .attr("dy", "0.35em")
            .text(state.currentType.toUpperCase());

        renderCustomLegend(selectedCategories);
    }

    function renderCustomLegend(selectedCategories) {
        if (Object.keys(selectedCategories).length === 0) {
            legendContainer.innerHTML = `<p class="text-stone-400 text-center italic text-sm mt-8">Selecciona notas en la rueda para construir tu perfil.</p>`;
            return;
        }

        const FLAVOR_DATA = state.flavorData[state.currentType];

        const findNoteIcon = (childrenArray, noteName) => {
            if (!childrenArray) return 'fa-circle-dot';
            for (const child of childrenArray) {
                if (child.name === noteName) return child.icon || 'fa-circle-dot';
                if (child.children) {
                    const found = findNoteIcon(child.children, noteName);
                    if (found !== 'fa-circle-dot') return found;
                }
            }
            return 'fa-circle-dot';
        };

        const legendHtml = Object.entries(selectedCategories).map(([category, data]) => `
            <div class="mb-5 bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                <h4 class="font-bold text-stone-800 flex items-center gap-3 mb-3">
                    <span class="w-4 h-4 rounded-full shadow-inner" style="background-color: ${data.color}"></span>
                    <i class="fas ${FLAVOR_DATA[category]?.icon || 'fa-circle'} text-stone-400"></i>
                    ${category}
                </h4>
                <ul class="grid grid-cols-1 gap-2 pl-7">
                    ${data.children.filter(n => n !== category).map(note => {
                        const noteIcon = FLAVOR_DATA[category] ? findNoteIcon(FLAVOR_DATA[category].children, note) : 'fa-circle-dot';
                        return `
                            <li class="group flex items-center gap-2 text-stone-600 text-sm">
                                <i class="fas ${noteIcon} text-stone-300 group-hover:text-stone-500 transition-colors"></i>
                                <span>${note}</span>
                            </li>
                        `;
                    }).join('')}
                </ul>
            </div>
        `).join('');

        legendContainer.innerHTML = `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${legendHtml}</div>`;
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const nombre_rueda = form.nombre_rueda.value.trim();
        const notas_json = state.selectedNotes;

        if (!nombre_rueda || notas_json.length === 0) {
            alert("Por favor, asigna un nombre y selecciona al menos una nota en la rueda.");
            return;
        }

        const data = {
            nombre_rueda,
            notas_json,
            tipo: state.currentType
        };

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/ruedas-sabores/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/ruedas-sabores', { method: 'POST', body: JSON.stringify(data) });
            }
            state.selectedRuedaId = null;
            resetForm();
            await loadRuedas();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    }

    function handleListClick(e) {
        const card = e.target.closest('[data-id]');
        if (!card) return;

        const id = parseInt(card.dataset.id, 10);

        if (e.target.closest('.delete-btn')) {
            e.stopPropagation();
            if (confirm('¿Seguro que quieres eliminar esta rueda de sabor?')) {
                api(`/api/ruedas-sabores/${id}`, { method: 'DELETE' }).then(() => {
                    state.selectedRuedaId = null;
                    resetForm();
                    loadRuedas();
                });
            }
        } else if (e.target.closest('.edit-btn')) {
            e.stopPropagation();
            populateFormForEdit(id);
        } else {
            resetForm();
            selectRueda(id);
        }
    }

    function populateFormForEdit(id) {
        const rueda = state.ruedas.find(r => r.id === id);
        if (!rueda) return;

        resetForm();

        state.currentType = rueda.tipo;
        ruedaTypeSelector.value = rueda.tipo;

        editIdInput.value = id;
        form.nombre_rueda.value = rueda.nombre_rueda;
        state.selectedNotes = [...rueda.notas_json];

        updateChart();
        formTitle.textContent = 'Editar Rueda';
        submitButton.textContent = 'Actualizar Perfil';
        cancelEditBtn.classList.remove('hidden');
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        ruedaTypeSelector.value = state.currentType;
        state.selectedNotes = [];

        if (state.selectedRuedaId) {
            const rueda = state.ruedas.find(r => r.id === state.selectedRuedaId);
            if (rueda) {
                state.selectedNotes = [...rueda.notas_json];
            }
        }

        updateChart();
        formTitle.textContent = 'Crear Nueva Rueda';
        submitButton.textContent = 'Guardar Perfil';
        cancelEditBtn.classList.add('hidden');
    }

    init();
});