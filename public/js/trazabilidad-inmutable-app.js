let chartInstances = {}; 
let FLAVOR_WHEELS_DATA = {};

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/data/flavor-wheels.json');
        FLAVOR_WHEELS_DATA = await response.json();
    } catch(e) { console.error("Error loading flavor data"); }

    await loadImmutableBatches();
});

async function loadImmutableBatches() {
    const tbody = document.getElementById('immutable-table-body');
    try {
        const batches = await api('/api/batches/immutable');
        console.log(batches);
        if (batches.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-6 py-12 text-center text-stone-400">
                        <p>No tienes lotes certificados con trazabilidad inmutable aún.</p>
                        <a href="/app/procesamiento" class="text-amber-800 hover:underline">Ir a Procesamiento</a>
                    </td>
                </tr>`;
            return;
        }

        tbody.innerHTML = batches.map(batch => {
            const hashShort = batch.blockchain_hash ? batch.blockchain_hash.substring(0, 8) + '...' : '...';
            const stars = renderStars(batch.avg_rating);
            const hasQualityData = batch.data && (batch.data.tipoPerfil || batch.data.tipoRuedaSabor);
            
            // Si no tiene GTIN, usamos un placeholder o 'undefined' que el generador manejará
            const gtinDisplay = batch.gtin || 'Pendiente';

            // --- NUEVO: Extracción de Origen (Finca y Ciudad) ---
            // Intentamos buscar en los campos comunes de data ('finca', 'finca_origen', 'ubicacion', 'ciudad')
            const fincaName = batch.data?.finca?.value || batch.data?.finca_origen?.value || 'Origen no registrado';
            const ciudadName = batch.data?.ciudad?.value || batch.data?.ubicacion?.value || '';
            const locationString = ciudadName ? `${fincaName}, ${ciudadName}` : fincaName;
            // ----------------------------------------------------

            return `
                <tr class="hover:bg-amber-50/50 transition-colors">
                    <td class="px-6 py-4">
                        <div class="flex items-center">
                            <div class="flex-shrink-0 h-10 w-10 bg-stone-100 rounded-lg flex items-center justify-center text-stone-600 font-bold border border-stone-200">
                                QR
                            </div>
                            <div class="ml-4">
                                <div class="text-sm font-bold text-gray-900">${batch.nombre_comercial || 'Lote Sin Producto'}</div>
                                <div class="text-xs font-mono text-gray-500">GTIN: ${gtinDisplay}</div>
                                <div class="text-[10px] text-green-600 mt-0.5"><i class="fas fa-lock text-[8px]"></i> Hash: ${hashShort}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="text-sm font-medium text-gray-900">${batch.tipo_proceso}</div>
                        <div class="text-xs text-gray-500 mb-1">
                            Lote: <span class="font-mono text-stone-700">${batch.id}</span>
                        </div>
                        <!-- NUEVO: Mostrar Ubicación -->
                        <div class="text-xs text-stone-500 flex items-center gap-1">
                            <i class="fas fa-map-marker-alt text-amber-700"></i>
                            <span class="font-medium">${locationString}</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-center">
                        <div class="flex flex-col gap-1">
                            <div class="text-xs text-stone-600"><strong>${batch.views || 0}</strong> escaneos</div>
                            <div class="flex items-center justify-center gap-1 text-xs text-stone-400">
                                ${stars} (${batch.total_reviews})
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 text-right text-sm font-medium space-x-2">
                        <a href="/${batch.id}" target="_blank" class="text-indigo-600 bg-indigo-50 p-2 rounded-lg" title="Ver Link">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                        <!-- Pasamos el GTIN y el ID a la función -->
                        <button onclick="downloadBrandedQR('${batch.id}', '${batch.gtin || ''}')" class="text-stone-800 bg-amber-100 hover:bg-amber-200 p-2 rounded-lg" title="Descargar QR GS1">
                            <i class="fas fa-qrcode"></i>
                        </button>
                        ${hasQualityData ? `
                            <button onclick="generatePDF('${batch.id}')" class="text-red-600 bg-red-50 hover:bg-red-100 p-2 rounded-lg" title="PDF">
                                <i class="fas fa-file-pdf"></i>
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error(error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-red-500 py-4">Error cargando datos.</td></tr>`;
    }
}

function renderStars(rating) {
    const r = Math.round(rating);
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<i class="fas fa-star ${i <= r ? 'text-yellow-400' : 'text-gray-200'}"></i>`;
    }
    return html;
}

// --- NUEVO: Generador QR GS1 con Canvas y Logo ---
window.downloadBrandedQR = function(loteId, gtin) {
    // 1. Construir URL GS1
    // Si no hay GTIN, usamos un placeholder genérico interno "00000000000000" para no romper la estructura
    const safeGtin = gtin && gtin.trim() !== '' ? gtin : '00000000000000';
    const url = `${window.location.origin}/01/${safeGtin}/10/${loteId}`;
    
    // 2. Configurar Generador
    // Usamos Tipo 0 (Auto) y Corrección de Error 'H' (High - 30%) para soportar el logo en el medio
    const qr = qrcode(0, 'H');
    qr.addData(url);
    qr.make();

    // 3. Preparar Canvas
    const canvas = document.getElementById('qr-canvas');
    const ctx = canvas.getContext('2d');
    
    // Tamaño de celda y margen
    const cellSize = 10;
    const margin = 4;
    const size = qr.getModuleCount() * cellSize + (margin * 2 * cellSize);
    
    canvas.width = size;
    canvas.height = size;

    // 4. Dibujar Fondo Blanco
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // 5. Dibujar Módulos del QR
    ctx.fillStyle = '#000000'; // Color del QR (Negro)
    const count = qr.getModuleCount();
    
    for (let row = 0; row < count; row++) {
        for (let col = 0; col < count; col++) {
            if (qr.isDark(row, col)) {
                ctx.fillRect(
                    (col + margin) * cellSize, 
                    (row + margin) * cellSize, 
                    cellSize, 
                    cellSize
                );
            }
        }
    }

    // 6. Dibujar Logo en el Centro
    // Usamos un logo genérico o el de la empresa si estuviera disponible. 
    // Para este ejemplo, uso un icono de huella dactilar de FontAwesome convertido a imagen o una URL fija
    // Aquí usaré una URL de placeholder segura. En producción, usa '/images/logo-rurulab-qr.png'
    const logoUrl = 'https://www.rurulab.com/images/logo.png'; 
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = logoUrl;
    
    img.onload = () => {
        // El logo debe ocupar aprox el 20-25% del QR
        const logoSize = size * 0.22; 
        const logoPos = (size - logoSize) / 2;

        // Dibujar un recuadro blanco detrás del logo para limpiar los puntos
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(logoPos - 5, logoPos - 5, logoSize + 10, logoSize + 10);
        
        // Dibujar el logo
        ctx.drawImage(img, logoPos, logoPos, logoSize, logoSize);

        // 7. Descargar
        const link = document.createElement('a');
        link.download = `GS1_QR_${gtin || 'Lote'}_${loteId}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    img.onerror = () => {
        // Si falla la imagen, descargamos el QR limpio sin logo
        const link = document.createElement('a');
        link.download = `GS1_QR_${loteId}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
    }
};

// --- Lógica de PDF (Reutilizada) ---
window.generatePDF = async function(batchId) {
    const btn = document.querySelector(`button[onclick="generatePDF('${batchId}')"]`);
    if(btn) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const history = await api(`/api/trazabilidad/${batchId}`);
        const stageData = history.stages.find(s => s.id === batchId);
        if (!stageData) throw new Error("Datos no encontrados");

        const template = history.ownerInfo;
        const fincaData = history.fincaData || {};
        const getVal = (data, key) => data && data[key] ? (data[key].value || data[key]) : '';
        
        let sensoryData = history.perfilSensorialData;
        let flavorData = history.ruedaSaborData;

        const container = document.getElementById('pdf-report-container');
        container.classList.remove('hidden');
        
        container.innerHTML = `
            <div class="font-sans text-stone-800 bg-white p-8 border-4 border-amber-900/10 h-full">
                <div class="flex justify-between items-center border-b-2 border-amber-800 pb-6 mb-8">
                    <div>
                        <h1 class="text-4xl font-display font-bold text-amber-900">Reporte de Calidad</h1>
                        <p class="text-stone-500 mt-1">Certificado de Análisis Sensorial</p>
                    </div>
                    <div class="text-right">
                        <h2 class="text-2xl font-bold text-stone-800">${template.empresa || 'Ruru Lab'}</h2>
                        <p class="text-xs text-stone-500 font-mono mt-1">Hash: ${stageData.blockchain_hash || 'N/A'}</p>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-8 mb-8">
                    <div class="bg-stone-50 p-6 rounded-xl">
                        <h3 class="font-bold text-xl text-amber-900 mb-4">Datos de Origen</h3>
                        <ul class="space-y-2 text-sm">
                            <li><strong>Código:</strong> ${batchId}</li>
                            <li><strong>Finca:</strong> ${fincaData.nombre_finca || getVal(stageData.data, 'finca') || '-'}</li>
                            <li><strong>Productor:</strong> ${fincaData.propietario || '-'}</li>
                            <li><strong>Ubicación:</strong> ${fincaData.ciudad || '-'}, ${fincaData.pais || '-'}</li>
                        </ul>
                    </div>
                    <div class="bg-amber-50 p-6 rounded-xl text-center flex flex-col justify-center">
                        <h3 class="font-bold text-xl text-amber-900 mb-2">Puntuación</h3>
                        <span class="text-6xl font-bold text-amber-900">${parseFloat(getVal(stageData.data, 'puntuacion') || 0).toFixed(2)}</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-8">
                    <div>
                        <h4 class="font-bold text-center mb-4">Perfil Sensorial</h4>
                        <div class="relative aspect-square"><canvas id="pdf-radar-chart"></canvas></div>
                    </div>
                    <div>
                        <h4 class="font-bold text-center mb-4">Rueda de Sabor</h4>
                        <div class="relative aspect-square flex items-center justify-center">
                            <canvas id="pdf-doughnut-chart" class="absolute inset-0"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (sensoryData) renderPdfRadarChart(sensoryData);
        if (flavorData) renderPdfFlavorChart(flavorData);

        await new Promise(r => setTimeout(r, 800));

        const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.8);
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`Certificado_${batchId}.pdf`);

    } catch (err) {
        console.error(err);
        alert("Error generando PDF: " + err.message);
    } finally {
        if(btn) btn.innerHTML = '<i class="fas fa-file-pdf"></i>';
        document.getElementById('pdf-report-container').classList.add('hidden');
    }
};

function renderPdfRadarChart(data) {
    const ctx = document.getElementById('pdf-radar-chart').getContext('2d');
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: Object.keys(data).map(k => k.charAt(0).toUpperCase() + k.slice(1)),
            datasets: [{ label: 'Perfil', data: Object.values(data), backgroundColor: 'rgba(146, 64, 14, 0.2)', borderColor: 'rgba(146, 64, 14, 1)', borderWidth: 2 }]
        },
        options: { animation: false, scales: { r: { suggestedMin: 0, suggestedMax: 10, ticks: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

function renderPdfFlavorChart(ruedaData) {
    const FLAVOR_DATA = ruedaData.tipo === 'cafe' ? FLAVOR_WHEELS_DATA.cafe : FLAVOR_WHEELS_DATA.cacao;
    if(!FLAVOR_DATA) return;
    const notes = typeof ruedaData.notas_json === 'string' ? JSON.parse(ruedaData.notas_json) : ruedaData.notas_json;
    const categories = {};
    notes.forEach(n => { if (!categories[n.category]) categories[n.category] = []; categories[n.category].push(n.subnote); });
    const labels = Object.keys(categories);
    const data = labels.map(c => categories[c].length);
    const colors = ['#ef4444', '#f97316', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6', '#d946ef', '#f43f5e'];

    new Chart(document.getElementById('pdf-doughnut-chart'), {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: data, backgroundColor: colors, borderWidth: 0 }] },
        options: { animation: false, plugins: { legend: { display: false }, datalabels: { display: false } } }
    });
}