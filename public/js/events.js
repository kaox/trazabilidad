// Lógica para la página pública de eventos (events.html)
document.addEventListener('DOMContentLoaded', () => {
    const upcomingContainer = document.getElementById('upcoming-events');
    const pastContainer = document.getElementById('past-events');

    // Cargar los posts al iniciar
    loadEvents();

    async function loadEvents() {
        try {
            const response = await fetch(`/api/events`);
            if (!response.ok) throw new Error('Error en la red');

            const { upcoming, past } = await response.json();

            renderSection(upcoming, upcomingContainer, true);
            renderSection(past, pastContainer, false);
        } catch (error) {
            console.error("Error cargando eventos:", error);
            const errorMsg = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-exclamation-circle text-4xl text-stone-300 mb-4"></i>
                    <p class="text-stone-500">No se pudieron cargar los eventos. Intenta recargar la página.</p>
                </div>
            `;
            upcomingContainer.innerHTML = errorMsg;
        }
    }

    /**
     * Calcula los días faltantes para una fecha.
     */
    function getDaysRemaining(targetDate) {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const target = new Date(targetDate + 'T00:00:00');
        const diffTime = target - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays;
    }

    function formatEventDateRange(startDate, endDate) {
        if (!startDate) return null;
        const opts = { year: 'numeric', month: 'long', day: 'numeric' };
        const optsShort = { day: 'numeric' };
        const start = new Date(startDate + 'T00:00:00');
        const formattedStart = start.toLocaleDateString('es-ES', opts);
        if (!endDate || startDate === endDate) return formattedStart;
        const end = new Date(endDate + 'T00:00:00');
        if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
            const endDay = end.toLocaleDateString('es-ES', optsShort);
            return `${start.getDate()} – ${endDay} de ${start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`;
        }
        const formattedEnd = end.toLocaleDateString('es-ES', opts);
        return `${formattedStart} – ${formattedEnd}`;
    }

    function formatLocation(city, department, country) {
        const parts = [city, department, country].filter(Boolean);
        return parts.length > 0 ? parts.join(', ') : null;
    }

    function renderSection(events, container, isUpcoming) {
        container.innerHTML = '';

        if (!events || events.length === 0) {
            if (isUpcoming) {
                container.innerHTML = `
                    <div class="col-span-full text-center py-10 bg-stone-50 rounded-2xl border border-stone-100">
                        <p class="text-stone-400 text-sm italic">No hay eventos próximos programados por ahora.</p>
                    </div>
                `;
            } else {
                container.innerHTML = `
                    <div class="col-span-full text-center py-10">
                        <p class="text-stone-400 text-sm italic">No hay registros de eventos pasados.</p>
                    </div>
                `;
            }
            return;
        }

        const html = events.map(event => {
            const imageSrc = event.cover_image || 'https://placehold.co/600x400/78350f/ffffff?text=Evento';
            const dateRange = formatEventDateRange(event.event_start_date, event.event_end_date);
            const location = formatLocation(event.event_city, event.event_department, event.event_country);

            let statusBadge = '';
            let countdownBadge = '';

            if (event.event_start_date) {
                const now = new Date();
                now.setHours(0, 0, 0, 0);
                const start = new Date(event.event_start_date + 'T00:00:00');
                const end = event.event_end_date ? new Date(event.event_end_date + 'T23:59:59') : new Date(event.event_start_date + 'T23:59:59');

                if (now < start) {
                    const daysLeft = getDaysRemaining(event.event_start_date);
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 uppercase tracking-wider"><i class="fas fa-clock text-[9px]"></i> Próximamente</span>`;
                    
                    if (daysLeft > 0) {
                        const dayText = daysLeft === 1 ? 'día' : 'días';
                        countdownBadge = `<div class="absolute bottom-3 left-3 z-20 bg-amber-800 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg">Faltan ${daysLeft} ${dayText}</div>`;
                    } else {
                        countdownBadge = `<div class="absolute bottom-3 left-3 z-20 bg-emerald-600 text-white px-3 py-1 rounded-lg text-xs font-bold shadow-lg">¡Es mañana!</div>`;
                    }

                } else if (now >= start && now <= end) {
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider animate-pulse"><i class="fas fa-circle text-[7px]"></i> En curso</span>`;
                } else {
                    statusBadge = `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-500 uppercase tracking-wider"><i class="fas fa-check text-[9px]"></i> Finalizado</span>`;
                }
            }

            return `
            <article class="bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full group">
                <a href="/events/${event.slug}" class="block h-56 overflow-hidden relative">
                    <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors z-10"></div>
                    ${statusBadge ? `<div class="absolute top-3 right-3 z-20">${statusBadge}</div>` : ''}
                    ${countdownBadge}
                    <img src="${imageSrc}" 
                         alt="${event.title}" 
                         class="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-700"
                         loading="lazy">
                </a>
                <div class="p-6 flex-grow flex flex-col">
                    ${dateRange ? `
                    <div class="flex items-center gap-2 text-xs text-amber-700 font-bold mb-2 uppercase tracking-wide">
                        <i class="far fa-calendar-alt"></i>
                        <span>${dateRange}</span>
                    </div>
                    ` : ''}

                    ${location ? `
                    <div class="flex items-center gap-2 text-xs text-stone-500 mb-3">
                        <i class="fas fa-map-marker-alt text-rose-400"></i>
                        <span>${location}</span>
                    </div>
                    ` : ''}
                    
                    <h3 class="text-xl font-display font-bold text-stone-900 mb-3 leading-snug group-hover:text-amber-800 transition-colors">
                        <a href="/events/${event.slug}">
                            ${event.title}
                        </a>
                    </h3>
                    
                    <p class="text-stone-600 text-sm mb-6 line-clamp-3 leading-relaxed flex-grow">
                        ${event.summary || 'Sin resumen disponible.'}
                    </p>
                    
                    <div class="mt-auto border-t border-stone-100 pt-4 flex justify-between items-center">
                        <a href="/events/${event.slug}" class="text-sm font-bold text-amber-800 hover:text-amber-900 flex items-center gap-2 group/link">
                            Ver evento <i class="fas fa-arrow-right text-xs transform group-hover/link:translate-x-1 transition-transform"></i>
                        </a>
                    </div>
                </div>
            </article>
            `;
        }).join('');

        container.innerHTML = html;
    }
});