# Feature Specification: Gestor de Ruedas de Sabor (Flavor Wheels)

**Feature Branch**: `004-flavor-wheels`  
**Created**: 2026-04-28  
**Status**: Draft  
**Input**: User description: "Gestor de Ruedas de Sabor (Sensory Profiling). Un módulo interno para empresas que permite crear, customizar y guardar evaluaciones sensoriales complejas en un formato gráfico estandarizado (Sunburst Chart). Exportable vía iframe."

## Clarifications

### Session 2026-04-28

- Q: ¿Los sabores seleccionados deben incluir intensidad? → A: Binaria (presente o no).
- Q: ¿Las plantillas son privadas o compartidas? → A: Compartidas por Empresa.
- Q: ¿Cómo reacciona el Sunburst al hacer clic? → A: Resaltado (centro fijo).
- Q: ¿Los tokens públicos son revocables? → A: Sí, regenerables.
- Q: ¿La asociación con productos/lotes es obligatoria? → A: Flexible (opcional).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Configuración Interactiva de Sabores (Priority: P1)

Como Catador o Q-Grader, quiero utilizar una interfaz visual circular (Sunburst) para seleccionar las notas de sabor de una muestra, navegando desde categorías generales hasta descriptores específicos, para generar un perfil sensorial preciso y visual.

**Why this priority**: Es la funcionalidad principal del módulo. Permite la entrada de datos sensoriales de forma lúdica y estandarizada, diferenciándose de un simple formulario de texto.

**Independent Test**: Se puede probar abriendo el gestor, haciendo clic en una categoría (ej: "Frutal"), expandiendo sus hijos (ej: "Cítrico") y seleccionando un descriptor final (ej: "Limón"). El sistema debe resaltar el camino seleccionado.

**Acceptance Scenarios**:

1. **Given** la rueda de sabor de café cargada, **When** el usuario hace clic en "Frutal", **Then** el gráfico debe expandirse o resaltar el segmento frutal y mostrar sus sub-categorías.
2. **Given** una selección de sabores realizada, **When** el usuario guarda la configuración, **Then** se debe almacenar la estructura jerárquica de los sabores seleccionados.

---

### User Story 2 - Gestión de Plantillas de Sabor (Priority: P2)

Como Jefe de Calidad, quiero guardar configuraciones específicas de ruedas de sabor como "Plantillas" para asociarlas rápidamente a diferentes lotes o productos, evitando la repetición manual de la evaluación para perfiles similares.

**Why this priority**: Mejora la eficiencia operativa y la escalabilidad de los datos en la plataforma.

**Independent Test**: Crear una rueda, guardarla con un nombre (ej: "Perfil Cacao Premium Tabasco"), luego crear un nuevo producto y seleccionar esta plantilla para que los sabores se carguen automáticamente.

**Acceptance Scenarios**:

1. **Given** una rueda configurada, **When** el usuario selecciona "Guardar como Plantilla", **Then** el sistema debe solicitar un nombre y guardarla en la base de datos asociada a la empresa.

---

### User Story 3 - Integración de Widget Externo (iframe) (Priority: P3)

Como Comercializador, quiero obtener un código de inserción (iframe) para una rueda de sabor específica, para mostrarla dinámicamente en una página de producto externa (Shopify, WooCommerce, etc.).

**Why this priority**: Aporta valor comercial directo al cliente, permitiéndole usar sus datos de calidad para mejorar las ventas en sus propios canales.

**Independent Test**: Copiar el código iframe generado, pegarlo en un archivo HTML local y verificar que el gráfico se renderiza correctamente y es interactivo.

**Acceptance Scenarios**:

1. **Given** un perfil de sabor guardado, **When** el usuario hace clic en "Generar Widget", **Then** se debe mostrar un snippet HTML `<iframe>` con un token público de acceso.
2. **Given** un widget renderizado, **When** se visualiza en una página externa, **Then** el gráfico debe mostrar únicamente las rutas jerárquicas de las notas seleccionadas (estilo Tastify), eliminando visualmente las categorías no utilizadas.

---

## Edge Cases

- **Carga de JSON fallida**: Si `public/data/flavor-wheels.json` no está disponible o está corrupto, el sistema debe mostrar un mensaje de error amigable y desactivar el gestor.
- **Taxonomías vacías**: Si un tipo de producto (ej: "Miel") no tiene descriptores definidos en el JSON, el sistema debe informar que la taxonomía aún no está configurada.
- **Suscripción Expirada**: Si el widget se visualiza en una tienda externa pero la cuenta del productor en RuruLab ha expirado, el widget debe mostrar un mensaje de fallback o una versión estática mínima (según configuración).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE cargar la taxonomía de sabores desde `public/data/flavor-wheels.json` para Café, Cacao y Miel.
- **FR-002**: La interfaz DEBE utilizar un gráfico Sunburst (radial jerárquico) para la selección de sabores.
- **FR-003**: El sistema DEBE permitir seleccionar múltiples caminos sensoriales (ej: Frutal -> Cítrico -> Limón Y Dulce -> Caramelo).
- **FR-004**: Las configuraciones de ruedas DEBEN guardarse en formato JSONB en la base de datos asociadas a un `id` único.
- **FR-005**: El sistema DEBE generar un token de acceso público para cada rueda que permita su visualización externa sin login.
- **FR-006**: El widget exportable DEBE ser responsivo y adaptarse al ancho del contenedor padre (100% width).
- **FR-007**: El sistema DEBE permitir la previsualización del widget antes de copiar el código.
- **FR-008**: El sistema DEBE registrar la presencia binaria de los sabores seleccionados, sin requerir niveles de intensidad individuales.
- **FR-009**: Las plantillas de ruedas de sabor DEBEN ser accesibles y editables por todos los usuarios pertenecientes a la misma organización/empresa.
- **FR-010**: La interacción con el gráfico Sunburst DEBE mantener el centro fijo; los clics en categorías superiores deben resaltar sus descriptores descendientes sin realizar zoom o cambios de escala en el gráfico.
- **FR-011**: El sistema DEBE permitir a los usuarios regenerar el public_token de una rueda guardada, invalidando instantáneamente cualquier widget (iframe) que utilice el token anterior.
- **FR-012**: Las ruedas de sabor DEBEN poder crearse de forma independiente y, opcionalmente, vincularse a un Producto o Lote existente en el sistema.
- **FR-013**: La visualización final en el widget DEBE mostrar únicamente las ramas jerárquicas que contienen notas seleccionadas (estética estilo Tastify), ocultando el resto del gráfico para resaltar el perfil específico del producto.

### Key Entities *(include if feature involves data)*

- **FlavorWheelConfig**: El objeto jerárquico que define la taxonomía (cargado del JSON).
- **SavedFlavorWheel**: Instancia de una rueda configurada por un usuario (asociada a empresa, producto o lote). Atributos: `id`, `nombre_rueda`, `tipo`, `data_json`, `public_token`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario puede configurar una rueda con 5 notas de sabor en menos de 45 segundos.
- **SC-002**: El widget iframe carga y renderiza el gráfico Sunburst en menos de 600ms (p95) en condiciones normales de red.
- **SC-003**: El código iframe generado es compatible con las políticas de seguridad (CORS) de Shopify y WooCommerce.
- **SC-004**: La interactividad del Sunburst (hover/click para expandir) mantiene una tasa de cuadros de 60fps.

## Assumptions

- Se asume que el archivo `public/data/flavor-wheels.json` sigue una estructura jerárquica compatible con D3 hierarchy (name, children).
- Se asume que el uso de D3.js es aceptable para la implementación del Sunburst Chart.
- Se asume que el backend tiene un endpoint para servir los datos del widget basado en el `public_token`.
- Se asume que el diseño del Sunburst seguirá la paleta de colores oficial de la SCA/Cocoa of Excellence por defecto.
