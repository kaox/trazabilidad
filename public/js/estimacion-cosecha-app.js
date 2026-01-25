// 1. Definir initMap globalmente para Callback de Google Maps
window.initMap = function() {
    // Se ejecuta cuando la API de Maps carga
    // Inicialización bajo demanda cuando se selecciona una finca
};

document.addEventListener('DOMContentLoaded', () => {
    // --- ESTADO ---
    let currentCrop = 'cafe'; // 'cafe' | 'cacao'
    let chartInstance = null;
    let fincasList = []; // Almacena las fincas cargadas
    let map = null;
    let currentPolygon = null;

    // --- ELEMENTOS DOM ---
    const btnCafe = document.getElementById('tab-cafe');
    const btnCacao = document.getElementById('tab-cacao');
    const themeBar = document.getElementById('theme-bar');
    const btnCalculate = document.getElementById('btn-calculate');
    
    // Inputs y Selects
    const fincaSelect = document.getElementById('finca-select');
    const areaInput = document.getElementById('area');
    const mapContainer = document.getElementById('map-container');
    
    const inputsCafe = document.getElementById('inputs-cafe');
    const inputsCacao = document.getElementById('inputs-cacao');
    const fieldsCafe = document.querySelectorAll('.field-cafe');
    const fieldsCacao = document.querySelectorAll('.field-cacao');
    
    // Resultados
    const resultsPanel = document.getElementById('results-panel');
    const resTotalKg = document.getElementById('res-total-kg');
    const resQuintales = document.getElementById('res-quintales');
    const resYield = document.getElementById('res-yield');
    const resAiImpact = document.getElementById('res-ai-impact');
    const aiMessage = document.getElementById('ai-message');
    const weatherBadge = document.getElementById('weather-badge');

    // --- CONFIGURACIÓN DE TEMA ---
    const themes = {
        cafe: {
            color: 'emerald',
            bgClass: 'bg-emerald-600',
            borderClass: 'border-emerald-500',
            textClass: 'text-emerald-700',
            btnClass: 'bg-emerald-600',
            shadowClass: 'shadow-emerald-200'
        },
        cacao: {
            color: 'orange',
            bgClass: 'bg-orange-600',
            borderClass: 'border-orange-500',
            textClass: 'text-orange-700',
            btnClass: 'bg-orange-600',
            shadowClass: 'shadow-orange-200'
        }
    };

    // --- INICIALIZACIÓN ---
    loadFincas();

    // --- EVENT LISTENERS ---
    btnCafe.addEventListener('click', (e) => { e.preventDefault(); switchCrop('cafe'); });
    btnCacao.addEventListener('click', (e) => { e.preventDefault(); switchCrop('cacao'); });
    
    fincaSelect.addEventListener('change', handleFincaSelection);

    document.getElementById('prediction-form').addEventListener('submit', (e) => {
        e.preventDefault();
        calculatePrediction();
    });

    // --- FUNCIONES API & MAPA ---

    async function loadFincas() {
        try {
            // Reutilizamos la función API si existe globalmente o fetch directo
            const response = await fetch('/api/fincas');
            if (response.ok) {
                fincasList = await response.json();
                populateFincaSelect();
            }
        } catch (error) {
            console.error("Error cargando fincas:", error);
            fincaSelect.innerHTML = `<option value="">Error al cargar fincas</option>`;
        }
    }

    function populateFincaSelect() {
        if (fincasList.length === 0) {
            fincaSelect.innerHTML = `<option value="">No hay fincas registradas</option>`;
            return;
        }
        
        let html = `<option value="">-- Ingreso Manual --</option>`;
        fincasList.forEach(f => {
            html += `<option value="${f.id}">${f.nombre_finca} (${f.superficie || 0} ha)</option>`;
        });
        fincaSelect.innerHTML = html;
    }

    function handleFincaSelection(e) {
        const selectedId = e.target.value;
        const finca = fincasList.find(f => f.id == selectedId);

        if (finca) {
            // 1. Llenar Área Automáticamente
            if (finca.superficie) {
                areaInput.value = finca.superficie;
                // Efecto visual de actualización
                areaInput.parentElement.classList.add('ring-2', 'ring-emerald-400');
                setTimeout(() => areaInput.parentElement.classList.remove('ring-2', 'ring-emerald-400'), 1000);
            }

            // 2. Mostrar y Dibujar en Mapa
            if (finca.coordenadas) {
                mapContainer.classList.remove('hidden');
                renderFincaOnMap(finca.coordenadas);
            } else {
                mapContainer.classList.add('hidden');
            }
        } else {
            // Selección manual o vacío
            mapContainer.classList.add('hidden');
            areaInput.value = '';
        }
    }

    function renderFincaOnMap(coordsJson) {
        if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
            console.warn("Google Maps API no cargada");
            return;
        }

        let paths = [];
        try {
            // Los datos pueden venir como string o ya parseados dependiendo de la API
            const raw = typeof coordsJson === 'string' ? JSON.parse(coordsJson) : coordsJson;
            // Formato esperado: [[lat, lng], [lat, lng]]
            if (Array.isArray(raw)) {
                paths = raw.map(p => ({ lat: parseFloat(p[0]), lng: parseFloat(p[1]) }));
            }
        } catch (e) {
            console.error("Error parseando coordenadas:", e);
            return;
        }

        if (paths.length === 0) return;

        // Inicializar mapa si no existe
        if (!map) {
            map = new google.maps.Map(document.getElementById('map'), {
                zoom: 15,
                center: paths[0],
                mapTypeId: 'hybrid',
                streetViewControl: false,
                mapTypeControl: false,
                zoomControl: true
            });
        }

        // Limpiar polígono anterior
        if (currentPolygon) currentPolygon.setMap(null);

        // Dibujar nuevo polígono
        currentPolygon = new google.maps.Polygon({
            paths: paths,
            strokeColor: "#10b981", // Emerald 500
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#10b981",
            fillOpacity: 0.35,
            map: map
        });

        // Centrar mapa en el polígono
        const bounds = new google.maps.LatLngBounds();
        paths.forEach(p => bounds.extend(p));
        map.fitBounds(bounds);
    }

    // --- FUNCIONES CORE (CÁLCULO) ---

    function switchCrop(crop) {
        currentCrop = crop;
        const t = themes[crop];

        // 1. Actualizar Tabs visualmente
        if (crop === 'cafe') {
            setActiveTab(btnCafe, btnCacao, t);
            inputsCafe.classList.remove('hidden');
            inputsCacao.classList.add('hidden');
            fieldsCafe.forEach(el => el.classList.remove('hidden'));
            fieldsCacao.forEach(el => el.classList.add('hidden'));
        } else {
            setActiveTab(btnCacao, btnCafe, t);
            inputsCafe.classList.add('hidden');
            inputsCacao.classList.remove('hidden');
            fieldsCafe.forEach(el => el.classList.add('hidden'));
            fieldsCacao.forEach(el => el.classList.remove('hidden'));
        }

        // 2. Actualizar Barra y Botón
        themeBar.className = `h-2 w-full transition-colors duration-500 ${t.bgClass}`;
        btnCalculate.className = `w-full py-4 rounded-xl text-white font-bold text-lg shadow-lg transform transition hover:-translate-y-1 active:scale-95 ${t.btnClass} ${t.shadowClass}`;

        // 3. Ocultar resultados previos
        resultsPanel.classList.add('hidden');
    }

    function setActiveTab(activeBtn, inactiveBtn, theme) {
        inactiveBtn.className = "crop-tab flex flex-col items-center justify-center p-4 rounded-2xl border-2 border-transparent bg-slate-100 text-slate-400 hover:bg-slate-200 transition-all duration-300 transform active:scale-95";
        activeBtn.className = `crop-tab active flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-300 transform active:scale-95 shadow-md bg-white ${theme.borderClass} ${theme.textClass}`;
    }

    function calculatePrediction() {
        const area = parseFloat(document.getElementById('area').value);
        const density = parseFloat(document.getElementById('density').value);
        const useAi = document.getElementById('ai-toggle').checked;

        if (!validateInput('area', area) || !validateInput('density', density)) return;

        let estimatedKg = 0;

        if (currentCrop === 'cafe') {
            const branches = parseFloat(document.getElementById('coffee-branches').value);
            const nodes = parseFloat(document.getElementById('coffee-nodes').value);
            const fruits = parseFloat(document.getElementById('coffee-fruits').value);
            const weightG = parseFloat(document.getElementById('coffee-weight').value);
            const factor = parseFloat(document.getElementById('coffee-factor').value);

            if (!validateInput('coffee-branches', branches) || !validateInput('coffee-nodes', nodes) || 
                !validateInput('coffee-fruits', fruits)) return;

            const treesTotal = area * density;
            const fruitsPerTree = branches * nodes * fruits;
            const cherryKg = (treesTotal * fruitsPerTree * weightG) / 1000;
            estimatedKg = cherryKg / factor; 

        } else {
            const pods = parseFloat(document.getElementById('cacao-pods').value);
            const prodPercent = parseFloat(document.getElementById('cacao-prod').value);
            const index = parseFloat(document.getElementById('cacao-index').value);

            if (!validateInput('cacao-pods', pods) || !validateInput('cacao-prod', prodPercent) || 
                !validateInput('cacao-index', index)) return;

            const treesTotal = area * density;
            const effectivePods = treesTotal * pods * (prodPercent / 100);
            estimatedKg = effectivePods / index; 
        }

        let aiAdjustment = 0;
        
        if (useAi) {
            const scenarios = [
                { factor: 0.90, label: "Sequía Moderada", icon: "fa-sun", color: "text-orange-500", bg: "bg-orange-100" },
                { factor: 1.05, label: "Lluvias Favorables", icon: "fa-cloud-rain", color: "text-blue-500", bg: "bg-blue-100" },
                { factor: 0.85, label: "Riesgo de Plagas", icon: "fa-bug", color: "text-red-500", bg: "bg-red-100" },
                { factor: 1.00, label: "Condiciones Normales", icon: "fa-check", color: "text-emerald-500", bg: "bg-emerald-100" }
            ];
            
            const randomIndex = Math.floor(Math.random() * scenarios.length);
            const scenario = scenarios[randomIndex];
            
            aiAdjustment = estimatedKg * (scenario.factor - 1);
            
            weatherBadge.className = `flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg animate-pulse ${scenario.bg} ${scenario.color}`;
            weatherBadge.innerHTML = `<i class="fa-solid ${scenario.icon}"></i>`;
            aiMessage.textContent = `${scenario.label}: Ajuste de ${(scenario.factor * 100 - 100).toFixed(0)}% en la producción.`;
        } else {
            aiMessage.textContent = "Análisis de IA desactivado.";
            weatherBadge.className = "flex-shrink-0 w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-lg";
            weatherBadge.innerHTML = `<i class="fa-solid fa-ban"></i>`;
        }

        const finalKg = estimatedKg + aiAdjustment;
        renderResults(estimatedKg, finalKg, area, aiAdjustment);
    }

    function validateInput(id, value) {
        const el = document.getElementById(id);
        if (isNaN(value) || value <= 0) {
            el.classList.add('border-red-500', 'ring-1', 'ring-red-500');
            el.classList.remove('border-slate-200');
            el.parentElement.classList.add('animate-pulse');
            setTimeout(() => el.parentElement.classList.remove('animate-pulse'), 500);
            return false;
        } else {
            el.classList.remove('border-red-500', 'ring-1', 'ring-red-500');
            el.classList.add('border-slate-200');
            return true;
        }
    }

    function renderResults(baseKg, finalKg, area, aiAdjustment) {
        resultsPanel.classList.remove('hidden');
        resultsPanel.classList.add('fade-enter-active');

        animateValue(resTotalKg, 0, Math.round(finalKg), 1000);
        
        const quintales = finalKg / 46; 
        resQuintales.textContent = `${quintales.toFixed(1)} qq`;
        
        const yieldVal = finalKg / area;
        resYield.textContent = Math.round(yieldVal);

        const diffPercent = (aiAdjustment / baseKg) * 100;
        const sign = diffPercent > 0 ? '+' : '';
        resAiImpact.textContent = `${sign}${diffPercent.toFixed(1)}%`;
        resAiImpact.className = `text-xl font-bold ${diffPercent < 0 ? 'text-red-600' : (diffPercent > 0 ? 'text-emerald-600' : 'text-slate-600')}`;

        renderChart(baseKg, finalKg);
        resultsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderChart(manual, adjusted) {
        const ctx = document.getElementById('predictionChart').getContext('2d');
        if (chartInstance) chartInstance.destroy();

        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Cálculo Manual', 'Predicción IA'],
                datasets: [{
                    label: 'Producción (kg)',
                    data: [manual, adjusted],
                    backgroundColor: [
                        '#cbd5e1', 
                        currentCrop === 'cafe' ? '#10b981' : '#ea580c' 
                    ],
                    borderRadius: 8,
                    barThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: { display: true, borderDash: [5, 5] } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    function animateValue(obj, start, end, duration) {
        let startTimestamp = null;
        const step = (timestamp) => {
            if (!startTimestamp) startTimestamp = timestamp;
            const progress = Math.min((timestamp - startTimestamp) / duration, 1);
            obj.innerHTML = Math.floor(progress * (end - start) + start).toLocaleString();
            if (progress < 1) {
                window.requestAnimationFrame(step);
            }
        };
        window.requestAnimationFrame(step);
    }
});