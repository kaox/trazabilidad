document.addEventListener('DOMContentLoaded', () => {
    initHelpMenu();
});

async function initHelpMenu() {
    try {
        // 1. Obtener datos
        const response = await fetch('/data/helper.json');
        const data = await response.json();

        // 2. Crear elementos DOM
        createFloatingButton();
        createMenuPanel(data);

        // 3. Event Listeners
        setupInteractions();

    } catch (error) {
        console.error("Error inicializando menú de ayuda:", error);
    }
}

function createFloatingButton() {
    const btn = document.createElement('button');
    btn.id = 'help-menu-btn';
    // Estilos Tailwind: Fijo abajo-derecha, circular, sombra, z-index alto
    btn.className = `
        fixed bottom-6 right-6 z-[9999] 
        w-14 h-14 rounded-full 
        bg-amber-600 hover:bg-amber-700 text-white 
        shadow-2xl flex items-center justify-center 
        transition-transform transform hover:scale-110 active:scale-95
        border-2 border-white
    `;
    btn.innerHTML = `<i class="fas fa-question text-2xl"></i>`;
    btn.title = "Guía de Configuración";
    document.body.appendChild(btn);

    // Pequeño badge de notificación (opcional, para llamar la atención)
    const badge = document.createElement('span');
    badge.className = "absolute top-0 right-0 -mt-1 -mr-1 flex h-4 w-4";
    badge.innerHTML = `
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-4 w-4 bg-sky-500"></span>
    `;
    btn.appendChild(badge);
}

function createMenuPanel(data) {
    const panel = document.createElement('div');
    panel.id = 'help-menu-panel';
    // Estilos: Oculto por defecto, posicionado arriba del botón, ancho limitado en móvil
    panel.className = `
        fixed bottom-24 right-6 z-[9999] 
        w-[90vw] max-w-sm 
        bg-white rounded-2xl shadow-2xl border border-stone-200
        transform transition-all duration-300 origin-bottom-right scale-0 opacity-0
        flex flex-col max-h-[75vh]
    `;

    // Header
    const header = `
        <div class="bg-amber-900 text-white p-4 rounded-t-2xl flex justify-between items-center shrink-0">
            <div>
                <h3 class="font-bold text-lg font-display">Guía RuruLab</h3>
                <p class="text-xs text-amber-200">Pasos para configurar tu cuenta</p>
            </div>
            <button id="close-help-btn" class="text-white/80 hover:text-white transition">
                <i class="fas fa-times text-xl"></i>
            </button>
        </div>
    `;

    // Body (Content)
    let bodyContent = `<div class="p-4 overflow-y-auto custom-scrollbar flex-grow space-y-4">`;

    data.forEach((bloque, index) => {
        bodyContent += `
            <div class="activity-block">
                <h4 class="text-xs font-bold text-stone-400 uppercase tracking-widest mb-3 border-b border-stone-100 pb-1">
                    ${bloque.actividad}
                </h4>
                <ul class="space-y-3">
                    ${bloque.tareas.map(tarea => renderTask(tarea)).join('')}
                </ul>
            </div>
        `;
    });

    bodyContent += `</div>`;

    // Footer
    const footer = `
        <div class="p-3 bg-stone-50 border-t border-stone-200 rounded-b-2xl text-center shrink-0">
            <a href="https://wa.me/51961222040" target="_blank" class="text-xs font-bold text-green-700 hover:text-green-900 flex items-center justify-center gap-2">
                <i class="fab fa-whatsapp text-lg"></i> ¿Necesitas soporte humano?
            </a>
        </div>
    `;

    panel.innerHTML = header + bodyContent + footer;
    document.body.appendChild(panel);
}

function renderTask(tarea) {
    const hasSubtasks = tarea.subtareas && tarea.subtareas.length > 0;
    
    let html = `
        <li class="group">
            <a href="${tarea.link || '#'}" class="flex items-start gap-3 p-2 rounded-lg hover:bg-stone-50 transition cursor-pointer">
                <div class="mt-1 w-5 h-5 rounded-full border-2 border-stone-300 text-transparent flex items-center justify-center group-hover:border-amber-500 transition">
                    <i class="fas fa-check text-[10px] group-hover:text-amber-500"></i>
                </div>
                <div class="flex-grow">
                    <span class="text-sm font-bold text-stone-700 group-hover:text-amber-800 transition block">
                        ${tarea.titulo}
                    </span>
    `;

    if (hasSubtasks) {
        html += `
            <ul class="mt-2 space-y-1 pl-1 border-l-2 border-stone-100 ml-1">
                ${tarea.subtareas.map(sub => `
                    <li class="text-xs text-stone-500 flex items-center gap-2">
                        <span class="w-1 h-1 rounded-full bg-stone-300"></span>
                        ${sub.titulo}
                    </li>
                `).join('')}
            </ul>
        `;
    }

    html += `
                </div>
                ${tarea.link ? '<i class="fas fa-chevron-right text-xs text-stone-300 group-hover:text-amber-500 mt-1.5"></i>' : ''}
            </a>
        </li>
    `;
    return html;
}

function setupInteractions() {
    const btn = document.getElementById('help-menu-btn');
    const panel = document.getElementById('help-menu-panel');
    const closeBtn = document.getElementById('close-help-btn');

    const toggleMenu = () => {
        const isClosed = panel.classList.contains('scale-0');
        if (isClosed) {
            panel.classList.remove('scale-0', 'opacity-0');
            panel.classList.add('scale-100', 'opacity-100');
            // Ocultar badge al abrir
            const badge = btn.querySelector('span.absolute');
            if(badge) badge.style.display = 'none';
        } else {
            panel.classList.remove('scale-100', 'opacity-100');
            panel.classList.add('scale-0', 'opacity-0');
        }
    };

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMenu();
    });

    // Cerrar al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!panel.contains(e.target) && !btn.contains(e.target)) {
            panel.classList.remove('scale-100', 'opacity-100');
            panel.classList.add('scale-0', 'opacity-0');
        }
    });
}d