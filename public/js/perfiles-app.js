document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('perfil-selector');
    const form = document.getElementById('perfil-form');
    const slidersContainer = document.getElementById('sliders-container');
    const chartCanvas = document.getElementById('radar-chart');
    const formTitle = document.getElementById('form-title');
    const editIdInput = document.getElementById('edit-id');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const nombrePerfilInput = document.getElementById('nombre_perfil');
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const deleteProfileBtn = document.getElementById('delete-profile-btn');
    let radarChart;
    let perfiles = [];

    const atributos = [
        { id: 'cacao', label: 'Cacao' }, { id: 'acidez', label: 'Acidez' },
        { id: 'amargor', label: 'Amargor' }, { id: 'astringencia', label: 'Astringencia' },
        { id: 'frutaFresca', label: 'Fruta Fresca' }, { id: 'frutaMarron', label: 'Fruta Marrón' },
        { id: 'vegetal', label: 'Vegetal' }, { id: 'floral', label: 'Floral' },
        { id: 'madera', label: 'Madera' }, { id: 'especia', label: 'Especia' },
        { id: 'nuez', label: 'Nuez' }, { id: 'caramelo', label: 'Caramelo' }
    ];

    // --- Inicialización ---
    async function init() {
        generateSliders();
        await loadPerfiles();
        form.addEventListener('submit', handleFormSubmit);
        selector.addEventListener('change', handleSelectorChange);
        cancelEditBtn.addEventListener('click', resetForm);
        editProfileBtn.addEventListener('click', handleEditClick);
        deleteProfileBtn.addEventListener('click', handleDeleteClick);
    }

    // --- Carga y Renderizado de Datos ---
    async function loadPerfiles() {
        try {
            perfiles = await api('/api/perfiles');
            populateSelector();
            if (perfiles.length > 0) {
                updateChart(perfiles[0]);
            } else {
                // Si no hay perfiles, muestra un gráfico vacío
                updateChart({ nombre: 'Sin Perfiles', perfil_data: {} });
            }
        } catch (error) {
            console.error("Error al cargar perfiles:", error);
        }
    }

    function populateSelector() {
        selector.innerHTML = perfiles.length > 0
            ? perfiles.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')
            : '<option>No hay perfiles guardados</option>';
    }

    // --- Lógica del Gráfico ---
    function updateChart(perfil) {
        const labels = atributos.map(a => a.label);
        const data = atributos.map(a => perfil.perfil_data[a.id] || 0);

        if (radarChart) {
            radarChart.data.datasets[0].data = data;
            radarChart.options.plugins.title.text = `Perfil Sensorial: ${perfil.nombre}`;
            radarChart.update();
        } else {
            radarChart = new Chart(chartCanvas, {
                type: 'radar',
                data: {
                    labels: labels,
                    datasets: [{
                        label: 'Intensidad',
                        data: data,
                        fill: true,
                        backgroundColor: 'rgba(120, 53, 15, 0.2)',
                        borderColor: 'rgb(120, 53, 15)',
                        pointBackgroundColor: 'rgb(120, 53, 15)',
                        pointBorderColor: '#fff',
                        pointHoverBackgroundColor: '#fff',
                        pointHoverBorderColor: 'rgb(120, 53, 15)'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: true,
                    elements: {
                        line: { borderWidth: 3 }
                    },
                    scales: {
                        r: {
                            angleLines: { display: true },
                            suggestedMin: 0,
                            suggestedMax: 10,
                            ticks: { stepSize: 2 }
                        }
                    },
                    plugins: {
                        legend: { display: false },
                        title: {
                            display: true,
                            text: `Perfil Sensorial: ${perfil.nombre}`,
                            font: { size: 18, family: "'Playfair Display', serif" }
                        }
                    }
                }
            });
        }
    }
    
    // --- Lógica del Formulario ---
    function generateSliders() {
        slidersContainer.innerHTML = atributos.map(attr => `
            <div>
                <label for="${attr.id}" class="block text-sm font-medium text-stone-700">${attr.label}</label>
                <div class="flex items-center gap-2">
                    <input type="range" id="${attr.id}" name="${attr.id}" min="0" max="10" value="5" class="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer">
                    <span id="${attr.id}-value" class="font-bold text-amber-900 w-6 text-center">5</span>
                </div>
            </div>
        `).join('');
        
        // Añadir listeners a los nuevos sliders
        slidersContainer.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                document.getElementById(`${e.target.id}-value`).textContent = e.target.value;
            });
        });
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(form);
        const perfil_data = {};
        atributos.forEach(attr => {
            perfil_data[attr.id] = parseFloat(formData.get(attr.id));
        });
        const data = { nombre: formData.get('nombre'), perfil_data };
        const editId = editIdInput.value;

        try {
            if (editId) {
                await api(`/api/perfiles/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/perfiles', { method: 'POST', body: JSON.stringify(data) });
            }
            resetForm();
            await loadPerfiles();
        } catch (error) {
            alert(`Error al guardar: ${error.message}`);
        }
    }
    
    function handleSelectorChange() {
        const selectedId = selector.value;
        const selectedPerfil = perfiles.find(p => p.id == selectedId);
        if (selectedPerfil) {
            updateChart(selectedPerfil);
        }
    }

    function handleEditClick() {
        const selectedId = selector.value;
        const perfil = perfiles.find(p => p.id == selectedId);
        if (!perfil) return;
        
        resetForm();
        formTitle.textContent = "Editar Perfil";
        editIdInput.value = perfil.id;
        nombrePerfilInput.value = perfil.nombre;
        
        atributos.forEach(attr => {
            const slider = document.getElementById(attr.id);
            const valueSpan = document.getElementById(`${attr.id}-value`);
            const value = perfil.perfil_data[attr.id] || 5;
            slider.value = value;
            valueSpan.textContent = parseFloat(value).toFixed(1);
        });
        
        cancelEditBtn.classList.remove('hidden');
    }
    
    async function handleDeleteClick() {
        const selectedId = selector.value;
        const perfil = perfiles.find(p => p.id == selectedId);
        if (!perfil) return;
        
        if (confirm(`¿Seguro que quieres eliminar el perfil "${perfil.nombre}"?`)) {
            try {
                await api(`/api/perfiles/${selectedId}`, { method: 'DELETE' });
                await loadPerfiles();
            } catch (error) {
                alert(`Error al eliminar: ${error.message}`);
            }
        }
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        formTitle.textContent = 'Crear Nuevo Perfil';
        cancelEditBtn.classList.add('hidden');
        slidersContainer.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.value = 5;
            document.getElementById(`${slider.id}-value`).textContent = '5.0';
        });
    }

    init();
});
