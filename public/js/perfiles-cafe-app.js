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
        { id: 'fraganciaAroma', label: 'Fragancia/Aroma' },
        { id: 'sabor', label: 'Sabor' },
        { id: 'postgusto', label: 'Postgusto' },
        { id: 'acidez', label: 'Acidez' },
        { id: 'cuerpo', label: 'Cuerpo' },
        { id: 'dulzura', label: 'Dulzura' },
        { id: 'balance', label: 'Balance' },
        { id: 'limpieza', label: 'Limpieza' },
        { id: 'impresionGeneral', label: 'Impresión General' }
    ];

    async function init() {
        generateSliders();
        await loadPerfiles();
        form.addEventListener('submit', handleFormSubmit);
        selector.addEventListener('change', handleSelectorChange);
        cancelEditBtn.addEventListener('click', resetForm);
        editProfileBtn.addEventListener('click', handleEditClick);
        deleteProfileBtn.addEventListener('click', handleDeleteClick);
    }

    async function loadPerfiles() {
        try {
            perfiles = await api('/api/perfiles-cafe');
            populateSelector();
            if (perfiles.length > 0) {
                selectPerfil(perfiles[0].id);
            } else {
                updateChart({ nombre_perfil: 'Crea tu primer perfil', perfil_data: {} });
            }
        } catch (error) {
            console.error("Error al cargar perfiles:", error);
            selector.innerHTML = `<option>Error al cargar</option>`;
        }
    }

    function populateSelector() {
        selector.innerHTML = perfiles.length > 0
            ? perfiles.map(p => `<option value="${p.id}">${p.nombre_perfil}</option>`).join('')
            : '<option>No hay perfiles guardados</option>';
    }

    function selectPerfil(id) {
        selector.value = id;
        const perfil = perfiles.find(p => p.id == id);
        if(perfil) {
            updateChart(perfil);
        }
    }

    function updateChart(perfil) {
        const labels = atributos.map(a => a.label);
        const data = perfil ? atributos.map(a => perfil.perfil_data[a.id] || 0) : Array(atributos.length).fill(0);

        if (radarChart) {
            radarChart.data.datasets[0].data = data;
            radarChart.options.plugins.title.text = `Perfil de Taza: ${perfil.nombre_perfil}`;
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
                        backgroundColor: 'rgba(22, 101, 52, 0.2)',
                        borderColor: 'rgb(22, 101, 52)',
                        pointBackgroundColor: 'rgb(22, 101, 52)',
                        pointBorderColor: '#fff',
                    }]
                },
                options: {
                    responsive: true,
                    scales: { r: { suggestedMin: 0, suggestedMax: 10, ticks: { stepSize: 2 } } },
                    plugins: {
                        legend: { display: false },
                        title: { display: true, text: `Perfil de Taza: ${perfil.nombre_perfil}`, font: { size: 18, family: "'Playfair Display', serif" } }
                    }
                }
            });
        }
    }
    
    function generateSliders() {
        slidersContainer.innerHTML = atributos.map(attr => `
            <div>
                <label for="${attr.id}" class="block text-sm font-medium text-stone-700">${attr.label}</label>
                <div class="flex items-center gap-2">
                    <input type="range" id="${attr.id}" name="${attr.id}" min="0" max="10" value="5" step="0.5" class="w-full h-2 bg-stone-200 rounded-lg appearance-none cursor-pointer">
                    <span id="${attr.id}-value" class="font-bold text-green-800 w-8 text-center">5.0</span>
                </div>
            </div>
        `).join('');
        
        slidersContainer.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                document.getElementById(`${e.target.id}-value`).textContent = parseFloat(e.target.value).toFixed(1);
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

        const data = {
            nombre_perfil: formData.get('nombre_perfil'),
            perfil_data
        };

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/perfiles-cafe/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/perfiles-cafe', { method: 'POST', body: JSON.stringify(data) });
            }
            resetForm();
            await loadPerfiles();
        } catch (error) {
            alert(`Error al guardar el perfil: ${error.message}`);
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
        nombrePerfilInput.value = perfil.nombre_perfil;
        
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
        
        if (confirm(`¿Seguro que quieres eliminar el perfil "${perfil.nombre_perfil}"?`)) {
            try {
                await api(`/api/perfiles-cafe/${selectedId}`, { method: 'DELETE' });
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

