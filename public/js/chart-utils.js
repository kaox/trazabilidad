/**
 * chart-utils.js
 * Utilidades compartidas para renderizar gráficos de Chart.js (Ruedas de sabor, Radares, etc.)
 */

const ChartUtils = {
    // Registro de instancias para limpieza de memoria
    instances: {},

    // Registro del plugin de etiquetas si existe
    registerPlugins: function() {
        if (typeof ChartDataLabels !== 'undefined' && typeof Chart !== 'undefined') {
            Chart.register(ChartDataLabels);
        }
    },

    // Convierte un color HEX a rgba con alpha
    hexToRgba: function (hex, alpha = 1) {
        let h = hex.replace('#', '');
        if (h.length === 3) {
            h = h.split('').map(c => c + c).join('');
        }
        const intVal = parseInt(h, 16);
        const r = (intVal >> 16) & 255;
        const g = (intVal >> 8) & 255;
        const b = intVal & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    },

    /**
     * Renderiza un Radar de Perfil Sensorial o de Taza
     * @param {string} canvasId - ID del elemento canvas
     * @param {object} perfilData - Objeto con los valores de los atributos
     * @param {string} tipoProducto - 'cafe' o 'cacao' (u otro)
     */
    initializePerfilChart: function (canvasId, perfilData, tipoProducto = '', options = {}) {
        const chartCanvas = document.getElementById(canvasId);
        if (!chartCanvas || !perfilData) return;

        // Destruir instancia anterior si existe
        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        let atributos = [];
        let labelColor = 'rgb(141, 110, 99)'; // Marrón Cacao
        let bgColor = 'rgba(141, 110, 99, 0.2)';

        const type = (tipoProducto || '').toLowerCase();

        // Lógica de selección de atributos
        if (type.includes('caf')) {
            // Atributos SCA para Café
            const commonCoffeeKeys = ['fraganciaAroma', 'sabor', 'postgusto', 'acidez', 'cuerpo', 'dulzura', 'balance', 'limpieza', 'impresionGeneral'];
            atributos = commonCoffeeKeys.filter(key => perfilData[key] !== undefined);

            // Fallback dinámico
            if (atributos.length === 0) {
                atributos = Object.keys(perfilData).filter(k => typeof perfilData[k] === 'number' && !['id', 'user_id'].includes(k));
            }

            labelColor = 'rgb(180, 83, 9)'; // Amber-700 para café
            bgColor = 'rgba(180, 83, 9, 0.2)';
        } else {
            // Cacao (Por defecto)
            atributos = ['cacao', 'acidez', 'amargor', 'astringencia', 'frutaFresca', 'frutaMarron', 'vegetal', 'floral', 'madera', 'especia', 'nuez', 'caramelo'];
            const existingAttrs = atributos.filter(key => perfilData[key] !== undefined);
            if (existingAttrs.length > 0) atributos = existingAttrs;
        }

        if (atributos.length === 0) return; // No hay datos para graficar

        const labels = atributos.map(a => a.charAt(0).toUpperCase() + a.slice(1).replace(/([A-Z])/g, ' $1').trim());
        const dataValues = atributos.map(attr => perfilData[attr] || 0);

        this.instances[canvasId] = new Chart(chartCanvas, {
            type: 'radar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Intensidad',
                    data: dataValues,
                    fill: true,
                    backgroundColor: bgColor,
                    borderColor: labelColor,
                    pointBackgroundColor: labelColor,
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: labelColor
                }]
            },
            options: {
                ...options,
                scales: {
                    r: {
                        angleLines: { color: 'rgba(0,0,0,0.1)' },
                        grid: { color: 'rgba(0,0,0,0.1)' },
                        pointLabels: {
                            font: { size: 11, family: "'Inter', sans-serif", weight: 'bold' },
                            color: '#57534e'
                        },
                        suggestedMin: 0,
                        suggestedMax: 10,
                        ticks: { display: false, stepSize: 2 },
                    }
                },
                plugins: {
                    legend: { display: false }
                },
                maintainAspectRatio: false
            }
        });
        
        return this.instances[canvasId];
    },

    /**
     * Renderiza una Rueda de Sabores (Dona multinivel) SCA o Cacao of Excellence
     * @param {string} baseId - ID del contenedor canvas (ej: "rueda-sabor-chart-{id}")
     * @param {object} ruedaData - Objeto con datos de la rueda (notas_json, tipo)
     * @param {object} flavorWheelsData - Configuración global de colores y categorías
     */
    initializeRuedaChart: function (baseId, ruedaData, flavorWheelsData, options = {}) {
        const canvasId = `${baseId}-l1`;
        const ctxL1 = document.getElementById(canvasId);

        if (!ctxL1 || !ruedaData || !ruedaData.notas_json || !flavorWheelsData) return null;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const notes = ruedaData.notas_json;
        const FLAVOR_DATA = ruedaData.tipo === 'cafe' ? flavorWheelsData.cafe : flavorWheelsData.cacao;

        if (!FLAVOR_DATA) return null;

        const selectedCategories = {};
        notes.forEach(note => {
            if (FLAVOR_DATA[note.category]) {
                if (!selectedCategories[note.category]) {
                    selectedCategories[note.category] = { color: FLAVOR_DATA[note.category].color, children: [] };
                }
                selectedCategories[note.category].children.push(note.subnote);
            }
        });

        // Si se pasa un arreglo de categorías seleccionadas (nivel 1) o subnotas (nivel 2), úsalos para colorear y leyenda
        const selectedCategoryNames = Array.isArray(options.selectedCategories)
            ? options.selectedCategories
            : Object.keys(selectedCategories);
        const selectedSubnotes = Array.isArray(options.selectedSubnotes)
            ? options.selectedSubnotes
            : notes.map(n => n.subnote).filter(Boolean);
        const showAllLabels = options.showAllLabels === true;
        const isCafe = ruedaData.tipo === 'cafe';

        // Helper para contar hojas (hoja = nivel 3 si existe, o nivel 2 si no tiene hijos)
        const countLeafs = (item) => {
            if (!item.children || item.children.length === 0) return 1;
            return item.children.reduce((sum, child) => sum + countLeafs(child), 0);
        };

        // --- NIVEL 1 (Interno) ---
        const l1_labels = Object.keys(FLAVOR_DATA);
        const l1_data = l1_labels.map(cat => countLeafs(FLAVOR_DATA[cat]));
        const l1_colors = l1_labels.map(label => {
            return selectedCategoryNames.includes(label) ? FLAVOR_DATA[label].color : '#F3F4F6';
        });

        // --- NIVEL 2 (Medio) ---
        const l2_labels = [];
        const l2_data = [];
        const l2_colors = [];
        const l2_parent_colors = [];

        l1_labels.forEach(catName => {
            const cat = FLAVOR_DATA[catName];
            cat.children.forEach(sub => {
                l2_labels.push(sub.name);
                l2_data.push(countLeafs(sub));
                
                const isSelected = selectedSubnotes.includes(sub.name) || 
                                 notes.some(n => n.category === catName && n.subnote === sub.name);
                
                l2_colors.push(isSelected ? this.hexToRgba(cat.color, 0.7) : '#F9FAFB');
                l2_parent_colors.push(cat.color);
            });
        });

        // --- NIVEL 3 (Externo - Solo Café) ---
        let datasets = [];
        let finalLabels = l2_labels;
        const l3_labels = [];
        const l3_data = [];
        const l3_colors = [];

        if (isCafe) {
            l1_labels.forEach(catName => {
                const cat = FLAVOR_DATA[catName];
                cat.children.forEach(sub => {
                    if (sub.children && sub.children.length > 0) {
                        sub.children.forEach(note => {
                            l3_labels.push(note.name);
                            l3_data.push(1);
                            const isSelected = notes.some(n => n.category === catName && (n.subnote === sub.name || n.subnote === note.name));
                            l3_colors.push(isSelected ? this.hexToRgba(cat.color, 0.45) : '#FFFFFF');
                        });
                    } else {
                        // Si no tiene hijos, ocupamos el espacio con un "vacío" o el mismo nombre
                        l3_labels.push(sub.name);
                        l3_data.push(1);
                        l3_colors.push('transparent'); // Ocultar si es solo relleno
                    }
                });
            });

            finalLabels = l3_labels;
            datasets.push({
                data: l3_data,
                backgroundColor: l3_colors,
                borderColor: '#ffffff',
                borderWidth: 1,
                weight: 1.5
            });
            datasets.push({
                data: l2_data,
                backgroundColor: l2_colors,
                borderColor: '#ffffff',
                borderWidth: 1,
                weight: 1.2
            });
            datasets.push({
                data: l1_data,
                backgroundColor: l1_colors,
                borderColor: '#ffffff',
                borderWidth: 1,
                weight: 1
            });
        } else {
            // Cacao / Otros (2 niveles)
            datasets.push({
                data: l2_data,
                backgroundColor: l2_colors,
                borderColor: '#ffffff',
                borderWidth: 1,
                weight: 1.2
            });
            datasets.push({
                data: l1_data,
                backgroundColor: l1_colors,
                borderColor: '#ffffff',
                borderWidth: 1,
                weight: 0.8
            });
        }

        const chart = new Chart(ctxL1, {
            type: 'doughnut',
            data: {
                labels: finalLabels,
                datasets: datasets
            },
            options: {
                responsive: false,
                maintainAspectRatio: false,
                cutout: isCafe ? '20%' : '30%',
                layout: { top: 0, left: 0, right: 0, bottom: 0 },
                plugins: {
                    legend: { display: false },
                    datalabels: {
                        color: '#444444',
                        font: function (context) {
                            var width = context.chart.width;
                            var size = Math.round(width / 50);
                            if (size > 12) size = 12;
                            if (size < 7) size = 7;
                            return { size: size, family: 'Arial', weight: 'bold' };
                        },
                        formatter: function (value, context) {
                            const dsIdx = context.datasetIndex;
                            const idx = context.dataIndex;
                            
                            // Lógica de etiquetas dinámica
                            if (isCafe) {
                                if (dsIdx === 0) { // Nivel 3
                                    const label = l3_labels[idx];
                                    if (l3_colors[idx] === 'transparent') return '';
                                    return (showAllLabels || notes.some(n => n.subnote === label)) ? label : '';
                                } else if (dsIdx === 1) { // Nivel 2
                                    const label = l2_labels[idx];
                                    return (showAllLabels || selectedSubnotes.includes(label)) ? label : '';
                                } else { // Nivel 1
                                    const label = l1_labels[idx];
                                    return (showAllLabels || selectedCategoryNames.includes(label)) ? label : '';
                                }
                            } else {
                                if (dsIdx === 0) { // Nivel 2
                                    const label = l2_labels[idx];
                                    return (showAllLabels || selectedSubnotes.includes(label)) ? label : '';
                                } else { // Nivel 1
                                    const label = l1_labels[idx];
                                    return (showAllLabels || selectedCategoryNames.includes(label)) ? label : '';
                                }
                            }
                        },
                        anchor: 'center',
                        align: 'center',
                        rotation: function (ctx) {
                            const valuesBefore = ctx.dataset.data.slice(0, ctx.dataIndex).reduce((a, b) => a + b, 0);
                            const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const currentVal = ctx.dataset.data[ctx.dataIndex];

                            const spanAngle = (currentVal / sum) * 360;
                            if (spanAngle > 60) return 0;

                            const angle = Math.PI * 2 * (valuesBefore + currentVal / 2) / sum - Math.PI / 2;
                            var degree = angle * 180 / Math.PI;

                            let normalizedDegree = degree;
                            if (normalizedDegree < 0) normalizedDegree += 360;

                            let rotation = degree;
                            if (normalizedDegree > 90 && normalizedDegree < 270) {
                                rotation += 180;
                            }
                            return rotation;
                        },
                        textStrokeColor: 'rgba(255,255,255,0.7)',
                        textStrokeWidth: 1
                    }
                }
            }
        });

        if (options.onClick) {
            chart.options.onClick = options.onClick;
        }

        this.instances[canvasId] = chart;

        // Renderizar leyenda personalizada por defecto, pero permitir ocultarla si se pasa hideLegend=true
        if (!options.hideLegend) {
            this.renderCustomLegend(baseId, selectedCategories, FLAVOR_DATA);
        }

        return chart;
    },

    renderCustomLegend: function (baseId, selectedCategories, FLAVOR_DATA) {
        let legendContainer = document.getElementById(`${baseId}-legend`);
        if (!legendContainer) legendContainer = document.getElementById('rueda-chart-legend');

        if (!legendContainer) return;

        if (Object.keys(selectedCategories).length === 0) {
            legendContainer.innerHTML = `<p class="text-stone-500 text-center text-sm">Ninguna nota de sabor seleccionada.</p>`;
            return;
        }

        const legendHtml = Object.entries(selectedCategories).map(([category, data]) => `
            <div class="mb-3">
                <h4 class="font-semibold text-sm flex items-center gap-2 text-stone-700">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${data.color}"></span>
                    <i class="fas ${FLAVOR_DATA[category].icon} w-4"></i>
                    ${category}
                </h4>
                <ul class="list-disc list-inside text-stone-600 pl-5 text-xs mt-1 space-y-1">
                    ${data.children.map(note => {
            const childObj = FLAVOR_DATA[category].children.find(c => c.name === note);
            const noteIcon = childObj?.icon || 'fa-circle-dot';
            return `<li><i class="fas ${noteIcon} w-3 text-stone-400 mr-1"></i>${note}</li>`;
        }).join('')}
                </ul>
            </div>
        `).join('');

        legendContainer.innerHTML = `<div class="grid grid-cols-2 gap-x-4">${legendHtml}</div>`;
    }
};

// Exportar globalmente para acceso desde módulos
window.ChartUtils = ChartUtils;