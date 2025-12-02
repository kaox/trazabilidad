document.addEventListener('DOMContentLoaded', () => {
    const contentContainer = document.getElementById('use-case-content');
    
    const useCases = {
        cacao: {
            title: 'Trazabilidad del Cacao Fino de Aroma',
            description: 'Desde la mazorca hasta la tableta, RuruLab te permite capturar cada detalle del proceso que hace único a tu chocolate. Comunica el origen, el perfil sensorial y la historia de tu productor para justificar tu valor premium.',
            scanText: 'Encuentre el recorrido de su cacao',
            securityImage: 'images/cacao.jpeg',
            qrImage: 'images/qr_cacao.png',
            qrLink: 'ENV-5W8BL4HE',
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
            securityImage: 'images/cafe.jpg',
            qrImage: 'images/qr_cafe.png',
            qrLink: 'EVA-SOEQC90S',
            process: [
                { icon: 'fa-leaf', title: 'Cosecha de Cerezas', description: 'Registro de la recolección manual de cerezas en su punto óptimo de maduración.', fields: ['Finca de Origen', 'Variedad', 'Altitud', 'Fecha de Cosecha'] },
                { icon: 'fa-water', title: 'Beneficio Húmedo', description: 'Control del proceso de despulpado, fermentación y lavado que define el perfil de acidez y limpieza en taza.', fields: ['Método de Beneficio', 'Horas de Fermentación', 'pH Inicial/Final'] },
                { icon: 'fa-sun', title: 'Secado', description: 'Monitorización del secado lento y uniforme para preservar los delicados atributos del grano.', fields: ['Tipo de Secado', 'Días de Secado', 'Humedad Final (%)','Temperatura de Secado (°C)'] },
                { icon: 'fa-fire', title: 'Tueste por Perfil', description: 'Registro de la curva de tueste, temperatura y tiempo para desarrollar las notas de sabor deseadas.', fields: ['Perfil de Tueste', 'Máquina Tostadora', 'Tiempo de Desarrollo', 'Notas de Cata'] },
            ]
        },
        pina: {
            title: 'Trazabilidad de la Piña Deshidratada',
            description: 'La transparencia es clave para los productos saludables. Muestra el origen de tu fruta, el proceso de deshidratación sin aditivos y garantiza la calidad de tu snack a los consumidores conscientes.',
            scanText: 'Encuentre el recorrido de su piña',
            securityImage: 'images/miel.jpg',
            process: [
                { icon: 'fa-leaf', title: 'Cosecha de Piña Orgánica', description: 'Registro del origen y la fecha de cosecha para garantizar la máxima frescura.', fields: ['Finca de Origen', 'Fecha de Cosecha', 'Calibre de la Fruta'] },
                { icon: 'fa-kitchen-set', title: 'Pelado y Rebanado', description: 'Control del grosor de las rodajas para un secado uniforme y una textura perfecta.', fields: ['Grosor de Rebanada (mm)', 'Fecha de Procesamiento'] },
                { icon: 'fa-wind', title: 'Deshidratación a Baja Temperatura', description: 'Monitorización del tiempo y la temperatura para preservar los nutrientes y el sabor natural de la fruta.', fields: ['Temperatura (°C)', 'Tiempo de Secado (horas)', 'Humedad Final (%)'] },
                { icon: 'fa-box-archive', title: 'Empaque al Vacío', description: 'Aseguramiento de la calidad final y la vida útil del producto mediante un empaque adecuado.', fields: ['Tipo de Empaque', 'Peso Neto (g)', 'Fecha de Empaque'] }
            ]
        },
        naranja: {
            title: 'Trazabilidad de Naranjas para Jugo',
            description: 'Desde el campo hasta el vaso. Registra la variedad, el punto de maduración y el proceso de prensado en frío para asegurar a tus clientes un jugo fresco, puro y de origen conocido.',
            scanText: 'Encuentre el recorrido de su naranja',
            securityImage: 'https://images.unsplash.com/photo-1611080626919-775a4048c231?q=80&w=2574&auto=format&fit=crop',
            process: [
                { icon: 'fa-tree', title: 'Recolección Manual', description: 'Registro del huerto y la fecha de recolección para garantizar el punto exacto de madurez.', fields: ['Huerto de Origen', 'Variedad', 'Fecha de Recolección'] },
                { icon: 'fa-arrows-left-right-to-line', title: 'Selección y Calibrado', description: 'Clasificación de la fruta por tamaño y calidad para asegurar un producto homogéneo.', fields: ['Calibre', 'Nivel de Brix (Dulzura)'] },
                { icon: 'fa-shower', title: 'Lavado y Cepillado', description: 'Proceso de limpieza para garantizar la inocuidad del producto antes del prensado.', fields: ['Método de Lavado', 'Fecha de Procesamiento'] },
                { icon: 'fa-compress', title: 'Prensado en Frío', description: 'Control de la temperatura y la presión para extraer un jugo puro que conserva todas sus vitaminas y sabor.', fields: ['Temperatura de Prensado', 'Rendimiento (Litros/kg)', 'Fecha de Prensado'] }
            ]
        },
        miel: {
            title: 'Trazabilidad de la Miel de Abeja',
            description: 'Desde la colmena hasta el frasco. Demuestra la pureza, el origen floral y las prácticas de apicultura sostenible detrás de tu miel.',
            scanText: 'Encuentre el recorrido de su miel',
            securityImage: 'images/miel.jpg',
            qrImage: 'images/qr_miel.png',
            qrLink: 'FIL-7VIEERIB',
            process: [
                { icon: 'fa-box-archive', title: 'Cosecha en Apiario', description: 'Registro de la recolección de las alzas, certificando la ubicación y la salud de las colmenas.', fields: ['Ubicación del Apiario', 'Fecha de Cosecha', 'Nº de Alzas', 'Flora Predominante'] },
                { icon: 'fa-cogs', title: 'Desoperculado y Extracción', description: 'Control del método de extracción para garantizar la pureza y la conservación de las propiedades de la miel.', fields: ['Método de Extracción', 'Fecha', 'Peso de Panales (kg)', 'Peso Miel Cruda (kg)'] },
                { icon: 'fa-filter', title: 'Filtrado y Decantación', description: 'Seguimiento del proceso de limpieza y maduración, donde la miel alcanza su textura y claridad final.', fields: ['Tipo de Filtrado', 'Tiempo de Madurez (días)', 'Temperatura de Sala', 'Peso Miel Madura (kg)'] },
            ]
        },
        queso: {
            title: 'Trazabilidad del Queso Artesanal',
            description: 'Cuenta la historia de tu queso, desde el pasto y la leche hasta la cava de maduración. Justifica su valor único registrando cada detalle del proceso.',
            scanText: 'Encuentre el recorrido de su queso',
            securityImage: 'https://images.unsplash.com/photo-1626966554245-483321cf7335?q=80&w=2574&auto=format&fit=crop',
            process: [
                { icon: 'fa-cow', title: 'Ordeño y Recolección', description: 'Registro de la calidad de la leche cruda, la base fundamental para un queso excepcional.', fields: ['Tipo de Ganado', 'Alimentación', 'Fecha de Ordeño', 'Volumen de Leche (L)'] },
                { icon: 'fa-temperature-three-quarters', title: 'Cuajado y Corte', description: 'Control preciso del tipo de cuajo, temperatura y tamaño del corte para definir la textura del queso.', fields: ['Tipo de Cuajo', 'Temperatura de Cuajado', 'Tiempo de Coagulación'] },
                { icon: 'fa-cubes', title: 'Moldeado y Prensado', description: 'Formación de la pieza y control de la presión para asegurar la correcta expulsión del suero.', fields: ['Tipo de Molde', 'Tiempo de Prensado', 'Presión Aplicada'] },
                { icon: 'fa-calendar-alt', title: 'Maduración en Cava', description: 'Seguimiento del tiempo, temperatura y humedad en la cava, donde el queso desarrolla su sabor y aroma final.', fields: ['Fecha de Entrada a Cava', 'Condiciones de Humedad', 'Frecuencia de Volteos', 'Tiempo de Maduración'] }
            ]
        }
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

                <section class="my-16 bg-white p-8 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h2 class="text-3xl font-display font-bold text-amber-900 mb-4">Información de seguimiento</h2>
                        <p class="text-stone-600 mb-4">En RuruLab, te conectamos directamente con el origen de tu producto. Documentamos cada etapa de la cadena de suministro para garantizar una calidad y responsabilidad absolutas. Con nuestra plataforma, puedes seguir el viaje completo de tu producto y verificar su historia</p>
                    </div>
                    <img src="images/use-case-ruta.png" alt="Informacion de seguimiento" class="w-full h-64 object-cover rounded-md">
                </section>

                <section class="my-16 bg-white p-8 rounded-lg shadow-md grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                    <div>
                        <h2 class="text-3xl font-display font-bold text-amber-900 mb-4">Perfil sensorial</h2>
                        <p class="text-stone-600 mb-4">Traduce la complejidad de tus evaluaciones de cata a un lenguaje visual que tus clientes entiendan. Nuestro gráfico de radar de perfil sensorial convierte los datos de expertos en una "huella sensorial" fácil de entender, permitiéndote mostrar de forma transparente y verificable el sabor excepcional de tu producto.</p>
                    </div>
                    <img src="images/use-case-perfil.png" alt="Perfil Sensorial" class="w-full h-64 object-cover rounded-md">
                </section>

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
                        <a href="/${data.qrLink}" target="_blank"><img src="${data.qrImage}" alt="qr code" ></a>
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
                            <p class="mt-4 text-stone-600">¡Sí! RuruLab es completamente flexible. Con nuestro gestor de plantillas, puedes crear y personalizar las etapas y los campos de datos que son específicos para tu producto y método de producción, incluso puedes decidir que campos se mostraran al cliente.</p>
                        </details>
                        <details class="bg-white p-4 rounded-lg shadow-sm">
                            <summary class="font-semibold cursor-pointer flex justify-between items-center">¿Qué es un pasaporte digital de producto y cómo funciona con los códigos QR?<i class="fas fa-plus plus-icon"></i><i class="fas fa-minus minus-icon"></i></summary>
                            <p class="mt-4 text-stone-600">Un pasaporte digital de producto es, en esencia, el "gemelo digital" de tu producto físico. Es un registro electrónico que recopila y comparte información clave a lo largo de todo su ciclo de vida, desde el origen de las materias primas hasta su fabricación y distribución. El código QR que imprimes y pegas en tu empaque actúa como una puerta de enlace: cuando un consumidor lo escanea con su teléfono, se conecta instantáneamente a este pasaporte digital, permitiéndole ver la historia completa y verificable del producto que tiene en sus manos.   </p>
                        </details>
                        <details class="bg-white p-4 rounded-lg shadow-sm">
                            <summary class="font-semibold cursor-pointer flex justify-between items-center">¿Por qué debería usar códigos QR para mostrar la trazabilidad de mis productos?<i class="fas fa-plus plus-icon"></i><i class="fas fa-minus minus-icon"></i></summary>
                            <p class="mt-4 text-stone-600">La razón principal es construir y fortalecer la confianza del consumidor. Los consumidores modernos están cada vez más preocupados por la seguridad, la calidad, la sostenibilidad y el origen de lo que compran. Al ofrecerles acceso directo a esta información, no solo respondes a sus inquietudes, sino que también demuestras un compromiso con la transparencia que fomenta la lealtad a la marca. Un código QR es una herramienta de bajo costo que te permite iniciar esta conversación con tu cliente en el momento más crucial: cuando está en la tienda, evaluando tu producto.</p>
                        </details>
                        <details class="bg-white p-4 rounded-lg shadow-sm">
                            <summary class="font-semibold cursor-pointer flex justify-between items-center">¿Cómo genero e imprimo los códigos QR para mis productos?<i class="fas fa-plus plus-icon"></i><i class="fas fa-minus minus-icon"></i></summary>
                            <p class="mt-4 text-stone-600">El propio aplicativo de trazabilidad se encarga de generar un código QR único para cada lote de producción que registras en el sistema. Una vez que has completado los datos de un lote (por ejemplo, después de procesar una cosecha de cacao o extraer un lote de miel), la plataforma te proporcionará el código QR. Luego, puedes imprimir estos códigos en etiquetas para adherirlas a tu empaque final.</p>
                        </details>
                    </div>
                </section>
            </div>
        `;
    } else {
        contentContainer.innerHTML = `<p class="text-center">Caso de uso no encontrado.</p>`;
    }
});

