document.addEventListener('DOMContentLoaded', () => {
    let state = { batches: [] };
    const crearCosechaBtn = document.getElementById('crearCosechaBtn');
    const dashboardView = document.getElementById('dashboard-view');
    const welcomeScreen = document.getElementById('welcome-screen');
    const formModal = document.getElementById('form-modal');
    const modalContent = document.getElementById('modal-content');

    const processConfig = {
        cosecha: { plural: 'fermentaciones', singular: 'fermentacion', outputWeightField: 'pesoGranosFrescos', icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM6.5 8.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2a.5.5 0 01-1 0V9h-1.5a.5.5 0 01-.5-.5zM10 5a.5.5 0 01.5.5v2a.5.5 0 01-1 0V5.5A.5.5 0 0110 5zm3.5 3.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v2a.5.5 0 01-1 0V9h-1.5a.5.5 0 01-.5-.5z" clip-rule="evenodd" /></svg>`},
        fermentacion: { plural: 'secados', singular: 'secado', outputWeightField: 'pesoFermentadoHumedo', icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 2h10v10H5V5z" /><path d="M7 7h2v2H7V7zm4 0h2v2h-2V7z" /></svg>`},
        secado: { plural: 'tostados', singular: 'tostado', outputWeightField: 'pesoSeco', icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-1.636 4.95l.707-.707a1 1 0 10-1.414-1.414l-.707.707a1 1 0 101.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 100 2h1zM6.343 7.657a1 1 0 010-1.414l.707-.707a1 1 0 011.414 1.414l-.707.707a1 1 0 01-1.414 0zm-.707 7.071a1 1 0 011.414 0l.707.707a1 1 0 01-1.414 1.414l-.707-.707a1 1 0 010-1.414zM10 17a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1z" clip-rule="evenodd" /></svg>`},
        tostado: { plural: 'moliendas', singular: 'molienda', outputWeightField: 'pesoTostado', icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 01-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>`},
        molienda: { displayName: 'Descascarillado & Molienda', plural: null, singular: null, outputWeightField: 'pesoProductoFinal', icon: `<svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" viewBox="0 0 20 20" fill="currentColor"><path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.268a2 2 0 010 3.464V16a1 1 0 11-2 0v-1.268a2 2 0 010-3.464V4a1 1 0 011-1z" /></svg>`}
    };
    
    function generateId(prefix = 'LOTE') {
        const now = new Date();
        const timestamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        const random = Math.random().toString(36).substring(2, 6);
        return `${prefix}-${timestamp}-${random}`;
    }

    async function init() {
        await loadBatches();
        crearCosechaBtn.addEventListener('click', () => openFormModal('create', 'cosecha', null));
        formModal.addEventListener('click', (e) => { if (e.target.id === 'form-modal') formModal.close(); });
    }

    async function loadBatches() {
        try {
            const batchesTree = await api('/api/batches/tree');
            state.batches = batchesTree;
            renderDashboard(state.batches);
        } catch (error) {
            console.error("Error al cargar lotes:", error);
            dashboardView.innerHTML = `<p class="text-red-500 text-center">No se pudieron cargar los datos del servidor.</p>`;
        }
    }

    function renderDashboard(cosechas) {
        dashboardView.innerHTML = '';
        welcomeScreen.classList.toggle('hidden', cosechas.length > 0);
        cosechas.forEach(cosecha => {
            dashboardView.appendChild(createBatchCard(cosecha, 'cosecha'));
        });
    }

    function buildPath(batch, type, parentPath = '') {
        const currentPath = `${type}:${batch.id}`;
        return parentPath ? `${parentPath}>${currentPath}` : currentPath;
    }

    function createBatchCard(batch, type, parentPath = '') {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-xl shadow-md mb-4 overflow-hidden';
        
        const path = buildPath(batch, type, parentPath);
        const config = processConfig[type];
        const childrenKey = config.plural;
        const hasChildren = batch[childrenKey] && batch[childrenKey].length > 0;
        const parentBatch = getParentBatchByPath(path);
        const parentType = parentBatch ? path.split('>').slice(-2, -1)[0].split(':')[0] : type;
        const availableWeight = calculateAvailableWeight(batch, type);

        let infoHtml = '';
        if (type === 'cosecha') {
            infoHtml = `<p class="text-sm text-stone-500">Finca: <strong>${batch.finca || 'N/A'}</strong></p>
                        <p class="text-sm text-stone-500 mt-1">Fecha: ${batch.fechaCosecha || 'N/A'}</p>`;
        } else {
            const inputField = processConfig[parentType].outputWeightField;
            infoHtml = `<p class="text-sm text-stone-600"><span class="font-semibold">Entrada:</span> ${batch[inputField] || 0} kg</p>`;
        }
        if (type === 'tostado') {
             if (batch.tipoPerfil) infoHtml += `<p class="text-sm text-stone-500 mt-1">Perfil: <strong>${batch.tipoPerfil}</strong></p>`;
            if (batch.perfilAroma) infoHtml += `<p class="text-sm text-stone-500 mt-1" title="${batch.perfilAroma}">Aroma: <strong>${batch.perfilAroma.substring(0,40)}...</strong></p>`;
        }
         if (type === 'molienda') {
             infoHtml += `<p class="text-sm text-stone-500 mt-1">Cascarilla: <strong>${batch.pesoCascarilla || 0} kg</strong></p>`;
             infoHtml += `<p class="text-sm text-stone-500 mt-1">Producto: <strong>${batch.productoFinal || 'N/A'}</strong></p>`;
        }
        
        const displayName = config.displayName || type.charAt(0).toUpperCase() + type.slice(1);

        const cardHeader = document.createElement('div');
        cardHeader.className = `p-4 border-l-4 border-amber-800 flex justify-between items-start ${hasChildren ? 'cursor-pointer hover:bg-stone-50' : ''}`;
        cardHeader.innerHTML = `
            <div class="flex items-center gap-3">
                 ${batch.imageUrl ? `<img src="${batch.imageUrl}" class="w-16 h-16 rounded-md object-cover flex-shrink-0" alt="Foto">` : `<div class="w-16 h-16 flex items-center justify-center text-amber-800 flex-shrink-0">${config.icon}</div>`}
                 ${hasChildren ? `<svg class="w-5 h-5 text-stone-400 transition-transform duration-300 expand-icon flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>` : '<div class="w-5"></div>' }
                <div>
                    <h3 class="font-bold text-lg text-amber-900">${displayName}: ${batch.id}</h3>
                    ${infoHtml}
                    <div class="mt-2 text-sm">
                        <span class="font-semibold">Salida:</span> ${batch[config.outputWeightField] || 0} kg
                        ${config.plural ? `<span class="ml-4 font-semibold text-green-700">Disponible:</span> ${availableWeight.toFixed(2)} kg` : ''}
                    </div>
                </div>
            </div>
            <div class="flex gap-2 flex-shrink-0 ml-4 items-start">
                ${type === 'molienda' || type === 'secado' ? `<button class="qr-btn text-sm bg-sky-600 hover:bg-sky-700 text-white font-bold px-3 py-1 rounded-lg" data-id="${batch.id}">QR</button>` : ''}
                <button class="edit-btn text-sm bg-stone-200 hover:bg-stone-300 px-3 py-1 rounded-lg" data-path="${path}" data-type="${type}">Editar</button>
                <button class="delete-btn text-sm bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded-lg" data-path="${path}">X</button>
                ${config.plural ? `<button ${availableWeight <= 0 ? 'disabled' : ''} class="add-sub-btn text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg disabled:bg-gray-400" data-path="${path}" data-type="${type}">+ Añadir</button>` : ''}
            </div>`;
        
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'ml-6 mt-0 pl-4 border-l-2 border-stone-200 hidden';

        if (hasChildren) {
            batch[childrenKey].forEach(childBatch => {
                childrenContainer.appendChild(createBatchCard(childBatch, config.singular, path));
            });
        }
        card.appendChild(cardHeader);
        card.appendChild(childrenContainer);
        if (hasChildren) {
            cardHeader.addEventListener('click', e => {
                if (e.target.closest('button')) return;
                childrenContainer.classList.toggle('hidden');
                cardHeader.querySelector('.expand-icon')?.classList.toggle('rotate-90');
            });
        }
        return card;
    }

    async function openFormModal(mode, type, path) {
        const isCreating = mode === 'create';
        const parentBatch = isCreating ? getBatchByPath(path) : getParentBatchByPath(path);
        const batchData = isCreating ? {} : getBatchByPath(path);

        const parentType = parentBatch ? path.split('>').pop().split(':')[0] : null;
        const availableWeight = parentBatch ? calculateAvailableWeight(parentBatch, parentType) : 0;
        
        modalContent.innerHTML = await generateFormHTML(mode, type, batchData || {}, availableWeight);
        formModal.showModal();

        const imageInput = modalContent.querySelector('.image-upload-input');
        if(imageInput) {
            imageInput.addEventListener('change', e => {
                const file = e.target.files[0];
                if(!file) return;
                const reader = new FileReader();
                reader.onloadend = () => {
                    document.getElementById('image-preview').src = reader.result;
                    document.getElementById('image-hidden-input').value = reader.result;
                };
                reader.readAsDataURL(file);
            });
        }

        const form = document.getElementById('batch-form');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(form);
            const newData = Object.fromEntries(formData.entries());

            try {
                if (isCreating) {
                    newData.id = generateId(type.toUpperCase().substring(0, 3));
                    const parentId = parentBatch ? parentBatch.id : null;
                    await api('/api/batches', { method: 'POST', body: JSON.stringify({ tipo: type, parent_id: parentId, data: newData }) });
                } else {
                    await api(`/api/batches/${batchData.id}`, { method: 'PUT', body: JSON.stringify({ data: newData }) });
                }
                formModal.close();
                await loadBatches();
            } catch (error) {
                console.error('Error al guardar:', error);
                alert('No se pudo guardar el lote: ' + error.message);
            }
        });
        document.getElementById('cancel-btn').addEventListener('click', () => formModal.close());
    }

    async function generateFormHTML(mode, type, data = {}, availableWeight = 0) {
        let formFields = '';
        if (type !== 'cosecha') {
            const parentType = Object.keys(processConfig).find(k => processConfig[k].singular === type);
            const inputWeightField = processConfig[parentType].outputWeightField;
            let limit = availableWeight + (mode === 'edit' ? parseFloat(data[inputWeightField]) || 0 : 0);
            formFields += createInput(inputWeightField, `Peso Entrada (kg)`, 'number', `Disponible: ${limit.toFixed(2)} kg`, data[inputWeightField] || '');
        }

        const hasImageUpload = ['cosecha', 'fermentacion', 'secado', 'tostado'].includes(type);
        const displayName = processConfig[type].displayName || type.charAt(0).toUpperCase() + type.slice(1);
        
        switch(type) {
            case 'cosecha':
                formFields += await createFincaSelectHTML(data.finca);
                formFields += createInput('id', 'ID Cosecha', 'text', 'Auto-generado', data.id, true);
                formFields += createInput('fechaCosecha', 'Fecha Cosecha', 'date', '', data.fechaCosecha);
                formFields += createInput('pesoMazorcas', 'Peso Mazorcas (kg)', 'number', '', data.pesoMazorcas);
                formFields += createInput('pesoGranosFrescos', 'Peso de granos frescos (kg)', 'number', 'Peso de salida', data.pesoGranosFrescos);
                break;
            case 'fermentacion':
                formFields += createInput('fechaInicio', 'Fecha Inicio', 'date', '', data.fechaInicio);
                formFields += createSelect('metodo', 'Método', ['bandejas Rohan', 'cajones de madera', 'otro'], data.metodo);
                formFields += createInput('duracion', 'Duración (días)', 'number', '', data.duracion);
                formFields += createInput('pesoFermentadoHumedo', 'Peso Fermentado Húmedo (kg)', 'number', '', data.pesoFermentadoHumedo);
                break;
            case 'secado':
                formFields += createInput('fechaInicio', 'Fecha Inicio', 'date', '', data.fechaInicio);
                formFields += createSelect('metodo', 'Método', ['túneles de secado', 'marquesinas', 'hornos', 'otro'], data.metodo);
                formFields += createInput('duracion', 'Duración (días)', 'number', '', data.duracion);
                formFields += createInput('pesoSeco', 'Peso Cacao Seco (kg)', 'number', '', data.pesoSeco);
                break;
            case 'tostado':
                formFields += await createPerfilSelectHTML(data.tipoPerfil);
                formFields += createInput('fechaTostado', 'Fecha Tostado', 'date', '', data.fechaTostado);
                formFields += createSelect('clasificacion', 'Tamaño Grano', ['Grandes', 'Medianos', 'Pequeños'], data.clasificacion);
                formFields += createInput('tempMinima', 'Temp. Mínima (°C)', 'number', '', data.tempMinima);
                formFields += createInput('tempMaxima', 'Temp. Máxima (°C)', 'number', '', data.tempMaxima);
                formFields += createInput('duracion', 'Tiempo de Tueste (min)', 'number', '', data.duracion);
                formFields += createTextArea('perfilAroma', 'Perfil de Aroma', 'Ej: notas a caramelo...', data.perfilAroma);
                formFields += createInput('pesoTostado', 'Peso Cacao Tostado (kg)', 'number', 'Peso de salida', data.pesoTostado);
                break;
            case 'molienda':
                formFields += createInput('fecha', 'Fecha Procesamiento', 'date', '', data.fecha);
                formFields += createInput('pesoCascarilla', 'Peso Cascarilla (kg)', 'number', '', data.pesoCascarilla);
                formFields += createSelect('productoFinal', 'Producto Final', ['Pasta de Cacao', 'Nibs de Cacao', 'Otros'], data.productoFinal);
                formFields += createInput('pesoProductoFinal', 'Peso Producto Final (kg)', 'number', '', data.pesoProductoFinal);
                break;
        }
        if (hasImageUpload) formFields += createImageInputHTML('imageUrl', `Foto de ${type}`, data.imageUrl);
        
        return `<form id="batch-form">
                    <h2 class="text-2xl font-display text-amber-900 border-b pb-2 mb-4">${mode === 'create' ? 'Crear' : 'Editar'} Lote de ${displayName}</h2>
                    <div class="space-y-4 max-h-[60vh] overflow-y-auto p-1">${formFields}</div>
                    <div class="flex justify-end gap-4 mt-6">
                        <button type="button" id="cancel-btn" class="bg-stone-300 hover:bg-stone-400 font-bold py-2 px-6 rounded-xl">Cancelar</button>
                        <button type="submit" class="bg-amber-800 hover:bg-amber-900 text-white font-bold py-2 px-6 rounded-xl">${mode === 'create' ? 'Guardar' : 'Actualizar'}</button>
                    </div>
                </form>`;
    }

    // --- Helpers de HTML y Datos ---
    function createInput(id, l, t, p, v, r) { return `<div><label for="${id}" class="block text-sm font-medium text-stone-700 mb-1">${l}</label><input type="${t}" id="${id}" name="${id}" value="${v||''}" placeholder="${p}" class="w-full p-3 border border-stone-300 rounded-xl" ${r?'readonly':''} ${t==='number'?'step="0.01"':''} required></div>`; }
    function createSelect(id, l, o, s) { const opts = o.map(opt => `<option value="${opt}" ${opt===s?'selected':''}>${opt}</option>`).join(''); return `<div><label for="${id}" class="block text-sm font-medium text-stone-700 mb-1">${l}</label><select id="${id}" name="${id}" class="w-full p-3 border border-stone-300 rounded-xl" required><option value="">Seleccionar...</option>${opts}</select></div>`; }
    function createTextArea(id, l, p, v) { return `<div><label for="${id}" class="block text-sm font-medium text-stone-700 mb-1">${l}</label><textarea id="${id}" name="${id}" placeholder="${p}" rows="3" class="w-full p-3 border border-stone-300 rounded-xl">${v||''}</textarea></div>`; }
    function createImageInputHTML(id, l, v) { return `<div class="pt-4 border-t"><label class="block text-sm font-medium text-stone-700 mb-1">${l}</label><div class="mt-1 flex items-center gap-4"><img id="image-preview" src="${v||'https://placehold.co/100x100/e7e5e4/a8a29e?text=Foto'}" alt="Previsualización" class="h-24 w-24 rounded-lg object-cover"><div class="w-full"><input type="file" class="image-upload-input block w-full text-sm text-stone-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100" accept="image/*"><input type="hidden" id="image-hidden-input" name="${id}" value="${v||''}"><p class="text-xs text-stone-500 mt-2">Sube una imagen.</p></div></div></div>`; }
    
    async function createFincaSelectHTML(selectedValue = '') {
        try {
            const fincas = await api('/api/fincas');
            if (fincas.length === 0) return `<div><label class="block text-sm font-medium text-stone-700 mb-1">Finca</label><div class="p-3 border rounded-xl bg-stone-50 text-stone-500">No hay fincas. <a href="/app/fincas" class="text-sky-600 hover:underline">Registra una</a>.</div><input type="hidden" name="finca" value=""></div>`;
            return createSelect('finca', 'Asociar Finca', fincas.map(f => f.nombre_finca), selectedValue);
        } catch (error) { return `<div class="text-red-500">Error al cargar fincas.</div>`; }
    }

    async function createPerfilSelectHTML(selectedValue = '') {
        try {
            const perfiles = await api('/api/perfiles');
            let optionsHTML = perfiles.map(p => `<option value="${p.nombre}" ${p.nombre === selectedValue ? 'selected' : ''}>${p.nombre}</option>`).join('');
            return `<div><label for="tipoPerfil" class="block text-sm font-medium text-stone-700 mb-1">Tipo de Perfil Sensorial</label><div class="flex items-center gap-2"><select id="tipoPerfil" name="tipoPerfil" class="w-full p-3 border border-stone-300 rounded-xl"><option value="">Seleccionar perfil...</option>${optionsHTML}</select><a href="/app/perfiles" target="_blank" class="flex-shrink-0 bg-sky-600 hover:bg-sky-700 text-white font-bold p-3 rounded-xl" title="Añadir Nuevo Perfil">+</a></div></div>`;
        } catch (error) { return `<div class="text-red-500">Error al cargar perfiles. <a href="/app/perfiles" class="text-sky-600 hover:underline">Ir a Perfiles</a>.</div>`; }
    }

    function getBatchByPath(path) { if (!path) return null; const ids = path.split('>'); let currentBatch = null; let currentList = state.batches; for (let i = 0; i < ids.length; i++) { const [type, key] = ids[i].split(':'); currentBatch = currentList.find(b => b.id === key); if (!currentBatch) return null; const nextKey = processConfig[type]?.plural; if (i < ids.length - 1) currentList = currentBatch[nextKey] || []; } return currentBatch; }
    function getParentBatchByPath(path) { if (!path || !path.includes('>')) return null; const parentPath = path.split('>').slice(0, -1).join('>'); return getBatchByPath(parentPath); }
    function calculateAvailableWeight(batch, type) { const config = processConfig[type]; if (!config.plural) return 0; const totalOutput = parseFloat(batch[config.outputWeightField]) || 0; const children = batch[config.plural] || []; const assignedWeight = children.reduce((sum, child) => sum + (parseFloat(child[processConfig[type].outputWeightField]) || 0), 0); return totalOutput - assignedWeight; }
    
    dashboardView.addEventListener('click', async e => {
        const button = e.target.closest('button');
        if (!button) return;
        const { path, type } = button.dataset;
        if (button.classList.contains('add-sub-btn')) { openFormModal('create', processConfig[type].singular, path); }
        if (button.classList.contains('edit-btn')) { openFormModal('edit', type, path); }
        if (button.classList.contains('delete-btn')) {
            const batchId = path.split('>').pop().split(':')[1];
            if (confirm('¿Seguro que quieres eliminar este lote?')) {
                try { await api(`/api/batches/${batchId}`, { method: 'DELETE' }); await loadBatches(); } catch (error) { alert('Error al eliminar: ' + error.message); }
            }
        }
        if (button.classList.contains('qr-btn')) { 
            const url = `${window.location.origin}/trazabilidad.html?lote=${button.dataset.id}`; const qr = qrcode(0, 'L'); qr.addData(url); qr.make();
            const link = document.createElement('a'); link.href = qr.createDataURL(10, 5); link.download = `QR_${button.dataset.id}.png`; link.click();
        }
    });

    init();
});

