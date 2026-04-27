# Investigación: Marketplace de Especialidad Interactivo

**Fecha**: 2026-04-24  
**Especificación**: [spec.md](./spec.md)

---

## Decisión 1: Mecanismo de Renderizado de la Rueda de Sabores

**Decisión**: Continuar utilizando D3.js v7 con `d3.partition()` (Sunburst) para la rueda interactiva.

**Razonamiento**:
- El proyecto ya tiene D3.js v7 integrado y funcionando en `marketplace.js`.
- La rueda Sunburst actual renderiza correctamente la jerarquía multinivel del archivo `flavor-wheels.json`.
- D3 ofrece control total sobre interacciones (hover, click, drill-down) y animaciones SVG.
- El rendimiento es excelente para datasets pequeños (< 200 nodos), que es el caso de las ruedas SCA (~100 nodos) y CoE (~50 nodos).

**Alternativas consideradas**:
- **Chart.js Polar/Doughnut**: Limitado para jerarquías anidadas (solo 1 nivel). Rechazado.
- **Rueda estática SVG prediseñada**: Sin interactividad dinámica. Rechazado.
- **Librería de terceros (e.g., amCharts)**: Dependencia pesada innecesaria. Rechazado.

---

## Decisión 2: Estructura de Datos de Sabores (SCA y CoE)

**Decisión**: Utilizar el archivo estático `public/data/flavor-wheels.json` existente como fuente de verdad para las ruedas.

**Razonamiento**:
- Los datos ya están organizados en formato jerárquico correcto: `{categoría} > {subcategoría} > {nota}`.
- El estándar SCA tiene 9 categorías raíz con ~100 notas finales. Ya están implementadas.
- El estándar Cocoa of Excellence tiene 8 categorías raíz con ~25 notas. Ya están implementadas.
- Los sabores del producto (`ruedas_sabores.notas_json`) almacenan referencias a estos nodos.
- No se necesita migración de datos ni cambios en el esquema.

**Alternativas consideradas**:
- **Almacenar estándares en la BD**: Mayor complejidad sin beneficio; los estándares son estáticos. Rechazado.
- **API externa de SCA**: No existe un servicio público con estos datos. Rechazado.

---

## Decisión 3: Estrategia de Filtrado (Backend vs Frontend)

**Decisión**: Mantener el enfoque híbrido actual: consulta SQL base filtrada por `tipo_producto`, con filtrado en memoria (JavaScript) para sabores, perfil mínimo y premios.

**Razonamiento**:
- El controlador `getMarketplaceProducts` ya implementa este patrón eficientemente.
- Con ≤500 productos activos (supuesto de la especificación), el filtrado en memoria es instantáneo (< 1ms).
- Evita la complejidad de queries JSONB dinámicos en SQLite (que no soporta JSONB queries nativas).
- La paginación en memoria ya está implementada (`limit`/`offset`).

**Alternativas consideradas**:
- **Filtros SQL completos con JSONB (PostgreSQL only)**: Rompería la compatibilidad con SQLite local. Rechazado.
- **Elasticsearch/Algolia**: Excesivo para <500 productos. Rechazado para v1.

---

## Decisión 4: Verificación de Trazabilidad Blockchain

**Decisión**: Utilizar la CTE `TracedProducts` existente en `getMarketplaceBaseProducts()` que cruza `batches` con `traceability_registry` para determinar el flag `has_traceability`.

**Razonamiento**:
- Ya implementado y funcionando. El campo `has_traceability` se mapea a `lotes[]` en el frontend.
- La presencia de un registro en `traceability_registry` con `blockchain_hash` confirma la verificación blockchain.
- Las insignias ya se renderizan condicionalmente en `renderProductCards()`.

**Alternativas consideradas**:
- **Consulta blockchain en tiempo real**: Latencia inaceptable para un listado. Rechazado.
- **Campo dedicado en `productos`**: Dato derivado, mejor calcularlo que duplicarlo. Rechazado.

---

## Decisión 5: Filtrado Bidireccional (Rueda ↔ Lista)

**Decisión**: Implementar sincronización de estado bidireccional a través del objeto `state` centralizado existente en `marketplace.js`.

**Razonamiento**:
- El patrón `state.selectedFlavors[]` ya existe y dispara `renderInteractiveWheel()` + `fetchProducts()` simultáneamente.
- Para la dirección inversa (lista → rueda), se necesita agregar lógica para resaltar las categorías presentes en los resultados filtrados activamente.
- El enfoque reactivo mediante estado centralizado es limpio y testeable.

**Nota de implementación**: Actualmente la bidireccionalidad solo funciona en una dirección (rueda → lista). Se debe agregar el flujo inverso.

---

## Decisión 6: Búsqueda por Palabras Clave (FR-006)

**Decisión**: Agregar un campo de búsqueda textual al frontend que filtre en memoria por `nombre`, `finca.nombre`, `empresa.nombre`, `variedad` y `proceso`.

**Razonamiento**:
- El dataset es lo suficientemente pequeño para filtrado client-side sin degradación.
- Consistente con el patrón de filtrado en memoria existente.
- No requiere cambios en el backend.

**Alternativas consideradas**:
- **Endpoint de búsqueda dedicado con SQL LIKE**: Innecesario para <500 registros. Reservado para escalado futuro.

---

## Decisión 7: Experiencia Móvil para la Rueda de Sabores

**Decisión**: Utilizar la naturaleza responsive del SVG con `viewBox` (ya implementado) y agregar gestos táctiles para selección de sectores.

**Razonamiento**:
- D3.js ya maneja eventos `click` que funcionan como `touchstart` en móvil.
- El `viewBox` SVG escala automáticamente al ancho del contenedor.
- Se necesitará optimizar el tamaño de fuentes y padding para pantallas < 375px.

**Mejoras pendientes**:
- Implementar `pinch-to-zoom` para ruedas densas (SCA con 100+ nodos).
- Considerar un modo de navegación por niveles (drill-down en lugar de mostrar todos los niveles simultáneamente).
