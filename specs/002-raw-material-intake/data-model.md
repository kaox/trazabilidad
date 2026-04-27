# Modelo de Datos: Centro de Acopio y Recepción

**Fecha**: 2026-04-24  
**Especificación**: [spec.md](./spec.md)

---

## Resumen

El módulo de acopio se apoya en la tabla `acquisitions` existente. La principal innovación arquitectónica es el manejo de datos flexibles en la columna `data_adicional` para evitar migraciones, y el cálculo del saldo disponible derivado de la relación con la tabla `batches`.

---

## 1. Tabla Principal: `acquisitions`

| Campo | Tipo | Descripción y Uso en Acopio |
|-------|------|-----------------------------|
| `id` | TEXT (PK) | Formato `ACP-XXXX` generado en backend |
| `user_id` | INTEGER (FK) | Dueño (Tenant) del registro |
| `nombre_producto` | TEXT | Macro-rubro (Ej: "Café", "Cacao") |
| `tipo_acopio` | TEXT | Condición (Ej: "Café Cereza", "Café Pergamino") |
| `subtipo` | TEXT | Subtipo opcional (Ej: "Lavado", "Honey") |
| `fecha_acopio` | DATE | Fecha de ingreso en báscula |
| `peso_kg` | DOUBLE | **Peso Neto** oficial en kg (Bruto - Tara) |
| `precio_unitario` | DOUBLE | Opcional |
| `finca_origen` | TEXT | Nombre de la finca |
| `imagenes_json` | TEXT | URL de evidencias de ticket (String JSON) |
| `data_adicional` | JSONB | **[Clave]** Almacena Tara, Peso Bruto y datos de calidad diferidos |
| `estado` | TEXT | `'disponible'` o `'agotado'` (derivado en backend) |
| `deleted_at` | TIMESTAMP | Soporte para eliminación lógica (Soft Delete) |

### Estructura de `data_adicional` (JSON)
```json
{
  "peso_bruto": 4550.5,
  "tara": 50.5,
  "humedad_porcentaje": 12.5,
  "rendimiento_fisico": 80,
  "defectos": 2
}
```

---

## 2. Relación de Consumo (Cálculo de Saldo)

El saldo disponible no se almacena en `acquisitions` para evitar condiciones de carrera. Se calcula dinámicamente uniendo con la tabla de procesamiento (`batches`).

**Tabla `batches` (relevante para saldos):**
- `acquisition_id`: Referencia foránea al ID del acopio.
- `input_quantity`: Cantidad de kg consumida del acopio en este lote específico.

**Lógica de Cálculo:**
```sql
-- Saldo = (Peso Neto del Acopio) - (Suma de los consumos en los lotes hijos)
saldo_disponible = acquisitions.peso_kg - COALESCE(SUM(batches.input_quantity), 0)
```

**Reglas de Negocio:**
1. Al intentar procesar un acopio, el backend debe validar que `input_quantity <= saldo_disponible`.
2. Si `saldo_disponible == 0`, el acopio cambia su estado visual a "Consumido" o "Agotado".
3. Un acopio que tenga al menos un registro en `batches` con `acquisition_id` apuntando a su ID, **NO puede ser eliminado físicamente** (Hard Delete), debe pasar por Soft Delete (`deleted_at`).

---

## 3. Entidad de Configuración: `acopio_config.json`

Este archivo estático funciona como esquema dinámico para el UI.

**Ruta**: `public/data/acopio_config.json`

**Estructura Jerárquica:**
1. Nivel 1: Macro-rubros (`nombre_producto`: Café, Cacao)
2. Nivel 2: Condiciones (`nombre_acopio`: Cereza, Pergamino, Baba)
3. Nivel 3: Subtipos (Opcional, `tipo_acopio` como array: Lavado, Honey)
4. Campos Dinámicos: Dentro de Nivel 2 o 3, un array `campos` dicta qué inputs renderizar que alimentarán `data_adicional`.
