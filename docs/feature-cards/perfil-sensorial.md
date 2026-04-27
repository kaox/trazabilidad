# 📌 Feature Card: Gestor de Perfiles Sensoriales (Cup Profiling)

## 📖 Resumen
**Nombre de la Función:** Configuración de Perfiles Sensoriales y Puntuaciones  
**Descripción:** Un panel organizativo que actúa como un repositorio de plantillas paramétricas de cata. Las empresas pueden traducir sus sesiones de catación numérica (puntajes en acidez, cuerpo, dulzor, etc.) a "Perfiles Sensoriales" reutilizables. Esto estandariza la evaluación de los lotes e inyecta la popular gráfica de radar (tela de araña) en las vistas públicas para los compradores.  
**Público Objetivo:** Maestros Tostadores, Analistas de Calidad (Q-Graders, Graders de Cacao), Catadores y Productores que hacen análisis de laboratorio.

---

## 🎯 Objetivos y Propuesta de Valor
- **Visualización Estándar Global:** Traducir métricas técnicas especializadas (SCA o Cocoa of Excellence) en gráficos de radar interactivos que los consumidores finales pueden entender sin dificultad.
- **Eficiencia en el Ingreso de Datos:** Al igual que el módulo de "Ruedas de Sabor", almacenar las métricas de cata bajo una plantilla centralizada ahorra tiempo y minimiza errores de tipeo al momento de reportar decenas de lotes homólogos.
- **Clasificación Continua (Scoring Rating):** Permitir a la compañía respaldar los precios y la clase del lote mediante el registro digital del Puntaje Sensorial Consolidado (ej. 86.5 pts). Esto alimenta posteriormente el filtro de búsqueda algorítmica del Marketplace.

---

## 📝 Historias de Usuario
- Como **Analista de Calidad (CQI)**, deseo introducir manualmente los puntajes cuantitativos exactos (en forma decimal hasta 10.0) para Acidez, Cuerpo, Dulzor y Balance para archivar el perfil físico del panel de cata.
- Como **Catador de Cacao**, quiero elegir la plantilla "Cacao" que adapta instantáneamente el formulario excluyendo criterios de café e integrando "Astringencia, Amargor y Cacao" bajo los estándares debidos.
- Como **Auditor/Administrador**, quiero vincular el Perfil Sensorial "Lavado Premium 84+" dentro del módulo de Procesamiento para garantizar que ese lote ha cumplido formalmente los estándares de exportación.
- Como **Inversor / Comprador Web**, deseo pasar el mouse sobre la "Tabla de Perfil" o "Gráfico Radial" en el Marketplace para analizar detalladamente si la acidez supera un rating de 8.0 antes de comprar.

---

## 💻 Elementos de UI / UX
- **Selector Adaptativo (Café vs. Cacao):** Menú que altera los campos de entrada de forma dinámica para acomodar las escalas sensoriales específicas que requiere el mercado.
- **Sliders y Campos de Evaluación Cuantitativa (`Input:Number`):** Controles duales diseñados en componentes interactivos que limitan lógicamente las evaluaciones máximas posibles (del 0 al 10 en atributos y del 0 al 100 de forma global).
- **Preview Chart (Minigráfico de Radar):** A medida que el usuario ajusta los números del slider en el dashboard, una previsualización interactiva con `Chart.js` dibuja la línea de la telaraña en tiempo real demostrando el impacto visual de las cifras anotadas.
- **Data-Grid CRUD:** Tabla inferior que gestiona eficientemente todo el catálogo de perfiles acumulativo de la empresa, listos para edición en su caso.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`perfiles-app.js`, `perfiles.html`)
- **Renderizado Adaptable de Formularios:** Contiene plantillas semánticas inyectables; detecta el estado del `<select>` de tipo de producto para reciclar o sustituir el bloque de preguntas de cata (Dom Manipulation puro).
- **Gráficos en Cliente (`Chart.js`):** El módulo importa un adaptador (`chart-utils` común de la app) e invoca la instancia del gráfico tipo `radar`. Detecta eventos sintéticos de tipeado (o el `onchange` del slider) invocando `chart.update()` asíncronamente sin recarga del DOM.
- **Disponibilidad Global:** Los UUIDs emitidos por este módulo rellenarán pasivamente componentes `select` nativos creados tanto en `productos-app` (Gestor de Marketplace) como en `procesamiento-app` (Bitácora blockchain).

### 2. Backend (`server.js`, Métodos en `db.js`)
- **Endpoints Autenticados (CRUD Completo):** 
  - `GET /api/perfiles`: Solicita la lista consolidada de la base de datos limitándola al `empresa_id` estricto que autoriza el JWT.
  - `POST /api/perfiles`: Serializa el payload agrupando todos los valores numéricos sueltos (sabor, acidez, cuerpo, defectología, etc.) dentro de un único bloque de objeto comprimido `perfil_data` anclado a un `puntaje_sca` matriz.
  - `PUT /api/perfiles/:id`: Parsea los valores delta numéricos enviados, sobrescribiendo la plantilla madre elegida para corregir desviaciones.
  - `DELETE /api/perfiles/:id`: Elimina el registro físico del perfil, liberándolo de las constricciones de vista.
- **Filtrado Condicional JSON:** Para potenciar el nivel de los endpoints en búsquedas públicas (`marketplace`), el backend usa funciones JSON de SQLite/Postgres para aislar o consultar directamente elementos numéricos encajados dentro de este módulo sin desglose de múltiples tablas.

---

## 🔌 Integración Externa: Generador de Widget de Perfil Sensorial (iframe / Snippet)

**Descripción:** Una sub-sección dentro del Gestor de Perfiles Sensoriales que permite a los usuarios exportar su "Gráfica de Radar" para incrustarla directamente en los escaparates de sus propias tiendas online (Shopify, WooCommerce, Magento, etc.) o sitios web corporativos. El sistema genera un fragmento de código (iframe o HTML/JS) listo para copiar y pegar en pestañas de descripción de producto o Metafields.

**Objetivo Específico:** Conectar la gestión interna de calidad del laboratorio con el marketing B2C/B2B del cliente, permitiéndole mostrar evidencia visual del perfil de taza en su propio punto de venta sin necesidad de saber programar.

### Reglas de Negocio y Lógica de Suscripción
- **Validación de Generación:** El botón o sección para "Generar Código de Integración" solo estará visible y habilitado si la cuenta del usuario cuenta con una suscripción activa (o el tier/plan que incluya esta función).
- **Widget Inteligente (Verificación en Tiempo Real):** El código generado está vinculado dinámicamente a la plataforma. Cada vez que un comprador final carga la página del producto en la tienda externa (ej. Shopify), el iframe hace una petición ligera (API Call) a los servidores principales.

### Manejo de Estados de Renderizado
- **Suscripción Activa:** La API autoriza la petición y el iframe renderiza la gráfica de radar interactiva, inyectando el CSS y JS necesarios para mostrar los parámetros del lote.
- **Suscripción Inactiva/Expirada:** La API deniega la visualización. El iframe se colapsa de forma segura (altura cero) o muestra un mensaje de reserva elegante y sutil (ej. "Información sensorial temporalmente no disponible"), garantizando que el diseño (UI/UX) de la tienda del cliente no se rompa ni se vea poco profesional.

### Flujo del Usuario (Customer Journey)
1. El usuario (Tostador/Productor) aprueba y consolida el Perfil Sensorial de un lote en la plataforma.
2. Se dirige a la pestaña de "Compartir / Integración Web".
3. El sistema genera automáticamente el código (ej. `<iframe src="https://app.tuplataforma.com/widget/radar/TOKEN_DEL_LOTE" width="100%" height="400"></iframe>`).
4. El usuario copia el código y lo pega en el editor de texto de su CMS (ej. un Custom Liquid o Metafield en Shopify, o en la descripción corta de WooCommerce).
5. El consumidor final entra a la tienda online y visualiza el gráfico de tela de araña del producto.

### Consideraciones Técnicas Relevantes
- **Rendimiento y Carga Asíncrona:** El iframe debe ser extremadamente ligero y soportar lazy loading (`loading="lazy"`) para no penalizar el tiempo de carga (PageSpeed) ni el SEO de la tienda del cliente.
- **Responsividad Autónoma:** El gráfico generado en el iframe debe adaptarse automáticamente al contenedor padre (`100% width`), garantizando una visualización perfecta tanto en la versión móvil como en la versión de escritorio de la tienda externa.
- **Seguridad:** Uso de un token público de solo lectura (read-only) en la URL del iframe, el cual no exponga información sensible de la cuenta ni permita la alteración de los datos.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `perfiles` (`id`, `empresa_id`, `nombre_perfil`, `tipo`, `perfil_data` (Estructura JSON numérico variable), `puntaje_sca` y metadata `created_at`).
- **Framework Vectorial:** `Chart.js` (Radial scale, Radar Chart). Indispensable para graficar de forma legible las asimetrías de sabores dentro de polígonos rellenos.
- **Interdependencias Lógicas:** Estrechamente acoplado con el objeto `Flavor Wheel` y la tabla `productos`, para crear en el lado público una presentación simbiótica (La base numérica por un lado `perfiles` para el Radar, y el diagrama solar en cascada D3.js `ruedas` para las descripciones abstractas).
