/**
 * pricing.js — Configuración centralizada de precios y lógica de negocio
 * Cotizador web · Agencia Web
 *
 * IMPORTANTE: Toda la lógica de precios vive aquí.
 * La UI NO contiene reglas de negocio dispersas.
 */

'use strict';

// ─── Número de WhatsApp (configurable) ────────────────────────────────────────
const WHATSAPP_NUMBER = '51957834892'; // ← Cambiar al número real

// ─── Definición de servicios ──────────────────────────────────────────────────
const SERVICES = {
  landing: {
    id: 'landing',
    name: 'Landing Page',
    description: 'Una página de alto impacto diseñada para convertir visitas en clientes.',
    icon: 'monitor',
    base: 800,
    fromLabel: 'S/ 800',
    quantity: {
      id: 'sections',
      label: '¿Cuántas secciones necesitas?',
      min: 1,
      max: 12,
      default: 4,
      unit: 'sección',
      unitPlural: 'secciones',
      pricePerExtra: 200,
      baseIncludes: 1,
    },
    extras: [
      { id: 'multilang', label: 'Varios idiomas', price: 150, icon: 'globe' },
      { id: 'animations', label: 'Animaciones / 3D', price: 200, icon: 'sparkles' },
      { id: 'contactform', label: 'Formulario de contacto', price: 250, icon: 'mail' },
      { id: 'blog', label: 'Blog', price: 250, icon: 'book-open' },
    ],
  },

  web: {
    id: 'web',
    name: 'Página Web',
    description: 'Sitio corporativo a medida con múltiples páginas y estructura profesional.',
    icon: 'globe',
    base: 1200,
    fromLabel: 'S/ 1,200',
    quantity: {
      id: 'pages',
      label: '¿Cuántas páginas necesitas?',
      min: 1,
      max: 10,
      default: 5,
      unit: 'página',
      unitPlural: 'páginas',
      pricePerExtra: 300,
      baseIncludes: 1,
    },
    extras: [
      { id: 'cms', label: 'Editar textos tú mismo / CMS', price: 500, icon: 'edit' },
      { id: 'multilang', label: 'Varios idiomas', price: 150, icon: 'globe' },
      { id: 'blog', label: 'Blog / noticias', price: 250, icon: 'book-open' },
      { id: 'integrations', label: 'Conexión con otros sistemas', price: 250, icon: 'link' },
    ],
  },

  ecommerce: {
    id: 'ecommerce',
    name: 'Tienda Virtual',
    description: 'Ecommerce completo listo para vender tus productos online.',
    icon: 'shopping-cart',
    base: 2000,
    fromLabel: 'S/ 2,000',
    catalogSize: {
      label: '¿Qué tamaño tendrá tu catálogo?',
      options: [
        { id: 'small', label: 'Hasta 50 productos', sublabel: '+S/ 100', price: 100 },
        { id: 'medium', label: '50 – 500 productos', sublabel: '+S/ 250', price: 250 },
        { id: 'large', label: '+500 productos', sublabel: '+S/ 400', price: 400 },
      ],
      default: 'small',
    },
    extras: [
      { id: 'payments', label: 'Pagos con tarjeta', price: 300, icon: 'credit-card' },
      { id: 'multicurrency', label: 'Varias monedas e idiomas', price: 150, icon: 'globe' },
      { id: 'sunat', label: 'Facturación electrónica (SUNAT)', price: 1000, icon: 'file-text' },
    ],
  },
};

const TIMELINE_OPTIONS = [
  { id: 'flexible', label: 'Flexible' },
  { id: '1-2months', label: '1–2 meses' },
  { id: 'urgent', label: 'Urgente (<1 mes)' },
];

function calculateTotal(state) {
  const { serviceId, quantity, catalogSize, extras } = state;
  const service = SERVICES[serviceId];
  if (!service) return 0;
  let total = service.base;
  if (service.quantity && quantity != null) {
    const additionalUnits = Math.max(0, quantity - service.quantity.baseIncludes);
    total += additionalUnits * service.quantity.pricePerExtra;
  }
  if (service.catalogSize && catalogSize) {
    const sizeOption = service.catalogSize.options.find(o => o.id === catalogSize);
    if (sizeOption) total += sizeOption.price;
  }
  if (service.extras && extras && extras.length) {
    for (const extraId of extras) {
      const extra = service.extras.find(e => e.id === extraId);
      if (extra) total += extra.price;
    }
  }
  return total;
}

function formatPrice(amount) {
  return 'S/ ' + amount.toLocaleString('es-PE');
}

function buildConfigSummary(state) {
  const { serviceId, quantity, catalogSize, extras } = state;
  const service = SERVICES[serviceId];
  if (!service) return [];
  const lines = [];
  if (service.quantity && quantity != null) {
    const u = quantity === 1 ? service.quantity.unit : service.quantity.unitPlural;
    lines.push(quantity + ' ' + u);
  }
  if (service.catalogSize && catalogSize) {
    const sizeOption = service.catalogSize.options.find(o => o.id === catalogSize);
    if (sizeOption) lines.push(sizeOption.label);
  }
  if (service.extras && extras && extras.length) {
    for (const extraId of extras) {
      const extra = service.extras.find(e => e.id === extraId);
      if (extra) lines.push(extra.label);
    }
  }
  return lines;
}

function buildWhatsAppMessage(state, contact) {
  const service = SERVICES[state.serviceId];
  const configLines = buildConfigSummary(state);
  const total = calculateTotal(state);
  const configText = configLines.map(function (l) { return '- ' + l; }).join('\n');
  let message = 'Hola, quiero cotizar un proyecto web.\n\n';
  message += 'Tipo:\n' + service.name + '\n\n';
  message += 'Configuración:\n' + configText + '\n\n';
  message += 'Estimado:\n' + formatPrice(total) + '\n\n';
  if (contact.name) message += 'Nombre:\n' + contact.name + '\n\n';
  if (contact.company) message += 'Empresa:\n' + contact.company + '\n\n';
  if (contact.email) message += 'Email:\n' + contact.email + '\n\n';
  if (contact.timeline) {
    const tl = TIMELINE_OPTIONS.find(function (t) { return t.id === contact.timeline; });
    if (tl) message += 'Plazo:\n' + tl.label + '\n\n';
  }
  if (contact.notes) message += 'Comentario:\n' + contact.notes + '\n\n';
  const encoded = encodeURIComponent(message.trim());
  return 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encoded;
}

function buildCopySummary(state, contact) {
  const service = SERVICES[state.serviceId];
  const configLines = buildConfigSummary(state);
  const total = calculateTotal(state);
  let text = '== COTIZACIÓN WEB ==\n\n';
  text += 'Servicio: ' + service.name + '\n';
  text += 'Configuración:\n' + configLines.map(function (l) { return '  · ' + l; }).join('\n') + '\n';
  text += 'Estimado: ' + formatPrice(total) + '\n';
  if (contact.name) text += '\nNombre: ' + contact.name;
  if (contact.company) text += '\nEmpresa: ' + contact.company;
  if (contact.email) text += '\nEmail: ' + contact.email;
  if (contact.timeline) {
    const tl = TIMELINE_OPTIONS.find(function (t) { return t.id === contact.timeline; });
    if (tl) text += '\nPlazo: ' + tl.label;
  }
  if (contact.notes) text += '\nComentario: ' + contact.notes;
  return text;
}

function trackEvent(eventName, props) {
  props = props || {};
  try {
    if (typeof gtag === 'function') gtag('event', eventName, props);
    if (typeof plausible === 'function') plausible(eventName, { props: props });
    if (window.location.hostname === 'localhost') console.log('[Analytics] ' + eventName, props);
  } catch (e) { }
}

// Exportar al scope global (no ES modules para compatibilidad máxima sin bundler)
window.Pricing = {
  SERVICES: SERVICES,
  TIMELINE_OPTIONS: TIMELINE_OPTIONS,
  WHATSAPP_NUMBER: WHATSAPP_NUMBER,
  calculateTotal: calculateTotal,
  formatPrice: formatPrice,
  buildConfigSummary: buildConfigSummary,
  buildWhatsAppMessage: buildWhatsAppMessage,
  buildCopySummary: buildCopySummary,
  trackEvent: trackEvent,
};
