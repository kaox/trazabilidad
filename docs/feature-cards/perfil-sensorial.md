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

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `perfiles` (`id`, `empresa_id`, `nombre_perfil`, `tipo`, `perfil_data` (Estructura JSON numérico variable), `puntaje_sca` y metadata `created_at`).
- **Framework Vectorial:** `Chart.js` (Radial scale, Radar Chart). Indispensable para graficar de forma legible las asimetrías de sabores dentro de polígonos rellenos.
- **Interdependencias Lógicas:** Estrechamente acoplado con el objeto `Flavor Wheel` y la tabla `productos`, para crear en el lado público una presentación simbiótica (La base numérica por un lado `perfiles` para el Radar, y el diagrama solar en cascada D3.js `ruedas` para las descripciones abstractas).
