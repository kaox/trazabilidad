document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('producto-selector');
    const recomendacionesContainer = document.getElementById('recomendaciones-container');
    let perfilesCacao = [];
    let perfilesCafe = [];
    let perfilesVino = [];

    async function init() {
        try {
            [perfilesCacao, perfilesCafe, perfilesVino] = await Promise.all([
                api('/api/perfiles'),
                api('/api/perfiles-cafe'),
                fetch('/maridajes.json').then(res => res.json()).then(data => data.defaultPerfilesVino)
            ]);
            populateSelector();
            selector.addEventListener('change', handleSelection);
            if (perfilesCacao.length > 0 || perfilesCafe.length > 0) {
                selector.selectedIndex = 1; // Seleccionar el primer producto real
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
            optionsHtml += `<optgroup label="Perfiles de Cacao">${perfilesCacao.map(p => `<option value="cacao-${p.id}">${p.nombre}</option>`).join('')}</optgroup>`;
        }
        if (perfilesCafe.length > 0) {
            optionsHtml += `<optgroup label="Perfiles de Café">${perfilesCafe.map(p => `<option value="cafe-${p.id}">${p.nombre_perfil}</option>`).join('')}</optgroup>`;
        }
        if (perfilesVino.length > 0) {
            optionsHtml += `<optgroup label="Perfiles de Vino">${perfilesVino.map(p => `<option value="vino-${p.id}">${p.nombre}</option>`).join('')}</optgroup>`;
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
        
        if (tipo === 'cacao') {
            productoBase = perfilesCacao.find(p => p.id == id);
            const recCafe = calcularMaridajes(productoBase, perfilesCafe, 'cacao-cafe');
            const recVino = calcularMaridajes(productoBase, perfilesVino, 'cacao-vino');
            renderRecomendaciones(recCafe, recVino, productoBase.nombre);
        } else if (tipo === 'cafe') {
            productoBase = perfilesCafe.find(p => p.id == id);
            const recCacao = calcularMaridajes(productoBase, perfilesCacao, 'cafe-cacao');
            renderRecomendaciones(recCacao, [], productoBase.nombre_perfil);
        } else if (tipo === 'vino') {
            productoBase = perfilesVino.find(p => p.id == id);
            const recCacao = calcularMaridajes(productoBase, perfilesCacao, 'vino-cacao');
            renderRecomendaciones(recCacao, [], productoBase.nombre);
        }
    }

    function calcularMaridajes(base, comparables, tipoMaridaje) {
        return comparables.map(item => {
            if (tipoMaridaje === 'cacao-cafe' || tipoMaridaje === 'cafe-cacao') {
                const cacao = tipoMaridaje === 'cacao-cafe' ? base : item;
                const cafe = tipoMaridaje === 'cacao-cafe' ? item : base;
                // Lógica Cacao-Café
                const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (cafe.perfil_data.sabor || 0)) / 10);
                const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (cafe.perfil_data.acidez || 0)) / 10);
                const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (cafe.perfil_data.dulzura || 0)) / 10);
                const pComp = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0))/2 - ((cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0))/2) / 10);
                const pFinal = ((pInt * 0.4) + (((pAcid + pDulz + pComp) / 3) * 0.6)) * 100;
                return { producto: item, puntuacion: pFinal, justificacion: generarJustificacionCacaoCafe(cacao, cafe), cacaoProfile: cacao, cafeProfile: cafe };
            } else if (tipoMaridaje === 'cacao-vino' || tipoMaridaje === 'vino-cacao') {
                const cacao = tipoMaridaje === 'cacao-vino' ? base : item;
                const vino = tipoMaridaje === 'cacao-vino' ? item : base;
                // Lógica Cacao-Vino
                const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (vino.perfil_data.intensidad || 0)) / 10);
                const pEst = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.astringencia || 0))/2 - (vino.perfil_data.taninos || 0)) / 10);
                const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (vino.perfil_data.acidez || 0)) / 10);
                const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (vino.perfil_data.dulzura || 0)) / 10);
                const bonusDulzura = (vino.perfil_data.dulzura || 0) >= (cacao.perfil_data.caramelo || 0) ? 1.1 : 1;
                const pArmonia = ((pAcid + pDulz) / 2) * bonusDulzura;
                const pFinal = ((pInt * 0.3) + (pEst * 0.3) + (pArmonia * 0.4)) * 100;
                return { producto: item, puntuacion: pFinal, justificacion: generarJustificacionCacaoVino(cacao, vino), cacaoProfile: cacao, vinoProfile: vino };
            }
        }).sort((a, b) => b.puntuacion - a.puntuacion).slice(0, 2);
    }

    function generarJustificacionCacaoCafe(cacao, cafe) { /* ... (lógica existente sin cambios) ... */ }
    function generarJustificacionCacaoVino(cacao, vino) {
        const intensidadCacao = cacao.perfil_data.cacao || 0;
        const intensidadVino = vino.perfil_data.intensidad || 0;
        const acidezCacao = cacao.perfil_data.acidez || 0;
        const acidezVino = vino.perfil_data.acidez || 0;
        let justificacion = `Una combinación fascinante. `;
        if (Math.abs(intensidadCacao - intensidadVino) < 2) {
            justificacion += `La intensidad del vino (${intensidadVino.toFixed(1)}) y del cacao (${intensidadCacao.toFixed(1)}) están en armonía. `;
        }
        if (Math.abs(acidezCacao - acidezVino) < 2.5) {
            justificacion += `Sus niveles de acidez (${acidezVino.toFixed(1)} y ${acidezCacao.toFixed(1)}) se realzan mutuamente.`;
        }
        return justificacion;
    }
    
    function renderRecomendaciones(recCafe, recVino, nombreProductoBase) {
        let html = `<h2 class="text-3xl font-display text-center text-amber-900 mb-8">Mejores Maridajes para ${nombreProductoBase}</h2>`;
        if (recCafe.length > 0) {
            html += `<h3 class="text-2xl font-display text-green-800 mb-4">Con Café:</h3>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">${recCafe.map((rec, i) => createCard(rec, `cafe-${i}`)).join('')}</div>`;
        }
        if (recVino.length > 0) {
            html += `<h3 class="text-2xl font-display text-red-800 mb-4">Con Vino:</h3>`;
            html += `<div class="grid grid-cols-1 md:grid-cols-2 gap-8">${recVino.map((rec, i) => createCard(rec, `vino-${i}`)).join('')}</div>`;
        }
        recomendacionesContainer.innerHTML = html;
        
        setTimeout(() => {
            recCafe.forEach((rec, i) => renderMaridajeChart(rec, `cafe-${i}`));
            recVino.forEach((rec, i) => renderMaridajeChart(rec, `vino-${i}`));
        }, 0);
    }

    function createCard(rec, index) {
        const nombre = rec.producto.nombre || rec.producto.nombre_perfil;
        return `
            <div class="bg-white p-6 rounded-2xl shadow-lg border-t-4 border-amber-800">
                <h3 class="text-xl font-bold font-display text-amber-900">${nombre}</h3>
                <div class="my-3"><span class="font-bold text-lg text-green-700">Compatibilidad: ${rec.puntuacion.toFixed(0)}%</span></div>
                <div class="my-4"><canvas id="maridaje-chart-${index}" width="300" height="300"></canvas></div>
                <p class="text-sm text-stone-600 leading-relaxed">${rec.justificacion}</p>
            </div>`;
    }

    function renderMaridajeChart(rec, index) {
        const canvas = document.getElementById(`maridaje-chart-${index}`);
        if (!canvas) return;

        const cacao = rec.cacaoProfile?.perfil_data;
        const cafe = rec.cafeProfile?.perfil_data;
        const vino = rec.vinoProfile?.perfil_data;
        
        const labels = ['Intensidad', 'Acidez', 'Dulzura', 'Cuerpo', 'Notas Frutales'];
        const datasets = [];

        if (cacao) {
            datasets.push({
                label: 'Cacao', data: [cacao.cacao || 0, cacao.acidez || 0, cacao.caramelo || 0, ((cacao.amargor || 0) + (cacao.astringencia || 0)) / 2, cacao.frutaFresca || 0],
                backgroundColor: 'rgba(120, 53, 15, 0.2)', borderColor: 'rgb(120, 53, 15)', pointBackgroundColor: 'rgb(120, 53, 15)'
            });
        }
        if (cafe) {
            datasets.push({
                label: 'Café', data: [cafe.sabor || 0, cafe.acidez || 0, cafe.dulzura || 0, cafe.cuerpo || 0, (cafe.fraganciaAroma || 0) / 2],
                backgroundColor: 'rgba(22, 101, 52, 0.2)', borderColor: 'rgb(22, 101, 52)', pointBackgroundColor: 'rgb(22, 101, 52)'
            });
        }
        if (vino) {
            datasets.push({
                label: 'Vino', data: [vino.intensidad || 0, vino.acidez || 0, vino.dulzura || 0, vino.cuerpo || 0, ((vino.intensidad || 0) + (vino.acidez || 0)) / 2],
                backgroundColor: 'rgba(159, 18, 57, 0.2)', borderColor: 'rgb(159, 18, 57)', pointBackgroundColor: 'rgb(159, 18, 57)'
            });
        }

        new Chart(canvas, {
            type: 'radar',
            data: { labels, datasets },
            options: { responsive: true, scales: { r: { suggestedMin: 0, suggestedMax: 10 } }, plugins: { legend: { position: 'top' } } }
        });
    }

    init();
});

