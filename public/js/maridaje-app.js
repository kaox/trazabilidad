document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('producto-selector');
    const recomendacionesContainer = document.getElementById('recomendaciones-container');
    let perfilesCacao = [];
    let perfilesCafe = [];
    let perfilesVino = [];
    let perfilesQueso = [];

    async function init() {
        try {
            [perfilesCacao, perfilesCafe, perfilesVino, perfilesQueso] = await Promise.all([
                api('/api/perfiles?tipo=cacao'),
                api('/api/perfiles?tipo=cafe'),
                fetch('/data/maridajes_vino.json').then(res => res.json()).then(data => data.defaultPerfilesVino),
                fetch('/data/maridajes_quesos.json').then(res => res.json())
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
            optionsHtml += `<optgroup label="Perfiles de Café">${perfilesCafe.map(p => `<option value="cafe-${p.id}">${p.nombre}</option>`).join('')}</optgroup>`;
        }
        if (perfilesVino.length > 0) {
            optionsHtml += `<optgroup label="Perfiles de Vino">${perfilesVino.map(p => `<option value="vino-${p.id}">${p.nombre}</option>`).join('')}</optgroup>`;
        }
        if (perfilesQueso.length > 0) {
            optionsHtml += `<optgroup label="Perfiles de Queso">${perfilesQueso.map(p => `<option value="queso-${p.id}">${p.nombre}</option>`).join('')}</optgroup>`;
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
            const recQueso = calcularMaridajes(productoBase, perfilesQueso, 'cacao-queso');
            renderRecomendaciones({ cafe: recCafe, vino: recVino, queso: recQueso }, productoBase.nombre);
        } else {
            if (tipo === 'cafe') productoBase = perfilesCafe.find(p => p.id == id);
            if (tipo === 'vino') productoBase = perfilesVino.find(p => p.id == id);
            if (tipo === 'queso') productoBase = perfilesQueso.find(p => p.id == id);
            const recCacao = calcularMaridajes(productoBase, perfilesCacao, `${tipo}-cacao`);
            renderRecomendaciones({ cacao: recCacao }, productoBase.nombre || productoBase.nombre);
        }
    }
    
    function calcularMaridajes(base, comparables, tipoMaridaje) {
        return comparables.map(item => {
            let cacao, cafe, vino, queso;
            let puntuacionFinal = 0;
            let justificacion = 'Una combinación excelente por su equilibrio de perfiles.';

            if (tipoMaridaje.includes('cacao-cafe') || tipoMaridaje.includes('cafe-cacao')) {
                cacao = tipoMaridaje.startsWith('cacao') ? base : item;
                cafe = tipoMaridaje.startsWith('cacao') ? item : base;
                const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (cafe.perfil_data.sabor || 0)) / 10);
                const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (cafe.perfil_data.acidez || 0)) / 10);
                const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (cafe.perfil_data.dulzura || 0)) / 10);
                const pComp = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.madera || 0))/2 - ((cafe.perfil_data.cuerpo || 0) + (cafe.perfil_data.postgusto || 0))/2) / 10);
                puntuacionFinal = ((pInt * 0.4) + (((pAcid + pDulz + pComp) / 3) * 0.6)) * 100;
                justificacion = generarJustificacionCacaoCafe(cacao, cafe);
            } else if (tipoMaridaje.includes('cacao-vino') || tipoMaridaje.includes('vino-cacao')) {
                cacao = tipoMaridaje.startsWith('cacao') ? base : item;
                vino = tipoMaridaje.startsWith('cacao') ? item : base;
                const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (vino.perfil_data.intensidad || 0)) / 10);
                const pEst = 1 - (Math.abs(((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.astringencia || 0))/2 - (vino.perfil_data.taninos || 0)) / 10);
                const pAcid = 1 - (Math.abs((cacao.perfil_data.acidez || 0) - (vino.perfil_data.acidez || 0)) / 10);
                const pDulz = 1 - (Math.abs((cacao.perfil_data.caramelo || 0) - (vino.perfil_data.dulzura || 0)) / 10);
                const bonusDulzura = (vino.perfil_data.dulzura || 0) >= (cacao.perfil_data.caramelo || 0) ? 1.1 : 1;
                const pArmonia = ((pAcid + pDulz) / 2) * bonusDulzura;
                puntuacionFinal = ((pInt * 0.3) + (pEst * 0.3) + (pArmonia * 0.4)) * 100;
                justificacion = generarJustificacionCacaoVino(cacao, vino);
            } else if (tipoMaridaje.includes('cacao-queso') || tipoMaridaje.includes('queso-cacao')) {
                cacao = tipoMaridaje.startsWith('cacao') ? base : item;
                queso = tipoMaridaje.startsWith('cacao') ? item : base;
                const pInt = 1 - (Math.abs((cacao.perfil_data.cacao || 0) - (queso.perfil_data.intensidad || 0)) / 10);
                const contraste = ((queso.perfil_data.cremosidad || 0) + (queso.perfil_data.salinidad || 0)) * ((cacao.perfil_data.amargor || 0) + (cacao.perfil_data.astringencia || 0));
                const pContraste = Math.min(1, contraste / 200);
                let pArmonia = 0;
                if(queso.perfil_data.notas_sabor.includes('nuez') && (cacao.perfil_data.nuez || 0) > 5) pArmonia += 0.5;
                if(queso.perfil_data.notas_sabor.includes('caramelo') && (cacao.perfil_data.caramelo || 0) > 5) pArmonia += 0.5;
                puntuacionFinal = ((pInt * 0.4) + (pContraste * 0.4) + (pArmonia * 0.2)) * 100;
                justificacion = generarJustificacionCacaoQueso(cacao, queso);
            }

            return {
                producto: item,
                puntuacion: puntuacionFinal,
                justificacion,
                cacaoProfile: cacao,
                cafeProfile: cafe,
                vinoProfile: vino,
                quesoProfile: queso
            };
        }).sort((a, b) => b.puntuacion - a.puntuacion);
    }

    function generarJustificacionCacaoCafe(cacao, cafe) {
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

    function generarJustificacionCacaoQueso(cacao, queso) {
        const intensidadCacao = cacao.perfil_data.cacao || 0;
        const intensidadQueso = queso.perfil_data.intensidad || 0;
        let justificacion = `Una pairing audaz y delicioso. `;
        if (Math.abs(intensidadCacao - intensidadQueso) < 2.5) {
            justificacion += `La intensidad similar del queso (${intensidadQueso.toFixed(1)}) y del cacao (${intensidadCacao.toFixed(1)}) crea una base sólida. `;
        }
        if ((queso.perfil_data.cremosidad || 0) > 6 && (cacao.perfil_data.amargor || 0) > 6) {
            justificacion += `La cremosidad del queso equilibra a la perfección las notas amargas del chocolate.`;
        }
        return justificacion;
    }
    
    function renderRecomendaciones(recomendaciones, nombreProductoBase) {
        let html = `<h2 class="text-3xl font-display text-center text-amber-900 mb-8">Mejores Maridajes para ${nombreProductoBase}</h2>`;
        
        const renderGroup = (recs, type, colorClass) => {
            const excepcionales = recs.filter(r => r.puntuacion >= 90);
            const recomendados = recs.filter(r => r.puntuacion >= 75 && r.puntuacion < 90);
            
            let groupHtml = '';
            if (excepcionales.length > 0) {
                groupHtml += `<div class="mb-8">
                                <h4 class="text-xl font-display ${colorClass} mb-3">Sinergia Excepcional (Maridaje "Mágico")</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">${excepcionales.map((rec, i) => createCard(rec, `${type}-excepcional-${i}`)).join('')}</div>
                             </div>`;
            }
            if (recomendados.length > 0) {
                groupHtml += `<div>
                                <h4 class="text-xl font-display ${colorClass} mb-3">Muy Buen Maridaje (Altamente Recomendado)</h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">${recomendados.map((rec, i) => createCard(rec, `${type}-recomendado-${i}`)).join('')}</div>
                             </div>`;
            }
            return groupHtml;
        };

        if (recomendaciones.cafe?.length > 0) {
            html += `<h3 class="text-2xl font-display text-green-800 mb-4 border-b pb-2">Con Café:</h3>`;
            html += renderGroup(recomendaciones.cafe, 'cafe', 'text-green-700');
        }
        if (recomendaciones.vino?.length > 0) {
            html += `<h3 class="text-2xl font-display text-red-800 mt-12 mb-4 border-b pb-2">Con Vino:</h3>`;
            html += renderGroup(recomendaciones.vino, 'vino', 'text-red-700');
        }
        if (recomendaciones.queso?.length > 0) {
            html += `<h3 class="text-2xl font-display text-blue-800 mt-12 mb-4 border-b pb-2">Con Queso:</h3>`;
            html += renderGroup(recomendaciones.queso, 'queso', 'text-blue-700');
        }
        if (recomendaciones.cacao?.length > 0) {
            html += `<h3 class="text-2xl font-display text-amber-800 mt-12 mb-4 border-b pb-2">Con Cacao:</h3>`;
            html += renderGroup(recomendaciones.cacao, 'cacao', 'text-amber-700');
        }
        
        recomendacionesContainer.innerHTML = html;
        
        // CORRECCIÓN: Usar requestAnimationFrame para asegurar que el DOM esté listo
        requestAnimationFrame(() => {
            Object.entries(recomendaciones).forEach(([type, recs]) => {
                if (recs && recs.length > 0) {
                    const excepcionales = recs.filter(r => r.puntuacion >= 90);
                    const recomendados = recs.filter(r => r.puntuacion >= 75 && r.puntuacion < 90);
                    
                    excepcionales.forEach((rec, i) => renderMaridajeChart(rec, `${type}-excepcional-${i}`));
                    recomendados.forEach((rec, i) => renderMaridajeChart(rec, `${type}-recomendado-${i}`));
                }
            });
        });
    }

    function createCard(rec, index) {
        const nombre = rec.producto.nombre;
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
        if (!canvas) {
            console.error(`Canvas with id maridaje-chart-${index} not found`);
            return;
        }

        const getUnifiedProfile = (profile, type) => {
            if (!profile) return [0,0,0,0,0];
            const p = profile.perfil_data;
            if (type === 'cacao') return [p.cacao || 0, p.acidez || 0, p.caramelo || 0, ((p.amargor || 0) + (p.astringencia || 0)) / 2, (p.nuez || 0) + (p.floral || 0) + (p.especia || 0)];
            if (type === 'cafe') return [p.sabor || 0, p.acidez || 0, p.dulzura || 0, p.cuerpo || 0, (p.fraganciaAroma || 0) / 2];
            if (type === 'vino') return [p.intensidad || 0, p.acidez || 0, p.dulzura || 0, p.cuerpo || 0, ((p.intensidad || 0) + (p.acidez || 0)) / 2];
            if (type === 'queso') return [p.intensidad || 0, p.acidez || 0, p.cremosidad || 0, ((p.intensidad || 0) + (p.salinidad || 0)) / 2, p.notas_sabor.length > 3 ? 5 : 3];
        };

        const datasets = [];
        if(rec.cacaoProfile) datasets.push({ label: 'Cacao', data: getUnifiedProfile(rec.cacaoProfile, 'cacao'), backgroundColor: 'rgba(120, 53, 15, 0.2)', borderColor: 'rgb(120, 53, 15)' });
        if(rec.cafeProfile) datasets.push({ label: 'Café', data: getUnifiedProfile(rec.cafeProfile, 'cafe'), backgroundColor: 'rgba(22, 101, 52, 0.2)', borderColor: 'rgb(22, 101, 52)' });
        if(rec.vinoProfile) datasets.push({ label: 'Vino', data: getUnifiedProfile(rec.vinoProfile, 'vino'), backgroundColor: 'rgba(159, 18, 57, 0.2)', borderColor: 'rgb(159, 18, 57)' });
        if(rec.quesoProfile) datasets.push({ label: 'Queso', data: getUnifiedProfile(rec.quesoProfile, 'queso'), backgroundColor: 'rgba(59, 130, 246, 0.2)', borderColor: 'rgb(59, 130, 246)' });

        new Chart(canvas, {
            type: 'radar',
            data: { labels: ['Intensidad', 'Acidez', 'Riqueza/Dulzura', 'Cuerpo/Estructura', 'Complejidad Aromática'], datasets },
            options: { responsive: true, scales: { r: { suggestedMin: 0, suggestedMax: 10 } }, plugins: { legend: { position: 'top' } } }
        });
    }

    init();
});

