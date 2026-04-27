# Contrato API: Perfiles Sensoriales y Widget

**Fecha**: 2026-04-26  
**Especificación**: [spec.md](../spec.md)

---

## 1. API Privada (Autenticada con JWT)

Esta API sirve al Frontend de la aplicación (SPA) para que el Analista o Productor gestione sus catálogos.

### Crear Perfil (`POST /api/perfiles`)

**Request Body (JSON):**
```json
{
  "nombre_perfil": "Cacao Fino Aroma 2026",
  "tipo": "cacao",
  "puntaje_sca": 82.5,
  "perfil_data": {
    "labels": ["Cacao", "Acidez", "Astringencia", "Amargor", "Frutal"],
    "datasets": [{"label": "Lote", "data": [7.0, 4.0, 1.0, 2.5, 8.0]}]
  }
}
```

**Response (201 Created):**
```json
{
  "message": "Perfil creado exitosamente",
  "id": "prf_123456",
  "public_token": "tok_abc123def456"
}
```

### Actualizar Perfil (`PUT /api/perfiles/:id`)

**Request Body (JSON):** (Misma estructura que POST, actualizando los nodos necesarios).
**Response (200 OK).**

### Eliminar Perfil (`DELETE /api/perfiles/:id`)

**Response (200 OK):** Marca el perfil o lo elimina físicamente.

---

## 2. API Pública de Widget (Solo Lectura)

Esta API expone el renderizado y los datos al iframe externo embebido en tiendas como Shopify.

### Renderizar Widget HTML (`GET /widget/radar/:public_token`)

Este endpoint NO retorna JSON. Retorna un documento HTML completo listo para incrustarse en el `iframe`.

**Comportamientos Esperados:**

1. **Token Inválido o Eliminado (404 Not Found)**
   Retorna HTML con un placeholder estilizado indicando que el lote no se encuentra.
   
2. **Suscripción Expirada/Inactiva (402 Payment Required / 403 Forbidden)**
   Retorna HTML con un mensaje sutil ("Información sensorial temporalmente no disponible") sin romper estilos del e-commerce.

3. **Éxito (200 OK)**
   Retorna HTML incluyendo:
   - `<script>` de D3.js desde CDN.
   - Contenedor SVG `<svg id="radarChart"></svg>`.
   - Script inyectado nativamente que inicializa D3.js utilizando el JSON `perfil_data` anclado al token provisto.

---

## 3. Snippet de Integración (Generado por el Frontend)

Código estático que el Productor copiará y pegará en su CMS.

```html
<div style="width:100%; max-width:600px; margin: 0 auto;">
  <iframe 
    src="https://trazabilidad-url.com/widget/radar/tok_abc123def456" 
    width="100%" 
    height="450" 
    frameborder="0" 
    scrolling="no" 
    loading="lazy">
  </iframe>
</div>
```
