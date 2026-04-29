# Feature Specification: RuruLab Landing Page (Public Index)

**Feature Branch**: `005-landing-page`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "RuruLab Landing Page (Public Index) - Vitrina pública premium para conversión de productores y compradores mediante storytelling y SEO sólido."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Descubrimiento del Origen (Priority: P1)

Como productor o comprador potencial, quiero entender visualmente el valor de la trazabilidad "del árbol a la taza" para confiar en la plataforma como mi infraestructura digital.

**Why this priority**: Es el núcleo de la propuesta de valor y el primer punto de contacto que justifica el uso de la herramienta sobre métodos tradicionales.

**Independent Test**: Se puede validar verificando que el "Value Chain Stepper" es interactivo y comunica claramente las 5 etapas de trazabilidad.

**Acceptance Scenarios**:

1. **Given** un visitante llega a la landing page, **When** interactúa con el stepper de la cadena de valor, **Then** debe ver información detallada de cada etapa (Finca, Acopio, Proceso, Catación, Mercado).
2. **Given** el stepper visual, **When** el usuario pasa el mouse o toca una etapa, **Then** se debe resaltar visualmente el flujo de datos inmutables.

---

### User Story 2 - Validación de Calidad y Cumplimiento (Priority: P2)

Como exportador preocupado por la normativa EUDR, quiero ver que RuruLab ofrece soluciones reales y técnicas para el cumplimiento regulatorio y la calidad sensorial.

**Why this priority**: El cumplimiento EUDR es un "bloqueador" crítico para el mercado europeo; demostrar que la plataforma lo maneja es vital para la conversión.

**Independent Test**: Comprobar que la sección de EUDR y el grid de módulos muestran los componentes técnicos (Blockchain, Satélite, Perfil SCA).

**Acceptance Scenarios**:

1. **Given** la sección de módulos técnicos, **When** el usuario revisa el ítem de EUDR, **Then** debe quedar claro que se usa validación satelital automática.
2. **Given** el mockup de empaque, **When** el usuario observa el QR y la Rueda de Sabores, **Then** debe entender cómo su producto se diferenciará en el anaquel.

---

### User Story 3 - Integración de Widgets Externos (Priority: P2)

Como dueño de una tienda Shopify o WooCommerce, quiero llevar mi perfil sensorial de RuruLab a mi propia tienda para mejorar mi tasa de conversión de ventas.

**Why this priority**: Amplía el ecosistema de RuruLab fuera de su propio dominio, convirtiendo la herramienta en un estándar de industria.

**Independent Test**: El usuario debe poder obtener un fragmento de código (script/embed) que renderice la rueda de sabores en un entorno HTML externo.

**Acceptance Scenarios**:

1. **Given** la sección de widgets, **When** el usuario selecciona "copiar código", **Then** se debe copiar al portapapeles un fragmento de script/iframe listo para usar.

---

### User Story 4 - Conversión a Registro/Mercado (Priority: P3)

Como usuario convencido por el storytelling, quiero registrarme o explorar los productos actuales para comenzar mi viaje digital.

**Why this priority**: Es el objetivo final de negocio de la landing page.

**Independent Test**: Validar que todos los botones de acción (CTAs) dirigen correctamente a las rutas de login o marketplace.

**Acceptance Scenarios**:

1. **Given** el botón "Comenzar Gratis", **When** se hace clic, **Then** redirige a la página de registro/login.
2. **Given** el acceso al Marketplace, **When** se hace clic, **Then** muestra el catálogo de productos con "Pasaporte Digital".

---

### Edge Cases

- **Carga en Conexiones Lentas**: Si las librerías pesadas (D3.js) tardan en cargar, el sistema debe mostrar un "placeholder" o estado de carga elegante para que la página no parezca rota.
- **Visualización en Móviles Antiguos**: Los gráficos D3 deben escalar correctamente en resoluciones pequeñas ( < 360px) sin que las etiquetas de texto se solapen ilegiblemente.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: La landing MUST incluir un Hero con una propuesta de valor basada en storytelling y CTAs claros.
- **FR-002**: El sistema MUST implementar un "Value Chain Stepper" de 5 etapas (Finca, Acopio, Proceso, Catación, Mercado), con contenido configurable desde un archivo JSON.
- **FR-003**: MUST mostrar un grid de los 9 módulos de impacto de RuruLab con iconos y descripciones breves.
- **FR-004**: MUST proporcionar la funcionalidad de Widgets Embeddable (copiar iframe/script) para Rueda de Sabores y Radar de Atributos.
- **FR-005**: La página MUST estar optimizada para SEO técnico incluyendo datos estructurados JSON-LD (SoftwareApplication, Organization).
- **FR-006**: MUST incluir un "Gemelo Digital del Terroir" o sección de Fincas que explique la geolocalización y altitud.
- **FR-007**: El sistema MUST renderizar una vista previa interactiva del "Pasaporte Digital QR" (hover/click) que demuestre la inmutabilidad blockchain.
- **FR-008**: La landing page MUST soportar multi-idioma (Español e Inglés) con un selector accesible.
- **FR-009**: El sistema MUST obtener estadísticas de impacto (conteo de módulos, empresas verificadas) dinámicamente desde la base de datos.

### Key Entities *(include if feature involves data)*

- **Visitante**: Actor que consume la landing page y puede convertirse en Usuario.
- **Widget**: Entidad exportable que contiene el renderizado D3 del perfil sensorial de un lote específico.
- **MetaData SEO**: Atributos técnicos (Title, Description, Schema, hreflang) que definen la visibilidad orgánica en múltiples idiomas.

## Clarifications

### Session 2026-04-28
- Q: ¿Cómo se implementarán los widgets embebibles? → A: Mediante Iframes para asegurar compatibilidad universal y evitar conflictos de estilos con sitios externos (Shopify/Woo).
- Q: ¿La landing será multilingüe? → A: Sí, soportará ES/EN mediante un selector de idioma para capturar el mercado de compradores internacionales.

- Q: ¿El contenido de la landing será dinámico o estático? → A: Híbrido; estadísticas reales de la plataforma (módulos, empresas) vendrán de la DB para generar confianza, mientras que el storytelling será estático para optimizar SEO.
- Q: ¿Cómo interactuará el usuario con el mockup del ADN de Marca? → A: Será interactivo; al pasar el cursor sobre el QR se mostrará una previsualización de los datos de trazabilidad para demostrar el concepto de "empaque que habla".
- Q: ¿Cómo se gestionará el contenido del Value Chain Stepper? → A: Configurable; los textos e iconos de los 5 pasos vendrán de un archivo JSON independiente para facilitar actualizaciones de marketing y mantenimiento.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 80% de los usuarios encuestados deben poder explicar la cadena de valor de RuruLab después de navegar por la landing por 1 minuto.
- **SC-002**: Puntaje de Lighthouse SEO > 95 y Performance > 90 en desktop y móvil.
- **SC-003**: Tiempo de carga inicial (First Contentful Paint) menor a 1.2 segundos en conexiones 4G estándar.
- **SC-004**: Incremento del 10% en el tráfico orgánico mensual atribuido a keywords de "trazabilidad" y "EUDR".

## Assumptions

- **A-001**: Los usuarios tienen navegadores modernos compatibles con SVG y D3.js (Chrome, Safari, Edge, Firefox modernos).
- **A-002**: El cumplimiento EUDR se presenta como una funcionalidad de la plataforma, aunque la validación real dependa de datos satelitales externos.
- **A-003**: No se requiere autenticación para que un tercero visualice un Widget embebido en un sitio externo (Shopify/Woo).
- **A-004**: El subdominio personalizado (`tuempresa.rurulab.com`) es una funcionalidad promocionada que ya existe en el core de la plataforma.
- **A-005**: Los sitios externos (Shopify, etc.) permiten la incrustación de Iframes de terceros.
