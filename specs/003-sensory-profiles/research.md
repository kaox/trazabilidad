# Investigación: Configuración de Perfiles Sensoriales y Puntuaciones

**Fecha**: 2026-04-26  
**Especificación**: [spec.md](./spec.md)

---

## Decisión 1: Implementación del Widget de Iframe Seguro

**Decisión**: El widget se expondrá como un endpoint GET público en Express (`/widget/radar/:token`) que servirá una vista HTML mínima (`widget-radar.html`). Esta vista contendrá un contenedor SVG para renderizar el radar con D3.js.

**Razonamiento**: 
- Evita problemas de CORS (`Access-Control-Allow-Origin`) al servir el HTML completo que los clientes pueden incrustar vía `<iframe src="...">`.
- El controlador asociado a esta ruta verificará el estado de la suscripción del emisor antes de renderizar la vista. Si la suscripción expiró, renderizará una vista alternativa (placeholder) sin datos.
- Cumple con SC-002, SC-003, y SC-004 garantizando aislamiento, responsividad y protección de UI en el e-commerce destino.

**Alternativas consideradas**: 
- Distribuir un snippet Javascript puro que inyecta elementos en el DOM del cliente. Rechazado por riesgo de conflictos CSS con el tema del e-commerce (Shopify/WooCommerce) y mayor riesgo de seguridad.

---

## Decisión 2: Diseño de Almacenamiento Dinámico (JSONB)

**Decisión**: Utilizar una sola tabla `perfiles` donde los atributos cuantitativos de la cata (acidez, cuerpo, etc.) se guardan dentro de un campo `perfil_data` de tipo `JSONB`.

**Razonamiento**: 
- Permite extender el catálogo a nuevos productos (ej. Té, Miel) o nuevas normativas de cata sin necesidad de migraciones SQL complejas.
- SQLite y PostgreSQL soportan funciones JSON nativas si fuese necesario indexar o buscar atributos específicos.
- Simplifica el contrato de la API.

**Alternativas consideradas**:
- Crear tablas relacionales separadas `perfil_atributos`. Rechazado por la latencia en múltiples JOINs innecesarios, afectando la métrica SC-002 (Carga < 500ms).

---

## Decisión 3: Generación de Identificador Público (Token de Solo Lectura)

**Decisión**: La base de datos incluirá una columna `public_token` en la tabla `perfiles`. Este será un UUID v4 o un hash alfanumérico generado al crear el perfil, y se indexará para búsquedas rápidas.

**Razonamiento**:
- Separa el ID interno autoincremental/UUID primario del acceso público.
- En caso de una vulneración (scraping), el usuario puede solicitar "revocar" y generar un nuevo token para el mismo perfil.
- Cumple estrictamente con FR-008.
