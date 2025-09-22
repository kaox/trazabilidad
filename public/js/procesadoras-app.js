document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('procesadora-form');
    const listContainer = document.getElementById('procesadoras-list');
    const editIdInput = document.getElementById('edit-id');
    const submitButton = form.querySelector('button[type="submit"]');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const formTitle = document.getElementById('form-title');
    const countrySelect = document.getElementById('pais');

    async function loadCountries() {
        try {
            const response = await fetch('/data/countries.json');
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
        }
    }

    async function loadProcesadoras() {
        try {
            const procesadoras = await api('/api/procesadoras');
            renderProcesadoras(procesadoras);
        } catch (error) {
            listContainer.innerHTML = `<p class="text-red-500">Error al cargar procesadoras.</p>`;
        }
    }

    function renderProcesadoras(procesadoras) {
        listContainer.innerHTML = procesadoras.length === 0 ? '<p class="text-stone-500 text-center">No hay procesadoras registradas.</p>' : procesadoras.map(p => `
            <div class="p-4 border rounded-xl bg-stone-50">
                <div class="flex justify-between items-start">
                    <div>
                        <h3 class="font-bold text-lg text-amber-900">${p.nombre_comercial || p.razon_social}</h3>
                        <p class="text-sm text-stone-600">RUC: ${p.ruc}</p>
                        <p class="text-sm text-stone-500">${p.direccion || 'N/A'}, ${p.ciudad || 'N/A'}</p>
                        <p class="text-sm text-stone-500">Tel: ${p.telefono || 'N/A'}</p>
                    </div>
                    <div class="flex gap-2 flex-shrink-0">
                        <button data-id="${p.id}" class="edit-btn text-sm bg-sky-600 hover:bg-sky-700 text-white px-3 py-1 rounded-lg">Editar</button>
                        <button data-id="${p.id}" class="delete-btn text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg">Eliminar</button>
                    </div>
                </div>
            </div>`).join('');
    }

    function resetForm() {
        form.reset();
        editIdInput.value = '';
        formTitle.textContent = 'Nueva Procesadora';
        submitButton.textContent = 'Guardar Procesadora';
        submitButton.className = 'bg-amber-800 hover:bg-amber-900 text-white font-bold py-3 px-8 rounded-xl shadow-md';
        cancelEditBtn.classList.add('hidden');
    }

    async function populateFormForEdit(id) {
        try {
            const procesadoras = await api('/api/procesadoras');
            const procesadora = procesadoras.find(p => p.id === id);
            if (!procesadora) return;
            
            for (const key in procesadora) {
                if (form.elements[key]) {
                    form.elements[key].value = procesadora[key];
                }
            }
            editIdInput.value = procesadora.id;

            formTitle.textContent = `Editando: ${procesadora.nombre_comercial || procesadora.razon_social}`;
            submitButton.textContent = 'Actualizar Procesadora';
            submitButton.className = 'bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-xl shadow-md';
            cancelEditBtn.classList.remove('hidden');
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (error) {
            alert('Error al cargar datos para editar.');
        }
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/procesadoras/${editId}`, { method: 'PUT', body: JSON.stringify(data) });
            } else {
                await api('/api/procesadoras', { method: 'POST', body: JSON.stringify(data) });
            }
            resetForm();
            await loadProcesadoras();
        } catch (error) {
            alert('Error al guardar la procesadora.');
        }
    });

    listContainer.addEventListener('click', async e => {
        const button = e.target.closest('button');
        if (!button) return;
        const id = button.dataset.id;
        if (button.classList.contains('delete-btn')) {
            if (confirm('¿Seguro que quieres eliminar esta procesadora?')) {
                try {
                    await api(`/api/procesadoras/${id}`, { method: 'DELETE' });
                    await loadProcesadoras();
                } catch (error) {
                    alert('Error al eliminar la procesadora.');
                }
            }
        } else if (button.classList.contains('edit-btn')) {
            populateFormForEdit(id);
        }
    });

    cancelEditBtn.addEventListener('click', resetForm);

    // Initial load
    loadCountries();
    loadProcesadoras();
});
