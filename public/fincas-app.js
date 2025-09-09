document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('finca-form');
    const fincasList = document.getElementById('fincas-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const countrySelect = document.getElementById('pais');
    const searchInput = document.getElementById('ciudad-search');
    const searchBtn = document.getElementById('search-btn');
    const locateBtn = document.getElementById('locate-btn');
    
    const map = L.map('map').setView([4.60971, -74.08175], 6);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a>' }).addTo(map);
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    let currentPolygon = null;
    const drawControl = new L.Control.Draw({ draw: { polygon: { allowIntersection: false }, polyline: false, rectangle: false, circle: false, marker: false, circlemarker: false }, edit: { featureGroup: drawnItems } });
    map.addControl(drawControl);

    map.on(L.Draw.Event.CREATED, e => { if (currentPolygon) drawnItems.removeLayer(currentPolygon); drawnItems.addLayer(e.layer); currentPolygon = e.layer; form.coordenadas.value = JSON.stringify(e.layer.getLatLngs()[0]); });
    map.on(L.Draw.Event.EDITED, e => { e.layers.eachLayer(layer => { currentPolygon = layer; form.coordenadas.value = JSON.stringify(layer.getLatLngs()[0]); }); });

    async function loadCountries() {
        try {
            const response = await fetch('/countries.json');
            const countries = await response.json();
            countrySelect.innerHTML = '<option value="">Seleccionar país...</option>';
            countries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.name;
                option.textContent = country.name;
                countrySelect.appendChild(option);
            });
        } catch (error) {
            console.error("Error al cargar países:", error);
            countrySelect.innerHTML = '<option value="">Error al cargar</option>';
        }
    }

    async function loadFincas() {
        try {
            const fincas = await api('/api/fincas');
            renderFincas(fincas);
        } catch (error) { fincasList.innerHTML = `<p class="text-red-500">Error al cargar fincas.</p>`; }
    }

    function renderFincas(fincas) {
        fincasList.innerHTML = fincas.length === 0 ? '<p class="text-stone-500 text-center">No hay fincas registradas.</p>' : fincas.map(finca => `
            <div class="p-4 border rounded-xl bg-stone-50">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg text-amber-900">${finca.nombre_finca}</h3>
                        <p class="text-sm text-stone-600">${finca.propietario} - ${finca.dni_ruc}</p>
                        <p class="text-sm text-stone-500">${finca.ciudad || 'N/A'}, ${finca.pais || 'N/A'} - ${finca.altura || 'S/A'} msnm</p>
                        <p class="text-sm text-stone-500">${finca.superficie} Hectáreas</p>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button data-id="${finca.id}" class="edit-btn text-sm bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg">Editar</button>
                        <button data-id="${finca.id}" class="delete-btn text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg">Eliminar</button>
                    </div>
                </div>
            </div>`).join('');
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        if (currentPolygon) drawnItems.removeLayer(currentPolygon);
        drawnItems.clearLayers(); currentPolygon = null;
        formTitle.textContent = 'Nueva Finca';
        submitButton.textContent = 'Guardar Finca';
        submitButton.className = 'bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 px-8 rounded-xl shadow-md';
        cancelEditBtn.classList.add('hidden');
    }

    async function populateFormForEdit(id) {
        try {
            const fincas = await api('/api/fincas');
            const finca = fincas.find(f => f.id === id);
            if (!finca) return;
            form.propietario.value = finca.propietario;
            form.dni_ruc.value = finca.dni_ruc;
            form.nombre_finca.value = finca.nombre_finca;
            form.pais.value = finca.pais;
            form.ciudad.value = finca.ciudad;
            form.altura.value = finca.altura;
            form.superficie.value = finca.superficie;
            form.coordenadas.value = JSON.stringify(finca.coordenadas);
            editIdInput.value = finca.id;
            drawnItems.clearLayers();
            if (finca.coordenadas) { const polygon = L.polygon(finca.coordenadas); drawnItems.addLayer(polygon); currentPolygon = polygon; map.fitBounds(polygon.getBounds()); }
            formTitle.textContent = `Editando: ${finca.nombre_finca}`;
            submitButton.textContent = 'Actualizar Finca';
            submitButton.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-md';
            cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) { alert('Error al cargar datos para editar.'); }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const fincaData = Object.fromEntries(formData.entries());
        
        if (fincaData.coordenadas && typeof fincaData.coordenadas === 'string' && fincaData.coordenadas.trim() !== '') {
            try {
                fincaData.coordenadas = JSON.parse(fincaData.coordenadas);
            } catch (err) {
                console.error("Error al parsear coordenadas:", err);
                alert("Las coordenadas del mapa no son válidas.");
                return;
            }
        } else {
            fincaData.coordenadas = null;
        }

        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/fincas/${editId}`, { method: 'PUT', body: JSON.stringify(fincaData) });
            } else {
                await api('/api/fincas', { method: 'POST', body: JSON.stringify(fincaData) });
            }
            resetForm();
            await loadFincas();
        } catch (error) { 
            console.error("Error al guardar:", error);
            alert('Error al guardar la finca.'); 
        }
    });

    fincasList.addEventListener('click', async e => {
        const button = e.target.closest('button');
        if (!button) return;
        const id = button.dataset.id;
        if (button.classList.contains('delete-btn')) {
            if (confirm('¿Seguro que quieres eliminar esta finca?')) {
                try { 
                    await api(`/api/fincas/${id}`, { method: 'DELETE' }); 
                    await loadFincas(); 
                }
                catch (error) { 
                    alert('Error al eliminar la finca.'); 
                }
            }
        } else if (button.classList.contains('edit-btn')) { 
            populateFormForEdit(id); 
        }
    });
    
    cancelEditBtn.addEventListener('click', resetForm);
    
    async function searchLocation() {
        const query = searchInput.value.trim();
        if (!query) return;
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data && data.length > 0) {
            map.setView([data[0].lat, data[0].lon], 13);
        } else {
            alert('Ubicación no encontrada.');
        }
    }

    searchBtn.addEventListener('click', searchLocation);
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            searchLocation();
        }
    });

    locateBtn.addEventListener('click', () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(position => {
                const { latitude, longitude } = position.coords;
                map.setView([latitude, longitude], 15);
                L.marker([latitude, longitude]).addTo(map)
                    .bindPopup('Tu ubicación actual.').openPopup();
            }, error => {
                alert('No se pudo obtener tu ubicación. Error: ' + error.message);
            });
        } else {
            alert('La geolocalización no está disponible en tu navegador.');
        }
    });

    // Inicializar la carga de datos
    loadCountries();
    loadFincas();
});

