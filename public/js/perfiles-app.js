document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let state = {
        perfiles: [],
        attributesConfig: {}, // Se cargará del JSON
        currentType: 'cafe',  // Tipo seleccionado en el formulario
        viewFilter: 'cafe',   // Tipo seleccionado en la lista
        selectedProfileId: null
    };
    let radarChart = null;

    // --- SELECTORES ---
    const form = document.getElementById('perfil-form');
    const tipoSelect = document.getElementById('tipo-producto');
    const slidersContainer = document.getElementById('sliders-container');
    const perfilesList = document.getElementById('perfiles-list');
    const chartTitle = document.getElementById('chart-title');
    const cancelBtn = document.getElementById('cancel-edit-btn');
    const submitBtn = form.querySelector('button[type="submit"]');
    const editIdInput = document.getElementById('edit-id');
    
    const filterBtnCafe = document.getElementById('filter-cafe');
    const filterBtnCacao = document.getElementById('filter-cacao');

    // --- INICIALIZACIÓN ---
    async function init() {
        await Promise.all([
            loadAttributesConfig(),
            loadPerfiles()
        ]);
        
        setupEventListeners();
        updateFormUI(); // Renderizar sliders iniciales
        updateListUI(); // Renderizar lista inicial
        updateChart(null); // Chart vacío
    }

    async function loadAttributesConfig() {
        try {
            const response = await fetch('/data/perfiles.json');
            state.attributesConfig = await response.json();
        } catch (error) {
            console.error("Error cargando configuración de atributos:", error);
            state.attributesConfig = { cafe: [], cacao: [] };
        }
    }

    async function loadPerfiles() {
        try {
            state.perfiles = await api('/api/perfiles'); // Carga TODOS los perfiles del usuario
        } catch (error) {
            console.error("Error cargando perfiles:", error);
        }
    }

    function setupEventListeners() {
        // Formulario
        tipoSelect.addEventListener('change', (e) => {
            state.currentType = e.target.value;
            updateFormUI();
            // Si estamos editando y cambiamos el tipo, es como resetear (a menos que sea intencional, pero simplifiquemos)
            if (!editIdInput.value) {
                 updateChart({ nombre: 'Nuevo Perfil', perfil_data: getRandomData(state.currentType) });
            }
        });

        form.addEventListener('submit', handleFormSubmit);
        cancelBtn.addEventListener('click', resetForm);

        // Lista y Filtros
        perfilesList.addEventListener('click', handleListClick);
        
        filterBtnCafe.addEventListener('click', () => setViewFilter('cafe'));
        filterBtnCacao.addEventListener('click', () => setViewFilter('cacao'));
        
        // Live Chart Update
        slidersContainer.addEventListener('input', () => {
            const currentData = {};
            slidersContainer.querySelectorAll('input[type="range"]').forEach(input => {
                currentData[input.name] = parseFloat(input.value);
            });
            updateChart({ 
                nombre: form.nombre.value || 'Vista Previa', 
                perfil_data: currentData,
                tipo: state.currentType
            });
        });
    }

    // --- UI LOGIC ---

    function setViewFilter(type) {
        state.viewFilter = type;
        updateListUI();
        // Actualizar estilos de botones
        if (type === 'cafe') {
            filterBtnCafe.classList.add('bg-amber-800', 'text-white');
            filterBtnCafe.classList.remove('text-stone-600', 'hover:bg-stone-200');
            filterBtnCacao.classList.remove('bg-amber-800', 'text-white');
            filterBtnCacao.classList.add('text-stone-600', 'hover:bg-stone-200');
        } else {
            filterBtnCacao.classList.add('bg-amber-800', 'text-white');
            filterBtnCacao.classList.remove('text-stone-600', 'hover:bg-stone-200');
            filterBtnCafe.classList.remove('bg-amber-800', 'text-white');
            filterBtnCafe.classList.add('text-stone-600', 'hover:bg-stone-200');
        }
    }

    function updateFormUI() {
        const attributes = state.attributesConfig[state.currentType] || [];
        slidersContainer.innerHTML = attributes.map(attr => `
            <div>
                <div class="flex justify-between mb-1">
                    <label for="${attr.id}" class="text-sm font-medium text-stone-700">${attr.label}</label>
                    <span id="val-${attr.id}" class="text-sm font-bold text-amber-800">0</span>
                </div>
                <input type="range" id="${attr.id}" name="${attr.id}" min="0" max="10" step="0.5" value="0" 
                    class="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer accent-amber-800"
                    oninput="document.getElementById('val-${attr.id}').textContent = this.value">
            </div>
        `).join('');
    }

    function updateListUI() {
        const filtered = state.perfiles.filter(p => p.tipo === state.viewFilter);
        
        if (filtered.length === 0) {
            perfilesList.innerHTML = `<p class="text-center text-stone-500 py-4">No hay perfiles de ${state.viewFilter} registrados.</p>`;
            return;
        }

        perfilesList.innerHTML = filtered.map(p => `
            <div class="flex items-center justify-between p-3 bg-stone-50 rounded-lg hover:bg-amber-50 transition cursor-pointer border border-stone-200 ${p.id === state.selectedProfileId ? 'border-amber-500 bg-amber-50' : ''}" data-id="${p.id}">
                <span class="font-medium">${p.nombre}</span>
                <div class="flex gap-2">
                    <button class="edit-btn text-stone-400 hover:text-amber-800" title="Editar"><i class="fas fa-edit"></i></button>
                    <button class="delete-btn text-stone-400 hover:text-red-600" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    function updateChart(profile) {
        const ctx = document.getElementById('radar-chart').getContext('2d');
        
        // Determinar qué atributos mostrar (del perfil seleccionado o del tipo actual en formulario)
        const typeToUse = profile ? (profile.tipo || state.currentType) : state.currentType;
        const attributes = state.attributesConfig[typeToUse] || [];
        const labels = attributes.map(a => a.label);
        
        // Obtener datos
        let data = [];
        if (profile && profile.perfil_data) {
            data = attributes.map(a => profile.perfil_data[a.id] || 0);
        } else {
            data = attributes.map(() => 0);
        }

        if (radarChart) {
            radarChart.destroy();
        }

        radarChart = new Chart(ctx, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: profile ? profile.nombre : 'Nuevo Perfil',
                    data: data,
                    fill: true,
                    backgroundColor: 'rgba(146, 64, 14, 0.2)',
                    borderColor: 'rgb(146, 64, 14)',
                    pointBackgroundColor: 'rgb(146, 64, 14)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(146, 64, 14)'
                }]
            },
            options: {
                elements: { line: { borderWidth: 3 } },
                scales: {
                    r: {
                        angleLines: { display: true },
                        suggestedMin: 0,
                        suggestedMax: 10
                    }
                },
                plugins: { legend: { display: false } }
            }
        });
        
        if (chartTitle) chartTitle.textContent = profile ? profile.nombre : 'Visualización';
    }

    // --- HANDLERS ---

    function handleListClick(e) {
        const item = e.target.closest('[data-id]');
        if (!item) return;
        const id = item.dataset.id;
        const profile = state.perfiles.find(p => p.id == id);

        if (e.target.closest('.delete-btn')) {
            e.stopPropagation();
            if(confirm('¿Eliminar este perfil?')) deleteProfile(id);
        } else if (e.target.closest('.edit-btn')) {
            e.stopPropagation();
            loadProfileToForm(profile);
        } else {
            // Solo visualizar
            state.selectedProfileId = parseInt(id);
            updateListUI(); // Para resaltar selección
            updateChart(profile);
        }
    }

    function loadProfileToForm(profile) {
        // Cambiar el tipo en el formulario para que coincida con el perfil
        state.currentType = profile.tipo;
        tipoSelect.value = profile.tipo;
        updateFormUI(); // Regenerar sliders

        editIdInput.value = profile.id;
        form.nombre.value = profile.nombre;
        
        // Llenar valores
        Object.entries(profile.perfil_data).forEach(([key, value]) => {
            const input = document.getElementById(key);
            const display = document.getElementById(`val-${key}`);
            if (input) {
                input.value = value;
                if(display) display.textContent = value;
            }
        });

        document.getElementById('form-title').textContent = 'Editar Perfil';
        submitBtn.textContent = 'Actualizar';
        cancelBtn.classList.remove('hidden');
        
        // Cambiar la vista de la lista para coincidir
        setViewFilter(profile.tipo);
        
        updateChart(profile);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {
            nombre: formData.get('nombre'),
            tipo: state.currentType,
            perfil_data: {}
        };

        state.attributesConfig[state.currentType].forEach(attr => {
            data.perfil_data[attr.id] = parseFloat(formData.get(attr.id));
        });

        const id = editIdInput.value;
        try {
            if (id) {
                await api(`/api/perfiles/${id}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/perfiles', { method: 'POST', body: JSON.stringify(data) });
            }
            resetForm();
            await loadPerfiles();
            updateListUI();
        } catch (error) {
            alert('Error al guardar: ' + error.message);
        }
    }

    async function deleteProfile(id) {
        try {
            await api(`/api/perfiles/${id}`, { method: 'DELETE' });
            await loadPerfiles();
            updateListUI();
            if(state.selectedProfileId == id) updateChart(null);
        } catch (error) {
            alert('Error al eliminar: ' + error.message);
        }
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        document.getElementById('form-title').textContent = 'Nuevo Perfil';
        submitBtn.textContent = 'Guardar Perfil';
        cancelBtn.classList.add('hidden');
        
        // Resetear sliders visualmente
        slidersContainer.querySelectorAll('span[id^="val-"]').forEach(span => span.textContent = '0');
        updateChart({ nombre: 'Nuevo Perfil', perfil_data: getRandomData(state.currentType) });
    }

    function getRandomData(type) {
        // Solo para efecto visual al resetear
        const data = {};
        const attrs = state.attributesConfig[type] || [];
        attrs.forEach(a => data[a.id] = 0);
        return data;
    }
    
    // Inicializar filtro visual por defecto
    setViewFilter('cafe');

    init();
});