# 📌 Feature Card: Gestor de Ruedas de Sabor (Sensory Profiling)

## 📖 Resumen
**Nombre de la Función:** Configuración y Gestión de Ruedas de Sabor  
**Descripción:** Un módulo interno para empresas (productores, tostadores, catadores) que permite crear, customizar y guardar evaluaciones sensoriales complejas en un formato gráfico estandarizado mundialmente. Las "Ruedas de Sabor" creadas aquí pueden ser asignadas luego a lotes de procesamiento, productos finales y reportes de trazabilidad.  
**Público Objetivo:** Q-Graders, Jefes de Calidad, Catadores y Administradores de Fincas/Procesadoras.

---

## 🎯 Objetivos y Propuesta de Valor
- **Estandarización Sensorial:** Empoderar a los productores utilizando las bases de datos de taxonomía globales oficiales: la *Rueda de Sabores del Café de la SCA* y el *Mapa de Sabores del Cacao (Cocoa of Excellence)*.
- **Escalabilidad de Datos:** En lugar de reescribir manualmente qué sabores tiene un lote en cada etapa, el productor crea "Plantillas de Sabor" (Una Rueda Guardada) que simplemente asocia como metadato a sus productos.
- **Evaluación Visual Inmersiva:** Pasar de un aburrido formulario de "notas de cata" a una interfaz radial, lúdica e interactiva (Sunburst Chart) que reacciona a los clics para expandir la especificidad del sabor (De "Frutal" a "Cítrico" a "Limón").

---

## 📝 Historias de Usuario
- Como **Q-Grader / Catador**, quiero hacer clic en una representación gráfica de la rueda circular para ir profundizando en los sabores específicos que acabo de detectar en mi muestra de taza.
- Como **Administrador de Finca**, quiero guardar esta evaluación sensorial bajo el nombre "Perfil Geisha Lavado 2025" para reutilizarla rápidamente cada vez que saque un lote de esa variedad.
- Como **Tostador**, quiero poder editar una rueda de sabor previamente guardada por si la curva de tueste varió y necesito ajustar notas de caramelización.
- Como **Cliente Final (en el Marketplace)**, quiero ver plasmado exactamente este mismo gráfico resultante en la tarjeta del producto para entender las notas de sabor complejas.

---

## 💻 Elementos de UI / UX
- **Canvas Interactivo D3.js (Sunburst):** Una rueda particionada. El círculo interno representa categorías macro (ej. Frutal, Floral, Tostado). Al hacer clic, se selecciona la rama, y visualmente se ilumina.
- **Leyenda Dinámica (Tags):** A medida que se hacen clics en el canvas gráfico, un contenedor flotante va renderizando "Píldoras" o "Tags" con los nombres seleccionados, con un botón "X" para removerlos rápidamente en caso de error.
- **Formulario de Identificación:** Campos para determinar el `Nombre de la Rueda` y el `Tipo de Producto` (Café o Cacao), ya que la taxonomía base de cada uno cambia radicalmente el gráfico inyectado.
- **Lista de Registros CRUD:** Tabla de administración donde yacen todas las ruedas guardadas de la empresa, permitiendo editarlas o eliminarlas.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`ruedas-sabores-app.js`, `ruedas-sabores.html`)
- **Renderizado Gráfico (`ChartUtils / D3.js`):** El sistema lee de forma asíncrona un JSON taxonómico estático `/data/flavor-wheels.json`. Este JSON dicta la jerarquía de los anillos de la rueda.
- **Selecciones Anidadas:** El script contiene herencia lógica: si un usuario deselecciona el nodo "Dulce", todas las sub-selecciones que dependían de él (Miel, Vainilla) se deseleccionan simultáneamente en el modelo de datos para preservar la integridad visual.
- **Inyección Transversal:** Otros módulos (`procesamiento-app.js`, `trazabilidad-app.js`) cargan un `<select>` que llama a la variable de base de datos de las ruedas para emparejarlas visualmente de forma pasiva a lo largo de todo el pipeline de producción.

### 2. Backend (`server.js`, Métodos en `db.js`)
- **Endpoints Autenticados (CRUD):** 
  - `GET /api/ruedas-sabores`: Lista todas las ruedas creadas bajo el `empresa_id` en sesión.
  - `POST /api/ruedas-sabores`: Inserta un nuevo perfil en formato JSON `BJSON` asimilando el arreglo anidado de etiquetas seleccionadas en D3.
  - `PUT /api/ruedas-sabores/:id`: Sobreescribe la taxonomía seleccionada para una rueda guardada.
  - `DELETE /api/ruedas-sabores/:id`: Soft o hard delete del registro de perfil sensorial.
- **Integridad Referencial:** Cuando un producto se expone en el marketplace, el backend busca el `id` o el JSON de la nota que está amarrado al código del lote para dibujarlo en modo "Read-Only".

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `ruedas_sabores` (Contiene `id`, `empresa_id`, `nombre_rueda`, `tipo`, `notas_json` y timestamps).
- **Activos Estáticos (Static Assets):** 
  - `/data/flavor-wheels.json`: Estructura jerárquica obligatoria (Color, Nombre, Hijos). Si se altera este JSON para agregar el tipo "Vino", automáticamente la UI lo renderizará gracias al algoritmo de particiones.
- **Framework Vectorial:** `D3.js` (`d3.hierarchy`, `d3.partition`, `d3.arc`). Imprescindible para el cómputo de geometría a partir de los datos asimétricos de la taxonomía.
