document.addEventListener('DOMContentLoaded', () => {

    // --- ESTADO ---
    let state = {
        ruedas: [],
        selectedRuedaId: null,
        currentType: 'cafe' // 'cafe' o 'cacao'
    };
    let charts = {};

    // --- SELECTORES DEL DOM ---
    const form = document.getElementById('rueda-form');
    const listContainer = document.getElementById('ruedas-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const chartTitle = document.getElementById('chart-title');
    const interactiveWheelContainer = document.getElementById('interactive-wheel');
    const legendContainer = document.getElementById('chart-legend');
    const ruedaTypeSelector = document.getElementById('rueda-type-selector');

    Chart.register(ChartDataLabels);

    async function init() {
        await Promise.all([
            loadRuedas(),
            loadFlavorData() // Cargar datos externos
        ]);
        setupEventListeners();
        renderInteractiveWheel(); // Render inicial
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
        cancelEditBtn.addEventListener('click', resetForm);
        interactiveWheelContainer.addEventListener('click', handleWheelClick);
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
        renderInteractiveWheel();
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
            updateChart(rueda);
            renderRuedas();
        }
    }

    function renderInteractiveWheel() {
        if (!state.flavorData) return;

        const FLAVOR_DATA = state.flavorData[state.currentType];

        // Función recursiva para renderizar notas de cualquier nivel
        const renderNotes = (childrenArray, categoryName, categoryColor) => {
            if (!childrenArray || childrenArray.length === 0) return '';

            return childrenArray.map(note => {
                let html = `
                    <button type="button" class="flavor-tag bg-stone-200 text-stone-700 text-sm font-medium px-3 py-1 rounded-full m-1" 
                            data-category="${categoryName}" data-note="${note.name}" data-color="${categoryColor}">
                        <i class="fas ${note.icon || 'fa-circle-dot'} w-4"></i> ${note.name}
                    </button>
                `;
                if (note.children && note.children.length > 0) {
                    html += `<div class="ml-4 border-l-2 border-stone-200 pl-2 mt-1 mb-2">
                                ${renderNotes(note.children, categoryName, categoryColor)}
                             </div>`;
                }
                return html;
            }).join('');
        };

        interactiveWheelContainer.innerHTML = Object.entries(FLAVOR_DATA).map(([category, data]) => `
            <div class="mb-4">
                <h4 class="font-semibold text-stone-700 border-b pb-1 mb-2" style="color: ${data.color}">
                    <i class="fas ${data.icon} w-5"></i> ${category}
                </h4>
                <div class="flex flex-col">
                    <div class="flex flex-wrap">
                        ${renderNotes(data.children, category, data.color)}
                    </div>
                </div>
            </div>
        `).join('');
    }

    function updateChart(rueda) {
        const title = rueda ? rueda.nombre_rueda : 'Selecciona o crea un perfil';
        const notes = rueda ? rueda.notas_json : [];
        const FLAVOR_DATA = state.flavorData ? state.flavorData[state.currentType] : {};

        // Limpiar contenedor D3
        const chartContainer = d3.select("#flavor-wheel-chart");
        chartContainer.selectAll("*").remove();

        if (chartTitle) {
            chartTitle.textContent = title;
        }

        if (!FLAVOR_DATA || Object.keys(FLAVOR_DATA).length === 0) return;

        // Construir jerarquía para D3
        const rootData = { name: "Root", children: [] };

        // selectedCategories nos ayuda para el custom legend
        const selectedCategories = {};

        // Recorrer FLAVOR_DATA y transponer en formato jerárquico
        Object.entries(FLAVOR_DATA).forEach(([catName, catData]) => {
            // Verificar si alguna subnota de esta categoría está seleccionada
            const isCatSelected = notes.some(n => n.category === catName);
            if (isCatSelected) {
                selectedCategories[catName] = { color: catData.color, children: [] };
            }

            const catNode = {
                name: catName,
                color: isCatSelected ? catData.color : '#E5E7EB',
                baseColor: catData.color,
                children: [],
                icon: catData.icon
            };

            // Función recursiva para anidar children
            const processChildren = (childrenArray, parentNode) => {
                if (!childrenArray || childrenArray.length === 0) return;

                childrenArray.forEach(child => {
                    // Verificar si esta nota específica está en notas_json
                    const isSelected = notes.some(n => n.category === catName && n.subnote === child.name);

                    if (isSelected && selectedCategories[catName] && !selectedCategories[catName].children.includes(child.name)) {
                        selectedCategories[catName].children.push(child.name);
                    }

                    const childNode = {
                        name: child.name,
                        color: isSelected ? catData.color : '#E5E7EB',
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

        // Calcular el radio para que entre exactamente en el centro independientemente de la profundidad
        const maxDepth = root.height + 1;
        const maxPixelRadius = width / 2;
        const centerRadius = maxPixelRadius * 0.15; // 20% del espacio para el centro (antes era mayor)

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

        // Arcos
        const arcs = svg.selectAll("path")
            .data(root.descendants().slice(1))
            .join("path")
            .attr("class", "arc")
            .attr("fill", d => d.data.color)
            .attr("stroke", "#fff")
            .attr("stroke-width", "1.5px")
            .attr("d", arc)
            .style("cursor", "pointer")
            .style("transition", "opacity 0.2s, filter 0.2s")
            .on("mouseenter", (event, d) => {
                d3.selectAll(".arc").style("opacity", 0.3);
                const ancestors = d.ancestors();
                d3.selectAll(".arc").filter(node => ancestors.includes(node)).style("opacity", 1);

                const info = document.getElementById("flavor-wheel-info");
                if (info) {
                    document.getElementById("flavor-wheel-info-title").innerText = d.data.name;
                    document.getElementById("flavor-wheel-info-path").innerText = d.ancestors().reverse().slice(1).map(a => a.data.name).join(" > ");
                    info.style.display = "block";
                    info.style.borderLeftColor = d.data.baseColor;
                }
            })
            .on("mouseleave", () => {
                d3.selectAll(".arc").style("opacity", 1);
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
            .style("font-size", d => d.depth === 1 ? "16px" : "14px")
            .style("font-weight", "600")
            .style("font-family", "Arial, sans-serif")
            .style("fill", d => {
                if (d.data.color === '#E5E7EB') return '#6b7280'; // Gris para nodos inactivos
                return d.depth === 1 ? "white" : "#333";
            })
            .attr("transform", function (d) {
                const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
                const y = (getRadius(d.y0) + getRadius(d.y1)) / 2;
                return `rotate(${x - 90}) translate(${y}, 0) rotate(${x < 180 ? 0 : 180})`;
            })
            .attr("dy", "0.35em")
            .text(d => d.data.name.length > 18 ? d.data.name.substring(0, 15) + "..." : d.data.name);

        // Centro
        svg.append("circle").attr("r", centerRadius - 2).attr("fill", "#fff");
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("font-weight", "bold")
            .style("fill", "#333")
            .style("font-size", "24px")
            .attr("dy", "0.35em")
            .text(state.currentType.toUpperCase());

        renderCustomLegend(selectedCategories);
    }

    function renderCustomLegend(selectedCategories) {
        if (Object.keys(selectedCategories).length === 0) {
            legendContainer.innerHTML = `<p class="text-stone-500 text-center">Ninguna nota seleccionada.</p>`;
            return;
        }

        const FLAVOR_DATA = state.flavorData[state.currentType];

        // Buscamos un nodo y su icono recursivamente en FLAVOR_DATA
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
            <div class="mb-3">
                <h4 class="font-semibold text-sm flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${data.color}"></span>
                    <i class="fas ${FLAVOR_DATA[category]?.icon || 'fa-circle'} w-4"></i>
                    ${category}
                </h4>
                <ul class="list-disc list-inside text-stone-600 pl-5 text-sm mt-1 space-y-1">
                    ${data.children.map(note => {
            const noteIcon = FLAVOR_DATA[category] ? findNoteIcon(FLAVOR_DATA[category].children, note) : 'fa-circle-dot';
            return `<li><i class="fas ${noteIcon} w-4 text-stone-500 mr-1"></i>${note}</li>`;
        }).join('')}
                </ul>
            </div>
        `).join('');

        legendContainer.innerHTML = `<div class="grid grid-cols-2 gap-x-4">${legendHtml}</div>`;
    }

    function handleWheelClick(e) {
        const tag = e.target.closest('.flavor-tag');
        if (!tag) return;

        const isTurningOn = !tag.classList.contains('active');
        const categoryName = tag.dataset.category;
        const noteName = tag.dataset.note;

        // Helper para hacer toggle visual de un botón botón específico
        const setTagState = (btn, state) => {
            if (state) {
                btn.classList.add('active');
                btn.style.backgroundColor = btn.dataset.color;
                btn.style.borderColor = btn.dataset.color;
                btn.classList.remove('bg-stone-200', 'text-stone-700');
                btn.classList.add('text-white');
            } else {
                btn.classList.remove('active');
                btn.style.backgroundColor = '';
                btn.style.borderColor = 'transparent';
                btn.classList.add('bg-stone-200', 'text-stone-700');
                btn.classList.remove('text-white');
            }
        };

        // Activarlo a él mismo
        setTagState(tag, isTurningOn);

        // Si lo encendemos, debemos encender todos sus padres hasta la categoría
        if (isTurningOn) {
            // Buscamos sus padres analizando los contenedores DOM en niveles ascendentes
            let parentContainer = tag.parentElement;
            while (parentContainer && parentContainer.classList.contains('pl-2')) {
                // El contenedor padre tiene al hermano anterior (el div) o algo. 
                // Mejor: iterar hacia arriba buscando el botón previo al div collapse.
                const parentDiv = parentContainer.parentElement;
                if (parentDiv && parentDiv.previousElementSibling && parentDiv.previousElementSibling.classList.contains('flavor-tag')) {
                    setTagState(parentDiv.previousElementSibling, true);
                }
                parentContainer = parentDiv;
            }

            // También encender la categoría raíz si hay un botón que lo represente (en este diseño, la categoría a veces no es botón, pero si lo fuera se enciende)
            const rootCatBtn = interactiveWheelContainer.querySelector(`.flavor-tag[data-note="${categoryName}"]`);
            if (rootCatBtn) setTagState(rootCatBtn, true);

        } else {
            // Si lo apagamos, apagamos todos sus hijos
            const nextDiv = tag.nextElementSibling;
            if (nextDiv && nextDiv.classList.contains('ml-4')) {
                const childTags = nextDiv.querySelectorAll('.flavor-tag');
                childTags.forEach(childBtn => setTagState(childBtn, false));
            }
            
            // Revisar padres jerárquicos para apagarlos SOLO SI no les quedan otros hijos encendidos
            let parentContainer = tag.parentElement;
            while (parentContainer && parentContainer.classList.contains('pl-2')) {
                // Comprobamos si este contenedor tiene algún botón que siga encendido
                const hasActiveChildren = parentContainer.querySelector('.flavor-tag.active');
                
                if (hasActiveChildren) {
                    // Si hay algún otro hijo encendido, detenemos la propagación (los padres se quedan encendidos)
                    break;
                }
                
                // Si no hay hijos encendidos en este nivel, apagamos al padre
                if (parentContainer.previousElementSibling && parentContainer.previousElementSibling.classList.contains('flavor-tag')) {
                    setTagState(parentContainer.previousElementSibling, false);
                }
                
                // Subir al siguiente nivel
                parentContainer = parentContainer.parentElement;
            }
        }

        updateChartFromForm();
    }

    function updateChartFromForm() {
        const selectedTags = interactiveWheelContainer.querySelectorAll('.flavor-tag.active');
        const notes = Array.from(selectedTags).map(tag => ({
            category: tag.dataset.category,
            subnote: tag.dataset.note
        }));
        updateChart({ nombre_rueda: form.nombre_rueda.value || 'Nueva Rueda', notas_json: notes });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const nombre_rueda = form.nombre_rueda.value.trim();
        const activeTags = interactiveWheelContainer.querySelectorAll('.flavor-tag.active');
        const notas_json = Array.from(activeTags).map(tag => ({
            category: tag.dataset.category,
            subnote: tag.dataset.note
        }));

        if (!nombre_rueda || notas_json.length === 0) {
            alert("Por favor, asigna un nombre y al menos una nota de sabor.");
            return;
        }

        const data = {
            nombre_rueda,
            notas_json,
            tipo: state.currentType // <-- AÑADIR TIPO
        };

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/ruedas-sabores/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/ruedas-sabores', { method: 'POST', body: JSON.stringify(data) });
            }
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

        // Asegurarse que el tipo es correcto ANTES de renderizar
        state.currentType = rueda.tipo;
        ruedaTypeSelector.value = rueda.tipo;
        renderInteractiveWheel(); // Re-renderizar la rueda correcta

        editIdInput.value = id;
        form.nombre_rueda.value = rueda.nombre_rueda;

        interactiveWheelContainer.querySelectorAll('.flavor-tag').forEach(tag => {
            const isSelected = rueda.notas_json.some(note => note.category === tag.dataset.category && note.subnote === tag.dataset.note);
            if (isSelected) {
                tag.classList.add('active');
                tag.style.backgroundColor = tag.dataset.color;
                tag.style.borderColor = tag.dataset.color;
                tag.classList.remove('bg-stone-200', 'text-stone-700');
                tag.classList.add('text-white');
            }
        });

        updateChart(rueda);
        formTitle.textContent = 'Editar Rueda';
        submitButton.textContent = 'Actualizar';
        cancelEditBtn.classList.remove('hidden');
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        // No resetear el type selector, mantener el actual
        ruedaTypeSelector.value = state.currentType;

        interactiveWheelContainer.querySelectorAll('.flavor-tag.active').forEach(tag => {
            tag.classList.remove('active', 'text-white');
            tag.classList.add('bg-stone-200', 'text-stone-700');
            tag.style.backgroundColor = '';
            tag.style.borderColor = 'transparent';
        });
        formTitle.textContent = 'Crear Nueva Rueda';
        submitButton.textContent = 'Guardar';
        cancelEditBtn.classList.add('hidden');

        const firstRuedaOfType = state.ruedas.find(r => r.tipo === state.currentType);
        if (firstRuedaOfType) {
            selectRueda(firstRuedaOfType.id);
        } else {
            updateChart(null);
        }
    }

    init();
});