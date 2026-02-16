/**
 * chart-utils.js
 * Utilidades compartidas para renderizar gráficos de Chart.js (Ruedas de sabor, Radares, etc.)
 */

const ChartUtils = {
    // Registro de instancias para limpieza de memoria
    instances: {},

    /**
     * Renderiza un Radar de Perfil Sensorial
     * @param {string} canvasId - ID del elemento canvas
     * @param {object} perfilData - Objeto con los valores de los atributos
     * @param {string} tipoProducto - 'cafe' o 'cacao' (u otro)
     */
    initializePerfilChart: function(canvasId, perfilData, tipoProducto = '') {
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
             const commonCoffeeKeys = ['aroma', 'sabor', 'postgusto', 'acidez', 'cuerpo', 'balance', 'dulzor', 'limpieza', 'uniformidad', 'general'];
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
                scales: { 
                    r: { 
                        angleLines: { color: 'rgba(0,0,0,0.1)'},
                        grid: { color: 'rgba(0,0,0,0.1)'},
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
    },

    /**
     * Renderiza una Rueda de Sabores (Dona multinivel)
     * @param {string} baseId - ID del contenedor canvas (ej: "rueda-sabor-chart-{id}")
     * @param {object} ruedaData - Objeto con datos de la rueda (notas_json, tipo)
     * @param {object} flavorWheelsData - Configuración global de colores y categorías
     */
    initializeRuedaChart: function(baseId, ruedaData, flavorWheelsData) {
        const canvasId = `${baseId}-l1`;
        const ctxL1 = document.getElementById(canvasId);
        
        if (!ctxL1 || !ruedaData || !ruedaData.notas_json || !flavorWheelsData) return;

        if (this.instances[canvasId]) {
            this.instances[canvasId].destroy();
        }

        const notes = ruedaData.notas_json;
        const FLAVOR_DATA = ruedaData.tipo === 'cafe' ? flavorWheelsData.cafe : flavorWheelsData.cacao;
        
        if (!FLAVOR_DATA) return;

        const selectedCategories = {};
        notes.forEach(note => {
            if (FLAVOR_DATA[note.category]) {
                if (!selectedCategories[note.category]) {
                    selectedCategories[note.category] = { color: FLAVOR_DATA[note.category].color, children: [] };
                }
                selectedCategories[note.category].children.push(note.subnote);
            }
        });

        const l1_labels = Object.keys(FLAVOR_DATA);
        const l1_data = l1_labels.map(cat => FLAVOR_DATA[cat].children.length);
        const l1_colors = l1_labels.map(label => selectedCategories[label] ? FLAVOR_DATA[label].color : '#E5E7EB');

        const l2_labels = Object.values(FLAVOR_DATA).flatMap(d => d.children.map(c => c.name));
        const l2_data = Array(l2_labels.length).fill(1);
        const l2_colors = Object.values(FLAVOR_DATA).flatMap(d => {
            return d.children.map(child => {
                const categoryName = Object.keys(FLAVOR_DATA).find(k => FLAVOR_DATA[k] === d);
                const isSelected = notes.some(n => n.category === categoryName && n.subnote === child.name);
                return isSelected ? d.color : '#E5E7EB';
            });
        });

        this.instances[canvasId] = new Chart(ctxL1, {
            type: 'doughnut',
            data: {
                labels: l2_labels, 
                datasets: [
                    {
                        data: l2_data,
                        backgroundColor: l2_colors,
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        weight: 1.2 
                    },
                    {
                        data: l1_data,
                        backgroundColor: l1_colors,
                        borderColor: '#ffffff',
                        borderWidth: 1,
                        weight: 0.8 
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '25%',
                layout: { top: 0, left: 0, right: 0, bottom: 0 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const idx = context.dataIndex;
                                if(context.datasetIndex === 0) return l2_labels[idx];
                                return l1_labels[idx];
                            }
                        }
                    },
                    datalabels: {
                        color: '#444444',
                        font: function(context) {
                            var width = context.chart.width;
                            var size = Math.round(width / 45); 
                            if (size > 14) size = 14;
                            if (size < 8) size = 8;
                            return { size: size, family: 'Arial', weight: 'bold' };
                        },
                        formatter: function(value, context) {
                            if (context.datasetIndex === 0) {
                                const resultado = notes.find(item => {
                                    return item.subnote && item.subnote.toLowerCase().includes(l2_labels[context.dataIndex].toLowerCase());
                                });
                                return resultado ? l2_labels[context.dataIndex] : "";
                            } else {
                                return selectedCategories[l1_labels[context.dataIndex]] ? l1_labels[context.dataIndex] : "";
                            }
                        },
                        anchor: 'center',
                        align: 'center',
                        rotation: function(ctx) {
                            const valuesBefore = ctx.dataset.data.slice(0, ctx.dataIndex).reduce((a, b) => a + b, 0);
                            const sum = ctx.dataset.data.reduce((a, b) => a + b, 0);
                            const currentVal = ctx.dataset.data[ctx.dataIndex];
                            
                            const spanAngle = (currentVal / sum) * 360;
                            if (spanAngle > 40) return 0;

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
                        textStrokeColor: 'rgba(255,255,255,0.8)',
                        textStrokeWidth: 2
                    }
                }
            }
        });

        this.renderCustomLegend(baseId, selectedCategories, FLAVOR_DATA);
    },

    renderCustomLegend: function(baseId, selectedCategories, FLAVOR_DATA) {
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