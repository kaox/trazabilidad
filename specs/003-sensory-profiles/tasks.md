---
description: "Task list for Sensory Profiles implementation"
---

# Tasks: Configuración de Perfiles Sensoriales y Puntuaciones

**Input**: Design documents from `/specs/003-sensory-profiles/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Inicializar el script de utilidades base para la renderización de D3.js en `public/js/d3-utils.js`
- [ ] T002 Asegurar la inclusión de la librería D3.js (vía CDN) en los layouts compartidos pertinentes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Crear el script de migración para añadir la tabla `perfiles` con los campos `JSONB`, `tipo` y `public_token` (UUID), ejecutándolo en la base de datos (p.ej. `migrate_perfiles.js` o actualizando schema).
- [ ] T004 [P] Crear el modelo base `src/models/perfilModel.js` con las operaciones iniciales (Create, Read).

**Checkpoint**: Base de datos lista con soporte de JSONB para perfiles.

---

## Phase 3: User Story 1 - Configuración Dinámica y Previsualización de Perfil (Priority: P1) 🎯 MVP

**Goal**: Permitir al Analista de Calidad introducir manualmente métricas y visualizar una gráfica de radar D3.js interactiva en tiempo real.

**Independent Test**: Navegar a la vista de perfiles, crear un registro alterando campos dinámicos (café vs cacao) y verificar que el `<svg>` del radar se actualice instantáneamente.

### Implementation for User Story 1

- [ ] T005 [P] [US1] Completar métodos de Update y Delete en `src/models/perfilModel.js`.
- [ ] T006 [US1] Implementar la lógica REST en `src/controllers/perfilesController.js` (POST, PUT, GET, DELETE).
- [ ] T007 [US1] Configurar rutas para perfiles en `src/routes/perfilesRoutes.js` y registrar en el server.
- [ ] T008 [P] [US1] Crear la vista HTML para el analista en `views/perfiles.html` con la estructura de formulario adaptativo y el contenedor `<svg>` para el radar.
- [ ] T009 [US1] Implementar el manipulador de la UI en `public/js/perfiles-app.js` (selector dinámico, sliders de 0 a 10, y el update de `d3-utils.js` en tiempo real).
- [ ] T010 [US1] Validar límites numéricos (0.0 a 10.0 y score global) en backend y frontend.

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Integración de Widget Externo Inteligente (Priority: P2)

**Goal**: Permitir exportar un snippet iframe del radar que verifique la suscripción activa del emisor en tiempo real y sea incrustable en Shopify/WooCommerce.

**Independent Test**: Generar el código del iframe desde el frontend, incrustarlo en un HTML dummy (externo), y verificar el renderizado exitoso y el colapso al simular suscripción inactiva.

### Implementation for User Story 2

- [ ] T011 [P] [US2] Crear la vista HTML mínima para el iframe en `views/widget-radar.html` conteniendo CDN de D3.js y un contenedor `<svg id="radarChart"></svg>`.
- [ ] T012 [US2] Implementar `src/controllers/widgetController.js` para exponer el endpoint `GET /widget/radar/:public_token` sirviendo la vista, e inyectando JSONB tras validar estado de cuenta del `empresa_id`.
- [ ] T013 [US2] Configurar la ruta pública en `src/routes/widgetRoutes.js` y montarla en la aplicación principal.
- [ ] T014 [US2] Agregar lógica en `views/perfiles.html` y `public/js/perfiles-app.js` para generar el snippet iframe (`<iframe src="...">`) con el `public_token` y botón de "Copiar Portapapeles".

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Vinculación de Calidad en Procesamiento y Marketplace (Priority: P3)

**Goal**: Poder referenciar un Perfil Sensorial al guardar un Lote, permitiendo a Marketplace consumirlo visualmente.

**Independent Test**: Ir a Procesamiento, vincular perfil a un lote, y luego visitar la vista pública del Marketplace para verificar la carga del radar D3.

### Implementation for User Story 3

- [ ] T015 [P] [US3] Crear migración para añadir `perfil_sensorial_id` a la tabla de `batches` y `productos`.
- [ ] T016 [US3] Actualizar la vista de procesamiento (`views/procesamiento.html` y JS asociado) para permitir asignar un perfil a un lote finalizado.
- [ ] T017 [US3] Actualizar la vista del producto (`public/producto-detalle.html` y `public/js/producto-detalle-app.js`) para consumir e inicializar el radar usando `d3-utils.js`.

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T018 Refactorizar código compartido de D3.js entre `widget-radar.html`, el admin dashboard y el Marketplace para evitar duplicidad de assets.
- [ ] T019 Añadir directivas `loading="lazy"` a todos los iframes exportados.
- [ ] T020 Validar que el placeholder de "suscripción expirada" no rompa layout usando flex/grid boundaries.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Parallel Opportunities

- El diseño de `views/perfiles.html` (T008) puede hacerse en paralelo a las tareas de backend del controlador (T006, T007).
- La vista mínima `views/widget-radar.html` (T011) puede desarrollarse en paralelo al modelo.
- Las migraciones (T003, T015) pueden organizarse tempranamente.

---

## Implementation Strategy

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready (JSONB y DB listos).
2. Add User Story 1 → Frontend del analista listo, gráficas operativas. (Deploy MVP).
3. Add User Story 2 → Capacidad de compartir externamente los perfiles. (Deploy).
4. Add User Story 3 → Integración end-to-end con logística de planta y Marketplace.
