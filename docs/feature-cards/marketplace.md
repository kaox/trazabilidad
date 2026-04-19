# 📌 Feature Card: Marketplace de Especialidad Interactivo

## 📖 Resumen
**Nombre de la Función:** Marketplace de Cafés y Cacaos de Especialidad  
**Descripción:** Una plataforma pública de descubrimiento de productos (catálogo) donde compradores comerciales, tostadores y clientes pueden buscar lotes de café y cacao de especialidad utilizando filtros sensoriales avanzados basados en datos. Podras buscar por Rueda de Sabores de la SCA para el Cafe y la Rueda de Sabores de Cocoa of Excellence para el Cacao.
**Público Objetivo:** Compradores mayoristas, tostadores de especialidad, y consumidores finales apasionados por la trazabilidad y la calidad de especialidad.

---

## 🎯 Objetivos y Propuesta de Valor
- **Descubrimiento Diferenciado:** Alejarse de los filtros típicos de comercio electrónico (como precio o categoría general) y permitir filtrar por **lo que realmente importa en productos de especialidad**: Perfiles Sensoriales, Notas de Sabor y Trazabilidad.
- **Interacción Visual:** Usar una Rueda de Sabores Interactiva de última generación (basada en los estándares de la SCA para el café y Cocoa of Excellence para el cacao) para atraer a los usuarios de manera intuitiva.
- **Transparencia Verificable:** Mostrar insignias de trazabilidad blockchain y premios directamente en las tarjetas de producto para generar confianza inmediata.

---

## 📝 Historias de Usuario
- Como **Tostador de Café**, quiero hacer clic en el segmento "Frutal > Baya" de la rueda de sabores para encontrar lotes que coincidan con ese perfil sensorial exacto.
- Como **Comprador Especializado**, quiero filtrar productos que tengan un puntaje mínimo de "Acidez" de 8.0 para garantizar una calidad específica.
- As a **Consumidor Final**, quiero ver un gráfico de radar del perfil en taza en la tarjeta del producto para visualizar fácilmente a qué sabe el lote.
- Como **Productor**, quiero que mi producto redirija a los compradores a mi WhatsApp para tener una negociación directa y libre de comisiones.

---

## 💻 Elementos de UI / UX
- **Rueda de Sabores Interactiva:** Un gráfico interactivo de partición radial creado con D3.js mapeado a los estándares de la SCA y Cocoa of Excellence. Al hacer clic o activar una "nota padre" (ej. Frutal), se encienden todas sus "notas hijas" asociadas (ej. Baya > Fresa).
- **Deslizadores Sensoriales (Sliders):** Controles que permiten a los usuarios establecer umbrales mínimos requeridos para atributos específicos (Sabor, Cuerpo, Acidez, Balance, etc.).
- **Tarjetas de Producto:**
  - **Insignias (Badges):** Tipo de producto (Café/Cacao), Puntaje SCA, e Insignia Verificable de Trazabilidad en Blockchain.
  - **Minigráficos de Radar:** Visualización compacta del perfil de la taza utilizando Chart.js.
  - **Certificaciones y Premios:** Escudos visuales de los logros obtenidos.
  - **Llamados a la Acción (CTA):** "Ver Detalles" (enlaza directamente a la página SEO individual del producto `/lote/:slug`) y "Comprar" (redirige a la negociación por WhatsApp).

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`marketplace.js`)
- **Gestión de Estado:** Maneja internamente qué tipo de producto se muestra `tipo` (café/cacao), qué sabores están seleccionados `selectedFlavors` (arreglo de strings), y los valores mínimos del perfil sensorial a buscar `perfilMin` (objeto clave-valor).
- **Librerías principales:**
  - `D3.js`: Dibuja y maneja la interactividad multinivel de la rueda de sabores radial.
  - `Chart.js`: Elabora los minigráficos dinámicos de radar.

### 2. Backend (`server.js`, `productosController.js`)
- **Endpoint Analítico:** `GET /api/public/marketplace/products`
- **Parámetros de Consulta (Query Params):**
  - `tipo`: 'cafe' | 'cacao'
  - `sabores[]`: Arreglo de nodos y notas de sabor de la taxonomía.
  - `perfil_min[attr]`: Número o puntaje mínimo para un atributo en específico (ej: `perfil_min[acidez]=8.0`).
- **Lógica de Base de Datos:** Realiza consultas complejas sobre la tabla `productos`, aplicando *JOINs* con `fincas` y `empresas`. Las sentencias procesan y discriminan el arbolado de JSON para descartar productos que no reúnan los sabores exigidos (`sabores`) o que posean un puntaje por debajo del nivel elegido (`perfil_data`).

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `productos`, `fincas`, `users` (asociado a empresas).
- **Activos Estáticos (Static Assets):** 
  - `/data/flavor-wheels.json`: Archivo de configuración central que mapea la taxonomía lógica necesaria de aromas y sabores para generar el gráfico D3.
  - `/data/premios.json`: Esquema y escudos de los lineamientos de las premiaciones.
- **Enrutamiento Web:** Integrado con SSR a la ruta orientada a SEO de `/lote/:slug` permitiendo compatibilidad plena y previsualizaciones enriquecidas en otras plataformas.
