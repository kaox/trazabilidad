# Data Model: Landing Page

## Entities

### LandingStats (Dynamic)
Representa los datos agregados que se muestran en el grid de módulos para generar confianza. No es una tabla física nueva, sino una vista o consulta sobre tablas existentes.

- **total_batches**: Count de la tabla `lotes`.
- **total_companies**: Count de la tabla `procesadoras` + `organizaciones`.
- **total_hectares**: Suma de hectáreas verificadas (asociadas a fincas).
- **countries_covered**: Count distinct de países en fincas/lotes.

### WidgetConfig (Contextual)
Representa la configuración necesaria para renderizar un widget en un sitio externo.

- **batch_id**: UUID del lote a visualizar.
- **widget_type**: 'sunburst' | 'radar'.
- **theme**: 'light' | 'dark' (para adaptar al sitio anfitrión).
- **width/height**: Dimensiones del iframe.

### ContentSchema (JSON)
Esquema para el archivo `es.json` / `en.json` que alimenta el Stepper.

```json
{
  "stepper": [
    {
      "id": 1,
      "title": "Finca",
      "description": "Geolocalización y datos del productor...",
      "icon": "farm-icon"
    },
    ...
  ],
  "hero": {
    "title": "Trazabilidad del Árbol a la Taza",
    "subtitle": "Digitaliza tu cadena de valor..."
  }
}
```

## Relationships
- **LandingStats** depende de las tablas `lotes`, `procesadoras` y `fincas`.
- **WidgetConfig** requiere un `batch_id` válido para consultar las notas sensoriales en `lotes.notas_json`.
