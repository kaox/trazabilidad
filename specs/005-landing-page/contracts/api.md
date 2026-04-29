# API Contracts: Landing Page & Widgets

## 1. Landing Stats
**Endpoint**: `GET /api/landing/stats`
**Description**: Retorna estadísticas agregadas de la plataforma para mostrar en la landing.

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "total_batches": 1240,
    "total_companies": 85,
    "total_hectares": 4500,
    "countries_covered": 12
  }
}
```

## 2. Widget Sensory Data
**Endpoint**: `GET /api/widgets/sensory/:batchId`
**Description**: Retorna las notas sensoriales (rueda y radar) para un lote específico, optimizado para el widget.

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "product_name": "Finca Río Negro - Lote 402",
    "sensory_notes": [
      { "category": "Floral", "subnote": "Manzanilla" },
      { "category": "Frutal", "subnote": "Cítrico" }
    ],
    "radar_attributes": [
      { "axis": "Acidez", "value": 8.5 },
      { "axis": "Cuerpo", "value": 7.0 }
    ]
  }
}
```

## 3. Localization Proxy (Optional)
**Endpoint**: `GET /locales/:lang.json`
**Description**: Sirve los archivos de traducción. Generalmente servido como archivo estático por Express.
