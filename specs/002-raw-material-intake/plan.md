# Implementation Plan: Centro de Acopio y Recepción

**Branch**: `main` (Feature config `002-raw-material-intake`) | **Date**: 2026-04-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-raw-material-intake/spec.md`

## Summary

Implementación del Módulo de Acopio permitiendo registrar la entrada logística de materia prima base. El diseño técnico utiliza un enfoque de formularios guiados por configuración JSON (`acopio_config.json`) para renderizar inputs dinámicos en Vanilla JS. La captura de peso requiere Peso Bruto y Tara (guardados en `data_adicional` para evitar migraciones SQL), y los controles de calidad son diferidos. Los saldos de consumo parcial se calculan dinámicamente enlazando la tabla `acquisitions` con la tabla `batches`.

## Technical Context

**Language/Version**: Node.js (Backend), Vanilla JS (Frontend)
**Primary Dependencies**: Express (API), Tailwind CSS (UI)
**Storage**: SQLite (Desarrollo) / PostgreSQL (Producción)
**Testing**: Manual E2E (Registro, consumo parcial, soft delete)
**Target Platform**: Web Browser (Desktop y Tablet para báscula)
**Project Type**: Web Application
**Performance Goals**: < 60 segundos por registro de acopio. Consultas de saldos en < 200ms.
**Constraints**: 
- Estricta compatibilidad entre SQLite y PostgreSQL.
- Prohibición de eliminar físicamente (Hard Delete) acopios que ya hayan sido enlazados a un procesamiento (`batches`).
- Evitar cambios de esquema (Migraciones SQL) para campos de calidad y logística fina, usando `JSONB`.
**Scale/Scope**: ~10,000 registros anuales, aislamientos por `user_id`.

## Constitution Check

*GATE: Passed*

- **Cero Migraciones Innecesarias**: Se utiliza el campo preexistente `data_adicional` para guardar Tara, Peso Bruto, Humedad y Defectos en formato JSON.
- **Trazabilidad Inmutable**: Se implementa la regla estricta de "Soft Delete" (`deleted_at`) en el controlador cuando el método `checkUsageInBatches` retorna verdadero.
- **Sin Frameworks Reactivos Pesados**: La lógica de selección en cascada (Rubro → Condición → Subtipo) se desarrolla puramente en Vanilla JS leyendo de `acopio_config.json`.

## Project Structure

### Documentation (this feature)

```text
specs/002-raw-material-intake/
├── plan.md              # Plan de implementación
├── research.md          # Resolución de cálculo de saldos y bruto/tara
├── data-model.md        # Estructura JSONB y derivación de saldos
├── quickstart.md        # Guía operativa para planta y laboratorio
└── contracts/
    └── acquisitions-api.md # Definición de la API REST
```

### Source Code

```text
public/
├── data/
│   └── acopio_config.json         # Configuración estática de formularios
├── js/
│   ├── acopio-app.js              # Lógica de formularios y listado (saldos)
│   └── components/acopio-form.js  # Renderizado dinámico de campos
└── acopios.html                   # Interfaz visual de existencias e ingresos

src/
├── models/
│   └── acquisitionModel.js        # Ajustes a las consultas SQL para saldos
├── controllers/
│   └── acquisitionsController.js  # Lógica de creación, soft delete, y validaciones
└── routes/
    └── acquisitionsRoutes.js      # Definición de endpoints
```

**Structure Decision**: El módulo es una extensión natural del flujo de trazabilidad existente. Se crea la vista aislada `acopios.html` con su respectivo bundle de Vanilla JS. El backend se apoya en los archivos preexistentes modificando la lógica interna para soportar el cálculo cruzado con `batches`.

## Complexity Tracking

Ninguna violación a los principios constitucionales. La solución elegida (calcular saldos on-the-fly) evita transacciones complejas y previene desincronización de datos, manteniendo la simplicidad del sistema.
