/**
 * landingRenderer.js
 * Genera el HTML de la landing page en el servidor para mejorar el SEO.
 */

const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const extractYoutubeId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
};

const renderProductList = (products, phone, userId) => {
    if (!products || products.length === 0) {
        return `<div class="text-center py-12 bg-stone-50 rounded-xl border border-dashed border-stone-200"><p class="text-stone-500 italic">No hay productos disponibles.</p></div>`;
    }

    return products.map(prod => {
        const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
        const hasTraceability = prod.recent_batches && prod.recent_batches.length > 0;
        const hasSensory = prod.perfil_data && Object.values(prod.perfil_data).some(v => v > 0);
        const hasWheel = prod.notas_rueda && prod.notas_rueda.length > 0;
        const buyLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=Hola vi esto en RuruLab, me interesa: ${encodeURIComponent(prod.nombre)}` : '#';

        const createSlug = text => (text || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');
        const productName = createSlug(prod.nombre) || 'producto';
        const fincaName = prod.recent_batches && prod.recent_batches.length > 0 ? createSlug(prod.recent_batches[0].finca_origen) : 'origen';
        const detailLink = `/lote/${productName}-${fincaName}-${prod.id}`;

        const showTabs = hasSensory || hasWheel;

        const cardClasses = hasTraceability
            ? 'border-2 border-emerald-500/30 shadow-xl hover:shadow-2xl ring-1 ring-emerald-50/50'
            : 'border border-stone-200 shadow-sm hover:shadow-lg';

        const batchesHtml = hasTraceability ? prod.recent_batches.map(b => {
            const batchDate = new Date(b.fecha_finalizacion || Date.now()).toLocaleDateString();
            return `
            <a href="/${b.id}" target="_blank" class="flex-shrink-0 w-64 bg-stone-50 border border-stone-200 rounded-xl p-3 hover:border-amber-400 hover:shadow-md transition group no-underline text-left">
                <div class="flex justify-between items-start mb-2"><span class="font-mono text-[10px] font-bold text-stone-500 bg-white px-2 py-1 rounded border border-stone-100">${b.id}</span><i class="fas fa-external-link-alt text-stone-300 group-hover:text-amber-500 text-xs"></i></div>
                <p class="text-xs text-stone-600 font-bold mb-0.5 truncate">${b.finca_origen || 'Origen Protegido'}</p>
                <div class="text-[10px] text-stone-400 flex justify-between mt-2 pt-2 border-t border-stone-200"><span>${batchDate}</span><span class="text-green-600 font-bold"><i class="fas fa-shield-alt"></i> Inmutable</span></div>
            </a>`;
        }).join('') : '';

        return `
        <div class="bg-white rounded-2xl ${cardClasses} shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition duration-300 flex flex-col md:flex-row">
            <!-- Imagen -->
            <div class="md:w-1/3 h-56 md:h-auto relative group overflow-hidden bg-stone-100 flex-shrink-0">
                <img src="${prodImage}" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60"></div>
                                        
                    <div class="absolute top-3 left-3 bg-black/40 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded border border-white/20 uppercase tracking-wider">
                        ${prod.tipo_producto || 'Especialidad'}
                    </div>

                    ${hasTraceability ?
                `<div class="absolute top-0 right-0 z-20">
                            <div class="bg-gradient-to-r from-emerald-600 to-emerald-500 text-white text-[10px] font-black px-3 py-1.5 rounded-bl-2xl shadow-lg flex items-center gap-1.5">
                                <i class="fas fa-check-circle text-emerald-100 animate-pulse"></i>
                                <span class="tracking-wider">VERIFICADO</span>
                            </div>
                        </div>
                        <div class="absolute bottom-3 left-3 right-3 z-20">
                            <div class="bg-white/95 backdrop-blur-md p-2.5 rounded-xl shadow-xl border border-emerald-100 flex items-center gap-3">
                                <div class="bg-emerald-50 p-2 rounded-lg text-emerald-600">
                                    <i class="fas fa-link text-lg"></i>
                                </div>
                                <div class="flex flex-col leading-none">
                                    <span class="text-[9px] text-stone-400 uppercase tracking-widest font-bold">Insignia Digital</span>
                                    <span class="font-bold text-stone-800 text-sm">Trazabilidad Blockchain</span>
                                </div>
                            </div>
                        </div>` : ''}
            </div>

            <!-- Contenido -->
            <div class="md:w-2/3 flex flex-col">
                <!-- Cabecera -->
                <div class="p-6 pb-2">
                    <div class="flex justify-between items-start mb-1">
                        <div>
                            <h4 class="text-xl font-bold text-stone-900 leading-tight">${prod.nombre}</h4>
                            <p class="text-xs text-stone-500 font-bold mt-1 bg-stone-50 inline-block px-2 py-0.5 rounded border border-stone-100">
                                ${prod.peso || ''}
                            </p>
                        </div>
                        <div class="flex flex-wrap gap-1.5 justify-end ml-2">
                            ${(prod.premios || []).map(pr => `
                                <div class="flex flex-col items-center justify-center bg-white p-1.5 rounded-lg border border-stone-100 shadow-sm min-w-[3rem]" title="${pr.nombre || pr.name}">
                                    ${pr.logo_url ? `<img src="${pr.logo_url}" class="h-12 w-12 object-contain mb-0.5">` : `<i class="fas fa-medal text-amber-400 text-lg mb-0.5"></i>`}
                                    <span class="text-[9px] font-bold text-stone-600 leading-none">${pr.year || pr.ano || ''}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Pestañas -->
                ${showTabs ? `
                <div class="px-6 border-b border-stone-100 flex gap-4 text-sm font-medium">
                    <button class="tab-btn active pb-2 border-b-2 border-amber-800 text-amber-900 transition hover:text-amber-700">Detalles</button>
                    ${hasSensory ? `<button class="tab-btn pb-2 border-b-2 border-transparent text-stone-400 hover:text-stone-600 transition flex items-center gap-1"><i class="fas fa-chart-radar text-xs"></i> Perfil</button>` : ''}
                    ${hasWheel ? `<button class="tab-btn pb-2 border-b-2 border-transparent text-stone-400 hover:text-stone-600 transition flex items-center gap-1"><i class="fas fa-chart-pie text-xs"></i> Rueda</button>` : ''}
                </div>
                ` : ''}

                <!-- Contenedor de Pestañas -->
                <div class="p-6 pt-4 flex-grow relative tab-container">
                    
                    <!-- TAB 1: INFORMACIÓN -->
                    <div id="info-${prod.id}" class="tab-content active space-y-4 block opacity-100">
                        <p class="text-stone-600 text-sm leading-relaxed line-clamp-4">${prod.descripcion || 'Sin descripción detallada.'}</p>
                    </div>

                    <!-- TAB 2: PERFIL SENSORIAL (Placeholder for client-side Chart.js) -->
                    ${hasSensory ? `
                    <div id="sensory-${prod.id}" class="tab-content hidden opacity-0 h-48 w-full flex items-center justify-center">
                        <div class="w-full h-full max-w-md relative">
                            <canvas id="canvas-radar-${prod.id}"></canvas>
                        </div>
                    </div>` : ''}

                    <!-- TAB 3: RUEDA SABOR (Placeholder for client-side Chart.js) -->
                    ${hasWheel ? `
                    <div id="wheel-${prod.id}" class="tab-content hidden opacity-0 h-auto w-full flex flex-col items-center justify-center">
                        <div class="w-full h-full max-w-md relative">
                            <canvas id="canvas-wheel-${prod.id}-l1"></canvas>
                        </div>
                        <div id="canvas-wheel-${prod.id}-legend" class="mt-4 w-full"></div>
                    </div>` : ''}
                </div>
                
                <!-- AREA DE ACCIÓN -->
                <div class="px-6 pb-4">
                    <div class="flex items-center justify-between pt-3 border-t border-stone-100">
                        <span class="text-xs font-bold text-stone-400 uppercase tracking-widest">
                            ${hasTraceability ? `<i class="fas fa-cubes text-emerald-500"></i> ${prod.recent_batches.length} Lotes` : ''}
                        </span>
                        <div class="flex gap-2">
                            <a href="${detailLink}" class="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-200 hover:border-amber-300 px-4 py-2 rounded-xl text-sm font-bold transition flex items-center shadow-sm">
                                Ver Detalle
                            </a>
                            <a href="${buyLink}" target="_blank" class="bg-stone-900 hover:bg-stone-800 text-white px-5 py-2 rounded-xl text-sm font-bold transition flex items-center gap-2 shadow-lg">
                                <i class="fas fa-shopping-cart"></i> Comprar
                            </a>
                        </div>
                    </div>
                </div>

                <!-- Footer Lotes -->
                ${batchesHtml ? `<div class="bg-emerald-50/50 p-4 border-t border-emerald-100/50 backdrop-blur-sm"><p class="text-[10px] font-bold text-stone-400 mb-3 uppercase tracking-widest"><i class="fas fa-history text-emerald-500 mr-1"></i> Lotes con Trazabilidad</p><div class="flex gap-3 overflow-x-auto pb-2 scrollbar-hide snap-x">${batchesHtml}</div></div>` : ''}
            </div>
        </div>`;
    }).join('');
};

const renderLanding = (data) => {
    const { user, entity, products } = data;
    const isSuggested = user.is_suggested;
    const isFinca = user.type === 'finca';
    const entityName = isFinca ? (entity.nombre_finca || user.name) : (entity.nombre_comercial || user.name);
    const typeLabel = isFinca ? 'Finca de Origen' : 'Planta de Procesamiento';
    const locationStr = [entity.distrito, entity.provincia, entity.departamento, entity.pais].filter(Boolean).map(p => toTitleCase(p)).join(', ') || 'Ubicación no registrada';
    const historyText = user.history || entity.historia || 'Comprometidos con la calidad y la transparencia en cada grano.';

    const instagram = user.instagram || entity.social_instagram;
    const facebook = user.facebook || entity.social_facebook;

    let coverImage = 'https://images.unsplash.com/photo-1511537632536-b7a4896848a5?auto=format&fit=crop&q=80&w=1000';

    const mediaItems = [];
    if (!isSuggested) {
        if (user.cover && user.cover !== '') {
            coverImage = user.cover;
        } else if (entity.imagenes && entity.imagenes.length > 0) {
            coverImage = entity.imagenes[0];
        }
    }

    if (entity.imagenes && entity.imagenes.length > 0) {
        entity.imagenes.forEach(img => mediaItems.push({ type: 'image', src: img }));
    } else {
        mediaItems.push({ type: 'image', src: coverImage });
    }

    if (entity.video_link) {
        const videoId = extractYoutubeId(entity.video_link);
        if (videoId) {
            mediaItems.push({
                type: 'video',
                src: entity.video_link,
                videoId: videoId,
                thumb: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
            });
        }
    }

    const mediaJson = JSON.stringify(mediaItems).replace(/"/g, '&quot;');

    // Thumbnails logic
    const thumbnailsToShow = mediaItems.slice(1, 4);
    let galleryHtml = '';
    if (thumbnailsToShow.length > 0) {
        galleryHtml = `<div class="grid grid-cols-3 gap-2 mt-4">` +
            thumbnailsToShow.map((item, idx) => {
                const realIndex = idx + 1;
                if (item.type === 'video') {
                    return `
                    <div class="relative group cursor-pointer overflow-hidden rounded-lg border border-stone-100 h-20" onclick="app.openGallery(${realIndex}, ${mediaJson})">
                        <img src="${item.thumb}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500 filter brightness-75">
                        <div class="absolute inset-0 flex items-center justify-center">
                            <i class="fas fa-play-circle text-white text-3xl shadow-sm"></i>
                        </div>
                    </div>`;
                } else {
                    return `
                    <div class="relative group cursor-pointer overflow-hidden rounded-lg border border-stone-100 h-20" onclick="app.openGallery(${realIndex}, ${mediaJson})">
                        <img src="${item.src}" class="w-full h-full object-cover group-hover:scale-110 transition duration-500">
                        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    </div>`;
                }
            }).join('') +
            `</div>`;
    }

    const cleanPhone = user.celular ? String(user.celular).replace(/\D/g, '') : '';
    const waBase = cleanPhone ? `https://wa.me/${cleanPhone}` : '#';

    let socialHtml = '';
    if (instagram || facebook) {
        socialHtml += `<div class="flex gap-3 justify-center mt-6 pt-4 border-t border-stone-100">`;
        if (instagram) {
            const instaUrl = instagram.startsWith('http') ? instagram : `https://instagram.com/${instagram.replace('@', '')}`;
            socialHtml += `<a href="${instaUrl}" target="_blank" class="w-10 h-10 rounded-full bg-pink-50 text-pink-600 flex items-center justify-center hover:bg-pink-100 transition shadow-sm" title="Instagram"><i class="fab fa-instagram text-xl"></i></a>`;
        }
        if (facebook) {
            const fbUrl = facebook.startsWith('http') ? facebook : `https://facebook.com/${facebook}`;
            socialHtml += `<a href="${fbUrl}" target="_blank" class="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center hover:bg-blue-100 transition shadow-sm" title="Facebook"><i class="fab fa-facebook text-xl"></i></a>`;
        }
        socialHtml += `</div>`;
    }

    let claimBanner = '';
    if (isSuggested) {
        claimBanner = `
            <div class="bg-amber-100 border-l-4 border-amber-500 text-amber-900 p-4 mb-8 rounded shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex items-center gap-3">
                    <i class="fas fa-exclamation-circle text-2xl text-amber-600"></i>
                    <div>
                        <p class="font-bold">Perfil Sugerido por la Comunidad</p>
                        <p class="text-sm text-amber-800">Esta información ha sido generada por usuarios. ¿Eres el dueño de ${entityName}?</p>
                    </div>
                </div>
                <a href="/onboarding.html?claim_id=${user.id}" class="bg-amber-800 text-white px-6 py-2 rounded-lg font-bold hover:bg-amber-900 transition whitespace-nowrap shadow-md">Reclamar Perfil</a>
            </div>`;
    }

    const unverifiedStyle = isSuggested ? 'opacity-80 grayscale-[0.2]' : '';

    // Dirección y Mapa button
    let fullAddressHtml = '';
    let mapButtonHtml = '';

    if (!isFinca) {
        if (entity.direccion) {
            fullAddressHtml = `<p class="text-center text-xs text-stone-500 mb-4 px-2 leading-tight">${entity.direccion}</p>`;
        }

        let mapQuery = '';
        if (entity.coordenadas) {
            let lat, lng;
            if (Array.isArray(entity.coordenadas) && entity.coordenadas.length > 0) {
                if (Array.isArray(entity.coordenadas[0])) { lat = entity.coordenadas[0][0]; lng = entity.coordenadas[0][1]; }
            } else if (entity.coordenadas.lat) {
                lat = entity.coordenadas.lat; lng = entity.coordenadas.lng;
            }
            if (lat && lng) mapQuery = `${lat},${lng}`;
        }

        if (!mapQuery && entity.direccion) {
            mapQuery = encodeURIComponent(`${entity.direccion}, ${locationStr}`);
        }

        if (mapQuery) {
            mapButtonHtml = `
                <a href="https://www.google.com/maps/dir/?api=1&destination=${mapQuery}" target="_blank" class="block w-full text-center bg-white border border-stone-300 text-stone-700 font-bold py-2 rounded-lg text-sm hover:bg-stone-50 transition mb-4 shadow-sm group/btn">
                    <i class="fas fa-location-arrow mr-2 text-red-500 group-hover/btn:animate-pulse"></i> Cómo llegar
                </a>`;
        }
    }

    return `
        ${claimBanner}
        
        <!-- HERO SECTION -->
        <div class="relative w-full h-64 md:h-80 rounded-3xl overflow-hidden mb-8 shadow-xl group ${unverifiedStyle} cursor-pointer">
           <img src="${coverImage}" class="w-full h-full object-cover transform group-hover:scale-105 transition duration-700">
           <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
           <div class="absolute bottom-0 left-0 w-full p-6 md:p-8 flex items-end gap-6">
               <img src="${user.logo || 'https://placehold.co/100x100?text=Logo'}" class="w-24 h-24 md:w-32 md:h-32 rounded-xl border-4 border-white shadow-lg bg-white object-contain">
               <div class="text-white mb-2">
                   <span class="bg-amber-500 text-amber-900 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider mb-2 inline-block shadow-sm">${typeLabel}</span>
                   <h1 class="text-3xl md:text-5xl font-display font-bold leading-tight">${entityName}</h1>
                   <p class="text-amber-100 flex items-center gap-2 text-sm md:text-base opacity-90"><i class="fas fa-map-marker-alt"></i> ${locationStr}</p>
               </div>
           </div>
           <div class="absolute top-4 right-4 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full text-white text-[10px] font-bold uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
               <i class="fas fa-expand-alt mr-1"></i> Ver Galería
           </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 ${unverifiedStyle}">
            
            <!-- COLUMNA IZQUIERDA: IDENTIDAD -->
            <div class="lg:col-span-1 space-y-8">
                <div class="bg-white p-6 rounded-2xl shadow-sm border border-stone-100">
                    <h3 class="text-xl font-display font-bold text-amber-900 mb-4 border-b pb-2">Identidad</h3>
                    <div class="prose prose-sm text-stone-600 mb-4"><p class="italic">"${historyText}"</p></div>
                    ${galleryHtml}
                    ${socialHtml}
                    <div class="flex gap-2 mt-6">
                        <button class="flex-1 bg-stone-100 hover:bg-stone-200 text-stone-600 font-bold py-2 rounded-lg transition flex items-center justify-center gap-2 text-sm"><i class="fas fa-share-alt"></i> Compartir</button>
                        ${waBase !== '#' ? `<a href="${waBase}" target="_blank" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg text-center transition flex items-center justify-center gap-2 text-sm"><i class="fab fa-whatsapp text-lg"></i> Contactar</a>` : ''}
                    </div>
                </div>

                <!-- FICHA TÉCNICA -->
                <div class="bg-stone-50 p-6 rounded-2xl border border-stone-200">
                    <h3 class="text-lg font-bold text-stone-700 mb-4 flex items-center gap-2">
                        <i class="fas fa-mountain text-amber-600"></i> ${isFinca ? 'Terroir & Origen' : 'Ubicación & Calidad'}
                    </h3>
                    <div id="mini-map" class="w-full h-48 bg-stone-200 rounded-xl mb-3 relative"></div>

                    <p class="text-center font-bold text-stone-800 text-sm ${fullAddressHtml ? 'mb-1' : 'mb-4'}">
                        <i class="fas fa-map-pin text-red-500 mr-1"></i> ${locationStr}
                    </p>
                    
                    ${fullAddressHtml}
                    ${mapButtonHtml}

                    <ul class="space-y-3 text-sm">
                        ${isFinca && entity.altura ? `<li class="flex justify-between border-b border-stone-200 pb-2"><span class="text-stone-500">Altitud</span><span class="font-bold text-stone-800">${entity.altura} msnm</span></li>` : ''}
                    </ul>
                    
                    <div class="mt-4">
                        <span class="text-xs font-bold text-stone-400 uppercase block mb-2">Certificaciones</span>
                        <div class="flex flex-wrap gap-2">
                            ${(entity.certificaciones || []).map(c => `<div class="bg-white p-1.5 rounded border border-stone-200 shadow-sm" title="${c.nombre}"><img src="${c.logo_url}" class="h-8 w-8 object-contain"></div>`).join('')}
                            ${(!entity.certificaciones?.length) ? '<span class="text-stone-400 text-xs italic">--</span>' : ''}
                        </div>
                    </div>

                    <div class="mt-4">
                        <span class="text-xs font-bold text-stone-400 uppercase block mb-2">Premios</span>
                        <div class="flex flex-wrap gap-3">
                            ${(entity.premios || []).map(p => `
                                <div class="flex flex-col items-center">
                                    <div class="bg-white p-1.5 rounded-lg border border-stone-200 shadow-sm mb-1" title="${p.nombre}">
                                        <img src="${p.logo_url}" class="h-8 w-8 object-contain" alt="${p.nombre}">
                                    </div>
                                    <span class="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 rounded">${p.ano || p.year || ''}</span>
                                </div>
                            `).join('')}
                            ${(!entity.premios?.length) ? '<span class="text-stone-400 text-xs italic">--</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- COLUMNA DERECHA: CATÁLOGO -->
            <div class="lg:col-span-2">
                <h3 class="text-2xl font-display font-bold text-stone-800 mb-6 flex items-center gap-2"><i class="fas fa-store text-amber-600"></i> Catálogo Disponible</h3>
                <div class="space-y-6">
                    ${renderProductList(products, user.phone, user.id)}
                </div>
            </div>
        </div>
    `;
};

module.exports = { renderLanding };
