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
            // Simular la primera selección si hay datos
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
        renderRecomendaciones(recomendaciones);
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

            // 1. Coincidencia de Intensidad (40%)
            const intensidadCacao = cacao.perfil_data.cacao || 0;
            const intensidadCafe = cafe.perfil_data.sabor || 0;
            const diffIntensidad = Math.abs(intensidadCacao - intensidadCafe);
            const puntuacionIntensidad = (1 - (diffIntensidad / 10)) * 100;

            // 2. Armonía de Atributos (60%)
            const diffAcidez = Math.abs((cacao.perfil_data.acidez || 0) - (cafe.perfil_data.acidez || 0));
            const puntuacionAcidez = (1 - (diffAcidez / 10)) * 100;

            const dulzuraCacao = cacao.perfil_data.caramelo || 0;
            const dulzuraCafe = cafe.perfil_data.dulzura || 0;
            const diffDulzura = Math.abs(dulzuraCacao - dulzuraCafe);
            const puntuacionDulzura = (1 - (diffDulzura / 10)) * 100;
            
            const complejidadCacao = (cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0);
            const complejidadCafe = (cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0);
            const diffComplejidad = Math.abs(complejidadCacao - complejidadCafe) / 2; // Se divide entre 2 porque son dos atributos sumados
            const puntuacionComplejidad = (1 - (diffComplejidad / 10)) * 100;

            const puntuacionArmonia = (puntuacionAcidez + puntuacionDulzura + puntuacionComplejidad) / 3;

            // Puntuación Final
            const puntuacionFinal = (puntuacionIntensidad * 0.4) + (puntuacionArmonia * 0.6);

            return {
                producto: item,
                puntuacion: puntuacionFinal,
                justificacion: generarJustificacion(cacao, cafe, puntuacionIntensidad, puntuacionAcidez, puntuacionDulzura, puntuacionComplejidad)
            };
        });

        return recomendaciones.sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 2);
    }

    function generarJustificacion(cacao, cafe, pInt, pAcid, pDulz, pComp) {
        const intensidadCacao = cacao.perfil_data.cacao || 0;
        const intensidadCafe = cafe.perfil_data.sabor || 0;
        const acidezCacao = cacao.perfil_data.acidez || 0;
        const acidezCafe = cafe.perfil_data.acidez || 0;
        const dulzuraCacao = cacao.perfil_data.caramelo || 0;
        const dulzuraCafe = cafe.perfil_data.dulzura || 0;
        
        let justificacion = `Este maridaje es una excelente opción. `;
        
        if (pInt > 80) {
            justificacion += `La intensidad de sabor del café (${intensidadCafe.toFixed(1)}/10) es muy similar a la intensidad del cacao (${intensidadCacao.toFixed(1)}/10), creando una base equilibrada. `;
        } else if (pInt > 60) {
             justificacion += `Hay una buena correspondencia entre la intensidad del café (${intensidadCafe.toFixed(1)}/10) y la del cacao (${intensidadCacao.toFixed(1)}/10). `;
        } else {
             justificacion += `Las intensidades del café (${intensidadCafe.toFixed(1)}/10) y del cacao (${intensidadCacao.toFixed(1)}/10) ofrecen un contraste interesante. `;
        }

        if (pAcid > 75) {
             justificacion += `Además, la elevada acidez de ambos (${acidezCafe.toFixed(1)} en café y ${acidezCacao.toFixed(1)} en cacao) se complementa perfectamente, aportando brillantez. `;
        }

        if (pDulz > 75) {
             justificacion += `Las notas de caramelo del cacao (${dulzuraCacao.toFixed(1)}/10) resuenan con la dulzura natural del café (${dulzuraCafe.toFixed(1)}/10), creando una experiencia rica y placentera.`;
        }

        return justificacion;
    }
    
    function renderRecomendaciones(recomendaciones) {
        if (recomendaciones.length === 0) {
            recomendacionesContainer.innerHTML = `<p class="text-center text-stone-500">No se encontraron maridajes compatibles.</p>`;
            return;
        }

        recomendacionesContainer.innerHTML = `
            <h2 class="text-3xl font-display text-center text-amber-900 mb-8">Mejores Maridajes</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                ${recomendaciones.map(rec => createCard(rec)).join('')}
            </div>
        `;
    }

    function createCard(rec) {
        const nombre = rec.producto.nombre || rec.producto.nombre_perfil;
        return `
            <div class="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-amber-800">
                <h3 class="text-xl font-bold font-display text-amber-900">${nombre}</h3>
                <div class="my-3">
                    <span class="font-bold text-lg text-green-700">Compatibilidad: ${rec.puntuacion.toFixed(0)}%</span>
                </div>
                <p class="text-sm text-stone-600 leading-relaxed">${rec.justificacion}</p>
            </div>
        `;
    }

    init();
});
