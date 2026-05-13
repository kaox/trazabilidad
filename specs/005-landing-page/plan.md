# Implementation Plan: White Label Landing Page

**Branch**: `main` | **Date**: 2026-05-13 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/005-landing-page/spec.md`

## Summary

Evolución del portal de empresa existente (`landing-empresa.html`) hacia un sistema de **Marca Blanca multipágina** con navegación dedicada (Inicio, Tienda, Contáctanos), paleta de colores dinámica heredada del cliente, catálogo en cuadrícula, y CTAs comerciales (WhatsApp). Se reutiliza la infraestructura existente de detección de subdominio, SSR con `landingRenderer.js`, y el middleware de `server.js`. El cambio principal es la adición de `white_label_config` (JSONB) a `company_profiles`, la conversión a SPA con routing client-side, y la neutralización del header corporativo de RuruLab.

## Technical Context

**Language/Version**: Node.js 18+ (CommonJS)
**Primary Dependencies**: Express, D3.js, Knex/Raw SQL, Tailwind CSS 3+
**Storage**: SQLite (Local) / PostgreSQL (Production) / Vercel Blob (Images)
**Testing**: Jest (Unit & Integration), Lighthouse (Performance)
**Target Platform**: Vercel (Hybrid SSR/Static)
**Project Type**: Web Application (Omnichannel Branding B2B2C)
**Performance Goals**: FCP < 1.2s, Lighthouse Performance > 90, Page Weight < 1MB
**Constraints**: < 3s load on 3G, responsive design down to 360px
**Scale/Scope**: Public White Label portals, multi-page navigation, dynamic design system per client

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **Traceability First**: Integra Pasaporte Digital QR en el enlace "Ver Detalle" de cada producto → `/lote/:slug`.
- [x] **Sensory Excellence**: Los perfiles sensoriales D3 (Sunburst y Radar) se mantienen intactos en la página de detalle del producto.
- [x] **Premium "Wow" Experience**: Header neutral con logo del cliente, paleta dinámica con CSS Variables, catálogo en grid de 3-4 columnas, certificaciones destacadas.
- [x] **Resilient Hybrid Architecture**: Nuevo campo JSONB `white_label_config` compatible SQLite/PostgreSQL. Sin cambios al motor de base de datos.
- [x] **Vercel Ecosystem Optimization**: Sigue el despliegue actual en Vercel. Sin nueva infraestructura.
- [x] **Language Consistency**: Documentación y UI en Español. Código en Inglés.

## Project Structure

### Documentation (this feature)

```text
specs/005-landing-page/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── spec.md              # Feature specification
```

### Source Code (repository root)

```text
# Archivos EXISTENTES a MODIFICAR
server.js                          # Agregar rutas /tienda y /contacto al handler de subdominio
src/utils/landingRenderer.js       # Agregar renderizado de Tienda (grid) y Contacto
src/controllers/landingsController.js  # Sin cambios necesarios (ya devuelve products, entity)
src/models/CompanyProfile.js       # Agregar white_label_config al upsert
src/models/empresaModel.js         # Exponer white_label_config en queries de landing

public/landing-empresa.html        # Agregar navegación multi-página y estructura de secciones
public/js/landing-empresa.js       # SPA router client-side, renderizado de Tienda/Contacto
public/css/landing.css             # CSS Variables dinámicas (--accent-color, --primary-color)

# Archivos NUEVOS
migrations/add_white_label_config.sql  # ALTER TABLE company_profiles ADD COLUMN white_label_config
```

**Structure Decision**: Reutilización completa del stack existente. No se crean nuevos proyectos, controladores ni modelos. Se extiende `landing-empresa.html` como SPA con routing basado en hash o secciones dinámicas. El catálogo (Tienda) y Contacto se renderizan client-side con datos ya disponibles en `window.INITIAL_DATA`.

## Implementation Phases

### Phase 1: White Label Config & DB Migration
- Crear migración SQL para agregar columna `white_label_config` (JSONB/TEXT) a `company_profiles`.
- Actualizar `CompanyProfile.upsert()` para persistir `white_label_config`.
- Actualizar queries en `empresaModel.js` para exponer `white_label_config` en las respuestas del landing.
- Actualizar `landingsController.getCompanyLandingDataInternal()` para incluir el campo en la respuesta.

### Phase 2: Header Neutral & Navegación Multi-Página
- Modificar `landing-empresa.html`: Reemplazar el header actual con uno neutral que muestre logo del cliente + menú (Inicio, Tienda, Contáctanos).
- Implementar CSS Variables dinámicas en `landing.css` (`--accent-color`, `--primary-color`) inyectadas desde `white_label_config`.
- Implementar SPA router en `landing-empresa.js` para alternar entre las 3 vistas sin recarga de página.
- Actualizar el middleware de subdominio en `server.js` para servir rutas adicionales (`/tienda`, `/contacto`).

### Phase 3: Página de Inicio (FR-018)
- Refactorizar la vista actual de `landing-empresa.html` para mostrar solo: Hero + Sobre Nosotros + Certificaciones/Premios + Mapa de Fincas + CTA a Tienda.
- Mejorar la jerarquía tipográfica del Hero con el logo del cliente integrado limpiamente.
- Dar visibilidad prominente a Certificaciones y Premios (tarjetas grandes en lugar de miniaturas).

### Phase 4: Página de Tienda (FR-013, FR-015)
- Implementar vista de cuadrícula 3-4 columnas para el catálogo de productos.
- Cada tarjeta: imagen, nombre, precio, peso, dos CTAs ("Ver Detalle" → `/lote/:slug`, "WhatsApp" → `wa.me/`).
- Manejar estado vacío elegante ("Próximamente").
- Aplicar color de acento del cliente a botones e iconos.

### Phase 5: Página de Contáctanos (FR-017)
- Formulario simple (nombre, email, mensaje) que envía al `contact_email` de `white_label_config`.
- Botón prominente de WhatsApp (condicional: se oculta si `whatsapp_number` no está configurado).
- Información de redes sociales si están disponibles.

### Phase 6: Polish & Dual-Route Support
- Asegurar que `/origen-unico/:slug` sirva el mismo contenido White Label que `empresa.rurulab.com`.
- Optimización de iconografía (granos de cacao, carrito) con color de acento.
- Auditoría Lighthouse y optimización de rendimiento.
- Pruebas de responsividad en móvil (360px).

## Dependencies & Execution Order

1. **Phase 1 (DB/Config)**: Bloquea el resto — sin `white_label_config` no hay paleta dinámica.
2. **Phase 2 (Header/Navigation)**: Bloquea Phase 3-5 — la estructura de páginas debe existir antes de llenarlas.
3. **Phases 3, 4, 5**: Pueden ejecutarse en paralelo una vez que la navegación esté lista.
4. **Phase 6 (Polish)**: Depende de todas las fases anteriores.

## Complexity Tracking

> No hay violaciones constitucionales que justificar. Todos los gates pasan.
