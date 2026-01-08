document.addEventListener('DOMContentLoaded', () => {
    let state = {
        recipes: [],
        currentRecipe: null,
        ingredients: [],
        lang: 'es' // Estado del idioma: 'es' o 'en'
    };

    // Diccionario de Traducción
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
            per100g: "Por 100g"
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
            per100g: "Per 100g"
        }
    };

    // DOM Elements
    const recipeSelect = document.getElementById('recipe-select');
    const usdaSearchInput = document.getElementById('usda-search'); // Nota: Aunque se llame usda en HTML, ahora busca en OFF
    const searchBtn = document.getElementById('search-btn');
    const resultsList = document.getElementById('usda-results');
    const ingredientsList = document.getElementById('ingredients-list');
    const totalWeightEl = document.getElementById('total-weight');
    const labelToggles = document.querySelectorAll('.label-toggle');
    const createRecipeBtn = document.getElementById('create-recipe-btn');
    const deleteRecipeBtn = document.getElementById('delete-recipe-btn');
    const editRecipeBtn = document.getElementById('edit-recipe-btn');
    const updateRecipeBtn = document.getElementById('update-recipe-btn');
    const langToggleBtn = document.getElementById('lang-toggle-btn');
    
    const portionInput = document.getElementById('portion-size');
    const servingsInput = document.getElementById('servings-count');
    const saveRecipeChangesBtn = document.getElementById('save-recipe-changes-btn');

    // Inicializar
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
            try {
                const res = await api('/api/nutricion/recetas', {
                    method: 'POST',
                    body: JSON.stringify({ nombre: name })
                });
                document.getElementById('new-recipe-modal').close();
                await loadRecipes();
                recipeSelect.value = res.id;
                loadRecipeDetails(res.id);
            } catch (e) { alert(e.message); }
        });
        
        // CRUD Receta: Editar Nombre
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
                recipeSelect.value = state.currentRecipe.id; // Mantener selección
            } catch(e) { alert(e.message); }
        });

        // CRUD Receta: Eliminar
        deleteRecipeBtn.addEventListener('click', async () => {
            if(!confirm("¿Eliminar esta receta?")) return;
            try {
                await api(`/api/nutricion/recetas/${state.currentRecipe.id}`, { method: 'DELETE' });
                state.currentRecipe = null;
                await loadRecipes();
                document.getElementById('recipe-details').classList.add('hidden');
                editRecipeBtn.classList.add('hidden');
                deleteRecipeBtn.classList.add('hidden');
            } catch(e) { alert(e.message); }
        });

        // Actualizar detalles (porción)
        saveRecipeChangesBtn.addEventListener('click', async () => {
            try {
                 await api(`/api/nutricion/recetas/${state.currentRecipe.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        nombre: state.currentRecipe.nombre, // Mantener nombre
                        peso_porcion_gramos: portionInput.value,
                        porciones_envase: servingsInput.value
                    })
                });
                state.currentRecipe.peso_porcion_gramos = portionInput.value;
                state.currentRecipe.porciones_envase = servingsInput.value;
                saveRecipeChangesBtn.classList.add('hidden'); // Feedback visual
                calculateNutrition();
            } catch(e) { alert("Error guardando cambios"); }
        });

        // Detectar cambios en inputs para mostrar botón guardar
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
                    b.classList.add('text-stone-500');
                });
                btn.classList.remove('text-stone-500');
                btn.classList.add('bg-white', 'shadow-sm', 'text-amber-900');
                document.querySelectorAll('.label-view').forEach(div => div.classList.add('hidden'));
                document.getElementById(`label-${btn.dataset.type}`).classList.remove('hidden');
            });
        });

        // Toggle Idioma
        langToggleBtn.addEventListener('click', () => {
            state.lang = state.lang === 'es' ? 'en' : 'es';
            const btnSpan = langToggleBtn.querySelector('span');
            btnSpan.innerText = state.lang.toUpperCase();
            
            // Re-renderizar etiquetas con el nuevo idioma
            calculateNutrition(); 
        });

        document.getElementById('download-png').addEventListener('click', () => downloadImage());
        document.getElementById('download-pdf').addEventListener('click', () => downloadPDF());
    }

    // --- LÓGICA DE DATOS ---

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
            editRecipeBtn.classList.add('hidden');
            deleteRecipeBtn.classList.add('hidden');
            renderIngredients();
            return;
        }

        state.currentRecipe = recipe;
        state.ingredients = recipe.ingredientes || [];
        
        document.getElementById('recipe-details').classList.remove('hidden');
        editRecipeBtn.classList.remove('hidden');
        deleteRecipeBtn.classList.remove('hidden');
        
        portionInput.value = recipe.peso_porcion_gramos || 100;
        servingsInput.value = recipe.porciones_envase || 1;
        saveRecipeChangesBtn.classList.add('hidden'); // Resetear botón guardar
        
        renderIngredients();
        calculateNutrition();
    }

    // --- BUSCADOR OPEN FOOD FACTS ---
    async function searchIngredients() {
        const query = usdaSearchInput.value;
        if (!query) return;
        searchBtn.disabled = true;
        searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            // Cambio de endpoint: Ahora apunta al proxy de Open Food Facts
            const data = await api(`/api/proxy/off/search?query=${query}`);
            renderSearchResults(data.products || []); // OFF devuelve { count: ..., products: [] }
        } catch (e) { alert('Error buscando en Open Food Facts'); } 
        finally { searchBtn.disabled = false; searchBtn.innerHTML = '<i class="fas fa-search"></i>'; }
    }

    function renderSearchResults(foods) {
        resultsList.innerHTML = foods.map(food => `
            <li class="flex justify-between items-center bg-stone-50 p-2 rounded hover:bg-stone-100">
                <span class="truncate w-3/4" title="${food.product_name}">${food.product_name || 'Sin nombre'}</span>
                <!-- OFF usa _id o code para el código de barras -->
                <button class="text-xs bg-green-600 text-white px-2 py-1 rounded add-ing-btn" data-barcode="${food._id}" data-name="${food.product_name}">Agregar</button>
            </li>
        `).join('');
        document.querySelectorAll('.add-ing-btn').forEach(btn => {
            btn.addEventListener('click', async () => await addIngredientToRecipe(btn.dataset.barcode, btn.dataset.name));
        });
    }

    async function addIngredientToRecipe(barcode, name) {
        if (!state.currentRecipe) return alert("Selecciona una receta primero");
        try {
            // Llamada al proxy de OFF para detalles del producto
            const data = await api(`/api/proxy/off/product/${barcode}`);
            const product = data.product;
            const nutriments = product.nutriments;

            // Helper seguro para obtener valores nutricionales (fallback a 0)
            const getVal = (key) => {
                const val = parseFloat(nutriments[key]);
                return isNaN(val) ? 0 : val;
            };

            // Mapeo de campos OFF a nuestra estructura interna
            const nutrientsBase = {
                energy: getVal('energy-kcal_100g'), // OFF suele tener energy-kcal_100g
                protein: getVal('proteins_100g'),
                fat: getVal('fat_100g'),
                carb: getVal('carbohydrates_100g'),
                fiber: getVal('fiber_100g'),
                sugar: getVal('sugars_100g'),
                addedSugar: 0, // OFF no siempre tiene azúcares añadidos fiables, default 0 o intentar parsing
                sodium: getVal('sodium_100g') * 1000, // Convertir g a mg si OFF da g? OFF sodium_100g suele ser gramos.
                // Corrección: OFF sodium_100g es en GRAMOS. App espera MG para sodio.
                // Pero verifiquemos. USDA sodium es mg. OFF sodium_100g suele ser gramos (ej 0.4g). 
                // Multiplicamos por 1000.
                
                satFat: getVal('saturated-fat_100g'),
                transFat: getVal('trans-fat_100g'),
                chol: getVal('cholesterol_100g') * 1000, // OFF g -> mg
                
                vitD: getVal('vitamin-d_100g') * 1000000, // OFF g -> mcg (µg)
                calcium: getVal('calcium_100g') * 1000, // OFF g -> mg
                iron: getVal('iron_100g') * 1000, // OFF g -> mg
                potassium: getVal('potassium_100g') * 1000 // OFF g -> mg
            };

            // Corrección específica para Sodio si OFF lo da muy bajo (a veces es unidad incorrecta en user input)
            // Asumimos OFF standard que es gramos.
            // Si sodium es 0, intentar calcular desde sal: salt / 2.5
            if (nutrientsBase.sodium === 0 && getVal('salt_100g') > 0) {
                nutrientsBase.sodium = (getVal('salt_100g') / 2.5) * 1000;
            }

            const res = await api(`/api/nutricion/recetas/${state.currentRecipe.id}/ingredientes`, {
                method: 'POST',
                body: JSON.stringify({ usda_id: barcode, nombre: name, peso_gramos: 100, nutrientes_base_json: nutrientsBase })
            });

            state.ingredients.push({ id: res.id, nombre: name, peso_gramos: 100, nutrientes_base_json: nutrientsBase });
            renderIngredients();
            calculateNutrition();
        } catch (e) { 
            console.error(e);
            alert("Error agregando ingrediente de Open Food Facts."); 
        }
    }

    function renderIngredients() {
        // Calcular peso total para porcentajes
        const totalWeight = state.ingredients.reduce((sum, i) => sum + parseFloat(i.peso_gramos || 0), 0);

        ingredientsList.innerHTML = state.ingredients.map(ing => {
            const weight = parseFloat(ing.peso_gramos || 0);
            // Calcular porcentaje (evitar división por cero)
            const percentage = totalWeight > 0 ? ((weight / totalWeight) * 100).toFixed(1) : '0.0';

            return `
            <div class="flex justify-between items-center bg-stone-50 p-3 rounded border border-stone-100">
                <div class="flex flex-col w-1/2 overflow-hidden">
                    <span class="text-sm font-medium truncate" title="${ing.nombre}">${ing.nombre}</span>
                    <span class="text-xs text-amber-700 font-semibold">${percentage}%</span>
                </div>
                <div class="flex items-center gap-2">
                    <input type="number" value="${ing.peso_gramos}" class="w-20 p-1 border rounded text-right text-sm ingredient-weight" data-id="${ing.id}">
                    <span class="text-xs text-stone-500">g</span>
                    <button class="text-red-500 hover:text-red-700 delete-ing-btn" data-id="${ing.id}">&times;</button>
                </div>
            </div>
        `}).join('');

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

        document.querySelectorAll('.delete-ing-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = e.target.dataset.id;
                await api(`/api/nutricion/ingredientes/${id}`, { method: 'DELETE' });
                state.ingredients = state.ingredients.filter(i => i.id != id);
                renderIngredients(); // Re-renderizar
                calculateNutrition();
            });
        });
    }

    function calculateNutrition() {
        const totalWeight = state.ingredients.reduce((sum, i) => sum + parseFloat(i.peso_gramos), 0);
        totalWeightEl.innerText = totalWeight.toFixed(1) + 'g';
        
        // Calcular totales brutos
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

        // Render FDA
        const portionSize = parseFloat(portionInput.value) || 100;
        const servingsPerContainer = parseFloat(servingsInput.value) || 1;
        const perServing = {};
        for(let key in totals) perServing[key] = totalWeight > 0 ? (totals[key] / totalWeight) * portionSize : 0;
        renderFDA(perServing, servingsPerContainer, portionSize);

        // Render UE/OPS (Base 100g)
        const per100g = {};
        for(let key in totals) per100g[key] = totalWeight > 0 ? (totals[key] / totalWeight) * 100 : 0;
        renderEU(per100g);
        renderOPS(per100g);
    }

    function renderFDA(val, servings, portion) {
        const text = I18N[state.lang]; // Diccionario actual

        // Actualizar textos estáticos FDA
        const fdaEl = document.getElementById('label-fda');
        fdaEl.querySelector('h1').innerText = text.nutritionFacts;
        
        // Elementos dinámicos
        document.getElementById('lbl-servings-container').innerText = servings;
        document.getElementById('lbl-portion').innerText = portion + 'g';
        document.getElementById('lbl-calories').innerText = Math.round(val.energy);
        
        // Helper corregido para manejar IDs de HTML específicos
        const setVal = (eleId, v, unit, dvKey, customDvId) => {
            const el = document.getElementById(eleId);
            if(el) el.innerText = Math.round(v) + unit;
            
            // DV Calculation (Standard 2000 cal diet)
            if (dvKey) {
                const dvMap = { fat:78, satFat:20, chol:300, sod:2300, carb:275, fiber:28, addedSugar:50, vitD:20, calcium:1300, iron:18, pot:4700 };
                const pct = Math.round((v / dvMap[dvKey]) * 100);
                
                // Usamos el ID personalizado si existe (ej: dv-sat-fat), sino el default (ej: dv-fat)
                const targetId = customDvId || `dv-${dvKey}`;
                const dvEl = document.getElementById(targetId);
                
                if (dvEl) dvEl.innerText = pct + '%';
                else console.warn("Elemento DV no encontrado:", targetId);
            }
        };

        // Fat
        setVal('lbl-fat', val.fat, 'g', 'fat');
        
        // Saturated Fat (ID HTML: dv-sat-fat)
        setVal('lbl-sat-fat', val.satFat, 'g', 'satFat', 'dv-sat-fat');
        
        // Trans Fat (No tiene DV)
        document.getElementById('lbl-trans-fat').innerText = val.transFat.toFixed(1) + 'g';
        
        // Cholesterol
        setVal('lbl-chol', val.chol, 'mg', 'chol');
        
        // Sodium (ID HTML: dv-sodium vs Key: sod)
        setVal('lbl-sodium', val.sod, 'mg', 'sod', 'dv-sodium');
        
        // Carb
        setVal('lbl-carb', val.carb, 'g', 'carb');
        
        // Fiber
        setVal('lbl-fiber', val.fiber, 'g', 'fiber');
        
        // Sugars
        document.getElementById('lbl-sugar').innerText = Math.round(val.sugar) + 'g';
        
        // Added Sugars (ID HTML: dv-added-sugar)
        setVal('lbl-added-sugar', val.addedSugar, 'g', 'addedSugar', 'dv-added-sugar');
        
        // Protein
        document.getElementById('lbl-protein').innerText = Math.round(val.protein) + 'g';

        // Vitamins (IDs HTML específicos con guiones)
        setVal('lbl-vit-d', val.vitD, 'mcg', 'vitD', 'dv-vit-d');
        setVal('lbl-calcium', val.calcium, 'mg', 'calcium');
        setVal('lbl-iron', val.iron, 'mg', 'iron');
        setVal('lbl-potassium', val.pot, 'mg', 'pot', 'dv-potassium');
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
        // La lógica de advertencias se mantiene (los octógonos suelen ser estándar visual, aunque el texto podría traducirse "EXCESS SUGAR" si fuera necesario, pero OPS es Latam mayormente)
        // Por simplicidad, mantenemos los octógonos en español ya que es norma regional.
        
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
    async function api(url, options = {}) {
        options.credentials = 'include';
        options.headers = { ...options.headers, 'Content-Type': 'application/json' };
        const res = await fetch(url, options);
        if(!res.ok) throw new Error("Error API");
        return res.json();
    }

    function downloadImage() {
        const element = document.getElementById('label-canvas-container');
        html2canvas(element).then(canvas => {
            const link = document.createElement('a');
            link.download = `etiqueta_${state.currentRecipe.nombre}.png`;
            link.href = canvas.toDataURL();
            link.click();
        });
    }

    function downloadPDF() {
        const element = document.getElementById('label-canvas-container');
        html2canvas(element, { scale: 2 }).then(canvas => {
            const imgData = canvas.toDataURL('image/png');
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF();
            const width = pdf.internal.pageSize.getWidth();
            const height = (canvas.height * width) / canvas.width;
            pdf.addImage(imgData, 'PNG', 0, 0, width, height);
            pdf.save(`etiqueta_${state.currentRecipe.nombre}.pdf`);
        });
    }
});