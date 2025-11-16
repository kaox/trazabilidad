document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y ESTADO ---
    const DEFAULT_VALUE = '7.5';
    const MAIN_ATTRIBUTES = [
        { id: 'cacao', label: 'Cacao', icon: 'fa-chocolate', tooltip: 'Sabor fundamental y típico de granos de cacao tostados que fueron bien fermentados, secados y están libres de defectos.' },
        { id: 'acidez', label: 'Acidez', icon: 'fa-lemon', tooltip: 'Atributo de gestión que refleja la fermentación. Se desglosa en componentes químicos como Frutas (cítrico), Acético (vinagre), Láctico (yogur), Mineral y Butírico. Debe estar balanceado.' },
        { id: 'amargor', label: 'Amargor', icon: 'fa-seedling', tooltip: 'Sabor básico inherente al cacao, típicamente percibido en cafeína o nuez de cola. La evaluación mide su intensidad e integración.' },
        { id: 'astringencia', label: 'Astringencia', icon: 'fa-hand-dots', tooltip: 'Sensación táctil definitoria (taninos). Evalúa su calidad: puede ser un "fuerte efecto secante" (agudo, como piel de plátano verde) o una "sensación aterciopelada".' },
        { id: 'tostado', label: 'Grado de Tostado', icon: 'fa-fire', tooltip: 'Medida de la intensidad del tueste aplicado a los granos. Un tostado medio (4-6) es usual, pero un tostado alto (7) o bajo (2-3) puede ser característico.' }
    ];
    
    const SECONDARY_ATTRIBUTES = [
        { id: 'frutaFresca', label: 'Fruta Fresca', icon: 'fa-apple-whole', tooltip: 'Notas de Bayas/Frutos Rojos, Cítricos (naranja, limón), Fruta Oscura (cereza), Pulpa Amarilla/Naranja/Blanca o Tropical (maracuyá).' },
        { id: 'frutaMarron', label: 'Fruta Marrón', icon: 'fa-box-archive', tooltip: 'Notas de Fruta Seca (uva pasa), Dátil, Ciruela pasa o Fruta Sobre madura.' },
        { id: 'vegetal', label: 'Vegetal', icon: 'fa-leaf', tooltip: 'Notas como Pasto/vegetal verde/Hierba, o Terroso/hongo/Musgo/Bosque.' },
        { id: 'floral', label: 'Floral', icon: 'fa-fan', tooltip: 'Aromas de Flor de azahar (específicamente flor de naranjo) o Flores genéricas como jazmín y rosa.' },
        { id: 'madera', label: 'Madera', icon: 'fa-tree', tooltip: 'Notas de Madera clara, Madera oscura o Resina.' },
        { id: 'especia', label: 'Especia', icon: 'fa-mortar-pestle', tooltip: 'Tonalidades de Especias (nuez moscada, canela), Tabaco (hojas secas) o Sazonado/Umami.' },
        { id: 'nuez', label: 'Nuez', icon: 'fa-stroopwafel', tooltip: 'Notas de Parte interna (avellana, almendra) o Piel de la nuez.' },
        { id: 'caramelo', label: 'Caramelo / Panela', icon: 'fa-candy-cane', tooltip: 'Aromas que evocan caramelo, azúcar moreno y panela (azúcar de caña sin refinar).' },
        { id: 'dulzor', label: 'Dulzor', icon: 'fa-cube', tooltip: 'Sabor básico de las soluciones de azúcar blanca. Este atributo solo se evalúa y es relevante cuando se selecciona "Chocolate".', conditional: true }
    ];
    
    const GLOBAL_ATTRIBUTE = { id: 'calidadGlobal', label: 'Calidad Global', icon: 'fa-star', tooltip: 'La puntuación de Calidad Global refleja la impresión general del potencial aromático expresado, el carácter único de la muestra, el equilibrio del sabor y la pulcritud del acabado.' };

    let coexChart;
    let chartAttributes = [...MAIN_ATTRIBUTES, ...SECONDARY_ATTRIBUTES.filter(a => !a.conditional)];

    // --- SELECTORES DEL DOM ---
    const mainAttributesContainer = document.getElementById('main-attributes');
    const secondaryAttributesContainer = document.getElementById('secondary-attributes');
    const globalQualityContainer = document.getElementById('global-quality-slider');
    const chartCanvas = document.getElementById('coex-radar-chart').getContext('2d');
    const sampleTypeSelect = document.getElementById('sample-type');
    const exportBtn = document.getElementById('export-btn');
    const resetBtn = document.getElementById('reset-btn');

    // --- INICIALIZACIÓN ---
    function init() {
        renderSliders();
        initChart();
        addEventListeners();
        updateCalculations(); // Carga inicial
    }

    function renderSliders() {
        mainAttributesContainer.innerHTML = MAIN_ATTRIBUTES.map(attr => createSliderHTML(attr, DEFAULT_VALUE)).join('');
        secondaryAttributesContainer.innerHTML = SECONDARY_ATTRIBUTES.map(attr => createSliderHTML(attr, DEFAULT_VALUE)).join('');
        globalQualityContainer.innerHTML = createSliderHTML(GLOBAL_ATTRIBUTE, DEFAULT_VALUE);
        
        // Ocultar Dulzor por defecto
        document.getElementById('dulzor-row').classList.add('hidden');
    }

    function createSliderHTML(attr, defaultValue = '5.0') {
        return `
            <div id="${attr.id}-row" ${attr.conditional ? 'class="hidden"' : ''}>
                <div class="flex justify-between items-center mb-1">
                    <label for="${attr.id}" class="text-sm font-medium text-stone-700 flex items-center">
                        <i class="fas ${attr.icon} w-5 text-[#8D6E63]"></i>
                        <span class="ml-2">${attr.label}</span>
                        <span class="ml-1 text-sky-700" data-tooltip="${attr.tooltip}">
                            <i class="fas fa-info-circle text-xs"></i>
                        </span>
                    </label>
                    <span id="${attr.id}-value" class="font-bold text-lg text-[#3E2723]">${parseFloat(defaultValue).toFixed(2)}</span>
                </div>
                <input type="range" id="${attr.id}" min="0" max="10" step="0.25" value="${defaultValue}" class="w-full">
            </div>
        `;
    }

    function addEventListeners() {
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', updateCalculations);
        });
        sampleTypeSelect.addEventListener('change', handleSampleTypeChange);
        exportBtn.addEventListener('click', exportChart);
        resetBtn.addEventListener('click', resetForm);
    }

    // --- LÓGICA DE CÁLCULO ---
    function updateCalculations() {
        const chartData = [];
        chartAttributes.forEach(attr => {
            const slider = document.getElementById(attr.id);
            const value = parseFloat(slider.value);
            chartData.push(value);
            document.getElementById(`${attr.id}-value`).textContent = value.toFixed(2);
        });
        
        // Actualizar el valor de Calidad Global por separado
        const globalSlider = document.getElementById('calidadGlobal');
        document.getElementById('calidadGlobal-value').textContent = parseFloat(globalSlider.value).toFixed(2);
        
        updateChart(chartData);
    }

    function handleSampleTypeChange() {
        const type = sampleTypeSelect.value;
        const dulzorRow = document.getElementById('dulzor-row');
        const dulzorSlider = document.getElementById('dulzor');
        
        if (type === 'chocolate') {
            dulzorRow.classList.remove('hidden');
            chartAttributes = [...MAIN_ATTRIBUTES, ...SECONDARY_ATTRIBUTES];
        } else {
            dulzorRow.classList.add('hidden');
            dulzorSlider.value = 0; // Resetear valor si se oculta
            chartAttributes = [...MAIN_ATTRIBUTES, ...SECONDARY_ATTRIBUTES.filter(a => !a.conditional)];
        }
        updateCalculations();
    }

    // --- LÓGICA DE GRÁFICO ---
    function initChart() {
        const initialData = chartAttributes.map(() => parseFloat(DEFAULT_VALUE));
        coexChart = new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: chartAttributes.map(a => a.label),
                datasets: [{
                    label: 'Intensidad',
                    data: initialData,
                    fill: true,
                    backgroundColor: 'rgba(141, 110, 99, 0.2)', // Acento
                    borderColor: 'rgb(141, 110, 99)',
                    pointBackgroundColor: 'rgb(141, 110, 99)',
                    pointBorderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(0,0,0,0.1)' },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        pointLabels: { font: { size: 10, family: "'Lato', sans-serif" } },
                        suggestedMin: 0, 
                        suggestedMax: 10,
                        ticks: { stepSize: 2 }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    function updateChart(data) {
        coexChart.data.labels = chartAttributes.map(a => a.label);
        coexChart.data.datasets[0].data = data;
        coexChart.update();
    }

    // --- FUNCIONES DE BOTONES ---
    function resetForm() {
        document.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.value = DEFAULT_VALUE;
        });
        sampleTypeSelect.value = 'masa';
        handleSampleTypeChange(); // Esto llamará a updateCalculations
    }

    function exportChart() {
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        const sourceCanvas = chartCanvas.canvas;
        
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        exportCanvas.width = width;
        exportCanvas.height = height;

        exportCtx.fillStyle = '#F5F5F5'; // Fondo
        exportCtx.fillRect(0, 0, width, height);
        exportCtx.drawImage(sourceCanvas, 0, 0);

        exportCtx.save();
        exportCtx.translate(width / 2, height / 2);
        exportCtx.rotate(-0.45);
        exportCtx.font = `bold ${width / 10}px 'Playfair Display'`;
        exportCtx.fillStyle = 'rgba(62, 39, 35, 0.15)';
        exportCtx.textAlign = 'center';
        exportCtx.textBaseline = 'middle';
        exportCtx.fillText('Ruru Lab', 0, 0);
        exportCtx.restore();

        const link = document.createElement('a');
        link.href = exportCanvas.toDataURL('image/png');
        link.download = 'perfil-sensorial-cacao-rurulab.png';
        link.click();
    }

    init();
});