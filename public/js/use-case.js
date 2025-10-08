document.addEventListener('DOMContentLoaded', () => {
    const contentContainer = document.getElementById('use-case-content');
    
    const useCases = {
        cacao: {
            title: 'Trazabilidad del Cacao Fino de Aroma',
            description: 'Desde la mazorca hasta la tableta, AgriTraza te permite capturar cada detalle del proceso que hace único a tu chocolate. Comunica el origen, el perfil sensorial y la historia de tu productor para justificar tu valor premium.',
            scanText: 'Encuentre el recorrido de su cacao',
            securityImage: 'https://images.unsplash.com/photo-1611094435543-0c111304c431?q=80&w=2574&auto=format&fit=crop',
            process: [
                { icon: 'fa-leaf', title: 'Cosecha Selectiva', description: 'Registro del origen, la variedad y el punto exacto de maduración de cada mazorca.', fields: ['Finca de Origen', 'Variedad de Cacao', 'Fecha de Cosecha', 'Peso de Mazorcas (kg)'] },
                { icon: 'fa-hourglass-half', title: 'Fermentación Controlada', description: 'Monitorización de los días, método y temperatura para desarrollar perfiles de sabor complejos y consistentes.', fields: ['Método de Fermentación', 'Duración (días)', 'Frecuencia de Volteos', 'Temperatura Máxima (°C)'] },
                { icon: 'fa-sun', title: 'Secado al Sol', description: 'Control del proceso de secado para garantizar el nivel de humedad óptimo y prevenir defectos en el grano.', fields: ['Tipo de Secado', 'Duración (días)', 'Humedad Final (%)'] },
                { icon: 'fa-fire', title: 'Tostado de Precisión', description: 'Definición de curvas de tueste para revelar y potenciar las notas de sabor únicas de cada lote.', fields: ['Perfil de Tueste', 'Temperatura Mín./Máx.', 'Tiempo de Tueste (min)', 'Notas de Aroma'] },
            ]
        },
        cafe: {
            title: 'Trazabilidad del Café de Especialidad',
            description: 'Demuestra la calidad de tu café de origen único. Registra la altitud, el método de beneficio y el perfil de tueste para que tus clientes puedan saborear la historia detrás de cada taza.',
            scanText: 'Encuentre el recorrido de su café',
            securityImage: 'https://images.unsplash.com/photo-1559493233-13233a992329?q=80&w=2574&auto=format&fit=crop',
            process: [
                { icon: 'fa-leaf', title: 'Cosecha de Cerezas', description: 'Registro de la recolección manual de cerezas en su punto óptimo de maduración.', fields: ['Finca', 'Variedad', 'Altitud', 'Fecha de Cosecha'] },
                { icon: 'fa-water', title: 'Beneficio Húmedo', description: 'Control del proceso de despulpado, fermentación y lavado que define el perfil de acidez y limpieza en taza.', fields: ['Método de Beneficio', 'Horas de Fermentación', 'Tipo de Agua'] },
                { icon: 'fa-sun', title: 'Secado en Camas Africanas', description: 'Monitorización del secado lento y uniforme para preservar los delicados atributos del grano.', fields: ['Tipo de Secado', 'Días de Secado', 'Humedad Final (%)'] },
                { icon: 'fa-fire', title: 'Tueste por Perfil', description: 'Registro de la curva de tueste, temperatura y tiempo para desarrollar las notas de sabor deseadas.', fields: ['Perfil de Tueste', 'Máquina Tostadora', 'Tiempo de Desarrollo', 'Notas de Cata'] },
            ]
        },
        // ... (otros casos de uso se pueden añadir aquí con la misma estructura)
    };

    const params = new URLSearchParams(window.location.search);
    const product = params.get('product') || 'cacao'; // Default to cacao if not specified
    
    const data = useCases[product];

    if (data) {
        let processHtml = data.process.map(step => `
            <div class="bg-white p-6 rounded-lg shadow-md flex flex-col md:flex-row gap-6">
                <div class="flex-shrink-0 w-20 h-20 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center">
                    <i class="fas ${step.icon} text-3xl"></i>
                </div>
                <div class="flex-grow">
                    <h3 class="font-bold font-display text-xl mb-2">${step.title}</h3>
                    <p class="text-stone-600 mb-4">${step.description}</p>
                    <div class="pt-4 border-t border-stone-200">
                        <p class="text-sm font-semibold text-stone-700 mb-2">Campos Recolectados:</p>
                        <div class="flex flex-wrap gap-2">
                            ${step.fields.map(field => `<span class="text-xs bg-stone-200 text-stone-700 px-2 py-1 rounded-full">${field}</span>`).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `).join('');

        contentContainer.innerHTML = `
            <div class="max-w-4xl mx-auto">
                <header class="text-center mb-16">
                    <h1 class="text-4xl md:text-5xl font-display font-bold text-amber-900 mb-4">${data.title}</h1>
                    <p class="text-lg text-stone-600">${data.description}</p>
                </header>

                <section class="mb-16">
                    <h2 class="text-3xl font-display font-bold text-center mb-8">Etapas de Seguimiento</h2>
                    <div class="space-y-8">
                        ${processHtml}
                    </div>
                </section>

                <section class="my-16 bg-white p-8 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h2 class="text-3xl font-display font-bold text-amber-900 mb-4">Seguridad para tu Cliente</h2>
                        <p class="text-stone-600 mb-4">Con Rurulab, cada producto lleva un sello digital de autenticidad. Nuestro sistema de trazabilidad vincula el producto físico con su historia digital, ofreciendo a tus clientes una garantía inalterable de calidad y origen.</p>
                        <ul class="space-y-2">
                            <li class="flex items-center gap-3"><i class="fas fa-check-circle text-green-500"></i><span>Combate la falsificación y el fraude.</span></li>
                            <li class="flex items-center gap-3"><i class="fas fa-check-circle text-green-500"></i><span>Cumple con las normativas de exportación.</span></li>
                            <li class="flex items-center gap-3"><i class="fas fa-check-circle text-green-500"></i><span>Justifica el valor de tu producto premium.</span></li>
                        </ul>
                    </div>
                    <img src="${data.securityImage}" alt="Seguridad del producto" class="w-full h-64 object-cover rounded-md">
                </section>

                <section class="my-16 text-center">
                    <h2 class="text-3xl font-display text-amber-900 mb-4">${data.scanText}</h2>
                    <p class="text-stone-600 max-w-2xl mx-auto mb-6">Un simple escaneo del código QR en el empaque abre una puerta a una experiencia interactiva, conectando al consumidor directamente con la finca, el productor y cada etapa del proceso.</p>
                    <div class="flex justify-center">
                        <i class="fas fa-qrcode text-9xl text-stone-300"></i>
                    </div>
                </section>

                <section class="my-16 max-w-3xl mx-auto">
                    <h2 class="text-3xl font-display font-bold text-center mb-8">Preguntas Frecuentes</h2>
                    <div class="space-y-4">
                        <details class="bg-white p-4 rounded-lg shadow-sm">
                            <summary class="font-semibold cursor-pointer flex justify-between items-center">¿Necesito conocimientos técnicos para usar Rurulab?<i class="fas fa-plus plus-icon"></i><i class="fas fa-minus minus-icon"></i></summary>
                            <p class="mt-4 text-stone-600">No. Nuestra plataforma está diseñada para ser intuitiva y fácil de usar, permitiéndote registrar cada etapa del proceso desde tu celular o computadora sin complicaciones.</p>
                        </details>
                        <details class="bg-white p-4 rounded-lg shadow-sm">
                            <summary class="font-semibold cursor-pointer flex justify-between items-center">¿Puedo personalizar las etapas de mi proceso?<i class="fas fa-plus plus-icon"></i><i class="fas fa-minus minus-icon"></i></summary>
                            <p class="mt-4 text-stone-600">¡Sí! AgriTraza es completamente flexible. Con nuestro gestor de plantillas, puedes crear y personalizar las etapas y los campos de datos que son específicos para tu producto y método de producción.</p>
                        </details>
                    </div>
                </section>
            </div>
        `;
    } else {
        contentContainer.innerHTML = `<p class="text-center">Caso de uso no encontrado.</p>`;
    }
});

