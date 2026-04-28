# Data Model: Sensory Profiles

## Entities

### PerfilSensorial (`perfiles`)
Almacena la configuración de un perfil de taza o sensorial.

| Field | Type | Description |
|-------|------|-------------|
| `id` | TEXT (PK) | UUID del perfil |
| `empresa_id` | INTEGER | FK a `users.id` (dueño del perfil) |
| `nombre_perfil` | TEXT | Nombre descriptivo (ej: "Perfil Exportación Cacao") |
| `tipo` | TEXT | Tipo de producto (ej: "cafe", "cacao", "miel") |
| `perfil_data` | JSONB | Valores de los atributos (ej: `{"acidez": 8.5, "cuerpo": 7.0}`) |
| `puntaje_sca` | NUMERIC | Puntaje global calculado o manual |
| `public_token` | TEXT (UNIQUE) | Token para acceso público vía widget |
| `created_at` | TIMESTAMP | Fecha de creación |
| `updated_at` | TIMESTAMP | Fecha de última actualización |

### Batch / Producto Updates
Se añaden referencias a los perfiles.

- **`batches`**: Columna `perfil_sensorial_id` (FK a `perfiles.id`).
- **`productos`**: Columna `perfil_sensorial_id` (FK a `perfiles.id`).

## Relationships
- Un **Usuario/Empresa** puede tener muchos **Perfiles**.
- Un **Perfil** puede estar asociado a múltiples **Batches** (lotes) o **Productos**.
- La configuración de atributos (labels, ids) NO se guarda en DB, sino que se consulta en `perfiles.json` usando el campo `tipo`.
