document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('rueda-form');
    const listContainer = document.getElementById('ruedas-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const chartTitle = document.getElementById('chart-title');
    const interactiveWheelContainer = document.getElementById('interactive-wheel');
    const legendContainer = document.getElementById('chart-legend');
    
    let charts = {};
    let ruedas = [];
    let selectedRuedaId = null;
    
    Chart.register(ChartDataLabels);

    const SCAA_FLAVORS_ES = {
        'Floral': { color: '#ec4899', children: ['Té Negro', 'Floral'] },
        'Frutal': { color: '#ef4444', children: ['Bayas', 'Frutas Secas', 'Otras Frutas', 'Cítricos'] },
        'Agrio/Fermentado': { color: '#a855f7', children: ['Aromas Agrios', 'Alcohol/Fermentado'] },
        'Verde/Vegetal': { color: '#22c55e', children: ['Aceite de Oliva', 'Crudo', 'Verde/Vegetal', 'Frijol'] },
        'Otro': { color: '#6b7280', children: ['Papel/Moho', 'Químico'] },
        'Tostado': { color: '#0d9488', children: ['Tabaco de Pipa', 'Tabaco', 'Quemado', 'Cereal'] },
        'Especias': { color: '#d97706', children: ['Picante', 'Pimienta', 'Especias Dulces'] },
        'Nuez/Cacao': { color: '#78350f', children: ['Nueces', 'Cacao'] },
        'Dulce': { color: '#f59e0b', children: ['Azúcar Moreno', 'Vainilla', 'Dulce General', 'Aromas Dulces'] }
    };

    async function init() {
        renderInteractiveWheel();
        await loadRuedas();
        form.addEventListener('submit', handleFormSubmit);
        listContainer.addEventListener('click', handleListClick);
        cancelEditBtn.addEventListener('click', resetForm);
        interactiveWheelContainer.addEventListener('click', handleWheelClick);
    }

    async function loadRuedas() {
        try {
            ruedas = await api('/api/ruedas-sabores');
            renderRuedas();
            if (ruedas.length > 0 && !selectedRuedaId) {
                selectRueda(ruedas[0].id);
            } else if (ruedas.length > 0 && selectedRuedaId) {
                selectRueda(selectedRuedaId);
            } else {
                updateChart(null);
            }
        } catch (error) {
            console.error("Error al cargar las ruedas de sabores:", error);
        }
    }

    function renderRuedas() {
        listContainer.innerHTML = ruedas.map(r => `
            <div class="p-3 border rounded-xl cursor-pointer hover:bg-amber-50 ${r.id === selectedRuedaId ? 'bg-amber-100 border-amber-800' : ''}" data-id="${r.id}">
                <div class="flex justify-between items-center">
                    <span class="font-semibold flex-grow">${r.nombre_rueda}</span>
                    <div class="flex items-center flex-shrink-0">
                        <button data-id="${r.id}" class="edit-btn text-sky-600 hover:text-sky-800 p-1 rounded-full"><svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z"></path><path fill-rule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clip-rule="evenodd"></path></svg></button>
                        <button data-id="${r.id}" class="delete-btn text-red-500 hover:text-red-700 text-xl font-bold leading-none p-1">&times;</button>
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    function selectRueda(id) {
        selectedRuedaId = id;
        const rueda = ruedas.find(r => r.id === id);
        if (rueda) {
            updateChart(rueda);
            renderRuedas();
        }
    }

    function renderInteractiveWheel() {
        interactiveWheelContainer.innerHTML = Object.entries(SCAA_FLAVORS_ES).map(([category, data]) => `
            <div>
                <h4 class="font-semibold text-stone-700" style="color: ${data.color}">${category}</h4>
                <div class="flex flex-wrap gap-2 mt-2">
                    ${data.children.map(note => `
                        <button type="button" class="flavor-tag bg-stone-200 text-stone-700 text-sm font-medium px-3 py-1 rounded-full" data-category="${category}" data-note="${note}" data-color="${data.color}">
                            ${note}
                        </button>
                    `).join('')}
                </div>
            </div>
        `).join('');
    }

    function updateChart(rueda) {
        const title = rueda ? rueda.nombre_rueda : 'Selecciona o crea un perfil';
        const notes = rueda ? rueda.notas_json : [];

        ['l1', 'l2'].forEach(l => { if (charts[l]) charts[l].destroy(); });

        const chartOptions = {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false },
                datalabels: { display: false }
            }
        };
        
        const selectedCategories = {};
        notes.forEach(note => {
            if (!selectedCategories[note.category]) {
                selectedCategories[note.category] = { color: SCAA_FLAVORS_ES[note.category].color, children: [] };
            }
            selectedCategories[note.category].children.push(note.subnote);
        });

        const level1_labels = Object.keys(SCAA_FLAVORS_ES);
        const level1_data = level1_labels.map(cat => SCAA_FLAVORS_ES[cat].children.length);
        const level1_colors = level1_labels.map(l => selectedCategories[l] ? SCAA_FLAVORS_ES[l].color : '#E5E7EB');

        const level2_labels = Object.values(SCAA_FLAVORS_ES).flatMap(d => d.children);
        const level2_data = Array(level2_labels.length).fill(1);
        const level2_colors = level2_labels.map(label => {
            const note = notes.find(n => n.subnote === label);
            return note ? SCAA_FLAVORS_ES[note.category].color : '#E5E7EB';
        });

        charts.l1 = new Chart(document.getElementById('flavor-wheel-chart-l1'), { 
            type: 'doughnut', 
            data: { labels: level1_labels, datasets: [{ data: level1_data, backgroundColor: level1_colors, borderWidth: 2, borderColor: '#fdfaf6' }] }, 
            options: {...chartOptions, cutout: '30%'} 
        });

        charts.l2 = new Chart(document.getElementById('flavor-wheel-chart-l2'), { 
            type: 'doughnut', 
            data: { labels: level2_labels, datasets: [{ data: level2_data, backgroundColor: level2_colors, borderWidth: 2, borderColor: '#fdfaf6' }] }, 
            options: {...chartOptions, cutout: '65%'} 
        });
        
        document.getElementById('chart-title').textContent = title;
        renderCustomLegend(selectedCategories);
    }
    
    function renderCustomLegend(selectedCategories) {
        if(Object.keys(selectedCategories).length === 0) {
            legendContainer.innerHTML = `<p class="text-stone-500 text-center">Ninguna nota seleccionada.</p>`;
            return;
        }

        const legendHtml = Object.entries(selectedCategories).map(([category, data]) => `
            <div class="mb-3">
                <h4 class="font-semibold text-sm flex items-center gap-2">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${data.color}"></span>
                    ${category}
                </h4>
                <ul class="list-disc list-inside text-stone-600 pl-5 text-sm mt-1">
                    ${data.children.map(note => `<li>${note}</li>`).join('')}
                </ul>
            </div>
        `).join('');
        
        legendContainer.innerHTML = `<div class="grid grid-cols-2 gap-x-4">${legendHtml}</div>`;
    }
    
    function handleWheelClick(e) {
        const tag = e.target.closest('.flavor-tag');
        if (!tag) return;
        tag.classList.toggle('active');
        if (tag.classList.contains('active')) {
            tag.style.backgroundColor = tag.dataset.color;
            tag.style.borderColor = tag.dataset.color;
            tag.classList.remove('bg-stone-200', 'text-stone-700');
            tag.classList.add('text-white');
        } else {
            tag.style.backgroundColor = '';
            tag.style.borderColor = 'transparent';
            tag.classList.add('bg-stone-200', 'text-stone-700');
            tag.classList.remove('text-white');
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

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/ruedas-sabores/${editId}`, { method: 'PUT', body: JSON.stringify({ nombre_rueda, notas_json }) });
            } else {
                await api('/api/ruedas-sabores', { method: 'POST', body: JSON.stringify({ nombre_rueda, notas_json }) });
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
                    selectedRuedaId = null;
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
        const rueda = ruedas.find(r => r.id === id);
        if (!rueda) return;

        resetForm();
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
        interactiveWheelContainer.querySelectorAll('.flavor-tag.active').forEach(tag => {
            tag.classList.remove('active', 'text-white');
            tag.classList.add('bg-stone-200', 'text-stone-700');
            tag.style.backgroundColor = '';
            tag.style.borderColor = 'transparent';
        });
        formTitle.textContent = 'Crear Nueva Rueda';
        submitButton.textContent = 'Guardar';
        cancelEditBtn.classList.add('hidden');
        if(ruedas.length > 0) {
            const firstId = ruedas[0].id;
            selectRueda(firstId);
        } else {
            updateChart(null);
        }
    }

    init();
});

