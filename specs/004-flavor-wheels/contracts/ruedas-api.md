# API Contracts: Flavor Wheels

## Private API (Auth Required)

### `GET /api/ruedas`
Lista todas las ruedas guardadas por el usuario autenticado.
- **Success Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": [
      { "id": "uuid", "nombre_rueda": "...", "tipo": "cafe", "created_at": "..." }
    ]
  }
  ```

### `POST /api/ruedas`
Crea una nueva rueda de sabores.
- **Payload**:
  ```json
  {
    "nombre_rueda": "Nombre",
    "tipo": "cafe",
    "notas_json": ["Lemon", "Citrus", "Fruit"]
  }
  ```
- **Success Response**: `201 Created`

### `PUT /api/ruedas/:id`
Actualiza una rueda existente.

### `POST /api/ruedas/:id/regenerate-token`
Invalida el token anterior y genera uno nuevo.
- **Success Response**: `200 OK`
  ```json
  { "success": true, "public_token": "new-uuid" }
  ```

---

## Public API (No Auth)

### `GET /api/public/ruedas/:token`
Obtiene los datos de una rueda para ser renderizada en el widget.
- **Success Response**: `200 OK`
  ```json
  {
    "success": true,
    "data": {
      "nombre_rueda": "...",
      "tipo": "cafe",
      "notas_json": ["..."],
      "taxonomy": { ... } 
    }
  }
  ```

---

## Widget Serving

### `GET /widget/sunburst/:token`
Sirve el documento HTML completo que contiene el script de D3 y renderiza la rueda.
- **Query Params**:
  - `theme`: `light` | `dark` (opcional)
- **Response**: `text/html`
