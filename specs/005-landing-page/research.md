# Research: RuruLab Landing Page

## Decision: D3.js Widget Iframe Integration
- **Decision**: Servir los widgets sensoriales (Rueda y Radar) mediante una página HTML ligera (`public/widgets/sensory.html`) cargada a través de un `<iframe>`.
- **Rationale**: Aísla el motor D3.js y sus estilos del sitio anfitrión (Shopify, WooCommerce, etc.), evitando colisiones de CSS y permitiendo que RuruLab mantenga el control total sobre la actualización del widget sin que el cliente tenga que cambiar su código.
- **Alternatives Considered**: 
  - **JS Snippet**: Descartado por el riesgo de conflictos de selectores CSS y versiones de librerías en sitios de terceros.

## Decision: Multilingual Implementation (i18n)
- **Decision**: Uso de archivos JSON estáticos (`public/locales/{lang}.json`) y un script ligero `landing-app.js` para el reemplazo de texto en el cliente.
- **Rationale**: Mantiene el SEO robusto (el HTML inicial puede estar en ES) mientras permite una conmutación rápida sin recarga de página para EN. Dado que es una landing estática en su mayoría, no se requiere un framework pesado de i18n.
- **Alternatives Considered**: 
  - **Server-side Rendering (SSR)**: Podría ser más complejo de configurar en el entorno híbrido actual si solo se necesita para una página.

## Decision: Performance Optimization (Lighthouse > 90)
- **Decision**: Carga diferida (defer) de D3.js y uso de `IntersectionObserver` para inicializar las animaciones y el Stepper solo cuando entren en el viewport.
- **Rationale**: El motor D3 es pesado. No debe bloquear el First Contentful Paint (FCP) de la propuesta de valor inicial.
- **Alternatives Considered**: 
  - **Inline SVG**: Demasiado código para gráficos complejos; el archivo HTML crecería demasiado afectando el tiempo de descarga.

## Decision: SEO Structured Data
- **Decision**: Inyección de JSON-LD para `SoftwareApplication` (RuruLab) y `Organization` (RuruLab).
- **Rationale**: Mejora la visibilidad en resultados de búsqueda (Rich Snippets) y ayuda a Google a entender que es una plataforma SaaS de trazabilidad.
- **Alternatives Considered**: 
  - **Microdata (HTML attributes)**: Más difícil de mantener y ensucia el marcado semántico.
