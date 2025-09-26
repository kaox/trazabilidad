document.addEventListener('DOMContentLoaded', () => {
    // --- State Management ---
    let state = {
        cacaoSources: [], // Perfiles de cacao y blends guardados
        insumos: [],
        azucares: [],
        savedRecipes: [],
        currentRecipe: {
            name: '',
            type: null,
            components: [], // { id, name, type, percentage, profile, locked }
            conchingTime: 24 // Valor por defecto en horas
        }
    };
    let resultRadarChart;

    // --- DOM Elements ---
    const cacaoSourcesList = document.getElementById('cacao-sources-list');
    const insumosList = document.getElementById('insumos-list');
    const azucarSourcesList = document.getElementById('azucar-sources-list');
    const componentsContainer = document.getElementById('components-container');
    const resultContainer = document.getElementById('result-container');
    const recipeNameInput = document.getElementById('recipe-name');
    const saveRecipeBtn = document.getElementById('save-recipe-btn');
    const synergyScoreEl = document.getElementById('synergy-score');
    const synergyJustificationEl = document.getElementById('synergy-justification');
    const savedRecipesList = document.getElementById('saved-recipes-list');
    const formTitle = document.getElementById('form-title');
    const editIdInput = document.getElementById('edit-id');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const conchingTimeContainer = document.getElementById('conching-time');

    const CACAO_ATTRIBUTES = ['cacao', 'acidez', 'amargor', 'astringencia', 'dulzura', 'frutaFresca', 'frutaMarron', 'vegetal', 'floral', 'madera', 'especia', 'nuez', 'caramelo', 'lactico'];

    // --- Initialization ---
    async function init() {
        try {
            const [cacaoProfiles, savedBlends, insumosData, savedRecipes, azucaresData] = await Promise.all([
                api('/api/perfiles'),
                api('/api/blends'),
                fetch('/data/insumos.json').then(res => res.json()),
                api('/api/recetas-chocolate'),
                fetch('/data/insumos_azucar.json').then(res => res.json())
            ]);
            
            state.cacaoSources = [...cacaoProfiles.map(p => ({...p, type: 'cacao'})), ...savedBlends.map(b => ({...b, type: 'blend'}))];
            state.insumos = insumosData;
            state.azucares = azucaresData;
            state.savedRecipes = savedRecipes;

            renderSourceLists();
            renderSavedRecipes();
            setupEventListeners();
        } catch (error) {
            console.error("Error al inicializar el formulador:", error);
            componentsContainer.innerHTML = `<p class="text-red-600">Error al cargar datos. Por favor, recarga la página.</p>`;
        }
    }

    function setupEventListeners() {
        if(cacaoSourcesList) cacaoSourcesList.addEventListener('click', e => handleAddComponent(e, 'cacao'));
        if(insumosList) insumosList.addEventListener('click', e => handleAddComponent(e, 'insumo'));
        if(azucarSourcesList) azucarSourcesList.addEventListener('click', e => handleAddComponent(e, 'azucar'));
        componentsContainer.addEventListener('input', handlePercentageChange);
        componentsContainer.addEventListener('click', (e) => {
            handleRemoveComponent(e);
            handleLockToggle(e);
        });
        saveRecipeBtn.addEventListener('click', handleSaveRecipe);
        savedRecipesList.addEventListener('click', handleSavedRecipeActions);
        //cancelEditBtn.addEventListener('click', resetForm);
        conchingTimeContainer.addEventListener('click', handleConchingTimeChange);
    }

    // --- Rendering Functions ---
    function renderSourceLists() {
        cacaoSourcesList.innerHTML = state.cacaoSources.map(p => createSourceCard(p, p.type)).join('');
        insumosList.innerHTML = state.insumos.map(i => createSourceCard(i, 'insumo')).join('');
        azucarSourcesList.innerHTML = state.azucares.map(a => createSourceCard(a, 'azucar')).join('');
    }
    
    function createSourceCard(item, type) {
        const name = item.nombre || item.nombre_blend;
        return `<div class="p-3 border rounded-xl flex items-center justify-between hover:bg-amber-50">
                    <span class="font-medium text-sm">${name}</span>
                    <button data-id="${item.id}" data-type="${type}" class="add-component-btn bg-green-100 text-green-800 text-xs font-bold px-3 py-1 rounded-full hover:bg-green-200">+</button>
                </div>`;
    }

    function renderRecipeComponents() {
        if (state.currentRecipe.components.length === 0) {
            componentsContainer.innerHTML = `<p class="text-center text-stone-500 py-8">Añade un origen de cacao para comenzar.</p>`;
            resultContainer.classList.add('hidden');
            if(resultRadarChart) resultRadarChart.destroy();
            resultRadarChart = null;
            return;
        }

        resultContainer.classList.remove('hidden');
        componentsContainer.innerHTML = state.currentRecipe.components.map((comp, index) => {
            const color = comp.type.startsWith('cacao') || comp.type === 'blend' ? '#854d0e' : (comp.type === 'azucar' ? '#f59e0b' : '#4b5563');
            return `
                <div class="p-4 border rounded-xl">
                    <div class="flex justify-between items-center mb-2">
                        <span class="font-bold">${comp.name}</span>
                        <button data-index="${index}" class="remove-component-btn text-red-500 hover:text-red-700 text-2xl leading-none">&times;</button>
                    </div>
                    <div class="flex items-center gap-4">
                        <input type="range" min="0" max="100" value="${comp.percentage}" data-index="${index}" class="component-slider w-full" style="--thumb-color: ${color};" ${comp.locked ? 'disabled' : ''}>
                        <input type="number" min="0" max="100" value="${comp.percentage}" data-index="${index}" class="component-input w-20 p-2 border border-stone-300 rounded-md text-center" ${comp.locked ? 'disabled' : ''}>
                        <span class="font-bold -ml-2 text-stone-600">%</span>
                        <button type="button" data-index="${index}" class="lock-btn p-2 rounded-md ${comp.locked ? 'bg-amber-200 text-amber-800' : 'bg-stone-200 text-stone-600'}" title="Bloquear porcentaje">
                            <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">${comp.locked ? '<path fill-rule="evenodd" d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z" clip-rule="evenodd" />' : '<path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-1V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v2H7V7a3 3 0 013-3z" />'}</svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
        conchingTimeContainer.querySelectorAll('.conching-btn').forEach(btn => {
            btn.classList.toggle('bg-amber-800', parseInt(btn.dataset.value) === state.currentRecipe.conchingTime);
            btn.classList.toggle('text-white', parseInt(btn.dataset.value) === state.currentRecipe.conchingTime);
        });
        
        updateFullAnalysis();
    }
    
    function syncComponentUI() {
        state.currentRecipe.components.forEach((comp, index) => {
            const slider = componentsContainer.querySelector(`.component-slider[data-index="${index}"]`);
            const input = componentsContainer.querySelector(`.component-input[data-index="${index}"]`);
            if (slider) slider.value = comp.percentage;
            if (input) input.value = comp.percentage;
        });
        updateAllSliderVisuals();
        updateResultChart();
    }
    
    function updateAllSliderVisuals() {
        document.querySelectorAll('.component-slider').forEach(slider => {
            const percentage = slider.value;
            const color = slider.style.getPropertyValue('--thumb-color');
            slider.style.background = `linear-gradient(to right, ${color} ${percentage}%, #e5e7eb ${percentage}%)`;
        });
    }

    function updateResultChart() {
        const finalProfile = calculateFinalProfile();
        const { type, components } = state.currentRecipe;
        if (!type || components.length === 0) return;

        const attributes = CACAO_ATTRIBUTES;
        const labels = attributes.map(a => a.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()));
        
        const componentColors = ['rgba(239, 68, 68, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(245, 158, 11, 0.7)', 'rgba(139, 92, 246, 0.7)'];
        
        const datasets = components.map((comp, index) => {
            const color = componentColors[index % componentColors.length];
            return {
                label: comp.name,
                data: attributes.map(attr => comp.profile[attr] || 0),
                fill: true,
                backgroundColor: 'rgba(0,0,0,0)',
                borderColor: color,
                pointBackgroundColor: color,
                borderWidth: 1.5,
                borderDash: [5, 5]
            };
        });
        
        const blendColor = type.startsWith('cacao') || type === 'blend' ? 'rgb(133, 77, 14)' : 'rgb(22, 101, 52)';
        datasets.push({
            label: 'Perfil Final',
            data: attributes.map(attr => finalProfile[attr] || 0),
            fill: true,
            backgroundColor: blendColor.replace('rgb', 'rgba').replace(')', ', 0.2)'),
            borderColor: blendColor,
            pointBackgroundColor: blendColor,
            borderWidth: 3
        });
        
        if (resultRadarChart) {
            resultRadarChart.data.labels = labels;
            resultRadarChart.data.datasets = datasets;
            resultRadarChart.update();
        } else {
            resultRadarChart = new Chart(document.getElementById('result-radar-chart'), {
                type: 'radar',
                data: { labels, datasets },
                options: {
                    scales: { r: { suggestedMin: 0, suggestedMax: 10, pointLabels: { font: { size: 11 } } } },
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }
    
    function updateSynergyPanel() {
        const finalProfile = calculateFinalProfile();
        const { score, justification } = analyzeSynergy(finalProfile);
        synergyScoreEl.textContent = `${score.toFixed(0)}%`;
        synergyJustificationEl.textContent = justification;
    }
    
    function updateFullAnalysis() {
        syncComponentUI();
        updateSynergyPanel();
    }

    function handleAddComponent(e, typeFamily) {
        const button = e.target.closest('.add-component-btn');
        if (!button) return;

        const sourceId = button.dataset.id;
        const type = button.dataset.type;
        
        let sourceList;
        if (type === 'insumo') sourceList = state.insumos;
        else if (type === 'azucar') sourceList = state.azucares;
        else sourceList = state.cacaoSources;
        
        const sourceItem = sourceList.find(item => item.id == sourceId);

        if (state.currentRecipe.components.some(c => c.id === sourceId)) {
            alert("Este ingrediente ya está en la formulación.");
            return;
        }

        if ((type === 'cacao' || type === 'blend') && state.currentRecipe.components.some(c => c.type === 'cacao' || c.type === 'blend')) {
             alert("Solo se puede añadir un origen de cacao o blend a la vez.");
            return;
        }

        state.currentRecipe.type = 'cacao'; // Asignar tipo de receta

        const profile = sourceItem.perfil_data || sourceItem.perfil_final_json || sourceItem.impacto_perfil;
        
        state.currentRecipe.components.push({
            id: sourceItem.id,
            name: sourceItem.nombre || sourceItem.nombre_blend,
            type: type,
            percentage: 0,
            profile: profile,
            locked: false
        });

        normalizePercentages();
        renderRecipeComponents();
    }

    function handlePercentageChange(e) {
        const target = e.target;
        if (!target.classList.contains('component-slider') && !target.classList.contains('component-input')) return;

        const index = parseInt(target.dataset.index, 10);
        let newValue = parseInt(target.value, 10);

        if (isNaN(newValue) || newValue < 0) newValue = 0;
        
        const totalLocked = state.currentRecipe.components.reduce((sum, c) => c.locked ? sum + c.percentage : sum, 0);
        if (newValue > 100 - totalLocked) {
            newValue = 100 - totalLocked;
        }
        
        state.currentRecipe.components[index].percentage = newValue;
        
        normalizePercentages(index);
        updateFullAnalysis();
    }
    
    function handleLockToggle(e) {
        const button = e.target.closest('.lock-btn');
        if (!button) return;
        const index = parseInt(button.dataset.index, 10);
        state.currentRecipe.components[index].locked = !state.currentRecipe.components[index].locked;
        normalizePercentages();
        renderRecipeComponents();
    }

    function handleRemoveComponent(e) {
        if (!e.target.classList.contains('remove-component-btn')) return;
        const index = parseInt(e.target.dataset.index, 10);
        state.currentRecipe.components.splice(index, 1);
        if (state.currentRecipe.components.length === 0) state.currentRecipe.type = null;
        normalizePercentages();
        renderRecipeComponents();
    }
    
    function handleConchingTimeChange(e) {
        const button = e.target.closest('.conching-btn');
        if (!button) return;
        state.currentRecipe.conchingTime = parseInt(button.dataset.value, 10);
        conchingTimeContainer.querySelectorAll('.conching-btn').forEach(btn => {
            btn.classList.toggle('bg-amber-800', btn === button);
            btn.classList.toggle('text-white', btn === button);
        });
        updateFullAnalysis();
    }
    
    function getConchingModifier(cacaoPercent, conchingTimeHours) {
        const MAX_IMPACT_THRESHOLDS = {
            acidez: { min: -5, max: 0 },
            amargor: { min: -4, max: 0 },
            astringencia: { min: -4, max: 0 },
            frutaFresca: { min: -6, max: 0 },
            floral: { min: -7, max: 0 },
            caramelo: { min: 0, max: 4 },
            nuez: { min: 0, max: 3 }
        };

        let cacaoMultiplier = 1.0;
        let volatileMultiplier = 1.0;

        if (cacaoPercent > 75) {
            cacaoMultiplier = 1.2;
            volatileMultiplier = 0.8;
        } else if (cacaoPercent < 60) {
            cacaoMultiplier = 0.9;
            volatileMultiplier = 1.5;
        }
        
        const timeFactor = Math.log2(conchingTimeHours / 12 + 1);

        const rawModifier = {
            acidez: -1.8 * timeFactor * cacaoMultiplier,
            amargor: -1.5 * timeFactor * cacaoMultiplier,
            astringencia: -1.6 * timeFactor * cacaoMultiplier,
            frutaFresca: -2.2 * timeFactor * volatileMultiplier,
            floral: -2.8 * timeFactor * volatileMultiplier,
            caramelo: 1.5 * timeFactor,
            nuez: 1.2 * timeFactor,
        };

        const finalModifier = {};
        for (const attr in MAX_IMPACT_THRESHOLDS) {
            const val = rawModifier[attr] || 0;
            const { min, max } = MAX_IMPACT_THRESHOLDS[attr];
            finalModifier[attr] = Math.max(min, Math.min(max, val));
        }

        return finalModifier;
    }

    function calculateFinalProfile() {
        const { components, conchingTime } = state.currentRecipe;
        const baseProfile = {};
        let totalCacaoPercentage = 0;

        CACAO_ATTRIBUTES.forEach(attr => {
            let weightedSum = 0;
            components.forEach(comp => {
                const value = comp.profile[attr] || 0;
                weightedSum += value * (comp.percentage / 100);
            });
            baseProfile[attr] = weightedSum;
        });
        
        const cacaoComponent = components.find(c => c.type === 'cacao' || c.type === 'blend');
        if (cacaoComponent) {
            totalCacaoPercentage = (cacaoComponent.profile.cacao || 0) * (cacaoComponent.percentage / 100);
        }

        const conchingModifier = getConchingModifier(totalCacaoPercentage, conchingTime);
        const processedProfile = { ...baseProfile };
        for (const attr in conchingModifier) {
            processedProfile[attr] = (processedProfile[attr] || 0) + conchingModifier[attr];
        }

        const interactionMatrix = {
            amargor: { dulzura: -0.15, caramelo: -0.1, lactico: -0.1 },
            acidez: { dulzura: -0.2, caramelo: -0.15, lactico: -0.2 },
            frutaFresca: { acidez: 0.1 },
            astringencia: { lactico: -0.15 }
        };
        const perceivedProfile = { ...processedProfile };
        for (const targetAttr in interactionMatrix) {
            let interactionSum = 0;
            for (const sourceAttr in interactionMatrix[targetAttr]) {
                const modifier = interactionMatrix[targetAttr][sourceAttr];
                interactionSum += (processedProfile[sourceAttr] || 0) * modifier;
            }
            perceivedProfile[targetAttr] += interactionSum;
        }
        
        for(const attr in perceivedProfile) {
            perceivedProfile[attr] = parseFloat(Math.max(0, Math.min(10, perceivedProfile[attr])).toFixed(2));
        }
        
        return perceivedProfile;
    }

    function analyzeSynergy(finalProfile) {
        let score = 0;
        let justification = "";

        const keyAttributes = [finalProfile.acidez, finalProfile.amargor, finalProfile.dulzura, finalProfile.frutaFresca];
        const mean = keyAttributes.reduce((a, b) => a + b, 0) / keyAttributes.length;
        const stdDev = Math.sqrt(keyAttributes.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b, 0) / keyAttributes.length);
        const balanceScore = Math.max(0, (1 - stdDev / 4)) * 100;
        score += balanceScore * 0.5;
        if (stdDev > 3) justification += "Perfil desequilibrado con picos de sabor muy marcados. ";

        let synergyPoints = 0;
        if ((finalProfile.nuez || 0) > 5 && (finalProfile.caramelo || 0) > 5) synergyPoints += 15;
        if ((finalProfile.frutaFresca || 0) > 6 && (finalProfile.acidez || 0) > 6) synergyPoints += 10;
        if ((finalProfile.lactico || 0) > 5 && (finalProfile.caramelo || 0) > 5) synergyPoints += 15;
        const synergyScore = (synergyPoints / 40) * 100;
        score += synergyScore * 0.3;
        if (synergyPoints > 10) justification += "Excelente armonía de notas (ej. nuez y caramelo). ";

        let coherenceScore = 100;
        if ((finalProfile.lactico || 0) > 6 && (finalProfile.acidez || 0) > 7) {
            coherenceScore -= 20;
            justification += "¡Cuidado! La alta acidez podría chocar con las notas lácticas. ";
        }
        if ((finalProfile.amargor || 0) > 8 && (finalProfile.astringencia || 0) > 8) {
            coherenceScore -= 10;
            justification += "El perfil puede resultar excesivamente seco o astringente. ";
        }
        score += coherenceScore * 0.2;

        if (justification === "") justification = "Sinergia equilibrada. Un perfil coherente sin interacciones problemáticas detectadas.";
        
        return { score: Math.max(0, Math.min(100, score)), justification };
    }
    
    function normalizePercentages(activeIndex = -1) {
        const components = state.currentRecipe.components;
        if (components.length === 0) return;

        const totalLocked = components.reduce((sum, c) => c.locked ? sum + c.percentage : sum, 0);
        const unlockedComponents = components.filter(c => !c.locked);
        let availableForUnlocked = 100 - totalLocked;
        if(availableForUnlocked < 0) availableForUnlocked = 0;

        if (unlockedComponents.length > 0) {
            const activeComponent = activeIndex !== -1 ? components[activeIndex] : null;
            const otherUnlocked = unlockedComponents.filter((_, i) => components.indexOf(unlockedComponents[i]) !== activeIndex);
            
            let totalToDistribute = availableForUnlocked;
            if(activeComponent && !activeComponent.locked) {
                totalToDistribute -= activeComponent.percentage;
            }

            const currentOtherUnlockedTotal = otherUnlocked.reduce((sum, c) => sum + c.percentage, 0);

            if (currentOtherUnlockedTotal > 0 && totalToDistribute > 0) {
                const scale = totalToDistribute / currentOtherUnlockedTotal;
                otherUnlocked.forEach(c => c.percentage = Math.round(c.percentage * scale));
            } else if (otherUnlocked.length > 0) {
                const avg = Math.floor(totalToDistribute / otherUnlocked.length);
                otherUnlocked.forEach(c => c.percentage = avg);
            }
        }
        
        let finalTotal = components.reduce((sum, c) => sum + c.percentage, 0);
        let diff = 100 - finalTotal;
        if (diff !== 0) {
            const lastUnlocked = components.slice().reverse().find(c => !c.locked);
            if(lastUnlocked) {
                lastUnlocked.percentage += diff;
            }
        }
    }
    
    function renderSavedRecipes() {
        savedRecipesList.innerHTML = state.savedRecipes.map(receta => `
            <div class="p-3 border rounded-xl flex items-center justify-between">
                <div>
                    <p class="font-semibold">${receta.nombre_receta}</p>
                    <p class="text-xs text-stone-500">${receta.componentes_json.length} componentes</p>
                </div>
                <div class="flex gap-2">
                     <button data-id="${receta.id}" class="load-recipe-btn text-sky-600 hover:text-sky-800 text-xs font-bold px-3 py-1 rounded-full bg-sky-100">Cargar</button>
                    <button data-id="${receta.id}" class="delete-recipe-btn text-red-600 hover:text-red-800 text-xs font-bold px-3 py-1 rounded-full bg-red-100">X</button>
                </div>
            </div>
        `).join('') || `<p class="text-center text-stone-500 py-4">Aún no tienes recetas guardadas.</p>`;
    }

    async function handleSaveRecipe() {
        const name = recipeNameInput.value.trim();
        if (!name) {
            alert("Por favor, dale un nombre a tu receta.");
            return;
        }
        if (state.currentRecipe.components.length === 0) {
            alert("Añade al menos un ingrediente a la formulación.");
            return;
        }

        const recipeData = {
            nombre_receta: name,
            componentes_json: state.currentRecipe.components.map(c => ({
                id: c.id, name: c.name, type: c.type, percentage: c.percentage, locked: c.locked
            })),
            perfil_final_json: calculateFinalProfile(),
            tiempo_conchado: state.currentRecipe.conchingTime
        };
        
        const editId = editIdInput.value;
        try {
            if (editId) {
                await api(`/api/recetas-chocolate/${editId}`, { method: 'PUT', body: JSON.stringify(recipeData) });
                alert("Receta actualizada con éxito!");
            } else {
                await api('/api/recetas-chocolate', { method: 'POST', body: JSON.stringify(recipeData) });
                alert("Receta guardada con éxito!");
            }
            state.savedRecipes = await api('/api/recetas-chocolate');
            renderSavedRecipes();
            resetForm();
        } catch (error) {
            alert(`Error al guardar la receta: ${error.message}`);
        }
    }
    
    function handleSavedRecipeActions(e) {
        const target = e.target.closest('button');
        if (!target) return;
        const id = target.dataset.id;
        
        if (target.classList.contains('delete-recipe-btn')) {
            if (confirm("¿Seguro que quieres eliminar esta receta?")) {
                api(`/api/recetas-chocolate/${id}`, { method: 'DELETE' }).then(() => {
                    state.savedRecipes = state.savedRecipes.filter(r => r.id !== id);
                    renderSavedRecipes();
                });
            }
        } else if (target.classList.contains('load-recipe-btn')) {
            populateFormForEdit(id);
        }
    }
    
    function populateFormForEdit(id) {
        const recipeToLoad = state.savedRecipes.find(r => r.id === id);
        if (recipeToLoad) {
            formTitle.textContent = 'Editar Receta';
            saveRecipeBtn.textContent = 'Actualizar Receta';
            cancelEditBtn.classList.remove('hidden');
            editIdInput.value = recipeToLoad.id;

            state.currentRecipe.components = recipeToLoad.componentes_json.map(comp => {
                let sourceList;
                if (comp.type === 'insumo') sourceList = state.insumos;
                else if (comp.type === 'azucar') sourceList = state.azucares;
                else sourceList = state.cacaoSources;
                
                const profileSource = sourceList.find(s => s.id === comp.id);
                return {
                    ...comp,
                    profile: profileSource.perfil_data || profileSource.perfil_final_json || profileSource.impacto_perfil,
                    locked: comp.locked || false
                };
            }).filter(c => c.profile);
            
            state.currentRecipe.type = 'cacao'; // Asignar el tipo al cargar
            state.currentRecipe.conchingTime = recipeToLoad.tiempo_conchado || 24;
            recipeNameInput.value = recipeToLoad.nombre_receta;
            renderRecipeComponents();
        }
    }
    
    function resetForm() {
        editIdInput.value = '';
        recipeNameInput.value = '';
        state.currentRecipe.components = [];
        state.currentRecipe.type = null;
        state.currentRecipe.conchingTime = 24;
        if(formTitle) formTitle.textContent = 'Crear Nueva Receta';
        if(saveRecipeBtn) saveRecipeBtn.textContent = 'Guardar Receta';
        if(cancelEditBtn) cancelEditBtn.classList.add('hidden');
        renderRecipeComponents();
    }

    init();
});

