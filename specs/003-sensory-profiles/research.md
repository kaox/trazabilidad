# Research: Sensory Profiles Dynamic Config

## Decisions

### 1. Dynamic Attribute Loading
- **Decision**: Cargar `public/data/perfiles.json` tanto en el backend como en el frontend.
- **Rationale**: El backend necesita validar que los datos enviados en `perfil_data` correspondan a los atributos permitidos para el tipo de producto. El frontend necesita el JSON para generar dinámicamente los sliders y las etiquetas de la gráfica de radar.
- **Implementation**: 
  - Backend: Usar `fs.readFileSync` o `require` para cargar el JSON al inicio del controlador.
  - Frontend: Usar `fetch('/data/perfiles.json')` durante la inicialización de la app.

### 2. Radar Chart Visualization (D3.js)
- **Decision**: Crear un componente reutilizable `renderRadarChart` en `public/js/d3-utils.js`.
- **Rationale**: Permite mantener una consistencia visual entre la previsualización del administrador y el widget externo. D3.js ofrece la flexibilidad necesaria para manejar un número variable de ejes (atributos).
- **Alternatives**: Chart.js (rechazado por la directiva de la Constitución de usar D3.js para visualizaciones avanzadas).

### 3. Widget Security (Public Tokens)
- **Decision**: Usar UUIDs v4 como `public_token` y un endpoint de solo lectura.
- **Rationale**: Evita la exposición de IDs secuenciales y permite invalidar tokens si es necesario. La validación de suscripción se hace consultando la tabla `users` (empresa) asociada al perfil.
- **Security**: El endpoint `/widget/radar/:token` solo devolverá los datos mínimos necesarios para renderizar la gráfica, sin información sensible del usuario.

## Findings

- D3.js v7 tiene soporte nativo para escalas circulares y polígonos, ideales para radar charts.
- La validación de JSONB en SQLite se puede hacer mediante `JSON_EXTRACT` o simplemente parseando el objeto en la capa del modelo de Node.js.
