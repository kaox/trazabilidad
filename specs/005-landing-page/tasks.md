# Tasks: White Label Landing Page

**Input**: Design documents from `/specs/005-landing-page/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md

**Tests**: No specific tests requested in spec; manual verification per story is required.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. US1-US4 (RuruLab index) are already completed from prior phases. New work focuses on US5 (Marca Blanca).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US5)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETED

**Purpose**: Project initialization and basic structure

- [x] T001 Create project structure: `public/css/`, `public/js/`, `public/locales/`, `public/widgets/`
- [x] T002 [P] Create `public/locales/es.json` and `public/locales/en.json` base files
- [x] T003 [P] Configure initial `public/index.html` with semantic HTML5 and SEO meta tags

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETED

**Purpose**: Core infrastructure that was needed before ANY user story

- [x] T004 Implement `GET /api/landing/stats` route in `server.js`
- [x] T005 [P] Create core `public/js/landing-app.js` with i18n logic
- [x] T006 [P] Extract styles to `public/css/landing.css` with global variables

---

## Phase 3: User Story 1 - Descubrimiento del Origen (P1) ✅ COMPLETED

- [x] T007 [US1] Create interactive Value Chain Stepper in `public/index.html`
- [x] T008 [US1] Implement Stepper animation in `public/js/landing-app.js`

---

## Phase 4: User Story 2 - Validación de Calidad (P2) ✅ COMPLETED

- [x] T010 [US2] Create 9-module impact grid in `public/index.html`
- [x] T011 [US2] Implement DNA Mockup (QR hover) in `public/index.html`

---

## Phase 5: User Story 3 - Widgets Externos (P2) ✅ COMPLETED

- [x] T013 [US3] Create `public/widgets/flavor-wheel.html`
- [x] T014 [US3] Implement `GET /api/public/widgets/flavor-wheel/:token` in `server.js`
- [x] T015 [US3] Integrate `d3-sunburst.js` into flavor wheel widget
- [x] T022 [US3] Create `public/widgets/radar.html`
- [x] T021 [US3] Create "Herramientas para tu Marca" section with embed code generator

---

## Phase 6: User Story 4 - Conversión a Registro (P3) ✅ COMPLETED

- [x] T016 [US4] Implement Hero section with CTAs in `public/index.html`
- [x] T017 [US4] Finalize navigation and multilingual switcher

---

## Phase 7: White Label Config & DB Migration (BLOCKING) 🔧 NEW

**Purpose**: Data layer changes that MUST be complete before US5 can begin

**⚠️ CRITICAL**: No US5 work can begin until this phase is complete

- [ ] T100 Create migration SQL file `migrations/add_white_label_config.sql` with `ALTER TABLE company_profiles ADD COLUMN white_label_config TEXT DEFAULT NULL`
- [ ] T101 [P] Create migration SQL for `contact_leads` table in `migrations/add_contact_leads.sql` (id, company_id, name, email, message, created_at, is_read)
- [ ] T102 Update `src/models/CompanyProfile.js` — add `white_label_config` to the `upsert()` method params and both INSERT/UPDATE SQL statements
- [ ] T103 [P] Update `src/models/empresaModel.js` — add `white_label_config` to the SELECT columns in `getVerifiedProfileByUserId()` and `findCompanyBySubdomainOrSlug()` queries
- [ ] T104 Update `src/controllers/landingsController.js` — parse and include `white_label_config` (via `safeJSONParse`) in the `companyData` object returned by both `getCompanyLandingData()` and `getCompanyLandingDataInternal()`

**Checkpoint**: White Label config is stored, retrieved, and exposed via the landing API. Verify by hitting `GET /api/landing/:userId` and confirming `user.white_label_config` appears in the response.

---

## Phase 8: User Story 5 - Marca Blanca (P1) 🎯 NEW MVP

**Goal**: Consumidor final accede a `empresa.rurulab.com` y ve un portal de marca coherente con menú (Inicio, Tienda, Contacto), paleta de colores del cliente, y catálogo en cuadrícula.

**Independent Test**: Acceder a `http://burgoschocolate.localhost:3000` o `http://localhost:3000/origen-unico/burgos-chocolate-1`. El header NO debe mostrar "Ruru Lab". Los colores de acento deben coincidir con la configuración del cliente.

### 8a. Header Neutral & Navegación (FR-010, FR-011)

- [ ] T105 [US5] Refactorizar `public/landing-empresa.html` — reemplazar el header actual con un header neutral: logo del cliente (dinámico), menú simplificado (Inicio, Tienda, Contáctanos), hamburger menu en móvil. Eliminar todos los enlaces corporativos de RuruLab.
- [ ] T106 [US5] Implementar CSS Variables dinámicas en `public/css/landing.css` — definir `--accent-color`, `--primary-color`, `--accent-hover` con defaults, y aplicarlas a todos los botones, links, iconos y hovers del portal White Label.
- [ ] T107 [US5] Implementar SPA hash router en `public/js/landing-empresa.js` — escuchar `hashchange` para alternar entre `#inicio` (default), `#tienda`, `#contacto`. Ocultar/mostrar las secciones correspondientes. Actualizar la clase `active` del menú.
- [ ] T108 [US5] Actualizar middleware de subdominio en `server.js` (líneas 57-58) — cambiar la condición `req.path !== '/'` para permitir también `/tienda` y `/contacto` (o servir siempre `landing-empresa.html` para paths que no sean assets estáticos ni API).
- [ ] T109 [US5] Inyectar CSS Variables dinámicas en `server.js` — al renderizar `landing-empresa.html` (tanto en subdominio como en `/origen-unico/:slug`), leer `white_label_config` del `landingData` e inyectar un bloque `<style>:root { --accent-color: ...; --primary-color: ...; }</style>` en el `<head>`.

### 8b. Página de Inicio (FR-018)

- [ ] T110 [US5] Refactorizar la sección Hero en `public/landing-empresa.html` — integrar el logo del cliente de forma limpia en un área dedicada, mejorar la jerarquía tipográfica (nombre de empresa grande, subtítulo con historia corta), usar `cover_image_url` como fondo.
- [ ] T111 [P] [US5] Crear sección "Sobre Nosotros" en `public/landing-empresa.html` — renderizar `user.history` como contenido destacado con tipografía moderna. Incluir imágenes de galería si `entity.imagenes` tiene datos.
- [ ] T112 [P] [US5] Refactorizar sección de Certificaciones y Premios en `public/landing-empresa.html` — convertir de miniaturas pequeñas a tarjetas grandes destacadas con imágenes completas, nombres y descripciones. Usar `entity.certificaciones` y `entity.premios`.
- [ ] T113 [US5] Crear sección Mapa de Fincas en `public/landing-empresa.html` — renderizar un mapa interactivo (Leaflet o estático) con `entity.coordenadas`. Mostrar nombre de finca, altitud, y ubicación geográfica.
- [ ] T114 [US5] Crear CTA prominente hacia Tienda al final de la sección Inicio en `public/landing-empresa.html` — botón "Ver Catálogo" con `--accent-color` que navega a `#tienda`.

### 8c. Página de Tienda (FR-013, FR-015)

- [ ] T115 [US5] Crear vista de cuadrícula del catálogo en `public/js/landing-empresa.js` — función `renderTienda(products, whatsappNumber)` que genera un grid CSS de 3-4 columnas (responsive: 1 col mobile, 2 col tablet, 3-4 col desktop).
- [ ] T116 [US5] Diseñar tarjeta de producto en `public/js/landing-empresa.js` — cada tarjeta muestra: imagen, nombre, `tipo_producto`, precio (`precio_venta`), peso (`peso_neto` + `unidad_medida`), dos CTAs: "Ver Detalle" (enlace a `/lote/:slug`) y "WhatsApp" (enlace `wa.me/:number?text=...`).
- [ ] T117 [US5] Implementar estado vacío de la Tienda en `public/js/landing-empresa.js` — si `products.length === 0`, mostrar un estado elegante con icono, mensaje "Próximamente" y CTA de contacto.
- [ ] T118 [P] [US5] Agregar estilos del grid de Tienda en `public/css/landing.css` — clases para grid responsive, tarjetas con hover effect, botones con `--accent-color`, badges de trazabilidad.

### 8d. Página de Contáctanos (FR-017)

- [ ] T119 [US5] Crear vista de Contacto en `public/js/landing-empresa.js` — función `renderContacto(config)` que genera: formulario (nombre, email, mensaje) + botón WhatsApp prominente (condicional: solo si `whatsapp_number` existe).
- [ ] T120 [US5] Implementar endpoint `POST /api/public/contact` en `server.js` — recibe `{name, email, message, companyId}`, valida campos, inserta en tabla `contact_leads`. Retorna `{success: true, message: "Mensaje enviado"}`.
- [ ] T121 [US5] Conectar formulario al endpoint en `public/js/landing-empresa.js` — fetch POST, manejo de estados (loading, success, error), limpiar formulario al enviar.
- [ ] T122 [P] [US5] Agregar estilos del formulario de contacto en `public/css/landing.css` — inputs con bordes suaves, focus states con `--accent-color`, botón submit con acento, botón WhatsApp verde prominente.

### 8e. Iconografía & Refinamientos (FR-016)

- [ ] T123 [US5] Reemplazar iconos genéricos por iconos de industria en `public/landing-empresa.html` y `public/js/landing-empresa.js` — usar Font Awesome icons refinados (granos de cacao `fa-seedling`, carrito `fa-shopping-bag`, WhatsApp `fa-whatsapp`) con `color: var(--accent-color)`.

**Checkpoint**: El portal White Label completo debe ser funcional bajo `empresa.localhost:3000` y `/origen-unico/:slug`. Las 3 páginas (Inicio, Tienda, Contacto) deben navegar correctamente, la paleta del cliente debe aplicarse a todos los elementos, y los CTAs deben funcionar.

---

## Phase 9: Dual-Route & SSR Parity

**Purpose**: Asegurar que ambas rutas sirvan la experiencia idéntica y el SSR sea completo para SEO.

- [ ] T124 Actualizar SSR en `src/utils/landingRenderer.js` — agregar función `renderProductGrid(products, phone)` que genera el HTML de la cuadrícula de Tienda para SSR (SEO de productos). Llamarla desde `server.js` al renderizar bajo `/origen-unico/:slug`.
- [ ] T125 [P] Actualizar SSR en `src/utils/landingRenderer.js` — agregar función `renderContactSection(config)` que genera el HTML del formulario de contacto para SSR.
- [ ] T126 Verificar paridad visual: navegar a `http://localhost:3000/origen-unico/burgos-chocolate-1` y a `http://burgoschocolate.localhost:3000` — ambas deben renderizar exactamente el mismo contenido y paleta de colores.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T127 [P] Verificar responsividad del grid de Tienda a 360px — tarjetas deben ser 1 columna en mobile sin desbordamiento
- [ ] T128 [P] Verificar que el header neutral funciona correctamente en mobile — hamburger menu abre/cierra, menú ocupa pantalla completa
- [ ] T129 Auditoría Lighthouse: ejecutar `npx lighthouse` contra el portal White Label — verificar Performance > 90, SEO > 95
- [ ] T130 [P] Optimizar imágenes de productos — verificar que las imágenes del grid usan `loading="lazy"` y `width/height` explícitos
- [ ] T131 Actualizar JSON-LD en `server.js` para incluir `Organization` del cliente White Label en lugar de RuruLab cuando es subdominio

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1-6 (Setup → US4)**: ✅ Completadas — No requieren trabajo adicional
- **Phase 7 (DB Migration)**: Sin dependencias — Puede comenzar inmediatamente. **BLOQUEA** Phase 8
- **Phase 8 (US5 Marca Blanca)**: Depende de Phase 7 completa
  - 8a (Header/Nav): Debe completarse primero — BLOQUEA 8b, 8c, 8d
  - 8b (Inicio), 8c (Tienda), 8d (Contacto): Pueden ejecutarse **en paralelo** después de 8a
  - 8e (Iconografía): Puede ejecutarse en paralelo con 8b-8d
- **Phase 9 (SSR Parity)**: Depende de Phase 8 completa
- **Phase 10 (Polish)**: Depende de Phase 9 completa

### Parallel Opportunities

```text
# Fase 7: Pueden ejecutarse en paralelo
T100 + T101  (migraciones SQL independientes)
T102 + T103  (modelos diferentes)

# Fase 8a: Secuencial (mismos archivos)
T105 → T106 → T107 → T108 → T109

# Fase 8b-8d: En paralelo después de 8a
Thread A: T110 → T111 → T112 → T113 → T114  (Inicio)
Thread B: T115 → T116 → T117 + T118           (Tienda)
Thread C: T119 → T120 → T121 + T122           (Contacto)

# Fase 9: Parcialmente paralelo
T124 + T125  → T126 (verificación final)
```

---

## Implementation Strategy

### MVP First (Phase 7 + Phase 8a + 8c)

1. Complete Phase 7: DB Migration (white_label_config)
2. Complete Phase 8a: Header Neutral + SPA Router
3. Complete Phase 8c: Tienda (Grid de productos — mayor impacto comercial)
4. **STOP and VALIDATE**: El portal muestra productos en grid con paleta del cliente
5. Continue with 8b (Inicio) and 8d (Contacto)

### Task Summary

| Fase | Tareas | Estado |
|------|--------|--------|
| Phase 1-6 (Legacy) | 17 tasks | ✅ Completadas |
| Phase 7 (DB Migration) | 5 tasks | 🔧 Pendiente |
| Phase 8 (US5 Marca Blanca) | 19 tasks | 🔧 Pendiente |
| Phase 9 (SSR Parity) | 3 tasks | 🔧 Pendiente |
| Phase 10 (Polish) | 5 tasks | 🔧 Pendiente |
| **Total nuevas** | **32 tasks** | |

## Notes

- [P] tasks = different files or decoupled logic, can run in parallel
- [US5] label maps all new tasks to User Story 5 (Marca Blanca)
- `white_label_config` es TEXT en SQLite y JSONB en PostgreSQL — usar `safeJSONParse` siempre
- El SPA router usa hash (`#inicio`, `#tienda`, `#contacto`) para evitar recarga de página y conflictos con rutas Express
- Los datos de `window.INITIAL_DATA` ya contienen todo lo necesario (products, entity, user) — no se requieren llamadas API adicionales para las vistas
