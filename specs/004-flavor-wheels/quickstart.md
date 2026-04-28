# Quickstart: Flavor Wheels

## Setup
1. Asegurarse de que `public/data/flavor-wheels.json` esté presente.
2. Ejecutar las migraciones de base de datos para crear la tabla `ruedas_sabores`.
3. Iniciar el servidor: `npm run dev`.

## Local Development
- Abrir `/app/ruedas` para acceder al gestor.
- Seleccionar el tipo de producto (Café, Cacao, Miel).
- Interactuar con el Sunburst para seleccionar notas.
- Guardar y copiar el código iframe de previsualización.

## Widget Testing
- Copiar el `public_token` de una rueda guardada.
- Navegar a `http://localhost:3000/widget/sunburst/[TOKEN]`.
- Verificar que solo se muestran las notas seleccionadas (estilo Tastify).
