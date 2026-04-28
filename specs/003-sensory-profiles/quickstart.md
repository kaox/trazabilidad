# Quickstart: Sensory Profiles Implementation

## 1. Database Migrations
Ejecutar scripts para añadir la tabla `perfiles` y las columnas en `batches` y `productos`.
```sql
CREATE TABLE perfiles ( ... );
ALTER TABLE batches ADD COLUMN perfil_sensorial_id TEXT;
ALTER TABLE productos ADD COLUMN perfil_sensorial_id TEXT;
```

## 2. Configuration Setup
Asegurarse de que `public/data/perfiles.json` contenga los atributos para cafe, cacao y miel.

## 3. Backend Implementation
- Crear `src/models/perfilModel.js`.
- Crear `src/controllers/perfilesController.js` para manejar CRUD.
- Crear `src/controllers/widgetController.js` para la API pública.

## 4. Frontend Implementation
- Panel Admin: Implementar sliders dinámicos en `views/perfiles.html` que lean el JSON.
- Radar Chart: Usar D3.js en `public/js/d3-utils.js` para dibujar el polígono.
- Widget: Crear una vista minimalista `views/widget-radar.html`.

## 5. Integration
Vincular la selección de perfil en el modal de finalización de lotes (`procesamiento-app.js`).
