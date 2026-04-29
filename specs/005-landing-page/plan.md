# Implementation Plan: RuruLab Landing Page (Public Index)

**Branch**: `005-landing-page` | **Date**: 2026-04-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-landing-page/spec.md`

## Summary

Desarrollo de una Landing Page de alto impacto y conversión para RuruLab, centrada en el storytelling ("del árbol a la taza") y optimizada para SEO. La solución incluye un Stepper interactivo de la cadena de valor, integración de widgets embebibles (Iframe) para perfiles sensoriales, y soporte multilingüe (ES/EN). Técnicamente se basa en Node.js/Express con renderizado híbrido (estadísticas dinámicas + contenido estático optimizado) y visualizaciones avanzadas con D3.js.

## Technical Context

**Language/Version**: Node.js 18+ (CommonJS)  
**Primary Dependencies**: Express, D3.js, Knex.js, Tailwind CSS 3+  
**Storage**: SQLite (Local) / PostgreSQL (Production)  
**Testing**: Jest (Unit & Integration)  
**Target Platform**: Vercel (Hybrid SSR/Static)
**Project Type**: Web Application  
**Performance Goals**: FCP < 1.2s, Lighthouse Performance > 90, Page Weight < 1MB  
**Constraints**: < 3s load on 3G, responsive design down to 360px  
**Scale/Scope**: Public landing, 9-module showcase, 5-stage stepper, external widgets

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Traceability First**: Integra Pasaporte Digital QR y visualización de cadena de custodia.
- [x] **Sensory Excellence**: Utiliza D3.js para Rueda de Sabores y Radar de Atributos en widgets.
- [x] **Premium "Wow" Experience**: Implementa glassmorfismo, micro-animaciones y tipografía moderna (Inter/Outfit).
- [x] **Resilient Hybrid Architecture**: Compatible con SQLite/PostgreSQL; usa JSON para configuración flexible.
- [x] **Vercel Ecosystem Optimization**: Diseñado para despliegue en Vercel con optimización de assets.
- [x] **Language Consistency**: Documentación y UI principal en Español, con soporte Multilingüe (EN).

## Project Structure

### Documentation (this feature)

```text
specs/005-landing-page/
├── plan.md              # This file
├── research.md          # Research findings and decisions
├── data-model.md        # Entity definitions and relationships
├── quickstart.md        # Setup and development instructions
├── checklists/          # Quality checklists
│   └── requirements.md  # Spec validation results
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
public/
├── css/
│   └── landing.css      # Specific styles (glassmorphism, animations)
├── js/
│   ├── landing-app.js   # Main logic (stepper, i18n, stats fetch)
│   ├── d3-sunburst.js   # Reusable sunburst logic (shared)
│   └── d3-utils.js      # Reusable radar logic (shared)
├── widgets/
│   ├── flavor-wheel.html # Sunburst chart widget
│   └── radar.html        # Sensory profile (radar) widget
└── locales/
    ├── es.json          # Spanish marketing content
    └── en.json          # English marketing content

views/
└── landing.html         # Main landing template (Semantic HTML5)

routes/
└── landing.js           # Routes for landing and widget stats

server.js                # Express entry point (register new routes)
```

**Structure Decision**: Se opta por una estructura integrada (Single Project) siguiendo el patrón actual del repositorio, separando la lógica de widgets en un directorio dedicado dentro de `public/` para facilitar su servicio vía Iframe independiente.

## Implementation Phases

### Phase 1: Foundation & SEO
- Configuración de `public/index.html` con SEO meta-tags y estructura semántica.
- Implementación de `landing-app.js` para manejo de i18n y estadísticas dinámicas (`/api/landing/stats`).

### Phase 2: Interactive Storytelling (US1 & US2)
- Desarrollo del **Value Chain Stepper** interactivo (D3/CSS).
- Creación de la sección de **Impact Modules** (9 módulos) y el **DNA Mockup** (Packaging interactivo).

### Phase 3: Widget Ecosystem (US3)
- **Engine**: Refactorización de `public/widgets/flavor-wheel.html` para consumo externo.
- **API**: Endpoint robusto `/api/public/widgets/flavor-wheel/:token`.
- **Landing UI**: Sección "Herramientas para tu Marca" en la landing page con un visualizador de widgets y botón "Copiar Código" (Embed code generator).

### Phase 4: Conversion & Polish (US4)
- Optimización de CTAs y navegación multilingüe.
- Auditoría Lighthouse para asegurar rendimiento > 90.

## Dependencies & Execution Order
1. **Foundational (Phase 1)**: Bloquea el resto.
2. **Storytelling (Phase 2)**: Puede desarrollarse en paralelo con US3.
3. **Widgets (Phase 3)**: Requiere US1/US2 si se desea mostrar ejemplos reales.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
