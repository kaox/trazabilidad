document.addEventListener('DOMContentLoaded', async () => {
    try {
        const batches = await fetch('/api/batches/tree').then(res => res.json());
        const processMetrics = {
            fermentacion: { totalInput: 0, totalOutput: 0, count: 0 },
            secado:       { totalInput: 0, totalOutput: 0, count: 0 },
            tostado:      { totalInput: 0, totalOutput: 0, count: 0 },
            molienda:     { totalInput: 0, totalOutput: 0, count: 0 }
        };
        const produccionPorFinca = {};
        const inventario = {
            'Cosechado (p/ fermentar)': { total: 0, unit: 'kg Baba'},
            'Fermentado (p/ secar)':   { total: 0, unit: 'kg Húmedo'},
            'Seco (p/ tostar)':        { total: 0, unit: 'kg Seco'},
            'Tostado (p/ moler)':      { total: 0, unit: 'kg Tostado'}
        };

        batches.forEach(c => {
            const finca = c.finca || 'No especificada';
            produccionPorFinca[finca] = (produccionPorFinca[finca] || 0) + (parseFloat(c.pesoBaba) || 0);
            let babaAsignada = 0;
            (c.fermentaciones || []).forEach(f => {
                babaAsignada += parseFloat(f.pesoBaba) || 0;
                processMetrics.fermentacion.totalInput += parseFloat(f.pesoBaba) || 0;
                processMetrics.fermentacion.totalOutput += parseFloat(f.pesoFermentadoHumedo) || 0;
                processMetrics.fermentacion.count++;
                let fermentadoAsignado = 0;
                (f.secados || []).forEach(s => {
                    fermentadoAsignado += parseFloat(s.pesoFermentadoHumedo) || 0;
                    processMetrics.secado.totalInput += parseFloat(s.pesoFermentadoHumedo) || 0;
                    processMetrics.secado.totalOutput += parseFloat(s.pesoSeco) || 0;
                    processMetrics.secado.count++;
                    let secoAsignado = 0;
                    (s.tostados || []).forEach(t => {
                        secoAsignado += parseFloat(t.pesoSeco) || 0;
                        processMetrics.tostado.totalInput += parseFloat(t.pesoSeco) || 0;
                        processMetrics.tostado.totalOutput += parseFloat(t.pesoTostado) || 0;
                        processMetrics.tostado.count++;
                        let tostadoAsignado = 0;
                        (t.moliendas || []).forEach(m => {
                            tostadoAsignado += parseFloat(m.pesoTostado) || 0;
                            processMetrics.molienda.totalInput += parseFloat(m.pesoTostado) || 0;
                            processMetrics.molienda.totalOutput += parseFloat(m.pesoProductoFinal) || 0;
                            processMetrics.molienda.count++;
                        });
                        inventario['Tostado (p/ moler)'].total += (parseFloat(t.pesoTostado) || 0) - tostadoAsignado;
                    });
                    inventario['Seco (p/ tostar)'].total += (parseFloat(s.pesoSeco) || 0) - secoAsignado;
                });
                inventario['Fermentado (p/ secar)'].total += (parseFloat(f.pesoFermentadoHumedo) || 0) - fermentadoAsignado;
            });
            inventario['Cosechado (p/ fermentar)'].total += (parseFloat(c.pesoBaba) || 0) - babaAsignada;
        });

        document.getElementById('inventory-cards').innerHTML = Object.keys(inventario).map(key => `
            <div class="bg-white p-5 rounded-2xl shadow-lg text-center">
                <p class="text-stone-500 text-sm">${key}</p>
                <p class="text-3xl font-bold text-amber-900 mt-2">${inventario[key].total.toFixed(2)}</p>
                <p class="text-stone-500 text-xs">${inventario[key].unit}</p>
            </div>`).join('');

        new Chart(document.getElementById('rendimientoChart'), {
            type: 'bar',
            data: {
                labels: ['Fermentación', 'Secado', 'Tostado', 'Molienda'],
                datasets: [{
                    label: 'Rendimiento (%)',
                    data: Object.values(processMetrics).map(m => m.totalInput > 0 ? (m.totalOutput / m.totalInput) * 100 : 0),
                    backgroundColor: 'rgba(120, 53, 15, 0.6)',
                    borderColor: 'rgba(120, 53, 15, 1)',
                    borderWidth: 1
                }]
            },
            options: { scales: { y: { beginAtZero: true, max: 100, ticks: { callback: v => v + '%' } } }, plugins: { legend: { display: false } } }
        });
        new Chart(document.getElementById('produccionChart'), {
            type: 'doughnut',
            data: {
                labels: Object.keys(produccionPorFinca),
                datasets: [{
                    data: Object.values(produccionPorFinca),
                    backgroundColor: ['rgba(120,53,15,0.7)', 'rgba(180,83,9,0.7)', 'rgba(217,119,6,0.7)', 'rgba(245,158,11,0.7)', 'rgba(251,191,36,0.7)'],
                    hoverOffset: 4
                }]
            }
        });
    } catch (error) {
        document.getElementById('inventory-cards').innerHTML = `<p class="text-red-500 col-span-full text-center">Error al cargar datos del dashboard.</p>`
    }
});