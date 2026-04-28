# API Contracts: Sensory Profiles

## Admin API (Private)
Requiere autenticación (JWT).

### `GET /api/perfiles`
Lista todos los perfiles de la empresa.
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "uuid",
      "nombre_perfil": "Cafe Especial",
      "tipo": "cafe",
      "puntaje_sca": 86.5,
      "public_token": "token-123"
    }
  ]
  ```

### `POST /api/perfiles`
Crea un nuevo perfil.
- **Body**:
  ```json
  {
    "nombre_perfil": "Nuevo Perfil",
    "tipo": "cafe",
    "perfil_data": { "acidez": 8, "cuerpo": 7, ... },
    "puntaje_sca": 85
  }
  ```

### `PUT /api/perfiles/:id`
Actualiza un perfil existente.

### `DELETE /api/perfiles/:id`
Elimina un perfil.

---

## Public Widget API (No Auth)

### `GET /api/public/radar/:public_token`
Obtiene los datos del perfil para el widget.
- **Security Check**: Valida que la empresa asociada al token tenga suscripción activa.
- **Response**: `200 OK`
  ```json
  {
    "nombre": "Cafe Especial",
    "tipo": "cafe",
    "data": { "acidez": 8, "cuerpo": 7, ... },
    "config": [ { "id": "acidez", "label": "Acidez" }, ... ]
  }
  ```
- **Response (Inactive)**: `403 Forbidden` o `200 OK` con un flag de `inactive`.
