document.addEventListener('DOMContentLoaded', () => {
    // State Management
    let state = {
        cacaoProfiles: [],
        cafeProfiles: [],
        savedBlends: [],
        currentBlend: {
            name: '',
            type: null, // 'cacao' or 'cafe'
            components: [] // { profile, percentage }
        }
    };
    let blendRadarChart;

    // DOM Elements
    const cacaoList = document.getElementById('cacao-profiles-list');
    const cafeList = document.getElementById('cafe-profiles-list');
    const savedBlendsList = document.getElementById('saved-blends-list');
    const blendComponentsContainer = document.getElementById('blend-components-container');
    const blendResultContainer = document.getElementById('blend-result-container');
    const blendNameInput = document.getElementById('blend-name');
    const saveBlendBtn = document.getElementById('save-blend-btn');

    const CACAO_ATTRIBUTES = ['cacao', 'acidez', 'amargor', 'astringencia', 'frutaFresca', 'frutaMarron', 'vegetal', 'floral', 'madera', 'especia', 'nuez', 'caramelo'];
    const CAFE_ATTRIBUTES = ['fraganciaAroma', 'sabor', 'postgusto', 'acidez', 'cuerpo', 'dulzura', 'balance', 'limpieza', 'impresionGeneral'];

    async function init() {
        try {
            [state.cacaoProfiles, state.cafeProfiles, state.savedBlends] = await Promise.all([
                api('/api/perfiles'),
                api('/api/perfiles-cafe'),
                api('/api/blends')
            ]);
            renderOriginLists();
            renderSavedBlends();
            setupEventListeners();
        } catch (error) {
            console.error("Error inicializando el laboratorio de blends:", error);
            blendComponentsContainer.innerHTML = `<p class="text-red-600">Error al cargar los perfiles. Inténtalo de nuevo.</p>`;
        }
    }

    function setupEventListeners() {
        cacaoList.addEventListener('click', e => handleAddOrigin(e, 'cacao'));
        cafeList.addEventListener('click', e => handleAddOrigin(e, 'cafe'));
        blendComponentsContainer.addEventListener('input', handlePercentageChange);
        blendComponentsContainer.addEventListener('click', handleRemoveComponent);
        saveBlendBtn.addEventListener('click', handleSaveBlend);
        savedBlendsList.addEventListener('click', handleSavedBlendActions);
    }

    // --- Rendering Functions ---

    function renderOriginLists() {
        cacaoList.innerHTML = state.cacaoProfiles.map(p => createOriginCard(p, 'cacao')).join('');
        cafeList.innerHTML = state.cafeProfiles.map(p => createOriginCard(p, 'cafe')).join('');
    }
    
    function createOriginCard(profile, type) {
        const name = type === 'cacao' ? profile.nombre : profile.nombre_perfil;
        return `
            <div class="p-3 border rounded-xl flex items-center justify-between hover:bg-amber-50">
                <span class="font-medium text-sm">${name}</span>
                <button data-id="${profile.id}" data-type="${type}" class="add-origin-btn bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200">+</button>
            </div>
        `;
    }

    function renderBlendComponents() {
        if (state.currentBlend.components.length === 0) {
            blendComponentsContainer.innerHTML = `<p class="text-center text-stone-500 py-8">Añade un origen para comenzar a crear tu blend.</p>`;
            blendResultContainer.classList.add('hidden');
            if(blendRadarChart) blendRadarChart.destroy();
            blendRadarChart = null;
            return;
        }

        blendResultContainer.classList.remove('hidden');
        blendComponentsContainer.innerHTML = state.currentBlend.components.map((comp, index) => {
            const name = state.currentBlend.type === 'cacao' ? comp.profile.nombre : comp.profile.nombre_perfil;
            return `
                <div class="p-4 border rounded-xl">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold">${name}</span>
                        <button data-index="${index}" class="remove-component-btn text-red-500 hover:text-red-700 text-2xl leading-none">&times;</button>
                    </div>
                    <div class="flex items-center gap-4">
                        <input type="range" min="0" max="100" value="${comp.percentage}" data-index="${index}" class="blend-component-slider w-full">
                        <input type="number" min="0" max="100" value="${comp.percentage}" data-index="${index}" class="blend-component-input w-20 p-2 border border-stone-300 rounded-md text-center">
                        <span class="font-bold -ml-2 text-stone-600">%</span>
                    </div>
                </div>
            `;
        }).join('');
        
        syncBlendUI();
    }
    
    function syncBlendUI() {
        state.currentBlend.components.forEach((comp, index) => {
            const slider = blendComponentsContainer.querySelector(`.blend-component-slider[data-index="${index}"]`);
            const input = blendComponentsContainer.querySelector(`.blend-component-input[data-index="${index}"]`);
            
            if (slider) slider.value = comp.percentage;
            if (input) input.value = comp.percentage;
        });
        
        updateAllSliderVisuals();
        updateBlendChart();
    }


    function updateAllSliderVisuals() {
        document.querySelectorAll('.blend-component-slider').forEach(slider => {
            const percentage = slider.value;
            const color = state.currentBlend.type === 'cacao' ? '#854d0e' : '#166534';
            slider.style.setProperty('--thumb-color', color);
            slider.style.background = `linear-gradient(to right, ${color} ${percentage}%, #e5e7eb ${percentage}%)`;
        });
    }

    function renderSavedBlends() {
        savedBlendsList.innerHTML = state.savedBlends.map(blend => `
            <div class="p-3 border rounded-xl flex items-center justify-between">
                <div>
                    <p class="font-semibold">${blend.nombre_blend}</p>
                    <p class="text-xs text-stone-500">${blend.tipo_producto.toUpperCase()} - ${blend.componentes_json.length} componentes</p>
                </div>
                <div class="flex gap-2">
                     <button data-id="${blend.id}" class="load-blend-btn text-sky-600 hover:text-sky-800 text-xs font-bold px-3 py-1 rounded-full bg-sky-100">Cargar</button>
                    <button data-id="${blend.id}" class="delete-blend-btn text-red-600 hover:text-red-800 text-xs font-bold px-3 py-1 rounded-full bg-red-100">X</button>
                </div>
            </div>
        `).join('') || `<p class="text-center text-stone-500 py-4">Aún no tienes recetas guardadas.</p>`;
    }
    
    function updateBlendChart() {
        const blendProfile = calculateCurrentBlendProfile();
        const { type, components } = state.currentBlend;
        if (!type || components.length === 0) return;

        const attributes = type === 'cacao' ? CACAO_ATTRIBUTES : CAFE_ATTRIBUTES;
        const labels = attributes.map(a => a.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
        
        const componentColors = ['rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(139, 92, 246, 0.7)'];
        
        const datasets = components.map((comp, index) => {
            const color = componentColors[index % componentColors.length];
            return {
                label: comp.profile.nombre || comp.profile.nombre_perfil,
                data: attributes.map(attr => comp.profile.perfil_data[attr] || 0),
                fill: true,
                backgroundColor: 'rgba(0,0,0,0)',
                borderColor: color,
                pointBackgroundColor: color,
                borderWidth: 1.5,
                borderDash: [5, 5]
            };
        });
        
        const blendColor = type === 'cacao' ? 'rgb(133, 77, 14)' : 'rgb(22, 101, 52)';
        datasets.push({
            label: 'Perfil del Blend',
            data: attributes.map(attr => blendProfile[attr] || 0),
            fill: true,
            backgroundColor: blendColor.replace('rgb', 'rgba').replace(')', ', 0.2)'),
            borderColor: blendColor,
            pointBackgroundColor: blendColor,
            borderWidth: 3
        });

        if (blendRadarChart) {
            blendRadarChart.data.labels = labels;
            blendRadarChart.data.datasets = datasets;
            blendRadarChart.update();
        } else {
            blendRadarChart = new Chart(document.getElementById('blend-radar-chart'), {
                type: 'radar',
                data: { labels, datasets },
                options: {
                    scales: { r: { suggestedMin: 0, suggestedMax: 10, pointLabels: { font: { size: 11 } } } },
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }

    // --- Event Handlers ---
    
    function handleAddOrigin(e, type) {
        if (!e.target.classList.contains('add-origin-btn')) return;
        
        const profileId = e.target.dataset.id;
        
        if (state.currentBlend.type && state.currentBlend.type !== type) {
            alert("No se pueden mezclar perfiles de Cacao y Café en el mismo blend.");
            return;
        }

        if (state.currentBlend.components.some(c => c.profile.id == profileId)) {
            alert("Este origen ya está en la mesa de mezclas.");
            return;
        }

        state.currentBlend.type = type;
        const profile = (type === 'cacao' ? state.cacaoProfiles : state.cafeProfiles).find(p => p.id == profileId);
        state.currentBlend.components.push({ profile, percentage: 0 });
        
        normalizePercentages();
        renderBlendComponents();
    }

    function handlePercentageChange(e) {
        const target = e.target;
        if (!target.classList.contains('blend-component-slider') && !target.classList.contains('blend-component-input')) {
            return;
        }
        
        const index = parseInt(target.dataset.index, 10);
        let newValue = parseInt(target.value, 10);

        if (isNaN(newValue)) return;
        if (newValue < 0) newValue = 0;
        if (newValue > 100) newValue = 100;

        const oldValue = state.currentBlend.components[index].percentage;
        const diff = newValue - oldValue;

        state.currentBlend.components[index].percentage = newValue;
        
        const otherComponents = state.currentBlend.components.filter((_, i) => i !== index);
        if (otherComponents.length > 0) {
            const totalOtherPercentage = otherComponents.reduce((sum, c) => sum + c.percentage, 0);
            if (totalOtherPercentage > 0) {
                let remainder = 0;
                 otherComponents.forEach(comp => {
                    const proportion = comp.percentage / totalOtherPercentage;
                    const change = diff * proportion;
                    const roundedChange = Math.round(change);
                    remainder += change - roundedChange;
                    comp.percentage -= roundedChange;
                });
                if (otherComponents.length > 0) {
                     otherComponents[0].percentage -= Math.round(remainder);
                }
            }
        }
        
        normalizePercentages();
        syncBlendUI();
    }
    
    function handleRemoveComponent(e) {
        if (!e.target.classList.contains('remove-component-btn')) return;
        const index = parseInt(e.target.dataset.index, 10);
        state.currentBlend.components.splice(index, 1);
        
        if (state.currentBlend.components.length === 0) {
            state.currentBlend.type = null;
        } else {
            normalizePercentages();
        }
        renderBlendComponents();
    }

    async function handleSaveBlend() {
        const name = blendNameInput.value.trim();
        if (!name) {
            alert("Por favor, dale un nombre a tu receta de blend.");
            return;
        }

        const blendData = {
            nombre_blend: name,
            tipo_producto: state.currentBlend.type,
            componentes_json: state.currentBlend.components.map(c => ({
                id: c.profile.id,
                nombre: c.profile.nombre || c.profile.nombre_perfil,
                percentage: c.percentage
            })),
            perfil_final_json: calculateCurrentBlendProfile()
        };

        try {
            await api('/api/blends', { method: 'POST', body: JSON.stringify(blendData) });
            alert("Receta guardada con éxito!");
            state.savedBlends = await api('/api/blends');
            renderSavedBlends();
        } catch (error) {
            alert(`Error al guardar el blend: ${error.message}`);
        }
    }

    async function handleSavedBlendActions(e) {
        const deleteBtn = e.target.closest('.delete-blend-btn');
        const loadBtn = e.target.closest('.load-blend-btn');

        if (deleteBtn) {
            const id = deleteBtn.dataset.id;
            if (confirm("¿Seguro que quieres eliminar esta receta?")) {
                try {
                    await api(`/api/blends/${id}`, { method: 'DELETE' });
                    state.savedBlends = state.savedBlends.filter(b => b.id != id);
                    renderSavedBlends();
                } catch (error) {
                    alert("Error al eliminar la receta.");
                }
            }
        } else if (loadBtn) {
            const id = loadBtn.dataset.id;
            const blendToLoad = state.savedBlends.find(b => b.id == id);
            if (blendToLoad) {
                state.currentBlend.type = blendToLoad.tipo_producto;
                state.currentBlend.components = blendToLoad.componentes_json.map(comp => {
                    const profileList = blendToLoad.tipo_producto === 'cacao' ? state.cacaoProfiles : state.cafeProfiles;
                    return {
                        profile: profileList.find(p => p.id === comp.id),
                        percentage: comp.percentage
                    };
                }).filter(c => c.profile);
                
                blendNameInput.value = blendToLoad.nombre_blend + " (copia)";
                renderBlendComponents();
            }
        }
    }
    
    // --- Logic Functions ---

    function normalizePercentages() {
        const count = state.currentBlend.components.length;
        if (count === 0) return;
        
        let total = state.currentBlend.components.reduce((sum, c) => sum + c.percentage, 0);
        
        if (total === 0 && count > 0) {
            const initialPercentage = Math.floor(100 / count);
            state.currentBlend.components.forEach(c => c.percentage = initialPercentage);
        }
        
        total = state.currentBlend.components.reduce((sum, c) => sum + c.percentage, 0);
        let diff = 100 - total;
        if(diff !== 0 && count > 0) {
            state.currentBlend.components[count-1].percentage += diff;
        }

        // Asegurarse de que ningún porcentaje sea negativo
        state.currentBlend.components.forEach(comp => {
            if (comp.percentage < 0) comp.percentage = 0;
        });
        
        // Renormalizar si hay negativos
        total = state.currentBlend.components.reduce((sum, c) => sum + c.percentage, 0);
        if(total !== 100 && total > 0) {
            const scale = 100 / total;
            state.currentBlend.components.forEach(comp => {
                comp.percentage = Math.round(comp.percentage * scale);
            });
            total = state.currentBlend.components.reduce((sum, c) => sum + c.percentage, 0);
            diff = 100 - total;
            if(diff !== 0 && count > 0) {
               state.currentBlend.components[count-1].percentage += diff;
            }
        }
    }

    function calculateCurrentBlendProfile() {
        const { type, components } = state.currentBlend;
        if (!type || components.length === 0) return {};

        const attributes = type === 'cacao' ? CACAO_ATTRIBUTES : CAFE_ATTRIBUTES;
        const finalProfile = {};

        attributes.forEach(attr => {
            let weightedSum = 0;
            components.forEach(comp => {
                const value = comp.profile.perfil_data[attr] || 0;
                weightedSum += value * (comp.percentage / 100);
            });
            finalProfile[attr] = parseFloat(weightedSum.toFixed(2));
        });
        
        return finalProfile;
    }

    init();
});