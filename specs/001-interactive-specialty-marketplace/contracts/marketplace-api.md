# Contrato API: Marketplace de Productos

**Base URL**: `/api/public/marketplace`  
**Autenticación**: Ninguna (endpoint público)

---

## GET `/api/public/marketplace/products`

Retorna la lista de productos publicados del marketplace, filtrados opcionalmente por tipo, sabores, perfil sensorial y premios.

### Parámetros de Query

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `tipo` | `string` | No | Tipo de producto: `'cafe'`, `'cacao'`, `'miel'`, `'todos'`. Por defecto: todos |
| `sabores[]` | `string[]` | No | Array de nombres de notas de sabor para filtrar (ej. `sabores[]=Jazmín&sabores[]=Cereza`) |
| `categorias` | `string[]` | No | Array de categorías raíz de la rueda (ej. `categorias=Floral&categorias=Frutal`) |
| `perfil_min[attr]` | `number` | No | Valor mínimo para un atributo del perfil sensorial (ej. `perfil_min[acidez]=7`) |
| `premios` | `string[]` | No | Filtrar por nombre de premio (ej. `premios=Cup of Excellence`) |
| `q` | `string` | No | **NUEVO** - Búsqueda textual por nombre, finca, productor, variedad |
| `limit` | `number` | No | Productos por página. Por defecto: `20` |
| `offset` | `number` | No | Desplazamiento para paginación. Por defecto: `0` |

### Respuesta Exitosa (`200 OK`)

```json
{
  "total": 42,
  "products": [
    {
      "id": "uuid-xxxx",
      "nombre": "Café Geisha Lavado",
      "descripcion": "Lote premium de café Geisha...",
      "tipo": "cafe",
      "presentacion": "250",
      "variedad": "Geisha",
      "proceso": "Lavado",
      "nivel_tueste": "Medio",
      "puntaje_sca": 88.5,
      "grupo_genetico": null,
      "porcentaje_cacao": null,
      "imagen": "https://blob.vercel.com/...",
      "imagenes_json": ["https://blob.vercel.com/..."],
      "sabores": [
        { "category": "Floral", "subnote": "Jazmín" },
        { "category": "Frutal", "subnote": "Cereza" }
      ],
      "perfil": {
        "fraganciaAroma": 8.0,
        "sabor": 8.5,
        "acidez": 8.0,
        "cuerpo": 7.5,
        "balance": 8.0
      },
      "premios": [
        { "nombre": "Cup of Excellence 2025", "anio": "2025" }
      ],
      "precio": 45.00,
      "moneda": "S/",
      "unidad": "G",
      "lotes": [{ "registry_id": 1 }],
      "finca": {
        "nombre": "Finca La Esperanza",
        "pais": "Perú",
        "departamento": "Cajamarca",
        "provincia": "Jaén",
        "distrito": "San Ignacio",
        "altura": 1850,
        "historia": "Finca familiar de tercera generación...",
        "productor": "Juan Pérez",
        "coordenadas": { "lat": -5.145, "lng": -79.003 }
      },
      "empresa": {
        "id": 1,
        "nombre": "Café Andino SAC",
        "tipo": "procesadora",
        "slug": null,
        "logo": "https://blob.vercel.com/...",
        "whatsapp": "+51999999999"
      }
    }
  ]
}
```

### Respuesta de Error (`500`)

```json
{
  "error": "Mensaje de error descriptivo"
}
```

---

## Contrato Estático: Ruedas de Sabores

**Ubicación**: `GET /data/flavor-wheels.json`

### Estructura

```json
{
  "cafe": {
    "Floral": {
      "icon": "fa-solid fa-fan",
      "color": "#ec4899",
      "children": [
        {
          "name": "Té Negro",
          "icon": "fa-solid fa-leaf"
        },
        {
          "name": "Floral",
          "icon": "fa-solid fa-flower",
          "children": [
            { "name": "Manzanilla" },
            { "name": "Rosa" },
            { "name": "Jazmín" }
          ]
        }
      ]
    }
  },
  "cacao": { ... },
  "miel": { ... }
}
```

---

## Contrato Estático: Premios

**Ubicación**: `GET /data/premios.json`

### Estructura

```json
{
  "cafe": [
    { "nombre": "Cup of Excellence", "logo_url": "https://..." },
    { "nombre": "SCA Award", "logo_url": "https://..." }
  ],
  "cacao": [
    { "nombre": "Cocoa of Excellence", "logo_url": "https://..." }
  ]
}
```
