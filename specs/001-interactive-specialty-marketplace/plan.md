# Plan de Implementación: Marketplace de Especialidad Interactivo

**Rama**: `001-interactive-specialty-marketplace` | **Fecha**: 2026-04-24 | **Spec**: [spec.md](./spec.md)  
**Entrada**: Especificación de la función desde `specs/001-interactive-specialty-marketplace/spec.md`

**Nota**: Este plan fue generado por el comando `/speckit-plan`.

## Resumen

Mejorar el marketplace existente de Ruru Lab para transformarlo en una experiencia de descubrimiento de productos de especialidad verdaderamente interactiva. El trabajo se centra en tres pilares: (1) optimizar la **Rueda de Sabores Interactiva** con D3.js para soportar filtrado bidireccional entre rueda y lista de productos, (2) agregar **filtros avanzados** basados en datos técnicos (puntaje SCA, altitud, variedad, proceso) y búsqueda textual, y (3) reforzar la **transparencia verificable** con insignias de trazabilidad blockchain y premios más prominentes en las tarjetas de producto.

## Contexto Técnico

**Lenguaje/Versión**: Node.js 18+ (Backend), Vanilla JavaScript ES6+ (Frontend)  
**Dependencias Principales**: Express 4.19, D3.js v7, Chart.js, Tailwind CSS 3.4  
**Almacenamiento**: SQLite (Local) / PostgreSQL (Producción) via consultas SQL directas  
**Testing**: Jest 29 con jsdom  
**Plataforma Objetivo**: Web responsive (Desktop + Móvil)  
**Tipo de Proyecto**: Aplicación web (monolito Express con frontend estático)  
**Objetivos de Rendimiento**: Filtrado de rueda < 300ms, carga de página < 3s en 3G  
**Restricciones**: Página total < 1MB, Lighthouse >= 90, compatibilidad SQLite/PostgreSQL  
**Escala/Alcance**: Hasta 500 lotes activos

## Verificación de Constitución

*COMPUERTA: Debe pasar antes de la investigación de Fase 0. Re-verificar después del diseño de Fase 1.*

| Principio | Estado | Notas |
|-----------|--------|-------|
| I. Trazabilidad y Transparencia Primero | ✅ Cumple | Insignias blockchain en tarjetas, verificación vía `traceability_registry` |
| II. Excelencia Sensorial de Especialidad | ✅ Cumple | Ruedas SCA (café) y CoE (cacao) implementadas en `flavor-wheels.json` |
| III. Experiencia Premium "Wow" | ✅ Cumple | Tipografía Inter/Playfair Display, gradientes, micro-animaciones, glassmorfismo |
| IV. Arquitectura Híbrida Resiliente | ✅ Cumple | Filtrado en memoria compatible SQLite/PostgreSQL, sin queries JSONB |
| V. Optimización del Ecosistema Vercel | ✅ Cumple | Imágenes en Vercel Blob, archivos estáticos servidos por Express |
| Stack Técnico No Negociable | ✅ Cumple | Node.js/Express, Vanilla JS, Tailwind CSS 3+, Jest |
| Estándares de Código | ✅ Cumple | CommonJS, camelCase, API RESTful, HTML5 semántico |
| Rendimiento y Optimización | ⚠️ Verificar | D3.js + Chart.js CDN pueden impactar el presupuesto de 1MB. Monitorear. |
| Idioma y Comunicación | ✅ Cumple | Interfaz y documentación en español, código en inglés |

## Estructura del Proyecto

### Documentación (esta función)

```text
specs/001-interactive-specialty-marketplace/
├── spec.md              # Especificación de la función
├── plan.md              # Este archivo
├── research.md          # Fase 0: Decisiones técnicas
├── data-model.md        # Fase 1: Modelo de datos
├── quickstart.md        # Fase 1: Guía de inicio rápido
├── contracts/           # Fase 1: Contratos de API
│   └── marketplace-api.md
├── checklists/          # Checklists de calidad
│   └── requirements.md
└── tasks.md             # Fase 2 (/speckit-tasks - pendiente)
```

### Código Fuente (raíz del repositorio)

```text
# Archivos EXISTENTES a modificar
public/
├── marketplace.html         # Vista HTML del marketplace
├── js/
│   ├── marketplace.js       # Lógica principal (rueda, filtros, cards)
│   └── chart-utils.js       # Utilidades de Chart.js (radar)
├── data/
│   ├── flavor-wheels.json   # Datos estáticos ruedas SCA/CoE
│   └── premios.json         # Datos estáticos de premios
└── css/
    └── styles.css           # Estilos compilados de Tailwind

src/
├── controllers/
│   └── productosController.js  # Endpoint /api/public/marketplace/products
├── models/
│   └── productoModel.js        # Consultas SQL del marketplace
└── config/
    └── db.js                   # Configuración de BD

server.js                       # Rutas Express

# Tests
__tests__/
└── marketplace.test.js         # Tests del marketplace (nuevo)
```

**Decisión de Estructura**: Se mantiene la estructura monolítica existente. No se crean nuevas carpetas ni archivos de infraestructura. Los cambios son iterativos sobre los archivos existentes, con la posible adición de un archivo de test dedicado.

## Seguimiento de Complejidad

> No hay violaciones a la constitución que requieran justificación.
