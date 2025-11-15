document.addEventListener('DOMContentLoaded', () => {
    // --- CONSTANTES Y ESTADO ---
    const ATTRIBUTES = [
        { id: 'fraganciaAroma', label: 'Fragancia/Aroma', icon: 'fa-cloud', tooltip: 'La Fragancia es lo que se percibe del café molido en seco. El Aroma se percibe al infusionar y al romper la costra.' },
        { id: 'sabor', label: 'Sabor', icon: 'fa-mug-hot', tooltip: 'La impresión global del gusto y los aromas retronasales.' },
        { id: 'postgusto', label: 'Sabor Residual', icon: 'fa-clock-rotate-left', tooltip: 'Evalúa la calidad y la duración de las sensaciones positivas que permanecen en el paladar. Debe ser limpio y agradable.' },
        { id: 'acidez', label: 'Acidez', icon: 'fa-lemon', tooltip: 'El brillo y la vivacidad del café, indicador de calidad. Se busca una acidez "brillante" o "jugosa", no "agria".' },
        { id: 'cuerpo', label: 'Cuerpo', icon: 'fa-fill-drip', tooltip: 'La sensación táctil en el paladar, incluyendo su peso, densidad y viscosidad.' },
        { id: 'dulzura', label: 'Dulzura', icon: 'fa-cookie-bite', tooltip: 'La presencia de azúcares naturales y la ausencia de asperezas. Es un indicador clave de alta calidad.' },
        { id: 'balance', label: 'Balance', icon: 'fa-scale-balanced', tooltip: 'Mide la armonía entre todos los atributos principales (aroma, sabor, acidez y cuerpo).' },
        { id: 'uniformidad', label: 'Uniformidad', icon: 'fa-clone', tooltip: 'Mide la consistencia entre las cinco tazas catadas. Todas deben contar la misma historia.' },
        { id: 'tazaLimpia', label: 'Taza Limpia', icon: 'fa-hand-sparkles', tooltip: 'Evalúa la ausencia de notas ajenas, contaminaciones o sabores extraños.' },
        { id: 'puntajeCatador', label: 'Puntaje del Catador', icon: 'fa-trophy', tooltip: 'El veredicto integrador del catador que resume la experiencia total y contribuye a la nota final.' }
    ];

    const SCA_CLASSIFICATIONS = {
        excepcional: { label: 'Café Especialidad - Excepcional', color: 'bg-purple-200 text-purple-800' },
        excelente: { label: 'Café Especialidad - Excelente', color: 'bg-green-200 text-green-800' },
        muyBueno: { label: 'Café Especialidad - Muy Bueno', color: 'bg-sky-200 text-sky-800' },
        comercial: { label: 'Café Comercial', color: 'bg-stone-200 text-stone-800' }
    };

    let scaChart;

    // --- SELECTORES DEL DOM ---
    const attributesContainer = document.getElementById('attributes-container');
    const chartCanvas = document.getElementById('sca-radar-chart').getContext('2d');
    const defectCupsInput = document.getElementById('defect-cups');
    const defectTypeSelect = document.getElementById('defect-type');
    const totalAttributesScoreEl = document.getElementById('total-attributes-score');
    const totalPenaltyScoreEl = document.getElementById('total-penalty-score');
    const finalScoreEl = document.getElementById('final-score');
    const scoreClassificationEl = document.getElementById('score-classification');
    const exportBtn = document.getElementById('export-btn');
    const resetBtn = document.getElementById('reset-btn');

    // --- INICIALIZACIÓN ---
    function init() {
        renderSliders();
        initChart();
        addEventListeners();
        updateCalculations();
    }

    function renderSliders() {
        attributesContainer.innerHTML = ATTRIBUTES.map(attr => `
            <div>
                <div class="flex justify-between items-center mb-1">
                    <label for="${attr.id}" class="text-sm font-medium text-stone-700 flex items-center">
                        <i class="fas ${attr.icon} w-5 text-[#8D6E63]"></i>
                        <span class="ml-2">${attr.label}</span>
                        <span class="ml-1 text-sky-700" data-tooltip="${attr.tooltip}">
                            <i class="fas fa-info-circle text-xs"></i>
                        </span>
                    </label>
                    <span id="${attr.id}-value" class="font-bold text-lg text-[#3E2723]">7.50</span>
                </div>
                <input type="range" id="${attr.id}" min="0" max="10" step="0.25" value="7.5" class="w-full">
            </div>
        `).join('');
    }

    function addEventListeners() {
        attributesContainer.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.addEventListener('input', updateCalculations);
        });
        defectCupsInput.addEventListener('input', updateCalculations);
        defectTypeSelect.addEventListener('input', updateCalculations);
        resetBtn.addEventListener('click', resetForm);
        exportBtn.addEventListener('click', exportChart);
    }

    // --- LÓGICA DE CÁLCULO ---
    function updateCalculations() {
        let sumaAtributos = 0;
        const chartData = [];

        ATTRIBUTES.forEach(attr => {
            const slider = document.getElementById(attr.id);
            const value = parseFloat(slider.value);
            sumaAtributos += value;
            chartData.push(value);
            document.getElementById(`${attr.id}-value`).textContent = value.toFixed(2);
        });

        const cups = parseInt(defectCupsInput.value) || 0;
        const defectValue = parseInt(defectTypeSelect.value) || 0;
        const penalizacion = defectValue * cups;
        const notaFinal = sumaAtributos - penalizacion;

        totalAttributesScoreEl.textContent = sumaAtributos.toFixed(2);
        totalPenaltyScoreEl.textContent = `-${penalizacion}`;
        finalScoreEl.textContent = notaFinal.toFixed(2);
        
        updateClassification(notaFinal);
        updateChart(chartData);
    }

    function updateClassification(score) {
        let classification;
        if (score >= 90) classification = SCA_CLASSIFICATIONS.excepcional;
        else if (score >= 85) classification = SCA_CLASSIFICATIONS.excelente;
        else if (score >= 80) classification = SCA_CLASSIFICATIONS.muyBueno;
        else classification = SCA_CLASSIFICATIONS.comercial;

        scoreClassificationEl.textContent = classification.label;
        scoreClassificationEl.className = `text-center font-bold text-lg p-3 rounded-lg mt-4 transition-colors duration-300 ${classification.color}`;
    }

    // --- LÓGICA DE GRÁFICO ---
    function initChart() {
        const initialData = ATTRIBUTES.map(() => 7.5);
        scaChart = new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: ATTRIBUTES.map(a => a.label),
                datasets: [{
                    label: 'Puntaje',
                    data: initialData,
                    fill: true,
                    backgroundColor: 'rgba(141, 110, 99, 0.2)', // Acento
                    borderColor: 'rgb(141, 110, 99)',
                    pointBackgroundColor: 'rgb(141, 110, 99)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgb(141, 110, 99)'
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
        scaChart.data.datasets[0].data = data;
        scaChart.update();
    }

    // --- FUNCIONES DE BOTONES ---
    function resetForm() {
        attributesContainer.querySelectorAll('input[type="range"]').forEach(slider => {
            slider.value = '7.5';
        });
        defectCupsInput.value = '0';
        defectTypeSelect.value = '0';
        updateCalculations();
    }

    function exportChart() {
        // 1. Crear un canvas temporal para añadir la marca de agua
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');
        const sourceCanvas = chartCanvas.canvas;
        
        const width = sourceCanvas.width;
        const height = sourceCanvas.height;
        exportCanvas.width = width;
        exportCanvas.height = height;

        // 2. Dibujar el gráfico actual en el nuevo canvas
        exportCtx.fillStyle = '#F5F5F5'; // Fondo
        exportCtx.fillRect(0, 0, width, height);
        exportCtx.drawImage(sourceCanvas, 0, 0);

        // 3. Añadir la marca de agua "RuruLab"
        exportCtx.save();
        exportCtx.translate(width / 2, height / 2);
        exportCtx.rotate(-0.45); // Rotación diagonal
        exportCtx.font = `bold ${width / 10}px 'Playfair Display'`; // Tamaño de fuente responsivo
        exportCtx.fillStyle = 'rgba(62, 39, 35, 0.15)'; // Color Primario semi-transparente
        exportCtx.textAlign = 'center';
        exportCtx.textBaseline = 'middle';
        exportCtx.fillText('RuruLab', 0, 0);
        exportCtx.restore();

        // 4. Crear y simular clic en el enlace de descarga
        const link = document.createElement('a');
        link.href = exportCanvas.toDataURL('image/png');
        link.download = 'perfil-catacion-rurulab.png';
        link.click();
    }

    init();
});