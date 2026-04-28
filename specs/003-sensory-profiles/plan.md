# Implementation Plan: Sensory Profiles Config

**Branch**: `main` | **Date**: 2026-04-28 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/003-sensory-profiles/spec.md`

## Summary

Implementación de un gestor dinámico de perfiles sensoriales (Cup Profiling) que permite a los usuarios configurar atributos de cata (café, cacao, miel, etc.) a través de un archivo JSON (`public/data/perfiles.json`). El sistema incluye un panel administrativo para CRUD de perfiles, una visualización interactiva con radar charts (D3.js) y la generación de widgets (iframes) externos con validación de suscripción.

## Technical Context

**Language/Version**: Node.js 18+ with Express  
**Primary Dependencies**: D3.js, Tailwind CSS 3+, SQLite (Local) / PostgreSQL (Production)  
**Storage**: SQLite/PostgreSQL (JSONB para `perfil_data`)  
**Testing**: Jest  
**Target Platform**: Web (Vercel)
**Project Type**: Web application (Frontend Vanilla JS + Backend Express)  
**Performance Goals**: Page load < 3s, Page size < 1MB, Lighthouse >= 90  
**Constraints**: Atributos dinámicos, límites de puntuación (0-10.0), validación de suscripción en tiempo real para el widget  
**Scale/Scope**: Repositorio centralizado de perfiles, exportación vía iframe para e-commerce externos

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

1. **Traceability & Transparency First**: El perfil sensorial se vincula criptográficamente a los lotes en procesamiento. (PASSED)
2. **Specialty & Sensory Excellence**: Sigue estándares SCA/Cocoa of Excellence; integración de ruedas de sabores. (PASSED)
3. **Premium "Wow" Experience**: Uso de D3.js para visualizaciones avanzadas y UI con Inter/Tailwind. (PASSED)
4. **Resilient Hybrid Architecture**: Compatible con SQLite y PostgreSQL usando JSONB. (PASSED)
5. **Vercel Ecosystem Optimization**: Preparado para despliegue en Vercel. (PASSED)

## Project Structure

### Documentation (this feature)

```text
specs/003-sensory-profiles/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
src/
├── controllers/
│   ├── perfilesController.js
│   └── widgetController.js
├── models/
│   ├── perfilModel.js
│   └── batchModel.js
├── routes/
│   ├── perfilesRoutes.js
│   └── widgetRoutes.js
└── config/
    └── db.js

public/
├── data/
│   └── perfiles.json    # Configuración de atributos
├── js/
│   ├── perfiles-app.js
│   ├── d3-utils.js
│   └── widget-radar.js
└── css/
    └── styles.css

views/
├── perfiles.html
└── widget-radar.html
```

**Structure Decision**: Se mantiene la estructura monolítica actual con separación clara de controladores, modelos y rutas en `src/`, y activos estáticos/vistas en `public/` y `views/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | | |
