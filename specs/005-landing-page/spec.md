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

### User Story 5 - Experiencia de Marca Blanca para el Cliente Final (Priority: P1)

Como consumidor final que accede a `burgoschocolates.rurulab.com`, quiero una experiencia de marca coherente y profesional que me permita comprar productos sin la interferencia visual de la marca de la plataforma técnica.

**Why this priority**: Es la base del modelo de negocio B2B2C de RuruLab.
**Independent Test**: Al cargar el subdominio del cliente, el header no debe mostrar "Ruru Lab" sino el logo del cliente y una paleta de colores acorde.
**Acceptance Scenarios**:
1. **Given** un subdominio de cliente, **When** la página carga, **Then** el menú principal oculta los enlaces corporativos de RuruLab y muestra (Inicio, Tienda, Contacto).
2. **Given** el catálogo de productos, **When** el usuario navega a "Tienda", **Then** los productos se muestran en una cuadrícula de 3-4 columnas con el color de acento del cliente.
3. **Given** una tarjeta de producto, **When** el usuario hace clic en "Ver Detalle", **Then** es redirigido a la página de lote `/lote/:slug` con el Pasaporte Digital completo.
4. **Given** una tarjeta de producto, **When** el usuario hace clic en el botón de WhatsApp, **Then** se abre un mensaje de WhatsApp pre-cargado dirigido al número configurado del productor.

---

### Edge Cases

- **Carga en Conexiones Lentas**: Si las librerías pesadas (D3.js) tardan en cargar, el sistema debe mostrar un "placeholder" o estado de carga elegante para que la página no parezca rota.
- **Visualización en Móviles Antiguos**: Los gráficos D3 deben escalar correctamente en resoluciones pequeñas ( < 360px) sin que las etiquetas de texto se solapen ilegiblemente.
- **Catálogo Vacío**: Si un cliente no tiene productos publicados, la página Tienda debe mostrar un estado vacío elegante con un mensaje tipo "Próximamente" en lugar de una cuadrícula vacía.
- **Formulario sin WhatsApp configurado**: Si `whatsapp_number` no está configurado en `white_label_config`, la página de Contacto debe ocultar el botón de WhatsApp y mostrar únicamente el formulario de email.

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
- **FR-010 (White Label)**: El sistema MUST detectar el subdominio/CNAME y activar el modo "Marca Blanca" neutralizando el header (ocultando menús de RuruLab). MUST funcionar también bajo la ruta existente `/origen-unico/:slug`, sirviendo el mismo contenido White Label en ambos puntos de acceso.
- **FR-011 (Navigation)**: MUST implementar un menú de navegación simplificado: Inicio, Tienda (Catálogo) y Contáctanos.
- **FR-012 (Dynamic Design)**: El diseño MUST heredar dinámicamente la paleta de colores del cliente (colores de acento para botones, iconos y hovers) leyendo un campo JSONB `white_label_config` de la entidad empresa/procesadora en la base de datos.
- **FR-013 (Catalog UI)**: El catálogo de productos MUST renderizarse en una vista dedicada de tipo cuadrícula (3-4 columnas). Cada tarjeta MUST incluir dos acciones: (1) botón "Ver Detalle" que redirige a `/lote/:slug` y (2) botón de WhatsApp que abre un mensaje pre-cargado al número del productor (`white_label_config.whatsapp_number`).
- **FR-014 (Trust)**: MUST incluir una sección destacada para "Certificaciones y Premios" con visualización de alta jerarquía en la pagina de Inicio de la Tienda.
- **FR-015 (CTA)**: El CTA principal en modo Marca Blanca MUST ofrecer dos acciones por producto: "Ver Detalle" (enlace a `/lote/:slug`) y "Comprar por WhatsApp" (enlace `wa.me/` con el número del productor y un mensaje pre-cargado con el nombre del producto).
- **FR-016 (Iconography)**: MUST utilizar iconos refinados de la industria (granos de cacao, carritos) con el color de acento del cliente.
- **FR-017 (Contact Page)**: La página "Contáctanos" MUST incluir un formulario simple (nombre, email, mensaje) que envía al `contact_email` configurado, más un botón prominente de WhatsApp que abre `wa.me/` con el número del productor.
- **FR-018 (Inicio Page)**: La página "Inicio" del portal Marca Blanca MUST mostrar en orden: (1) Hero con banner y logo del cliente, (2) sección "Sobre Nosotros" con la historia de la empresa, (3) Certificaciones y Premios destacados, (4) Mapa de Fincas de origen, y (5) CTA prominente hacia la Tienda.

### Key Entities *(include if feature involves data)*

- **Visitante**: Actor que consume la landing page y puede convertirse en Usuario.
- **Widget**: Entidad exportable que contiene el renderizado D3 del perfil sensorial de un lote específico.
- **MetaData SEO**: Atributos técnicos (Title, Description, Schema, hreflang) que definen la visibilidad orgánica en múltiples idiomas.
- **WhiteLabelConfig**: Campo JSONB en la tabla de empresa/procesadora que almacena `accent_color`, `primary_color`, `logo_url`, `whatsapp_number`, y `contact_email` para la personalización por cliente.

## Clarifications

### Session 2026-04-28
- Q: ¿Cómo se implementarán los widgets embebibles? → A: Mediante Iframes para asegurar compatibilidad universal y evitar conflictos de estilos con sitios externos (Shopify/Woo).
- Q: ¿La landing será multilingüe? → A: Sí, soportará ES/EN mediante un selector de idioma para capturar el mercado de compradores internacionales.
- Q: ¿El contenido de la landing será dinámico o estático? → A: Híbrido; estadísticas reales de la plataforma (módulos, empresas) vendrán de la DB para generar confianza, mientras que el storytelling será estático para optimizar SEO.
- Q: ¿Cómo interactuará el usuario con el mockup del ADN de Marca? → A: Será interactivo; al pasar el cursor sobre el QR se mostrará una previsualización de los datos de trazabilidad para demostrar el concepto de "empaque que habla".
- Q: ¿Cómo se gestionará el contenido del Value Chain Stepper? → A: Configurable; los textos e iconos de los 5 pasos vendrán de un archivo JSON independiente para facilitar actualizaciones de marketing y mantenimiento.

### Session 2026-05-13
- Q: ¿Dónde se almacena la configuración de Marca Blanca de cada cliente (logo, colores, WhatsApp)? → A: En un campo JSONB `white_label_config` en la tabla existente de empresa/procesadora en la DB.
- Q: ¿La tienda del portal Marca Blanca es una vitrina o incluye flujo de compra? → A: Vitrina con dos botones por producto: "Ver Detalle" que enlaza a `/lote/:slug` (Pasaporte Digital) y "Comprar por WhatsApp" que abre un mensaje pre-cargado al número del productor.
- Q: ¿Qué contenido muestra la página "Contáctanos"? → A: Formulario simple (nombre, email, mensaje) + botón de WhatsApp prominente.
- Q: ¿Qué secciones muestra la página "Inicio" del portal Marca Blanca? → A: Hero (banner + logo) + Sobre Nosotros (historia) + Certificaciones y Premios + Mapa de Fincas + CTA a Tienda.
- Q: ¿El portal Marca Blanca funciona bajo ambas rutas (subdominio Y path) o solo subdominio? → A: Ambas rutas (`/origen-unico/:slug` y `empresa.rurulab.com`) muestran el mismo contenido White Label.

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
- **A-004**: El subdominio personalizado (`tuempresa.rurulab.com`) es una funcionalidad promocionada que ya existe en el core de la plataforma y el servidor puede identificarlo para inyectar la configuración correcta.
- **A-006**: Los clientes proporcionarán sus colores corporativos (Hex/HSL) y logo en alta resolución para la configuración de su portal.
- **A-007**: La sección de "Contacto" enviará leads directamente al correo configurado o contactarse directamente por whastapp del dueño de la marca blanca.
