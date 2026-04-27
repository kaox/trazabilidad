# Guía de Inicio Rápido: Marketplace de Especialidad Interactivo

**Fecha**: 2026-04-24

---

## Prerrequisitos

- Node.js 18+
- npm instalado
- Variables de entorno configuradas en `.env`

## Configuración del Entorno

```bash
# 1. Instalar dependencias
npm install

# 2. Inicializar la base de datos local (SQLite)
npm run db:init

# 3. Compilar estilos Tailwind
npm run build:css

# 4. Iniciar servidor de desarrollo
npm run dev
```

## Acceder al Marketplace

1. Navegar a `http://localhost:3000/marketplace`
2. La rueda de sabores se cargará automáticamente con los datos de `public/data/flavor-wheels.json`
3. Los productos se cargarán desde `/api/public/marketplace/products`

## Archivos Clave

| Archivo | Descripción |
|---------|-------------|
| `public/marketplace.html` | Vista HTML principal del marketplace |
| `public/js/marketplace.js` | Lógica de la rueda de sabores, filtros y cards |
| `public/js/chart-utils.js` | Utilidades para Chart.js (radares sensoriales) |
| `public/data/flavor-wheels.json` | Datos estáticos de las ruedas SCA/CoE/Miel |
| `public/data/premios.json` | Datos estáticos de premios y logos |
| `src/controllers/productosController.js` | Controlador del endpoint del marketplace |
| `src/models/productoModel.js` | Modelo de datos de productos (SQL) |
| `server.js` | Rutas Express (líneas ~470 y ~720) |

## Verificación Rápida

1. **Rueda de sabores funcional**: Hacer clic en un segmento de la rueda y verificar que la lista de productos se filtre.
2. **Toggle Café/Cacao**: Cambiar entre tipos y verificar que la rueda cambie de estándar.
3. **Perfil sensorial**: Mover los sliders y verificar que el radar preview se actualice.
4. **Trazabilidad**: Verificar que los productos con lotes trazados muestren el badge "Trazable".

## Tests

```bash
npm test
```

Los tests relevantes están en `__tests__/` y usan Jest con jsdom.
