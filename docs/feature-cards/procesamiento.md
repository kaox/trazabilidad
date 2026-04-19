# 📌 Feature Card: Centro de Procesamiento y Trazabilidad (Workstation)

## 📖 Resumen
**Nombre de la Función:** Módulo de Procesamiento (Workstation)  
**Descripción:** Es el motor central de la plataforma donde ocurre la magia de la transformación del producto. Este módulo gestiona el ciclo de vida completo de un lote (batch), desde que sale del acopio hasta que se convierte en un producto final. Permite registrar cada etapa (ej. Fermentación, Secado, Tostado) capturando variables críticas, pesos de salida y evidencias multimedia, todo organizado en una línea de tiempo inmutable.  
**Público Objetivo:** Jefes de Producción, Operarios de Planta, Controladores de Calidad y Gerentes de Operaciones.

---

## 🎯 Objetivos y Propuesta de Valor
- **Linaje e Integridad de Datos:** Garantiza que cada lote tenga un "padre" (Acopio o etapa anterior), creando una cadena de custodia irrompible. Nada se crea de la nada; todo peso procesado debe provenir de un ingreso verificado.
- **Estandarización Operativa (Recetas/Templates):** Utiliza "Plantillas de Proceso" dinámicas que dictan qué etapas y qué campos debe seguir el operario. Esto elimina la improvisación y garantiza que se capture la misma data en cada ciclo.
- **Gestión de Mermes y Rendimientos automáticamente:** Al capturar el peso de entrada y salida en cada transición, el sistema prepara la data para calcular la eficiencia y pérdida en cada punto de la cadena.
- **Preparación para Certificación:** Al "Finalizar" un proceso, el sistema bloquea los datos, convirtiéndolos en un registro histórico inmutable listo para auditorías de sostenibilidad o sellos de calidad.

---

## 📝 Historias de Usuario
- Como **Operario de Planta**, quiero ver mi lista de "Procesos en Curso" para saber qué lotes están actualmente en fermentación o secado y poder añadirles la siguiente etapa.
- Como **Jefe de Calidad**, quiero abrir la "Workstation" de un lote específico para ver la línea de tiempo completa, revisar las fotos del proceso y verificar que los grados Brix se mantuvieron en el rango deseado.
- Como **Dueño de Marca**, quiero asignar un "Perfil Sensorial" y una "Rueda de Sabor" a un lote finalizado directamente desde la Workstation para que esté listo para el Marketplace.
- Como **Exportador**, quiero generar el código QR y la URL de trazabilidad pública (GS1) de un lote finalizado para enviárselo a mi cliente en el extranjero como prueba de origen.

---

## 💻 Elementos de UI / UX
- **Vista de Pestañas Logísticas:** Separación clara entre "Acopios Disponibles" (materia prima lista para usar) y "Procesos en Curso" (inventario en transformación).
- **Workstation (Línea de Tiempo):** Una interfaz vertical elegante que muestra la progresión del lote. Cada nodo representa una etapa completada con sus datos específicos y fotos.
- **Botón de Acción Contextual ("Siguiente Etapa"):** El sistema detecta automáticamente cuál es el siguiente paso lógico según la plantilla y ofrece un botón prominente para "Iniciar Siguiente Etapa".
- **Gestor de Configuración de Lote:** Un acceso rápido para vincular el lote con un SKU de producto, un Perfil Sensorial Cup y una Rueda de Sabor, cerrando el círculo entre producción y ventas.
- **Generador de Identidad GS1/QR:** Herramienta integrada para visualizar y descargar el QR de trazabilidad que lleva a la vista pública del consumidor.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`procesamiento-app.js`, `procesamiento.html`)
- **Motor de Árbol de Lotes (`Batch Tree`):** El frontend consume una estructura jerárquica de la API (`/api/batches/tree`). Reconstruye recursivamente el linaje para mostrar el historial completo del grano.
- **Heurística de Detección de Peso:** El script analiza el JSON de `campos_json` para identificar inteligentemente cuál es el "peso de salida" principal, priorizando campos marcados con el atributo `type: output`.
- **Navegación por Hash:** Soporta enlaces profundos (deeplinks). Al entrar a la URL con un hash de ID (ej. `#ID-DEL-LOTE`), el sistema abre automáticamente la Workstation de ese lote.

### 2. Backend (`server.js`, `batchesController.js`, `db.js`)
- **Validación de Inventario:** El backend impide iniciar un proceso desde un acopio si el saldo disponible (`input_quantity`) es insuficiente, manteniendo la integridad del stock.
- **Inmutabilidad por Estado (`is_locked`):** Una vez que un lote se marca como finalizado, el backend bloquea cualquier intento de `PUT` o `DELETE` sobre ese registro y su linaje anterior, garantizando la confianza de la certificación.
- **Orquestación de Plantillas:** Sirve los esquemas de etapas (`templates` y `stages`) que el frontend usa para construir formularios dinámicos mediante el `formBuilder` común.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `lotes` (batches), `acopios`, `plantillas`, `etapas`, `productos`.
- **JSON dinámico:** `campos_json` (Define la estructura de captura de cada etapa).
- **Integraciones:** Librería `qrcode` para generación de imágenes en cliente y `Chart.js` para los previews de calidad dentro de la misma estación de trabajo.
- **Relaciones Clave:** Vinculación directa con el módulo de `Acopio` (Entrada) y el módulo de `Productos` (Venta / SKU).
