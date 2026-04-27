# Modelo de Datos: Perfiles Sensoriales

**Fecha**: 2026-04-26  
**Especificación**: [spec.md](./spec.md)

---

## 1. Tabla Principal: `perfiles`

Representa el catálogo de plantillas de evaluación sensorial y las métricas generadas por el panel de cata.

| Campo | Tipo | Restricciones / Uso |
|-------|------|---------------------|
| `id` | UUID / TEXT | Primary Key |
| `empresa_id` | INTEGER | Foránea (Tenant/Dueño). Base para validar suscripción. |
| `nombre_perfil` | TEXT | Nombre comercial (Ej. "Lavado Especial 84+") |
| `tipo` | TEXT | Enum: `'cafe'`, `'cacao'` (define qué renderiza el frontend) |
| `perfil_data` | JSONB | Estructura flexible con métricas y vértices del radar. |
| `puntaje_sca` | DOUBLE | Puntaje global numérico consolidado (0 - 100). |
| `public_token` | TEXT | **[ÚNICO]** UUID V4 / Hash de solo lectura para el Widget. |
| `created_at` | TIMESTAMP| Fecha de creación. |
| `updated_at` | TIMESTAMP| Fecha de última actualización. |

### Estructura del JSONB (`perfil_data`)

Dependiendo del `tipo`, la aplicación cliente proveerá diferentes vértices y valores para renderizar en D3.js.

**Ejemplo para Café:**
```json
{
  "labels": ["Acidez", "Cuerpo", "Dulzor", "Balance", "Sabor", "Post-Gusto"],
  "datasets": [
    {
      "label": "Evaluación del Lote",
      "data": [8.5, 7.5, 8.0, 7.0, 8.2, 7.8]
    }
  ],
  "notas_adicionales": "Notas a frutos rojos y caramelo."
}
```

**Ejemplo para Cacao:**
```json
{
  "labels": ["Cacao", "Acidez", "Astringencia", "Amargor", "Frutal", "Floral"],
  "datasets": [
    {
      "label": "Evaluación del Lote",
      "data": [6.0, 4.5, 2.0, 3.0, 7.5, 5.0]
    }
  ]
}
```

---

## 2. Relación Externa: `batches` / `productos`

Para la User Story 3 (Vinculación de Calidad en Procesamiento y Marketplace), las entidades de inventario necesitan referenciar el perfil de cata.

**Impacto en `batches` y `productos`:**
Se agregará una columna foránea (opcional) `perfil_sensorial_id` (UUID referenciando a `perfiles.id`) en las tablas que consolidan un lote terminado y en el registro público del producto en Marketplace.

---

## 3. Estado de la Suscripción (Referencia de Widget)

Para determinar si el Widget se debe mostrar, el endpoint `/widget/radar/:token` realizará un JOIN ligero o una segunda consulta a la tabla principal de usuarios/suscripciones basándose en el `empresa_id` del perfil. 

Si `empresa.estado_suscripcion !== 'activa'`, el widget retorna el placeholder en lugar de los datos del JSONB.
