# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

Implementación de un **Gestor de Ruedas de Sabor (Flavor Wheels)** basado en el estándar Sunburst Chart utilizando **D3.js**. El sistema permitirá a los catadores configurar perfiles sensoriales seleccionando descriptores jerárquicos. Siguiendo la estética de **Tastify (FR-013)**, el widget final mostrará exclusivamente las ramas que contienen notas seleccionadas, ofreciendo un perfil visualmente limpio y enfocado. Los datos se persisten en JSONB y se sirven vía iframe con tokens públicos regenerables.

## Technical Context

<!--
  ACTION REQUIRED: Replace the content in this section with the technical details
  for the project. The structure here is presented in advisory capacity to guide
  the iteration process.
-->

**Language/Version**: Node.js 18+, Vanilla JavaScript (ES6+).  
**Primary Dependencies**: D3.js v7, Express.js, SQLite/PostgreSQL.  
**Storage**: SQLite (Local) / PostgreSQL (Prod), tabla `ruedas_sabores` con columna `notas_json` (JSONB).  
**Testing**: Jest para controladores y utilidades de datos.  
**Target Platform**: Web (Responsive, compatible con iFrames externos).
**Project Type**: Web Application (Admin Dashboard + Public Widget).  
**Performance Goals**: Renderizado inicial < 600ms, interactividad a 60fps.  
**Constraints**: Uso estricto de colores SCA/Cocoa of Excellence; centro fijo en Sunburst; poda de ramas no seleccionadas en el widget final.  
**Scale/Scope**: Soporte para taxonomías de Café, Cacao y Miel con múltiples niveles de profundidad.

### I. Traceability & Transparency
- [ ] Las ruedas de sabor deben vincularse opcionalmente a productos y lotes.
- [ ] El `public_token` debe ser regenerable para control de acceso.

### II. Specialty & Sensory Excellence
- [ ] Implementar taxonomías SCA (Café) y Cocoa of Excellence (Cacao).
- [ ] Los colores deben coincidir exactamente con las definiciones del `flavor-wheels.json`.

### III. Premium "Wow" Experience
- [ ] Gráfico Sunburst interactivo con D3.js.
- [ ] Poda de ramas (Tastify-style) para resaltar la calidad del perfil seleccionado.

### IV. Resilient Hybrid Architecture
- [ ] Persistencia compatible con SQLite y PostgreSQL usando JSONB para las notas.

### V. Tech Stack Compliance
- [ ] Backend en Node.js/Express.
- [ ] Frontend en Vanilla JS + D3.js.

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)
<!--
  ACTION REQUIRED: Replace the placeholder tree below with the concrete layout
  for this feature. Delete unused options and expand the chosen structure with
  real paths (e.g., apps/admin, packages/something). The delivered plan must
  not include Option labels.
-->

```text
src/
├── controllers/
│   ├── ruedasController.js      # CRUD de ruedas y plantillas
│   └── widgetController.js      # Entrega del iframe con lógica de poda
├── models/
│   └── ruedaModel.js            # Lógica de base de datos
├── routes/
│   └── ruedasRoutes.js          # Endpoints API
public/
├── data/
│   └── flavor-wheels.json       # Taxonomías (Existente)
├── js/
│   ├── d3-sunburst.js           # Lógica central de D3
│   └── ruedas-app.js            # Lógica del gestor (Admin)
views/
├── ruedas.html                  # UI del gestor
└── widget-sunburst.html         # Template del iframe
```

**Structure Decision**: El proyecto sigue una estructura de aplicación web estándar (Express + Vanilla JS). La lógica de "poda" (filtering) de D3 se implementará en `d3-sunburst.js` para ser activada opcionalmente en la vista del widget.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
