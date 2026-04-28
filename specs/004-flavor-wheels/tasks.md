# Tasks: Gestor de Ruedas de Sabor (Flavor Wheels)

**Input**: Design documents from `/specs/004-flavor-wheels/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Las tareas están agrupadas por historia de usuario para permitir la implementación y prueba independiente de cada una.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo (diferentes archivos, sin dependencias).
- **[Story]**: A qué historia de usuario pertenece esta tarea (ej: US1, US2, US3).

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización del proyecto y estructura básica de datos.

- [ ] T001 Crear script de migración para la tabla `ruedas_sabores` en `src/migrations/create_ruedas_sabores.js`
- [ ] T002 Implementar `ruedaModel.js` en `src/models/ruedaModel.js` para interacciones con la base de datos

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura central necesaria antes de implementar las historias de usuario.

- [ ] T003 [P] Configurar el enrutamiento de la API en `src/routes/ruedasRoutes.js`
- [ ] T004 [P] Implementar el controlador base `ruedasController.js` en `src/controllers/ruedasController.js`
- [ ] T005 [P] Crear la utilidad core de D3 `public/js/d3-sunburst.js` con la lógica de renderizado radial

**Checkpoint**: Fundación lista - la implementación de historias de usuario puede comenzar.

---

## Phase 3: User Story 1 - Configuración Interactiva de Sabores (Priority: P1) 🎯 MVP

**Goal**: Permitir a los catadores seleccionar notas de sabor usando un Sunburst interactivo.

**Independent Test**: Abrir `/app/ruedas`, seleccionar sabores en el gráfico y guardar la configuración exitosamente.

### Implementation for User Story 1

- [ ] T006 [P] [US1] Crear la vista de administración `views/ruedas.html`
- [ ] T007 [P] [US1] Implementar la lógica de la interfaz de selección en `public/js/ruedas-app.js`
- [ ] T008 [US1] Implementar la lógica de selección y resaltado de nodos en `public/js/d3-sunburst.js`
- [ ] T009 [US1] Implementar el endpoint `POST /api/ruedas` en `src/controllers/ruedasController.js`

**Checkpoint**: La historia de usuario 1 es funcional: se pueden crear y guardar ruedas interactivamente.

---

## Phase 4: User Story 2 - Gestión de Plantillas de Sabor (Priority: P2)

**Goal**: Compartir y reutilizar configuraciones de ruedas a nivel de empresa.

**Independent Test**: Guardar una rueda como plantilla y verificar que otros usuarios de la misma empresa pueden cargarla.

### Implementation for User Story 2

- [ ] T010 [US2] Implementar la lógica de filtrado por empresa y visibilidad de plantillas en `src/controllers/ruedasController.js`
- [ ] T011 [US2] Actualizar `public/js/ruedas-app.js` para soportar la carga y guardado de plantillas

**Checkpoint**: Las historias de usuario 1 y 2 son funcionales e independientes.

---

## Phase 5: User Story 3 - Integración de Widget Externo (iframe) (Priority: P3)

**Goal**: Mostrar el perfil sensorial en tiendas externas con estética estilo Tastify (solo notas seleccionadas).

**Independent Test**: Acceder a `/widget/sunburst/[TOKEN]` y verificar que el gráfico muestra solo las ramas seleccionadas.

### Implementation for User Story 3

- [ ] T012 [P] [US3] Crear el template HTML para el widget público en `views/widget-sunburst.html`
- [ ] T013 [US3] Implementar la lógica de "poda" (filtering) jerárquica en `public/js/d3-sunburst.js` para el modo widget
- [ ] T014 [US3] Crear `src/controllers/widgetController.js` para servir los datos del widget vía `public_token`
- [ ] T015 [US3] Implementar la regeneración de tokens en `src/controllers/ruedasController.js`

**Checkpoint**: Todas las historias de usuario son funcionales.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [ ] T016 [P] Añadir micro-animaciones y transiciones suaves a los arcos de D3 en `public/js/d3-sunburst.js`
- [ ] T017 [P] Validar el cumplimiento de los Success Criteria (SC-001 a SC-004) mediante pruebas de carga y UX
- [ ] T018 [P] Actualizar `quickstart.md` con las instrucciones finales de despliegue y pruebas del widget

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias.
- **Foundational (Phase 2)**: Depende de Phase 1 - BLOQUEA las historias de usuario.
- **User Stories (Phase 3+)**: Dependen de Phase 2. Pueden ejecutarse en paralelo o secuencia.
- **Polish (Final Phase)**: Depende de la completitud de las historias de usuario.

### Parallel Opportunities

- T003, T004 y T005 pueden ejecutarse simultáneamente.
- T006 y T007 pueden desarrollarse en paralelo con la lógica del backend T009.
- T012 puede iniciarse mientras se desarrolla la lógica de poda T013.

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Completar Setup y Foundation.
2. Implementar User Story 1 (Configuración y Guardado).
3. **VALIDAR**: Probar la creación de una rueda desde cero.

### Incremental Delivery

1. Foundation ready.
2. US1 -> Demo de creación de perfiles.
3. US2 -> Demo de colaboración/plantillas.
4. US3 -> Demo de integración externa (Tastify style).
