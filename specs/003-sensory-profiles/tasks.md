---
description: "Task list for Sensory Profiles Refactor (Dynamic JSON Config)"
---

# Tasks: Configuración de Perfiles Sensoriales y Puntuaciones

**Input**: Design documents from `/specs/003-sensory-profiles/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story, incorporating the dynamic JSON configuration requirement.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup & Foundational Refactor

**Purpose**: Core infrastructure update to support dynamic attributes from `perfiles.json`.

- [X] T001 [P] Validar que `public/data/perfiles.json` sea accesible desde el navegador.
- [X] T002 [P] Crear función utilitaria en `src/utils/helpers.js` para cargar y parsear el JSON de perfiles en el backend.
- [X] T003 Actualizar `src/controllers/perfilesController.js` para cargar la configuración de atributos y validar los campos recibidos en `POST/PUT` contra las claves definidas en el JSON.

**Checkpoint**: El backend ya no tiene noción "hardcoded" de café o cacao, sino que valida según el archivo JSON.

---

## Phase 2: User Story 1 - Configuración Dinámica y Previsualización (Priority: P1)

**Goal**: El panel de administración debe construir el formulario dinámicamente según el `tipo` seleccionado cargando los datos desde `perfiles.json`.

**Independent Test**: Cambiar el tipo de producto en el dropdown y verificar que los sliders cambien automáticamente (p.ej. de café a cacao o miel).

### Implementation for User Story 1

- [X] T004 [US1] Modificar `public/js/perfiles-app.js` para realizar un `fetch('/data/perfiles.json')` al inicializar.
- [X] T005 [US1] Implementar función `renderSliders(tipo)` en `public/js/perfiles-app.js` que limpie y reconstruya el contenedor de atributos basándose en el JSON cargado.
- [X] T006 [P] [US1] Actualizar la lógica de guardado en `public/js/perfiles-app.js` para recolectar dinámicamente los valores de los sliders basándose en las claves del JSON.
- [X] T007 [US1] Asegurar que `updateRadarPreview` en `public/js/perfiles-app.js` use las etiquetas (labels) del JSON para los ejes de la gráfica de radar.

**Checkpoint**: El administrador puede gestionar perfiles de cualquier tipo definido en el JSON sin tocar el código JS.

---

## Phase 3: User Story 2 - Integración de Widget Dinámico (Priority: P2)

**Goal**: El widget público debe mostrar las etiquetas correctas según el tipo de perfil almacenado, consultando el JSON.

### Implementation for User Story 2

- [X] T008 [US2] Actualizar `src/controllers/widgetController.js` para incluir las etiquetas de atributos (config) en la respuesta de la API pública `/api/public/radar/:public_token`.
- [X] T009 [US2] Modificar `views/widget-radar.html` (o el JS asociado) para que use la configuración de etiquetas enviada por la API al renderizar el radar.

---

## Phase 4: User Story 3 - Marketplace & Procesamiento (Priority: P3)

**Goal**: El Marketplace debe renderizar los perfiles vinculados usando las etiquetas dinámicas.

### Implementation for User Story 3

- [X] T010 [US3] Actualizar `public/js/producto-detalle-app.js` para que cargue `perfiles.json` y asigne las etiquetas correctas al invocar `renderRadarChart`.
- [X] T011 [US3] Verificar que el modal de asignación de perfil en `public/js/procesamiento-app.js` se comporte correctamente con los nuevos tipos de producto.

---

## Phase 5: Polish & Validation

- [X] T012 Agregar un nuevo tipo de producto "Miel" en `public/data/perfiles.json` y validar que aparezca en el admin sin errores.
- [X] T013 Validar que si un atributo falta en el JSON pero existe en el registro DB (por ser antiguo), el sistema maneje el error de forma segura en la UI.

---

## Dependencies & Execution Order

- **Phase 1**: Requisito previo para todas las historias.
- **US1**: Debe completarse antes de probar US2 y US3 ya que es la fuente de creación de datos.

## Parallel Opportunities

- T002 y T004 pueden hacerse simultáneamente (Backend vs Frontend).
- T008 y T009 pueden desarrollarse en paralelo una vez definida la estructura de respuesta.
