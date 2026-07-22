/**
 * landingRenderer.js
 * Genera el HTML de la landing page en el servidor para mejorar el SEO.
 */

const { buildProductUrl } = require('./productSlug');

const safeJSONParse = (str, fallback = []) => {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch (e) {
        return fallback;
    }
};

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

const renderProductCards = (products, phone, userId, hostUrl = '', companyName = '') => {
    if (!products || products.length === 0) {
        return `<div class="col-span-full text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200"><p class="text-stone-500 italic">No hay productos disponibles.</p></div>`;
    }

    const createSlug = text => (text || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

    return products.map(prod => {
        const prodImage = (prod.imagenes && prod.imagenes.length > 0) ? prod.imagenes[0] : 'https://placehold.co/400x300/f5f5f4/a8a29e?text=Producto';
        const hasTraceability = prod.recent_batches && prod.recent_batches.length > 0;
        const detailLink = buildProductUrl(companyName, userId, prod.nombre, prod.id);
        const fullDetailLink = hostUrl + detailLink;
        const buyLink = phone ? `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola, me interesa este producto: ${prod.nombre}. Link: ${fullDetailLink}`)}` : '#';

        const tipo = (prod.tipo_producto || '').toLowerCase();
        const typeIcon = tipo === 'cafe' ? 'fa-mug-hot' : (tipo === 'cacao' ? 'fa-cookie-bite' : 'fa-jar');
        const typeLabel = toTitleCase(prod.tipo_producto || 'Producto');
        const score = prod.puntaje_sca || null;

        const perf = prod.perfil_data || {};
        const weight = `${prod.peso || ''} ${prod.unidad || 'G'}`;

        // Atributos específicos según tipo
        let attrHtml = '';
        if (tipo === 'cafe') {
            attrHtml = `
                <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    ${perf.variedad ? `<span class="flex items-center gap-1.5"><i class="fas fa-seedling text-stone-400"></i> ${perf.variedad}</span>` : ''}
                    ${perf.proceso ? `<span class="flex items-center gap-1.5"><i class="fas fa-sync text-stone-400"></i> ${perf.proceso}</span>` : ''}
                    ${perf.tueste ? `<span class="flex items-center gap-1.5"><i class="fas fa-fire text-stone-400"></i> ${perf.tueste}</span>` : ''}
                </div>
            `;
        } else if (tipo === 'cacao') {
            attrHtml = `
                <div class="flex flex-wrap gap-x-4 gap-y-2 mt-4 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    ${perf.genetica ? `<span class="flex items-center gap-1.5"><i class="fas fa-dna text-stone-400"></i> ${perf.genetica}</span>` : ''}
                    ${perf.porcentaje_cacao ? `<span class="flex items-center gap-1.5"><i class="fas fa-percent text-stone-400"></i> ${perf.porcentaje_cacao}% CACAO</span>` : ''}
                </div>
            `;
        }

        // Información de Origen (Finca)
        const fincaName = prod.nombre_finca || 'Origen Verificado';
        const fincaLoc = [prod.finca_distrito, prod.finca_provincia, prod.finca_departamento].filter(Boolean).map(p => toTitleCase(p)).join(', ');
        const fincaAltura = prod.finca_altura ? `${prod.finca_altura} msnm` : '';

        return `
    <div class="product-card fade-in">
            <div class="h-64 relative overflow-hidden group">
                <img src="${prodImage}" class="w-full h-full object-cover transition duration-500 group-hover:scale-110">
                
                <!-- Badges superiores -->
                <div class="absolute top-4 left-4">
                    <span class="bg-white/95 backdrop-blur shadow-sm text-stone-800 text-[11px] font-bold px-3 py-1.5 rounded-full flex items-center gap-2">
                        <i class="fas ${typeIcon} text-amber-800"></i> ${typeLabel}
                    </span>
                </div>
                ${score ? `
                <div class="absolute top-4 right-4">
                    <span class="bg-amber-500 text-white text-[11px] font-black px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                        <i class="fas fa-star text-[9px]"></i> ${score} PTS
                    </span>
                </div>` : ''}
                
                <!-- Traceability Badge -->
                ${hasTraceability ? `
                <div class="absolute bottom-4 left-4">
                    <span class="bg-emerald-500/90 backdrop-blur text-white text-[9px] font-black px-2 py-1 rounded shadow-lg flex items-center gap-1">
                        <i class="fas fa-check-circle"></i> TRAZABLE
                    </span>
                </div>` : ''}
            </div>

            <div class="p-6 flex-grow flex flex-col">
                <div class="mb-4">
                    <h4 class="text-2xl font-display font-bold text-stone-900 leading-tight mb-1">${prod.nombre}</h4>
                    <div class="flex items-baseline gap-2">
                        <p class="text-stone-900 font-black text-2xl">${prod.moneda || 'S/'} ${prod.precio || '0.00'}</p>
                        <span class="text-stone-400 font-bold text-sm uppercase">${weight}</span>
                    </div>
                    ${attrHtml}
                </div>

                <!-- Finca Card -->
                <div class="bg-stone-50 rounded-2xl p-4 border border-stone-100 mb-6">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-white border border-stone-200 flex items-center justify-center flex-shrink-0 text-stone-400">
                            <i class="fas fa-map-marker-alt text-red-500/70 text-xs"></i>
                        </div>
                        <div>
                            <h5 class="font-bold text-stone-800 text-sm leading-tight">${fincaName}</h5>
                            <p class="text-[10px] text-stone-500 mt-0.5 line-clamp-1">${fincaLoc || 'Perú'}</p>
                            ${fincaAltura ? `<p class="text-[10px] font-bold text-amber-900 mt-1 flex items-center gap-1"><i class="fas fa-mountain text-[8px]"></i> ${fincaAltura}</p>` : ''}
                        </div>
                    </div>
                </div>

                <div class="mt-auto flex flex-col gap-3">
                    <a href="${buyLink}" target="_blank" class="btn-accent py-3 rounded-2xl font-bold text-sm shadow-sm flex items-center justify-center gap-2">
                        <i class="fab fa-whatsapp"></i> Comprar ahora
                    </a>
                    <a href="${detailLink}" class="block w-full text-center bg-stone-100 hover:bg-stone-200 text-stone-700 py-2.5 rounded-xl font-bold text-sm transition">Ver detalles</a>
                </div>
            </div>
        </div>`;
    }).join('');
};

const renderLanding = (data, hostUrl = '') => {
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
    let mapQuery = entity.direccion ? encodeURIComponent(entity.direccion + ', ' + locationStr) : '';
    if (entity.coordenadas) {
        const lat = Array.isArray(entity.coordenadas) ? entity.coordenadas[0] : (entity.coordenadas.lat || null);
        const lng = Array.isArray(entity.coordenadas) ? entity.coordenadas[1] : (entity.coordenadas.lng || null);
        if (lat && lng) mapQuery = `${lat},${lng}`;
    }

    const fullAddressHtml = `
        <div class="text-center mt-4">
            <p class="font-bold text-stone-800 text-sm mb-1 flex items-center justify-center gap-2">
                <i class="fas fa-map-marker-alt text-red-500"></i> ${locationStr}
            </p>
            ${entity.direccion ? `<p class="text-[11px] text-stone-500 uppercase tracking-tight">${entity.direccion}</p>` : ''}
        </div>
    `;

    let mapButtonHtml = '';
    if (mapQuery) {
        mapButtonHtml = `
            <a href="https://www.google.com/maps/dir/?api=1&destination=${mapQuery}" target="_blank" class="mt-6 block w-full text-center bg-white border border-stone-200 text-stone-800 font-bold py-3 rounded-2xl text-base hover:bg-stone-50 transition shadow-sm flex items-center justify-center gap-3 group">
                <i class="fas fa-location-arrow text-red-500 group-hover:animate-pulse"></i> Cómo llegar
            </a>`;
    }

    return `
        <div class="container mx-auto px-6 py-8 fade-in">
            ${claimBanner}
            
            <!-- HERO -->
            <div class="relative w-full h-64 md:h-96 rounded-3xl overflow-hidden mb-12 shadow-2xl group cursor-pointer">
               <img src="${coverImage}" class="w-full h-full object-cover transform group-hover:scale-105 transition duration-700">
               <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"></div>
               <div class="absolute bottom-0 left-0 w-full p-8 flex items-end gap-6">
                   <img src="${user.logo || 'https://placehold.co/100x100?text=Logo'}" class="w-24 h-24 md:w-32 md:h-32 rounded-2xl border-4 border-white shadow-lg bg-white object-contain">
                   <div class="text-white mb-2">
                       <span class="bg-accent text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3 inline-block shadow-lg">${typeLabel}</span>
                       <h1 class="text-3xl md:text-5xl font-display font-bold leading-tight">${entityName}</h1>
                       <p class="text-white/80 flex items-center gap-2 text-sm md:text-base"><i class="fas fa-map-marker-alt text-accent"></i> ${locationStr}</p>
                   </div>
               </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-12">
                <div class="lg:col-span-1 space-y-8">
                    <div class="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 about-section">
                        <h3 class="text-2xl font-display font-bold text-stone-900 mb-6 border-b border-stone-100 pb-4">Nuestra Historia</h3>
                        <div class="prose prose-sm text-stone-600 mb-6 italic leading-relaxed text-lg">"${historyText}"</div>
                        ${galleryHtml}
                        ${socialHtml}
                    </div>

                    <div class="bg-stone-50 p-8 rounded-3xl border border-stone-200">
                        <h3 class="text-xl font-bold text-stone-800 mb-6 flex items-center gap-3">
                            <i class="fas fa-mountain text-accent"></i> ${isFinca ? 'Terroir & Origen' : 'Ubicación'}
                        </h3>
                        <div id="mini-map" class="w-full h-56 bg-stone-200 rounded-2xl mb-6 shadow-inner"></div>
                        ${fullAddressHtml}
                        ${mapButtonHtml}
                        <div class="flex flex-wrap gap-3 mt-6">
                            ${(entity.certificaciones || []).map(c => `<div class="cert-card p-3 w-16 h-16 flex items-center justify-center" title="${c.nombre}"><img src="${c.logo_url}" class="max-w-full max-h-full object-contain"></div>`).join('')}
                        </div>
                    </div>
                </div>

                <div class="lg:col-span-2">
                    <div class="flex items-center justify-between mb-8">
                        <h3 class="text-3xl font-display font-bold text-stone-900">Productos Destacados</h3>
                        <a href="/tienda" data-page="tienda" class="text-accent font-bold hover:underline">Ver todo el catálogo <i class="fas fa-arrow-right ml-1"></i></a>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        ${renderProductCards(products.slice(0, 4), cleanPhone, user.id, hostUrl, entityName)}
                    </div>
                </div>
            </div>
        </div>
    `;
};

const renderCompanyList = (companies) => {
    if (!companies || companies.length === 0) {
        return `<p class="text-center py-20 text-stone-400">No hay empresas registradas.</p>`;
    }

    const createSlug = text => (text || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 fade-in">`;

    companies.forEach(c => {
        const logoSrc = c.logo || c.logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&background=f5f5f4&color=78350f&size=128`;
        const isFinca = c.type === 'finca';
        const typeColor = isFinca ? 'amber' : 'blue';
        const locationStr = [c.distrito, c.provincia, c.departamento, c.pais].filter(Boolean).map(p => toTitleCase(p)).join(', ') || 'Ubicación por verificar';

        let tagsHtml = '';
        let categories = [];
        try { categories = typeof c.product_categories === 'string' ? JSON.parse(c.product_categories) : (c.product_categories || []); } catch (e) { }

        if (categories.length > 0) {
            const topTags = categories.slice(0, 2).map(cat => {
                let icon = '';
                if (cat === 'cafe') icon = '☕ ';
                if (cat === 'cacao') icon = '🍫 ';
                if (cat === 'miel') icon = '🍯 ';
                return `<span class="text-[9px] font-bold bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded border border-stone-200 capitalize">${icon}${cat}</span>`;
            }).join(' ');
            const moreTag = categories.length > 2 ? `<span class="text-[9px] font-bold text-stone-400">+${categories.length - 2}</span>` : '';
            tagsHtml = `<div class="flex gap-1 mt-2">${topTags}${moreTag}</div>`;
        }

        const slug = createSlug(c.name) + '-' + c.id;
        const linkUrl = `/origen-unico/${slug}`;
        html += `
            <a href="${linkUrl}" class="group relative bg-white rounded-3xl border border-stone-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col h-full text-left no-underline">
                <div class="h-2 w-full bg-${typeColor}-600/20 group-hover:bg-${typeColor}-600 transition-colors duration-500"></div>
                <div class="p-6 flex flex-col h-full">
                    <div class="flex justify-between items-start mb-6">
                        <img src="${logoSrc}" class="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow-md bg-white">
                        ${c.status === 'pending' ? '<span class="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-full border border-amber-100">Sugerido</span>' : '<span class="text-[10px] font-bold text-green-700 bg-green-50 px-2 py-1 rounded-full border border-green-100"><i class="fas fa-check-circle"></i> Verificado</span>'}
                    </div>
                    <div class="flex-grow">
                        <span class="text-[10px] font-black uppercase tracking-[0.15em] text-${typeColor}-600 mb-1 block">${isFinca ? '<i class="fas fa-leaf mr-1"></i> Productor' : '<i class="fas fa-industry mr-1"></i> Procesadora'}</span>
                        <h3 class="text-2xl font-display font-black text-stone-900 leading-tight group-hover:text-amber-900 transition-colors line-clamp-2">${c.name}</h3>
                        <p class="text-sm text-stone-500 mt-1 flex items-center gap-2 font-medium"><i class="fas fa-map-marker-alt text-stone-300 group-hover:text-amber-600 transition-colors"></i> ${locationStr}</p>
                        ${tagsHtml}
                    </div>
                    <div class="mt-6 pt-5 border-t border-stone-100 flex items-center justify-between">
                        <div class="flex flex-col"><span class="text-[10px] font-bold text-stone-400 uppercase"></span><span class="text-lg font-black text-stone-800"></span></div>
                        <div class="text-sm font-bold text-amber-800 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-2 group-hover:translate-x-0">Ver Perfil <i class="fas fa-arrow-right ml-1"></i></div>
                    </div>
                </div>
            </a>`;
    });

    // Tarjeta "Tu Marca Aquí"
    html += `
        <div class="flex flex-col items-center justify-center p-8 rounded-3xl border-2 border-dashed border-amber-200 bg-amber-50/30 hover:bg-amber-50 hover:border-amber-400 cursor-pointer transition-all duration-500 min-h-[280px]">
            <div class="w-16 h-16 rounded-2xl bg-white border border-amber-100 flex items-center justify-center mb-4 shadow-sm"><i class="fas fa-plus text-3xl text-amber-500"></i></div>
            <h3 class="text-xl font-display font-bold text-amber-900 mb-2">¿Tu Marca Aquí?</h3>
            <p class="text-sm text-stone-600 text-center mb-6 max-w-[200px]">Únete a la red de transparencia global.</p>
            <span class="bg-amber-800 text-white text-xs font-bold px-6 py-3 rounded-xl shadow-lg hover:bg-amber-900 transition-all">Sugerir Empresa</span>
        </div></div>`;

    return html;
};

const renderMarketplaceProducts = (products) => {
    if (!products || products.length === 0) {
        return `<div class="col-span-full text-center py-16 bg-white rounded-2xl border border-dashed border-stone-300">
                    <i class="fas fa-search text-4xl text-stone-300 mb-4"></i>
                    <h3 class="text-lg font-bold text-stone-700">No hay productos disponibles</h3>
                </div>`;
    }

    const createSlug = text => (text || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-').replace(/^-+/, '').replace(/-+$/, '');

    let html = '';
    products.forEach(p => {
        const images = safeJSONParse(p.imagenes_json || '[]');
        const image = images.length > 0 ? images[0] : 'https://rurulab.com/images/placeholder-product.jpg';
        const type = p.tipo || 'cafe';
        const typeIcon = type === 'cafe' ? 'fa-mug-hot' : (type === 'cacao' ? 'fa-cookie-bite' : 'fa-jar');
        const score = p.puntuacion_taza || p.puntuacion_total || null;

        const slug = createSlug(p.nombre) + '-' + p.id.substring(0, 8);
        const compName = p.empresa?.nombre || p.empresa || 'empresa';
        const compId = p.empresa?.id || '';
        const linkUrl = compId
            ? buildProductUrl(compName, compId, p.nombre, p.id)
            : `/lote/${createSlug(p.nombre)}-${p.id}`;

        html += `
            <div class="product-card bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden flex flex-col relative group">
                <a href="${linkUrl}" class="block overflow-hidden relative aspect-square">
                    <img src="${image}" alt="${p.nombre}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500">
                    <div class="type-badge">
                        <i class="fas ${typeIcon}"></i>
                        <span class="capitalize">${type}</span>
                    </div>
                    ${score ? `<div class="score-badge">
                        <i class="fas fa-star"></i>
                        <span>${score}</span>
                    </div>` : ''}
                </a>
                
                <div class="p-4 flex flex-col flex-grow">
                    <div class="mb-3">
                        <p class="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1">${p.empresa || 'Productor Directo'}</p>
                        <h3 class="text-base font-bold text-stone-900 leading-tight line-clamp-2 min-h-[2.5rem]">
                            <a href="${linkUrl}" class="hover:text-amber-800 transition-colors">${p.nombre}</a>
                        </h3>
                    </div>

                    <!-- Perfil Sensorial Mini -->
                    <div class="mt-auto pt-3 border-t border-stone-50">
                        <div class="flex flex-wrap gap-1 mb-3">
                            ${(safeJSONParse(p.perfil_data || '{}').notas || []).slice(0, 3).map(nota =>
            `<span class="text-[9px] font-bold bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full border border-amber-100">${nota}</span>`
        ).join('')}
                        </div>
                        
                        <div class="flex justify-between items-center">
                            <span class="text-sm font-black text-stone-900">${p.precio ? `${p.moneda || 'S/'} ${p.precio}` : 'Consultar'}</span>
                            <a href="${linkUrl}" class="text-xs font-bold text-amber-800 hover:underline">Detalles &rarr;</a>
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    return html;
};

module.exports = { renderLanding, renderCompanyList, renderMarketplaceProducts };
