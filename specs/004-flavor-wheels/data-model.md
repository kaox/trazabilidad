# Data Model: Flavor Wheels

## Entities

### SavedFlavorWheel (`ruedas_sabores`)
Representa una configuración específica de la rueda de sabores guardada por una empresa.

| Atributo | Tipo | Descripción |
|----------|------|-------------|
| `id` | `TEXT` | UUID único de la rueda (Primary Key). |
| `user_id` | `INTEGER` | Referencia al usuario/empresa propietaria. |
| `nombre_rueda` | `TEXT` | Nombre descriptivo (ej: "Lote Especial Mayo"). |
| `tipo` | `TEXT` | Categoría: `cafe`, `cacao` o `miel`. |
| `notas_json` | `JSONB` | Array de strings con los IDs/nombres de las notas seleccionadas. |
| `public_token` | `TEXT` | Token único para acceso público vía iframe. |
| `created_at` | `TIMESTAMP` | Fecha de creación. |
| `deleted_at` | `TIMESTAMP` | Borrado lógico. |

## Relationships
- `ruedas_sabores.user_id` -> `users.id` (Many-to-One).
- `productos.rueda_id` -> `ruedas_sabores.id` (Many-to-One, Opcional).
- `batches.rueda_id` -> `ruedas_sabores.id` (Many-to-One, Opcional).

## Validation Rules
- `nombre_rueda` no puede estar vacío.
- `tipo` debe ser uno de los tres valores permitidos.
- `notas_json` debe ser un array válido (puede estar vacío).
- `public_token` debe ser único y de alta entropía (UUID).
