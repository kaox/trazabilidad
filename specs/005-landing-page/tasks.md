# Tasks: RuruLab Landing Page (Public Index)

**Input**: Design documents from `/specs/005-landing-page/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: No specific tests requested in spec; TDD optional but manual verification per story is required.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure: `public/css/`, `public/js/`, `public/locales/`, `public/widgets/`, `routes/`
- [x] T002 [P] Create `public/locales/es.json` and `public/locales/en.json` base files with initial schema
- [x] T003 [P] Configure initial `public/index.html` with semantic HTML5, `data-i18n` attributes, and SEO meta tags

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Implement `GET /api/landing/stats` route in `server.js` with dynamic DB queries in `db.js`
- [x] T005 [P] Create core `public/js/landing-app.js` with i18n logic and statistics fetching function
- [x] T006 [P] Extract styles to `public/css/landing.css` with global variables for glassmorphism and palette

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Descubrimiento del Origen (Priority: P1) 🎯 MVP

**Goal**: Visitante entiende la cadena de valor visualmente mediante el Stepper interactivo.

**Independent Test**: Cargar la landing, interactuar con el Stepper y verificar que los textos de cada etapa se muestran correctamente desde el JSON.

### Implementation for User Story 1

- [x] T007 [US1] Create interactive Value Chain Stepper HTML structure in `public/index.html`
- [x] T008 [US1] Implement Stepper animation and stage transitions in `public/js/landing-app.js`
- [ ] T009 [P] [US1] Add custom SVG icons for the 5 stages of the value chain (Finca, Acopio, Proceso, Catación, Mercado) in `public/img/icons/`

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - Validación de Calidad y Cumplimiento (Priority: P2)

**Goal**: El usuario visualiza los 9 módulos de impacto y el DNA Mockup (empaque que habla).

**Independent Test**: Verificar que el grid de módulos renderiza correctamente y que el hover sobre el QR del empaque muestra el pop-over con datos.

### Implementation for User Story 2

- [x] T010 [US2] Create 9-module impact grid layout with descriptions in `public/index.html`
- [x] T011 [US2] Implement DNA Mockup (QR hover) with CSS pop-over animation in `public/index.html`
- [ ] T012 [P] [US2] Create interactive SVG mockup of specialty coffee packaging in `public/img/packaging-mockup.svg`

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - Integración de Widgets Externos (Priority: P2)

**Goal**: Productores pueden embeber su perfil sensorial en sitios externos vía Iframe.

**Independent Test**: Cargar `/api/public/widgets/flavor-wheel/:token` directamente y verificar que renderiza la Rueda de Sabores D3.

### Implementation for User Story 3

- [x] T013 [P] [US3] Create `public/widgets/flavor-wheel.html` template for Iframe consumption
- [x] T014 [US3] Implement `GET /api/public/widgets/flavor-wheel/:token` endpoint in `server.js` to serve widget data
- [x] T015 [US3] Integrate `d3-sunburst.js` and `d3-utils.js` into the flavor wheel widget for chart rendering
- [x] T022 [US3] Create `public/widgets/radar.html` for sensory profile Iframe consumption
- [x] T023 [US3] Implement logic in `radar.html` to fetch and render radar chart using `d3-utils.js`
- [x] T021 [US3] Create "Herramientas para tu Marca" section in `public/index.html` with embed code generator

**Checkpoint**: All user stories should now be independently functional

---

## Phase 6: User Story 4 - Conversión a Registro/Mercado (Priority: P3)

**Goal**: El usuario convencido navega hacia el marketplace o registro.

**Independent Test**: Click en los CTAs del Hero y verificar redirección correcta.

### Implementation for User Story 4

- [x] T016 [US4] Implement Hero section with high-impact glassmorphism and optimized CTAs in `public/index.html`
- [x] T017 [P] [US4] Finalize navigation links and multilingual switcher (ES/EN) in `views/partials/public-nav.html`

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T018 [P] Optimize images (WebP) and update references in `public/index.html`
- [ ] T019 [P] Verify responsive behavior at 360px viewport width (especially D3 charts)
- [ ] T020 Run `quickstart.md` validation to ensure developer setup works

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User Story 1 (P1) is the MVP priority.
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### Parallel Opportunities

- T002 and T003 can run in parallel during Setup.
- T005 and T006 can run in parallel during Foundational.
- Once Phase 2 is complete, User Stories 1, 2, and 3 can technically start in parallel if they don't touch the same lines in `landing-app.js` (modular implementation recommended).

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (Value Chain Stepper)
4. **STOP and VALIDATE**: Verify the core value proposition works.

## Notes

- [P] tasks = different files or decoupled logic.
- [Story] label ensures traceability to `spec.md`.
- El uso de **Iframes** en el US3 evita conflictos de CSS con sitios externos (Shopify/Woo).
