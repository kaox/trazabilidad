# Contrato API: Adquisiciones (Acopios)

**Fecha**: 2026-04-24  
**Especificación**: [spec.md](../spec.md)

---

## 1. Crear Acopio (`POST /api/acquisitions`)

Este endpoint recibe el payload del formulario dinámico de la báscula.

### Request Body (JSON)
```json
{
  "nombre_producto": "Café",          // Requerido. Ej: Café, Cacao
  "tipo_acopio": "Café Cereza",       // Requerido. Condición principal
  "subtipo": null,                    // Opcional.
  "fecha_acopio": "2026-04-24",       // Requerido. YYYY-MM-DD
  "peso_kg": 4500,                    // Requerido. Peso Neto calculado (Bruto - Tara)
  "finca_origen": "Finca La Esperanza",// Opcional.
  "precio_unitario": null,            // Opcional.
  "imagenes_json": {                  // Opcional. Evidencia.
    "foto1": "data:image/jpeg;base64,..."
  },
  "data_adicional": {                 // Opcional pero crítico para Bruto/Tara
    "peso_bruto": 4550,
    "tara": 50
  }
}
```

### Response (201 Created)
```json
{
  "message": "Acopio registrado",
  "id": "ACP-ABCD"
}
```

---

## 2. Listar Acopios con Saldos (`GET /api/acquisitions`)

Retorna la lista de acopios del usuario. El backend DEBE calcular el saldo disponible y retornarlo para el UI.

### Response (200 OK)
```json
[
  {
    "id": "ACP-ABCD",
    "nombre_producto": "Café",
    "tipo_acopio": "Café Cereza",
    "fecha_acopio": "2026-04-24T00:00:00.000Z",
    "peso_kg": 4500,                  // Peso Neto Original
    "saldo_disponible": 2500,         // Calculado dinámicamente en backend
    "finca_origen": "Finca La Esperanza",
    "data_adicional": {
      "peso_bruto": 4550,
      "tara": 50
    },
    // ... otros campos
  }
]
```

---

## 3. Actualizar Acopio (`PUT /api/acquisitions/:id`)

Permite la edición diferida de datos de calidad (laboratorio) u otros campos.

### Request Body (JSON)
Esencialmente el mismo que `POST`, actualizando los campos necesarios dentro de `data_adicional` para la calidad.

```json
{
  // ... campos regulares
  "data_adicional": {
    "peso_bruto": 4550,
    "tara": 50,
    "humedad_porcentaje": 11.5,
    "defectos": 3
  }
}
```

### Response (200 OK)
```json
{
  "message": "Acopio actualizado correctamente"
}
```

---

## 4. Eliminar Acopio (`DELETE /api/acquisitions/:id`)

Elimina un acopio. Dependiendo del uso, realiza Hard Delete o Soft Delete.

### Response (204 No Content)
El acopio fue eliminado físicamente (Hard Delete) porque no estaba asociado a ningún lote.

### Response (200 OK - Soft Delete)
```json
{
  "message": "El acopio tiene procesos vinculados. Se ha archivado (eliminación lógica) para mantener la trazabilidad.",
  "type": "soft"
}
```
