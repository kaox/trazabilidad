# Quickstart: Landing Page Development

## Setup
1. **Instalación de dependencias**: Asegurarse de tener `d3` disponible en el entorno (generalmente vía CDN para la landing).
2. **Archivos de Idioma**: Crear los archivos base en `public/locales/es.json`.
3. **Rutas**: Registrar `/` y `/api/landing/stats` en el servidor Express.

## Desarrollo Local
1. Ejecutar `npm run dev` para iniciar el servidor con SQLite.
2. Navegar a `http://localhost:3000/` para ver la landing.
3. Para probar los widgets, usar la URL `http://localhost:3000/widgets/sensory.html?batchId={ID}`.

## Pruebas de Performance
- Ejecutar `Lighthouse` desde Chrome DevTools.
- Validar que el FCP sea < 1.2s.
- Verificar que el peso de las imágenes en el Hero no exceda los 200KB (usar WebP).

## Integración de Widgets
Para embeber en un sitio externo:
```html
<iframe 
  src="https://rurulab.com/widgets/sensory.html?batchId=ABC&type=sunburst" 
  width="600" 
  height="600" 
  frameborder="0">
</iframe>
```
