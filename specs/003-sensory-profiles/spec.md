# Feature Specification: Configuración de Perfiles Sensoriales y Puntuaciones

**Feature Branch**: `003-sensory-profiles`  
**Created**: 2026-04-26  
**Status**: Draft  
**Input**: Gestor de Perfiles Sensoriales (Cup Profiling) y Generador de Widget.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configuración Dinámica y Previsualización de Perfil (Priority: P1)

Como Analista de Calidad o Catador, quiero introducir manualmente los puntajes cuantitativos (en forma decimal hasta 10.0) y ver una gráfica de radar en tiempo real, para archivar el perfil físico del panel de cata de forma visual y estandarizada.

**Why this priority**: Es el núcleo central de la funcionalidad; sin la capacidad de registrar y previsualizar los perfiles, el resto de características (integración, vinculación) no tiene datos base.

**Independent Test**: Puede probarse creando un perfil, ajustando los sliders numéricos y verificando que el minigráfico de radar reaccione instantáneamente antes de guardar.

**Acceptance Scenarios**:

1. **Given** un nuevo formulario de cata de café, **When** el usuario introduce 8.5 en Acidez y 7.0 en Cuerpo, **Then** la gráfica de radar se actualiza inmediatamente mostrando los nuevos vértices.
2. **Given** el formulario en pantalla, **When** el usuario cambia el selector de tipo de producto (p.ej., de "Café" a "Cacao" o "Miel"), **Then** los campos se actualizan dinámicamente según la configuración definida en `public/data/perfiles.json`.

---

### User Story 2 - Integración de Widget Externo Inteligente (Priority: P2)

Como Productor o Comercializador, quiero exportar la gráfica de radar generada copiando un código "iframe" para incrustarla en mi propia tienda online (Shopify, WooCommerce), permitiendo a mis consumidores finales ver la calidad del producto.

**Why this priority**: Aporta un inmenso valor comercial B2B/B2C, conectando el uso de la plataforma interna directamente con las ventas en el canal del cliente.

**Independent Test**: Puede probarse generando el código iframe desde un perfil guardado e incrustándolo en un archivo HTML externo, validando que el gráfico se dibuja si la cuenta está activa.

**Acceptance Scenarios**:

1. **Given** un lote con perfil consolidado y una suscripción activa, **When** el usuario hace clic en "Generar Código", **Then** el sistema muestra un snippet HTML con un `iframe` que incluye un token de solo lectura.
2. **Given** el iframe incrustado en una web de terceros, **When** el estado de la suscripción del dueño expira, **Then** el iframe muestra elegantemente un placeholder ("Información sensorial temporalmente no disponible") sin romper el CSS de la tienda externa.

---

### User Story 3 - Vinculación de Calidad en Procesamiento y Marketplace (Priority: P3)

Como Administrador/Auditor, quiero vincular un Perfil Sensorial específico a un lote en la fase de Procesamiento, para que luego en el Marketplace los compradores puedan verificar las métricas del lote.

**Why this priority**: Cierra el ciclo de trazabilidad, uniendo la evaluación de laboratorio con la bitácora logística y la presentación de ventas.

**Independent Test**: Puede probarse desde el módulo de Procesamiento al asignar un Perfil Sensorial al lote y validando su reflejo en la ficha del Marketplace.

**Acceptance Scenarios**:

1. **Given** un lote en procesamiento, **When** el usuario selecciona un perfil del catálogo, **Then** el perfil queda anclado criptográficamente a la historia del lote.

---

### Edge Cases

- ¿Qué sucede si el usuario ingresa un valor de atributo superior a 10.0 en los sliders?
- ¿Cómo se comporta el iframe incrustado en Shopify si la tienda usa un diseño ultra-delgado (mobile responsive) donde el radar podría aplastarse?
- ¿Qué pasa si el perfil sensorial vinculado a un lote en el Marketplace es posteriormente eliminado por el Analista de Calidad?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST permitir la creación, edición, lectura y eliminación (CRUD) de Perfiles Sensoriales.
- **FR-002**: El sistema MUST adaptar dinámicamente los campos de evaluación cuantitativa según el "Tipo de Producto" seleccionado (Café vs Cacao).
- **FR-003**: El sistema MUST validar que los puntajes por atributo oscilen estrictamente entre 0.0 y 10.0, y el puntaje global entre 0 y 100 con un slide.
- **FR-004**: El sistema MUST renderizar un minigráfico de radar de forma reactiva (en tiempo real) conforme se modifican los sliders o campos numéricos.
- **FR-005**: El sistema MUST permitir generar un snippet de código (`iframe`) únicamente si la suscripción de la cuenta emisora está activa.
- **FR-006**: El `iframe` generado MUST implementar carga asíncrona (`loading="lazy"`) y responsividad fluida (`width="100%"`).
- **FR-007**: El endpoint del widget MUST evaluar en tiempo real la suscripción del emisor; si está inactiva, MUST colapsar la vista de forma segura o renderizar un placeholder no disruptivo.
- **FR-008**: El endpoint del widget MUST consumir datos utilizando un token público, inmutable y de solo lectura (`read-only`) generado específicamente para ese perfil.
- **FR-009**: El sistema MUST cargar las definiciones de atributos (IDs y etiquetas) para cada tipo de producto desde `public/data/perfiles.json`.
- **FR-010**: La interfaz de administración MUST ser extensible, permitiendo soportar nuevos productos (p.ej., miel) simplemente actualizando el archivo de configuración JSON.

### Key Entities

- **PerfilSensorial (`perfiles`)**: Representa la evaluación paramétrica. Atributos: `id`, `empresa_id`, `nombre_perfil`, `tipo` (Dinámico basado en JSON), `perfil_data` (JSONB con vértices y puntuaciones), `puntaje_sca`, `public_token` (UUID de solo lectura).
- **WidgetSession**: Entidad virtual. Representa la petición pública desde un iframe utilizando el `public_token`, la cual desencadena la validación de suscripción de la `empresa_id` asociada.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un analista experto es capaz de transcribir y guardar una hoja de cata completa en menos de 90 segundos.
- **SC-002**: El widget externo (iframe) carga el gráfico interactivo en el cliente final en menos de 500ms (p95).
- **SC-003**: El widget iframe ajusta sus dimensiones perfectamente y sin romper el layout en al menos 3 resoluciones simuladas (Mobile, Tablet, Desktop) al ser embebido con width al 100%.
- **SC-004**: Tasa de fallos visuales en Shopify/WooCommerce es del 0% cuando la suscripción expira (manejo de fallback 100% efectivo).

## Assumptions

- Se asume que el token inyectado en el `src` del iframe no requiere autenticación activa (sesión JWT) de parte del comprador final que visita la tienda de Shopify.
- Se asume que la librería gráfica a utilizar (D3.js) ya existe en el proyecto y puede ser invocada dentro del documento servido para el iframe.
- Se asume que el diseño del widget incluye un fondo transparente o adaptable para integrarse orgánicamente con el tema claro/oscuro de la tienda del cliente.
