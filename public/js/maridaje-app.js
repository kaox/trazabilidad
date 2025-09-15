document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('producto-selector');
    const recomendacionesContainer = document.getElementById('recomendaciones-container');
    let perfilesCacao = [];
    let perfilesCafe = [];

    async function init() {
        try {
            [perfilesCacao, perfilesCafe] = await Promise.all([
                api('/api/perfiles'),
                api('/api/perfiles-cafe')
            ]);
            populateSelector();
            selector.addEventListener('change', handleSelection);
            if (perfilesCacao.length > 0 || perfilesCafe.length > 0) {
                handleSelection();
            }
        } catch (error) {
            console.error("Error al cargar los perfiles:", error);
            recomendacionesContainer.innerHTML = `<p class="text-center text-red-600">No se pudieron cargar los perfiles. Inténtalo de nuevo más tarde.</p>`;
        }
    }

    function populateSelector() {
        let optionsHtml = '<option value="">Selecciona un producto...</option>';
        if (perfilesCacao.length > 0) {
            optionsHtml += `<optgroup label="Perfiles de Cacao">`;
            optionsHtml += perfilesCacao.map(p => `<option value="cacao-${p.id}">${p.nombre}</option>`).join('');
            optionsHtml += `</optgroup>`;
        }
        if (perfilesCafe.length > 0) {
            optionsHtml += `<optgroup label="Perfiles de Café">`;
            optionsHtml += perfilesCafe.map(p => `<option value="cafe-${p.id}">${p.nombre_perfil}</option>`).join('');
            optionsHtml += `</optgroup>`;
        }
        selector.innerHTML = optionsHtml;
    }

    function handleSelection() {
        const selectedValue = selector.value;
        if (!selectedValue) {
            recomendacionesContainer.innerHTML = '';
            return;
        }

        const [tipo, id] = selectedValue.split('-');
        
        let productoBase;
        let listaComparacion;

        if (tipo === 'cacao') {
            productoBase = perfilesCacao.find(p => p.id == id);
            listaComparacion = perfilesCafe;
        } else {
            productoBase = perfilesCafe.find(p => p.id == id);
            listaComparacion = perfilesCacao;
        }

        if (!productoBase || listaComparacion.length === 0) {
            recomendacionesContainer.innerHTML = `<p class="text-center text-stone-500">No hay productos en la categoría opuesta para comparar.</p>`;
            return;
        }

        const recomendaciones = calcularMaridajes(productoBase, listaComparacion, tipo);
        renderRecomendaciones(recomendaciones, productoBase, tipo);
    }

    function calcularMaridajes(base, comparables, tipoBase) {
        const recomendaciones = comparables.map(item => {
            let cacao, cafe;
            if (tipoBase === 'cacao') {
                cacao = base;
                cafe = item;
            } else {
                cacao = item;
                cafe = base;
            }

            const intensidadCacao = cacao.perfil_data.cacao || 0;
            const intensidadCafe = cafe.perfil_data.sabor || 0;
            const diffIntensidad = Math.abs(intensidadCacao - intensidadCafe);
            const puntuacionIntensidad = (1 - (diffIntensidad / 10)) * 100;

            const acidezCacao = cacao.perfil_data.acidez || 0;
            const acidezCafe = cafe.perfil_data.acidez || 0;
            const diffAcidez = Math.abs(acidezCacao - acidezCafe);
            const puntuacionAcidez = (1 - (diffAcidez / 10)) * 100;

            const dulzuraCacao = cacao.perfil_data.caramelo || 0;
            const dulzuraCafe = cafe.perfil_data.dulzura || 0;
            const diffDulzura = Math.abs(dulzuraCacao - dulzuraCafe);
            const puntuacionDulzura = (1 - (diffDulzura / 10)) * 100;
            
            const complejidadCacao = ((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0)) / 2;
            const complejidadCafe = ((cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0)) / 2;
            const diffComplejidad = Math.abs(complejidadCacao - complejidadCafe);
            const puntuacionComplejidad = (1 - (diffComplejidad / 10)) * 100;

            const puntuacionArmonia = (puntuacionAcidez + puntuacionDulzura + puntuacionComplejidad) / 3;
            const puntuacionFinal = (puntuacionIntensidad * 0.4) + (puntuacionArmonia * 0.6);

            return {
                producto: item,
                puntuacion: puntuacionFinal,
                justificacion: generarJustificacion(cacao, cafe),
                cacaoProfile: cacao,
                cafeProfile: cafe
            };
        });

        return recomendaciones.sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 2);
    }

    function generarJustificacion(cacao, cafe) {
        const intensidadCacao = cacao.perfil_data.cacao || 0;
        const intensidadCafe = cafe.perfil_data.sabor || 0;
        const acidezCacao = cacao.perfil_data.acidez || 0;
        const acidezCafe = cafe.perfil_data.acidez || 0;
        const dulzuraCacao = cacao.perfil_data.caramelo || 0;
        const dulzuraCafe = cafe.perfil_data.dulzura || 0;
        
        let justificacion = `Este maridaje es una excelente opción. `;
        
        if (Math.abs(intensidadCacao - intensidadCafe) < 2) {
            justificacion += `La intensidad de sabor del café (${intensidadCafe.toFixed(1)}) y la del cacao (${intensidadCacao.toFixed(1)}) son muy similares, creando una base equilibrada. `;
        } else {
            justificacion += `Las intensidades del café (${intensidadCafe.toFixed(1)}) y del cacao (${intensidadCacao.toFixed(1)}) ofrecen un contraste interesante. `;
        }

        if (Math.abs(acidezCacao - acidezCafe) < 2.5) {
             justificacion += `Además, la acidez similar (${acidezCafe.toFixed(1)} en café y ${acidezCacao.toFixed(1)} en cacao) se complementa perfectamente. `;
        }

        if (Math.abs(dulzuraCacao - dulzuraCafe) < 2.5) {
             justificacion += `Las notas de caramelo del cacao (${dulzuraCacao.toFixed(1)}) resuenan con la dulzura natural del café (${dulzuraCafe.toFixed(1)}).`;
        }

        return justificacion;
    }
    
    function renderRecomendaciones(recomendaciones, productoBase, tipoBase) {
        if (recomendaciones.length === 0) {
            recomendacionesContainer.innerHTML = `<p class="text-center text-stone-500">No se encontraron maridajes compatibles.</p>`;
            return;
        }

        recomendacionesContainer.innerHTML = `
            <h2 class="text-3xl font-display text-center text-amber-900 mb-8">Mejores Maridajes para ${tipoBase === 'cacao' ? productoBase.nombre : productoBase.nombre_perfil}</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                ${recomendaciones.map((rec, index) => createCard(rec, index)).join('')}
            </div>
        `;
        
        // Retraso para asegurar que los canvas existen en el DOM
        setTimeout(() => {
            recomendaciones.forEach((rec, index) => {
                renderMaridajeChart(rec, index);
            });
        }, 0);
    }

    function createCard(rec, index) {
        const nombre = rec.producto.nombre || rec.producto.nombre_perfil;
        return `
            <div class="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-amber-800">
                <h3 class="text-xl font-bold font-display text-amber-900">${nombre}</h3>
                <div class="my-3">
                    <span class="font-bold text-lg text-green-700">Compatibilidad: ${rec.puntuacion.toFixed(0)}%</span>
                </div>
                <div class="my-4">
                    <canvas id="maridaje-chart-${index}" width="300" height="300"></canvas>
                </div>
                <p class="text-sm text-stone-600 leading-relaxed">${rec.justificacion}</p>
            </div>
        `;
    }

    function renderMaridajeChart(rec, index) {
        const canvas = document.getElementById(`maridaje-chart-${index}`);
        if (!canvas) return;

        const cacao = rec.cacaoProfile.perfil_data;
        const cafe = rec.cafeProfile.perfil_data;

        const unifiedData = {
            labels: ['Intensidad', 'Acidez', 'Dulzura', 'Cuerpo', 'Notas Frutales'],
            cacao: [
                cacao.cacao || 0,
                cacao.acidez || 0,
                cacao.caramelo || 0,
                ((cacao.amargor || 0) + (cacao.astringencia || 0)) / 2,
                cacao.frutaFresca || 0
            ],
            cafe: [
                cafe.sabor || 0,
                cafe.acidez || 0,
                cafe.dulzura || 0,
                cafe.cuerpo || 0,
                (cafe.fraganciaAroma || 0) / 2
            ]
        };

        new Chart(canvas, {
            type: 'radar',
            data: {
                labels: unifiedData.labels,
                datasets: [
                    {
                        label: 'Cacao',
                        data: unifiedData.cacao,
                        backgroundColor: 'rgba(120, 53, 15, 0.2)',
                        borderColor: 'rgb(120, 53, 15)',
                        pointBackgroundColor: 'rgb(120, 53, 15)'
                    },
                    {
                        label: 'Café',
                        data: unifiedData.cafe,
                        backgroundColor: 'rgba(22, 101, 52, 0.2)',
                        borderColor: 'rgb(22, 101, 52)',
                        pointBackgroundColor: 'rgb(22, 101, 52)'
                    }
                ]
            },
            options: {
                responsive: true,
                scales: { r: { suggestedMin: 0, suggestedMax: 10 } },
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    init();
});

