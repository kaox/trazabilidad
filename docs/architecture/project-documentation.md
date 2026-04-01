# Documentación del Proyecto: Ruru Lab
## Ecosistema de Trazabilidad y Pasaporte Digital para Café y Cacao

Ruru Lab es una plataforma integral diseñada para digitalizar la historia del café y el cacao de especialidad. Conecta a productores, procesadores y consumidores finales a través de una experiencia de trazabilidad transparente, inmutable y visualmente atractiva.

---

## 1. Arquitectura del Sistema

La aplicación está construida sobre una arquitectura **Node.js/Express** con un enfoque de **Multi-tenancy basado en subdominios**, permitiendo que cada empresa cliente tenga su propio espacio personalizado.

### Componentes Core:
- **Backend**: Servidor Express con controladores modulares para Fincas, Lotes, Productos y Landings.
- **Base de Datos**: PostgreSQL (via Supabase) utilizando intensivamente **JSONB** para una estructura de datos flexible (permite añadir atributos botánicos o sensoriales sin cambiar el esquema).
- **Frontend**: SPA-like (Single Page Application) utilizando Vanilla JavaScript, Tailwind CSS y componentes inyectados dinámicamente.
- **Subdominios**: Detección dinámica de slugs para servir landigs personalizadas (ej. `empresa.rurulab.com`).

---

## 2. Sistema de Diseño (Design System)

El diseño de Ruru Lab busca evocar **calidad, tierra y modernidad**, utilizando una estética "Premium/Artesanal".

### Paleta de Colores:
- **Stone (Piedra)**: `#fdfaf6`, `#57534e` — Colores base que dan un toque orgánico y limpio.
- **Amber/Orange (Ámbar)**: `#854d0e`, `#d97706` — Representan el tostado, el sol y la riqueza del grano.
- **Emerald/Teal (Esmeralda)**: `#065f46`, `#0f766e` — Utilizados para certificaciones de sostenibilidad y éxito.
- **Gold (Dorado)**: `#fbbf24` — Reservado para resaltado de mapas satelitales y premios de alta gama.

### Tipografía:
- **Display**: `Playfair Display` — Serif elegante para títulos y nombres de fincas.
- **Cuerpo**: `Inter` / `Lato` — Sans-serif legible para datos técnicos y descripciones.

### Estilos Visuales:
- **Bordes**: Radios amplios (`2rem`, `3rem`) para una sensación suave y moderna.
- **Sombras**: `shadow-xl` con difuminado suave para dar profundidad a las tarjetas de producto.
- **Glassmorphism**: Uso de fondos blancos con opacidad y `backdrop-blur` en modales y overlays.

---

## 3. Módulos y Funcionalidades Clave

### A. Marketplace de Especialidad
- **Galería de Alta Fidelidad**: Visualización nítida del empaque y granos.
- **Filtros Avanzados**: Búsqueda por origen, variedad, proceso y puntaje de cata.
- **Ficha Detallada**: Página de producto completa con 5 pestañas de inmersión:
    1. **Origen**: Mapas satelitales (Google Maps), fotos de finca y video del productor.
    2. **Ruta de Proceso**: Seguimiento logístico desde la cosecha hasta la exportación.
    3. **Especificaciones**: Ficha técnica (msnm, variedad, tueste).
    4. **Análisis**: Rueda de sabores (D3.js) y Radar de atributos.
    5. **Maridaje**: Sugerencias de consumo con "Match Score".

### B. Gestión de Fincas (GIS & Satélite)
- **Delimitación de Polígonos**: Integración con Google Maps Drawing Manager para definir áreas de cultivo.
- **Cálculo Automático**: Estimación de área (Ha), altura (msnm) y centroide geográfico mediante APIs externas (Open-Meteo).
- **Galería Multimedia**: Gestión de imágenes JSON y links de video.

### C. Pasaporte Digital y Trazabilidad
- **Códigos QR**: Generación dinámica de QR para empaques que redirigen a la historia del producto.
- **Lotes e Inmutabilidad**: Registro cronológico de hitos (cosecha, despulpado, fermentación, secado, tostado).

### D. Analítica Sensorial
- **Flavor Wheel (Interactive Sunburst)**: Implementación en D3.js que permite visualizar las notas de sabor de forma jerárquica (Frutal -> Cítrico -> Limón).
- **Radar Charts**: Comparativa visual de Cuerpo, Acidez, Dulzor, Aroma y Postgusto.

---

## 4. Estrategia de Datos (Modelo flexible)

El uso de **JSONB** en las tablas principales permite que Ruru Lab sea agnóstico al cultivo:
- **`imagenes_json`**: Arreglo de URLs para galerías dinámicas.
- **`certificaciones_json`**: Listado de sellos (Orgánico, Rainforest, etc.).
- **`sabores_json`**: Datos jerárquicos de la rueda de sabores.
- **`coordenadas`**: Almacena polígonos GeoJSON compatibles con estándares GIS.

---

## 5. SEO y Rendimiento
- **Inyección de Metadatos**: El servidor reemplaza etiquetas `<meta>` dinámicamente para previas ricas en redes sociales (Open Graph).
- **JSON-LD**: Estructura de datos `Schema.org` automática para que Google indexe los productos como objetos reales en su buscador.
