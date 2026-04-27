# Implementation Plan: Configuración de Perfiles Sensoriales y Puntuaciones

**Branch**: `main` (Feature `003-sensory-profiles`) | **Date**: 2026-04-26 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-sensory-profiles/spec.md`

## Summary

Implementación del Gestor de Perfiles Sensoriales ("Cup Profiling") y un Generador de Widget de Integración. El sistema usará una arquitectura flexible basada en `JSONB` para almacenar las catas paramétricas dinámicas según el tipo (Café/Cacao). D3.js renderizará gráficos de radar interactivos tanto en el dashboard interno como a través de un endpoint público (`iframe`) protegido por un token de solo lectura, cuyo acceso se valida en tiempo real contra el estado de suscripción del usuario.

## Technical Context

**Language/Version**: Node.js (Backend), Vanilla JS (Frontend)  
**Primary Dependencies**: Express, D3.js (Frontend y Widget HTML), Tailwind CSS  
**Storage**: SQLite (Dev) / PostgreSQL (Prod) mediante JSONB en `perfiles`.  
**Testing**: Pruebas manuales E2E (Creación de perfil, generación de widget, prueba de expiración de suscripción en iframe embebido)  
**Target Platform**: Web App y Tiendas Externas (Shopify/WooCommerce vía iframe)  
**Project Type**: Web Application  
**Performance Goals**: Widget load time < 500ms (usando `loading="lazy"`)  
**Constraints**: El iframe no debe depender de JWT/Cookies del cliente final, solo del `public_token`. Se evita crear tablas relacionales para atributos de cata en favor del performance.  
**Scale/Scope**: Múltiples tenants, un perfil referenciable por N lotes, alto tráfico de visualizaciones públicas.

## Constitution Check

*GATE: Passed*

- **Desarrollo Ágil y Sin Migraciones Duras**: Aprobado. Uso de `JSONB` previene `ALTER TABLE` por cada nuevo atributo sensorial.
- **Rendimiento e Integraciones Livianas**: Aprobado. El iframe sirve un HTML minificado con CDN de D3.js sin invocar librerías pesadas como React.
- **Validación de Capacidad de Negocio**: Aprobado. Se integrará la validación de suscripciones antes de servir el contenido asíncrono, protegiendo el core model comercial.

## Project Structure

### Documentation (this feature)

```text
specs/003-sensory-profiles/
├── plan.md              # Plan de implementación técnico
├── research.md          # Decisiones de arquitectura (Iframe, JSONB, Token)
├── data-model.md        # Estructura del JSON y llaves foráneas
├── quickstart.md        # Guía para analistas de calidad e integradores e-commerce
└── contracts/
    └── sensory-profiles-api.md # Endpoints REST y snippet de Iframe
```

### Source Code (repository root)

```text
public/
├── js/
│   ├── perfiles-app.js        # UI interna, manipulador dinámico y D3.js local
│   └── d3-utils.js            # Refactor/Extracción de helpers de D3.js
└── views/
    ├── perfiles.html          # Vista protegida CRUD del Analista
    └── widget-radar.html      # Plantilla pública HTML cruda para el iframe

src/
├── models/
│   └── perfilModel.js         # Interfaz a BD con validaciones de JSONB y suscripciones
├── controllers/
│   ├── perfilesController.js  # Lógica CRUD y generación de public_token
│   └── widgetController.js    # Endpoint liviano para servir el iframe al consumidor
└── routes/
    ├── perfilesRoutes.js      # Rutas /api/perfiles (Auth)
    └── widgetRoutes.js        # Rutas /widget/radar (Públicas)
```

**Structure Decision**: Se extiende la estructura actual añadiendo la lógica en un nuevo conjunto Modelo-Vista-Controlador dedicado a Perfiles, e introduciendo un `widgetController.js` especializado en inyectar data de forma asíncrona a un HTML base (`widget-radar.html`) sin requerir layouts pesados o autenticación estándar.

## Complexity Tracking

Ninguna violación identificada a la constitución. El uso de JSONB vs tablas de base de datos relacionales es el camino recomendado y documentado en `research.md`.
