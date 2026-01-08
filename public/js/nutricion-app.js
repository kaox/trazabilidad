document.addEventListener('DOMContentLoaded', () => {
    let state = {
        recipes: [],
        currentRecipe: null,
        ingredients: [],
        lang: 'es' // Estado del idioma: 'es' o 'en'
    };

    // Diccionario de Traducción (Mismo que antes)
    const I18N = {
        es: {
            nutritionFacts: "Información Nutricional",
            servingsPerContainer: "porciones por envase",
            servingSize: "Tamaño porción",
            amountPerServing: "Cantidad por porción",
            calories: "Calorías",
            dailyValue: "% Valor Diario*",
            totalFat: "Grasa Total",
            saturatedFat: "Grasa Saturada",
            transFat: "Grasa Trans",
            cholesterol: "Colesterol",
            sodium: "Sodio",
            totalCarb: "Carbohidratos Totales",
            dietaryFiber: "Fibra Dietética",
            totalSugars: "Azúcares Totales",
            includes: "Incluye",
            addedSugars: "Azúcares Añadidos",
            protein: "Proteínas",
            vitaminD: "Vitamina D",
            calcium: "Calcio",
            iron: "Hierro",
            potassium: "Potasio",
            energyValue: "Valor Energético",
            fats: "Grasas",
            ofWhichSaturates: "de las cuales saturadas",
            carbohydrates: "Hidratos de carbono",
            ofWhichSugars: "de los cuales azúcares",
            salt: "Sal",
            per100g: "Por 100g",
            nota: "La % de Valor Diario (VD) indica cuánto contribuye un nutriente en una porción de alimento a una dieta diaria. Se utilizan 2,000 calorías al día para consejos generales de nutrición."
        },
        en: {
            nutritionFacts: "Nutrition Facts",
            servingsPerContainer: "servings per container",
            servingSize: "Serving size",
            amountPerServing: "Amount per serving",
            calories: "Calories",
            dailyValue: "% Daily Value*",
            totalFat: "Total Fat",
            saturatedFat: "Saturated Fat",
            transFat: "Trans Fat",
            cholesterol: "Cholesterol",
            sodium: "Sodium",
            totalCarb: "Total Carbohydrate",
            dietaryFiber: "Dietary Fiber",
            totalSugars: "Total Sugars",
            includes: "Includes",
            addedSugars: "Added Sugars",
            protein: "Protein",
            vitaminD: "Vitamin D",
            calcium: "Calcium",
            iron: "Iron",
            potassium: "Potassium",
            energyValue: "Energy",
            fats: "Fat",
            ofWhichSaturates: "of which saturates",
            carbohydrates: "Carbohydrate",
            ofWhichSugars: "of which sugars",
            salt: "Salt",
            per100g: "Per 100g",
            nota: "* The % Daily Value (DV) tells you how much a nutrient in a serving of food contributes to a daily diet. 2,000 calories a day is used for general nutrition advice."
        }
    };

    // DOM Elements
    const recipeSelect = document.getElementById('recipe-select');
    const usdaSearchInput = document.getElementById('usda-search'); 
    const searchBtn = document.getElementById('search-btn');
    const resultsList = document.getElementById('usda-results');
    const resultsContainer = document.getElementById('search-results-container');
    const ingredientsList = document.getElementById('ingredients-list');
    const totalWeightEl = document.getElementById('total-weight');
    const labelToggles = document.querySelectorAll('.label-toggle');
    const createRecipeBtn = document.getElementById('create-recipe-btn');
    const deleteRecipeBtn = document.getElementById('delete-recipe-btn');
    const editRecipeBtn = document.getElementById('edit-recipe-btn');
    const updateRecipeBtn = document.getElementById('update-recipe-btn');
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    const recipeActions = document.getElementById('recipe-actions');
    
    const portionInput = document.getElementById('portion-size');
    const servingsInput = document.getElementById('servings-count');
    const saveRecipeChangesBtn = document.getElementById('save-recipe-changes-btn');

    init();

    async function init() {
        await loadRecipes();
        setupEventListeners();
    }

    function setupEventListeners() {
        recipeSelect.addEventListener('change', (e) => loadRecipeDetails(e.target.value));

        createRecipeBtn.addEventListener('click', async () => {
            const name = document.getElementById('new-recipe-name').value;
            if (!name) return;
            const btn = document.getElementById('create-recipe-btn');
            const originalText = btn.innerText;
            btn.innerText = '...'; btn.disabled = true;
            try {
                const res = await api('/api/nutricion/recetas', { method: 'POST', body: JSON.stringify({ nombre: name }) });
                document.getElementById('new-recipe-modal').close();
                await loadRecipes();
                recipeSelect.value = res.id;
                loadRecipeDetails(res.id);
            } catch (e) { alert(e.message); }
            finally { btn.innerText = originalText; btn.disabled = false; }
        });
        
        editRecipeBtn.addEventListener('click', () => {
            if(!state.currentRecipe) return;
            document.getElementById('edit-recipe-name').value = state.currentRecipe.nombre;
            document.getElementById('edit-recipe-modal').showModal();
        });

        updateRecipeBtn.addEventListener('click', async () => {
            const newName = document.getElementById('edit-recipe-name').value;
            if (!newName) return;
            try {
                await api(`/api/nutricion/recetas/${state.currentRecipe.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        nombre: newName,
                        peso_porcion_gramos: state.currentRecipe.peso_porcion_gramos,
                        porciones_envase: state.currentRecipe.porciones_envase
                    })
                });
                document.getElementById('edit-recipe-modal').close();
                await loadRecipes();
                recipeSelect.value = state.currentRecipe.id;
            } catch(e) { alert(e.message); }
        });

        deleteRecipeBtn.addEventListener('click', async () => {
            if(!confirm("¿Eliminar esta receta permanentemente?")) return;
            try {
                await api(`/api/nutricion/recetas/${state.currentRecipe.id}`, { method: 'DELETE' });
                state.currentRecipe = null;
                await loadRecipes();
                document.getElementById('recipe-details').classList.add('hidden');
                recipeActions.style.opacity = '0';
            } catch(e) { alert(e.message); }
        });

        saveRecipeChangesBtn.addEventListener('click', async () => {
            const btn = saveRecipeChangesBtn;
            btn.innerText = 'Guardando...'; btn.disabled = true;
            try {
                 await api(`/api/nutricion/recetas/${state.currentRecipe.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        nombre: state.currentRecipe.nombre,
                        peso_porcion_gramos: portionInput.value,
                        porciones_envase: servingsInput.value
                    })
                });
                state.currentRecipe.peso_porcion_gramos = portionInput.value;
                state.currentRecipe.porciones_envase = servingsInput.value;
                btn.classList.add('hidden');
                calculateNutrition();
            } catch(e) { alert("Error guardando cambios"); }
            finally { btn.innerText = 'Guardar Cambios de Configuración'; btn.disabled = false; }
        });

        [portionInput, servingsInput].forEach(input => {
            input.addEventListener('input', () => {
                saveRecipeChangesBtn.classList.remove('hidden');
                calculateNutrition();
            });
        });

        searchBtn.addEventListener('click', searchIngredients);
        usdaSearchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') searchIngredients(); });

        labelToggles.forEach(btn => {
            btn.addEventListener('click', () => {
                labelToggles.forEach(b => {
                    b.classList.remove('bg-white', 'shadow-sm', 'text-amber-900');
                    b.classList.add('text-slate-500');
                });
                btn.classList.remove('text-slate-500');
                btn.classList.add('bg-white', 'shadow-sm', 'text-amber-900');
                document.querySelectorAll('.label-view').forEach(div => div.classList.add('hidden'));
                document.getElementById(`label-${btn.dataset.type}`).classList.remove('hidden');
            });
        });

        langToggleBtn.addEventListener('click', () => {
            state.lang = state.lang === 'es' ? 'en' : 'es';
            const btnSpan = langToggleBtn.querySelector('span');
            btnSpan.innerText = state.lang.toUpperCase();
            calculateNutrition(); 
        });

        document.getElementById('download-png').addEventListener('click', () => downloadImage());
        document.getElementById('download-pdf').addEventListener('click', () => downloadPDF());
    }

    async function loadRecipes() {
        try {
            state.recipes = await api('/api/nutricion/recetas');
            recipeSelect.innerHTML = '<option value="">Selecciona una receta...</option>' + 
                state.recipes.map(r => `<option value="${r.id}">${r.nombre}</option>`).join('');
        } catch (e) { console.error(e); }
    }

    function loadRecipeDetails(id) {
        const recipe = state.recipes.find(r => r.id == id);
        if (!recipe) {
            state.currentRecipe = null;
            state.ingredients = [];
            document.getElementById('recipe-details').classList.add('hidden');
            recipeActions.style.opacity = '0';
            renderIngredients();
            return;
        }

        state.currentRecipe = recipe;
        state.ingredients = recipe.ingredientes || [];
        
        document.getElementById('recipe-details').classList.remove('hidden');
        recipeActions.style.opacity = '1';
        
        portionInput.value = recipe.peso_porcion_gramos || 100;
        servingsInput.value = recipe.porciones_envase || 1;
        saveRecipeChangesBtn.classList.add('hidden');
        
        renderIngredients();
        calculateNutrition();
    }

    async function searchIngredients() {
        const query = usdaSearchInput.value;
        if (!query) return;
        
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        resultsContainer.classList.remove('hidden');

        try {
            // CAMBIO: Apuntar a proxy USDA
            const data = await api(`/api/proxy/usda/search?query=${encodeURIComponent(query)}`);
            // USDA devuelve array 'foods'
            renderSearchResults(data.foods || []);
        } catch (e) { 
            console.error(e); 
            resultsList.innerHTML = '<li class="p-2 text-red-500 text-xs text-center">Error de conexión con USDA</li>';
        } finally { 
            searchBtn.disabled = false; 
            searchBtn.innerHTML = 'Buscar'; 
        }
    }

    function renderSearchResults(foods) {
        if (foods.length === 0) {
            resultsList.innerHTML = '<li class="p-2 text-slate-400 text-center text-xs italic">No se encontraron resultados.</li>';
            return;
        }

        resultsList.innerHTML = foods.map(food => {
            // USDA no siempre tiene imagenes fáciles, usamos placeholder
            const imgSrc = 'https://placehold.co/40x40?text=USDA';
            const icon = '<i class="fas fa-leaf text-green-600 mr-1" title="USDA Data"></i>';
            
            return `
            <li class="flex justify-between items-center p-2 hover:bg-slate-50 transition cursor-pointer group">
                <div class="flex items-center gap-3 overflow-hidden">
                    <img src="${imgSrc}" class="w-8 h-8 rounded object-cover border border-slate-100 flex-shrink-0">
                    <span class="truncate text-xs font-medium text-slate-700" title="${food.description}">
                        ${icon} ${food.description || 'Sin nombre'}
                    </span>
                </div>
                <button class="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-2 py-1 rounded add-ing-btn shadow-sm transition transform active:scale-95 flex-shrink-0" 
                    data-id="${food.fdcId}" 
                    data-name="${food.description || 'Ingrediente'}"
                    data-source="usda">
                    <i class="fas fa-plus"></i>
                </button>
            </li>
        `}).join('');

        document.querySelectorAll('.add-ing-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const originalContent = btn.innerHTML;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
                btn.disabled = true;
                // Pasamos 'usda' como source explícito
                await addIngredientToRecipe(btn.dataset.id, btn.dataset.name, 'usda');
                btn.innerHTML = originalContent;
            });
        });
    }

    async function addIngredientToRecipe(id, name, source) {
        if (!state.currentRecipe) return alert("Selecciona una receta primero");
        try {
            // 1. Obtener detalles desde USDA Proxy
            const details = await api(`/api/proxy/usda/food/${id}`);
            const nutrients = details.foodNutrients || [];

            // Helper para buscar nutriente por ID (USDA Nutrient Number)
            const getVal = (num) => {
                // Algunos endpoints devuelven nutrientNumber como string, otros como propiedad anidada
                const n = nutrients.find(x => x.nutrientNumber === num || x.nutrient?.number === num);
                return n ? n.amount : 0;
            };

            // Mapeo USDA Nutrient IDs
            const nutrientsBase = {
                energy: getVal('208') || getVal('1008'), // kcal
                protein: getVal('203'),
                fat: getVal('204'),
                carb: getVal('205'),
                fiber: getVal('291'),
                sugar: getVal('269'),
                addedSugar: 0, // Difícil de obtener consistentemente en USDA standard
                sodium: getVal('307'), // mg
                satFat: getVal('606'),
                transFat: getVal('605'),
                chol: getVal('601'), // mg
                vitD: getVal('328'), // ug
                calcium: getVal('301'), // mg
                iron: getVal('303'), // mg
                potassium: getVal('306') // mg
            };

            // 2. Guardar en Backend
            const res = await api(`/api/nutricion/recetas/${state.currentRecipe.id}/ingredientes`, {
                method: 'POST',
                body: JSON.stringify({ 
                    usda_id: id, 
                    nombre: name, 
                    peso_gramos: 100, 
                    nutrientes_base_json: nutrientsBase,
                    source: source
                })
            });

            state.ingredients.push({ id: res.id, nombre: name, peso_gramos: 100, nutrientes_base_json: nutrientsBase });
            renderIngredients();
            calculateNutrition();
            resultsContainer.classList.add('hidden');
            usdaSearchInput.value = '';
        } catch (e) { 
            console.error(e);
            alert("Error agregando ingrediente USDA."); 
        }
    }

    function renderIngredients() {
        const totalWeight = state.ingredients.reduce((sum, i) => sum + parseFloat(i.peso_gramos || 0), 0);

        if (state.ingredients.length === 0) {
            ingredientsList.innerHTML = `
                <div class="flex flex-col items-center justify-center py-10 text-slate-300">
                    <i class="fas fa-basket-shopping text-3xl mb-2 opacity-50"></i>
                    <p class="text-sm font-medium">Tu receta está vacía.</p>
                </div>
            `;
            return;
        }

        ingredientsList.innerHTML = state.ingredients.map(ing => {
            const weight = parseFloat(ing.peso_gramos || 0);
            const percentage = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0.0';

            return `
            <div class="group bg-white p-3 rounded-xl border border-slate-100 hover:border-slate-300 transition shadow-sm mb-2">
                <div class="flex justify-between items-center mb-1">
                    <span class="text-sm font-semibold text-slate-700 truncate w-2/3" title="${ing.nombre}">${ing.nombre}</span>
                    <button class="text-slate-300 hover:text-red-500 delete-ing-btn transition" data-id="${ing.id}"><i class="fas fa-trash-alt"></i></button>
                </div>
                <div class="flex items-center gap-3">
                    <div class="flex-grow h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div class="h-full bg-amber-400 rounded-full" style="width: ${percentage}%"></div>
                    </div>
                    <span class="text-xs text-amber-700 font-semibold min-w-[35px] text-right">${percentage}%</span>
                    <div class="flex items-center gap-1">
                        <input type="number" value="${ing.peso_gramos}" class="w-16 p-1 border border-slate-200 rounded text-right text-xs font-mono font-bold text-slate-800 focus:ring-1 focus:ring-amber-500 outline-none ingredient-weight" data-id="${ing.id}">
                        <span class="text-xs text-slate-400">g</span>
                    </div>
                </div>
            </div>
        `}).join('');

        // Listeners de cambio de peso
        document.querySelectorAll('.ingredient-weight').forEach(input => {
            input.addEventListener('change', async (e) => {
                const id = e.target.dataset.id;
                const newWeight = parseFloat(e.target.value) || 0;
                await api(`/api/nutricion/ingredientes/${id}`, { method: 'PUT', body: JSON.stringify({ peso_gramos: newWeight }) });
                const ing = state.ingredients.find(i => i.id == id);
                if(ing) ing.peso_gramos = newWeight;
                renderIngredients(); // Re-renderizar para actualizar porcentajes de todos
                calculateNutrition();
            });
        });

        // FIX: Listener borrar corregido para usar currentTarget
        document.querySelectorAll('.delete-ing-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.currentTarget.dataset.id; // Corrección aquí
                await api(`/api/nutricion/ingredientes/${id}`, { method: 'DELETE' });
                state.ingredients = state.ingredients.filter(i => i.id != id);
                renderIngredients();
                calculateNutrition();
            });
        });
    }

    function calculateNutrition() {
        const totalWeight = state.ingredients.reduce((sum, i) => sum + parseFloat(i.peso_gramos), 0);
        totalWeightEl.innerText = totalWeight.toFixed(1) + 'g';
        
        let totals = { energy:0, protein:0, fat:0, satFat:0, transFat:0, chol:0, sod:0, carb:0, fiber:0, sugar:0, addedSugar:0, vitD:0, calcium:0, iron:0, pot:0 };
        state.ingredients.forEach(ing => {
            const factor = parseFloat(ing.peso_gramos) / 100;
            const n = ing.nutrientes_base_json;
            totals.energy += (n.energy || 0) * factor;
            totals.protein += (n.protein || 0) * factor;
            totals.fat += (n.fat || 0) * factor;
            totals.satFat += (n.satFat || 0) * factor;
            totals.transFat += (n.transFat || 0) * factor;
            totals.chol += (n.chol || 0) * factor;
            totals.sod += (n.sodium || 0) * factor;
            totals.carb += (n.carb || 0) * factor;
            totals.fiber += (n.fiber || 0) * factor;
            totals.sugar += (n.sugar || 0) * factor;
            totals.addedSugar += (n.addedSugar || 0) * factor;
            totals.vitD += (n.vitD || 0) * factor;
            totals.calcium += (n.calcium || 0) * factor;
            totals.iron += (n.iron || 0) * factor;
            totals.pot += (n.potassium || 0) * factor;
        });

        const portionSize = parseFloat(portionInput.value) || 100;
        const servingsPerContainer = parseFloat(servingsInput.value) || 1;
        
        const perServing = {};
        for(let key in totals) perServing[key] = totalWeight > 0 ? (totals[key] / totalWeight) * portionSize : 0;
        renderFDA(perServing, servingsPerContainer, portionSize);

        const per100g = {};
        for(let key in totals) per100g[key] = totalWeight > 0 ? (totals[key] / totalWeight) * 100 : 0;
        renderEU(per100g);
        renderOPS(per100g);
        renderNutriScore(per100g);
    }

    // --- NUEVO: RENDER NUTRI-SCORE ---
    function renderNutriScore(val) {
        // 1. Cálculo de Puntos (Algoritmo Simplificado FSAm-NPS)
        // Energía (kJ)
        const kj = val.energy * 4.184;
        const getPoints = (v, arr) => {
            for(let i = arr.length - 1; i >= 0; i--) if(v > arr[i]) return i + 1;
            return 0;
        };
        
        const pEnergy = getPoints(kj, [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]); // 0-10
        const pSugar = getPoints(val.sugar, [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45]); // 0-10
        const pSatFat = getPoints(val.satFat, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); // 0-10
        const pSodium = getPoints(val.sod, [90, 180, 270, 360, 450, 540, 630, 720, 810, 900]); // 0-10
        
        const N = pEnergy + pSugar + pSatFat + pSodium;
        
        const pFiber = getPoints(val.fiber, [0.9, 1.9, 2.8, 3.7, 4.7]); // 0-5
        const pProtein = getPoints(val.protein, [1.6, 3.2, 4.8, 6.4, 8.0]); // 0-5
        
        let score = N - (pFiber + pProtein); // Simplificación (asumiendo sólido general)
        
        // 2. Clasificación (A-E)
        let grade = 'A';
        let color = '#038141'; // Dark Green
        if (score >= -1 && score <= 2) { grade = 'B'; color = '#85BB2F'; }
        else if (score >= 3 && score <= 10) { grade = 'C'; color = '#FECB02'; }
        else if (score >= 11 && score <= 18) { grade = 'D'; color = '#EE8100'; }
        else if (score > 18) { grade = 'E'; color = '#E63E11'; }

        // 3. Render Visual (HTML)
        const container = document.getElementById('nutriscore-display');
        if (!container) return;

        // Estilos para las cajas
        const boxes = [
            { l: 'A', c: '#038141' },
            { l: 'B', c: '#85BB2F' },
            { l: 'C', c: '#FECB02' },
            { l: 'D', c: '#EE8100' },
            { l: 'E', c: '#E63E11' }
        ];

        const html = boxes.map(box => {
            const isActive = box.l === grade;
            // Escala grande si es activo, pequeña y opaca si no
            const scaleClass = isActive ? 'scale-125 z-10 shadow-lg opacity-100 font-black' : 'scale-90 opacity-40 font-bold grayscale-[50%]';
            
            return `
                <div class="flex flex-col items-center justify-center transition-all duration-500 transform ${scaleClass}" 
                     style="background-color: ${box.c}; width: 60px; height: 70px; border-radius: 8px; color: white;">
                    <span class="text-3xl leading-none">${box.l}</span>
                </div>
            `;
        }).join('');

        container.innerHTML = `<div class="flex gap-2 justify-center items-center h-24">${html}</div>`;
    }

    function renderFDA(val, servings, portion) {
        const text = I18N[state.lang];
        const fdaEl = document.getElementById('label-fda');
        
        // Helper para calcular % DV
        const getPct = (v, k) => {
            const dvMap = { fat:78, satFat:20, chol:300, sod:2300, carb:275, fiber:28, addedSugar:50, vitD:20, calcium:1300, iron:18, pot:4700 };
            return Math.round((v / dvMap[k]) * 100) + '%';
        };

        const fdaHTML = `
            <h1 class="border-b-1 pb-1">${text.nutritionFacts}</h1>
            <div class="border-b-8 pb-1 mb-2">
                <p class="text-base font-bold mb-1"> ${servings} ${text.servingsPerContainer}</p>
                <div class="flex justify-between items-end font-bold text-lg border-t-4 border-black pt-1">
                    <span>${text.servingSize}</span>
                    <span>${portion}g</span>
                </div>
            </div>
            <div class="border-b-4 pb-2 mb-2">
                <p class="text-xs font-bold">${text.amountPerServing}</p>
                <div class="flex justify-between items-end">
                    <span class="text-3xl font-black">${text.calories}</span>
                    <span class="text-5xl font-black">${Math.round(val.energy)}</span>
                </div>
            </div>
            <div class="text-right text-sm font-bold border-b-1 pb-1 mb-1">${text.dailyValue}</div>
            
            <div class="text-sm">
                 <div class="border-b-1 pb-1 mb-1 flex justify-between">
                    <span><span class="font-bold">${text.totalFat}</span> ${Math.round(val.fat)}g</span>
                    <span class="font-bold">${getPct(val.fat, 'fat')}</span>
                </div>
                <div class="border-b-1 pb-1 mb-1 pl-4 flex justify-between">
                    <span>${text.saturatedFat} ${Math.round(val.satFat)}g</span>
                    <span class="font-bold">${getPct(val.satFat, 'satFat')}</span>
                </div>
                 <div class="border-b-1 pb-1 mb-1 pl-4 flex justify-between">
                    <span>${text.transFat} ${val.transFat.toFixed(1)}g</span>
                </div>
                <div class="border-b-1 pb-1 mb-1 flex justify-between">
                    <span><span class="font-bold">${text.cholesterol}</span> ${Math.round(val.chol)}mg</span>
                    <span class="font-bold">${getPct(val.chol, 'chol')}</span>
                </div>
                <div class="border-b-1 pb-1 mb-1 flex justify-between">
                    <span><span class="font-bold">${text.sodium}</span> ${Math.round(val.sod)}mg</span>
                    <span class="font-bold">${getPct(val.sod, 'sod')}</span>
                </div>
                <div class="border-b-1 pb-1 mb-1 flex justify-between">
                    <span><span class="font-bold">${text.totalCarb}</span> ${Math.round(val.carb)}g</span>
                    <span class="font-bold">${getPct(val.carb, 'carb')}</span>
                </div>
                 <div class="border-b-1 pb-1 mb-1 pl-4 flex justify-between">
                    <span>${text.dietaryFiber} ${Math.round(val.fiber)}g</span>
                    <span class="font-bold">${getPct(val.fiber, 'fiber')}</span>
                </div>
                <div class="border-b-1 pb-1 mb-1 pl-4 flex justify-between">
                    <span>${text.totalSugars} ${Math.round(val.sugar)}g</span>
                </div>
                <div class="border-b-8 pb-1 mb-2 pl-4 flex justify-between">
                    <span>${text.includes} ${Math.round(val.addedSugar)}g ${text.addedSugars}</span>
                    <span class="font-bold">${getPct(val.addedSugar, 'addedSugar')}</span>
                </div>
                <div class="border-b-8 pb-1 mb-2 flex justify-between items-end">
                    <span class="font-bold">${text.protein} <span class="font-normal">${Math.round(val.protein)}g</span></span>
                </div>
                
                <div class="border-b-1 py-1 flex justify-between"><span>${text.vitaminD} ${Math.round(val.vitD)}mcg</span> <span>${getPct(val.vitD, 'vitD')}</span></div>
                <div class="border-b-1 py-1 flex justify-between"><span>${text.calcium} ${Math.round(val.calcium)}mg</span> <span>${getPct(val.calcium, 'calcium')}</span></div>
                <div class="border-b-1 py-1 flex justify-between"><span>${text.iron} ${Math.round(val.iron)}mg</span> <span>${getPct(val.iron, 'iron')}</span></div>
                <div class="py-1 flex justify-between"><span>${text.potassium} ${Math.round(val.pot)}mg</span> <span>${getPct(val.pot, 'pot')}</span></div>
            </div>
            <div class="border-t-4 border-black mt-2 pt-1 text-[10px] leading-tight">
                ${text.nota}
            </div>
        `;
        
        fdaEl.innerHTML = fdaHTML;
    }

    function renderEU(val) {
        const text = I18N[state.lang];
        const kj = Math.round(val.energy * 4.184);
        const kcal = Math.round(val.energy);
        const salt = (val.sod * 2.5) / 1000;

        const euHTML = `
            <h3 class="font-bold mb-2">${text.nutritionFacts}</h3>
            <div class="flex justify-between text-sm border-b border-black py-1">
                <span>${text.per100g}</span>
            </div>
            <div class="flex justify-between py-1 border-b border-gray-300">
                <strong>${text.energyValue}</strong>
                <span>${kj} kJ / ${kcal} kcal</span>
            </div>
            <div class="flex justify-between py-1 border-b border-gray-300">
                <strong>${text.fats}</strong>
                <span>${val.fat.toFixed(1)} g</span>
            </div>
             <div class="flex justify-between py-1 border-b border-gray-300 pl-4 text-sm">
                ${text.ofWhichSaturates}
                <span>${val.satFat.toFixed(1)} g</span>
            </div>
             <div class="flex justify-between py-1 border-b border-gray-300">
                <strong>${text.carbohydrates}</strong>
                <span>${val.carb.toFixed(1)} g</span>
            </div>
            <div class="flex justify-between py-1 border-b border-gray-300 pl-4 text-sm">
                ${text.ofWhichSugars}
                <span>${val.sugar.toFixed(1)} g</span>
            </div>
             <div class="flex justify-between py-1 border-b border-gray-300">
                <strong>${text.protein}</strong>
                <span>${val.protein.toFixed(1)} g</span>
            </div>
             <div class="flex justify-between py-1 border-b-2 border-black">
                <strong>${text.salt}</strong>
                <span>${salt.toFixed(2)} g</span>
            </div>
        `;
        document.getElementById('label-eu').innerHTML = euHTML;
    }

    function renderOPS(val) {
        const showOct = (id, show) => {
            const el = document.getElementById(id);
            if (show) el.classList.remove('hidden');
            else el.classList.add('hidden');
            return show;
        };

        let hasWarnings = false;
        if (showOct('oct-cal', val.energy > 275)) hasWarnings = true;
        if (showOct('oct-sugar', val.sugar > 10)) hasWarnings = true;
        if (showOct('oct-sat', val.satFat > 4)) hasWarnings = true;
        if (showOct('oct-sodium', val.sod > 400)) hasWarnings = true;

        const noWarn = document.getElementById('no-warnings');
        if (hasWarnings) noWarn.classList.add('hidden');
        else noWarn.classList.remove('hidden');
    }

    // --- UTILS ---
    function getActiveLabelElement() {
        if (!document.getElementById('label-fda').classList.contains('hidden')) return document.getElementById('label-fda');
        if (!document.getElementById('label-eu').classList.contains('hidden')) return document.getElementById('label-eu');
        if (!document.getElementById('label-ops').classList.contains('hidden')) return document.getElementById('label-ops');
        if (!document.getElementById('label-ns').classList.contains('hidden')) return document.getElementById('label-ns');
        return document.getElementById('label-canvas-container'); // Fallback
    }
    
    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        const res = await fetch(url, options);
        if(!res.ok) throw new Error("Error API");
        if (res.status === 204) return null;
        return res.json();
    }

    async function downloadImage() {
        const element = getActiveLabelElement();
        
        // Configuración para alta calidad (Impresión)
        const canvas = await html2canvas(element, {
            scale: 4, // Mayor escala para impresión (aprox 300 DPI)
            useCORS: true,
            backgroundColor: '#ffffff', // Asegurar fondo blanco
            logging: false,
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById(element.id);
                if(clonedEl) {
                   clonedEl.style.margin = '0'; 
                   clonedEl.style.transform = 'none'; 
                }
            }
        });

        const link = document.createElement('a');
        link.download = `etiqueta_${state.currentRecipe?.nombre || 'nutricional'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    async function downloadPDF() {
        const element = getActiveLabelElement();
        
        // Generar canvas de alta resolución
        const canvas = await html2canvas(element, {
            scale: 4, 
            useCORS: true,
            backgroundColor: '#ffffff',
            onclone: (clonedDoc) => {
                const clonedEl = clonedDoc.getElementById(element.id);
                if(clonedEl) {
                   clonedEl.style.transform = 'none'; 
                }
            }
        });

        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        
        // Crear PDF A4
        const pdf = new jsPDF('p', 'mm', 'a4');
        
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(imgData);
        
        // Calcular dimensiones para ajustar al ancho de página con margen
        const margin = 10;
        const availableWidth = pdfWidth - (margin * 2);
        const imgHeight = (imgProps.height * availableWidth) / imgProps.width;
        
        let finalWidth = availableWidth;
        let finalHeight = imgHeight;
        
        // Si es muy alto, ajustar por alto
        if (finalHeight > (pdfHeight - margin * 2)) {
             finalHeight = pdfHeight - (margin * 2);
             finalWidth = (imgProps.width * finalHeight) / imgProps.height;
        }

        const x = (pdfWidth - finalWidth) / 2;
        const y = margin; 

        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);
        pdf.save(`etiqueta_${state.currentRecipe?.nombre || 'nutricional'}.pdf`);
    }
});