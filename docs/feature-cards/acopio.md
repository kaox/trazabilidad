# 📌 Feature Card: Centro de Acopio y Recepción de Materia Prima

## 📖 Resumen
**Nombre de la Función:** Modulo de Acopio (Raw Material Intake)  
**Descripción:** Es el punto de partida real del ciclo de trazabilidad agrícola dentro del sistema. Se trata de un gestor de entradas logísticas diseñado para registrar la adquisición de la "materia prima base" que llega a la finca o planta procesadora (ej. Cereza de Café recién cosechada, o Cacao en baba). Permite catalogar volúmenes, costos, origen y clasificaciones formales antes de que dicha materia entre a un ciclo de procesamiento o transformación.  
**Público Objetivo:** Jefes de Planta, Operarios de Báscula, Responsables de Compras Agrícolas y Productores en finca que dirigen cosechas.

---

## 🎯 Objetivos y Propuesta de Valor
- **Origen Garantizado (Punto Cero):** Permite fijar el ancla geográfica inicial de la trazabilidad. Desde esta pantalla, se certifica de dónde viene exactamente (lote o parcela específica) la materia prima.
- **Parametrización por Receta:** Simplificar la burocracia en el ingreso diario utilizando `/data/acopio_config.json`, una matriz dinámica que le dice a la interfaz gráfica qué campos preguntar dependiendo del rubro (No se piden los mismos datos de recolección para el Cacao que para el Café).
- **Conciliación Financiera Base:** Al permitir la captura de costos transaccionales ("Costo Unitario" y "Moneda"), sirve como el punto alimentador más importante para permitir al posterior *Módulo de Costos* inferir las mermas productivas.

---

## 📝 Historias de Usuario
- Como **Operario de Báscula**, necesito presionar "Nuevo Ingreso" para registrar que el proveedor "Finca el Gato Pez" acaba de descargar 4,500 Kg de Cereza de Café variedad Bourbon a un precio pactado.
- Como **Administrador de RuruLab**, necesito cambiar el archivo `acopio_config.json` para añadir una variante especial llamada "Café Pergamino Seco" (comprado ya secado) para que la fábrica asuma automáticamente una receta de merma diferente.
- Como **Jefe de Planta**, quiero visualizar rápidamente cuántos *batches* de "Acopio" tengo inactivos (en cola) y arrastrarlos directamente al "Módulo de Procesamiento" dando click a un botón.
- Como **Cliente (en la tarjeta de producto)**, en la vista del Marketplace necesito ver reflejado pasivamente este punto de entrada al mirar la fecha oficial en la que se cosechó/compró originalmente el grano desde la tabla de trazabilidad inmutable.

---

## 💻 Elementos de UI / UX
- **Modal de Selección Dinámica:** Un sistema en cascada. El usuario primero elige el macro-rubro ("Café") y el UI renderiza botones grandes interactivos para elegir su condición de acopio (Ej: Cereza Madura, o Pergamino Miel). Si el macro tiene sub-rubros, los expande progresivamente sin abrumar visualmente al usuario.
- **Formulario Generado al Vuelo (Data-Driven):** Los campos del formulario (Humedad, Rendimiento, Grados Brix, Defectos, Costos) no están quemados en el código. Se autogeneran basándose en los perfiles `etapas_acopio` que dicta JSON.
- **Carga Multi-Media Evidence:** Inputs para subir fotografías directas de los tickets de romaneaje (básculas) o del estado de la materia prima en su llegada como garantía de peso.
- **Tarjetas de Existencias Primitivas:** Los registros de acopio finalizados se renderizan con distintivos azules para diferenciarlos de los lotes procesados finalizados o en curso.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`acopio-app.js`, `acopio.html`)
- **Gestión de Plantillas (Config Loading):** Consume asincrónicamente `acopio_config.json`. Dependiendo de la elección del `radio-button`, cruza los campos requeridos y construye el modal nativo apoyado por la utilidad central del sistema `formBuilder`.
- **Integración con Existencias:** Usa un hook para inyectar un acceso rápido `app/procesamiento#acopio={ID}` que redirige al operario con el acopio ya puesto en su carrito ("buffer") listo para volcar a un tanque o zaranda.
- **Tipado Dinámico:** La data adicional se empaqueta en `data_adicional` de forma transparente.

### 2. Backend (`server.js`, Métodos `db.js`)
- **Endpoints Básicos de Logística:** 
  - `GET /api/acopios`: Obtiene la cola de ingresos filtrados por inquilino.
  - `POST /api/acopios`: Realiza el "COMMIT" logístico, registrando el inventario físico total (`original_quantity`, `unit_id`, `original_price`).
  - `PUT /api/acopios/:id`: Modificaciones temporales de corrección de error de peso.
  - `DELETE /api/acopios/:id`: Maneja borrado del inventario, con chequeos de cascada impidiendo borrar un acopio si ya parte o toda la materia fue gastada en un registro hijo del `Procesamiento`.
- **Motor Financiero:** Si el acopio trae precios asignados, el backend automáticamente actualiza contabilidades relativas prestando sus identificaciones de registro al módulo de costo general.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `acopios` (`id`, `empresa_id`, `lote_name`, `finca_origen`, `tipo_acopio`, `fecha_acopio`, variables de cantidades y moneda). Posteriormente vinculado a `lotes` a manera de materia transitoria consumida (`parent_acopio_id`).
- **Activos Estáticos Core:** 
  - `/data/acopio_config.json`: Fundamental para la flexibilidad logística del cliente, dictando qué se le pide preguntar al operario sin tener que recompilar el código fuente.
- **Sinergias:** Este módulo tiene una estricta integración unidireccional con el módulo de `Procesamientos`. Un lote procesado siempre parte exigiendo un "Acopio" referencial como raíz de masa.
