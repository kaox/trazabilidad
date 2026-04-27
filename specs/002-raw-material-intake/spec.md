# Especificación de la Función: Centro de Acopio y Recepción de Materia Prima

**Rama del Feature**: `002-raw-material-intake`  
**Creado**: 2026-04-24  
**Estado**: Borrador  
**Entrada**: Descripción del usuario: "Módulo de Acopio (Raw Material Intake) — Gestor de entradas logísticas para registrar la adquisición de materia prima base que llega a la finca o planta procesadora. Permite catalogar volúmenes, costos, origen y clasificaciones formales antes de que la materia entre a un ciclo de procesamiento."

## Clarificaciones

### Session 2026-04-24
- Q: Consumo Parcial de Materia Prima → A: Consumo Parcial con Saldos (El sistema lleva el cálculo del saldo restante. El acopio sigue "disponible" hasta que su saldo llegue a cero).
- Q: Captura del Peso (Bruto vs Tara) → A: Bruto y Tara (Global) (El sistema asiste al usuario pidiendo "Peso Bruto" y "Tara", calculando el peso neto final automáticamente).
- Q: Controles de Calidad al Ingreso → A: Opcionales al inicio (El registro inicial puede crearse rápido, dejando la captura de humedad y defectos para edición posterior).

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Registro Rápido de Ingreso de Materia Prima (Prioridad: P1)

Como operario de báscula, quiero registrar un nuevo ingreso de materia prima (ej. 4,500 Kg de Cereza de Café variedad Bourbon) seleccionando el tipo de producto y su condición de acopio, para que el sistema genere un registro logístico que alimente la cadena de trazabilidad.

**Por qué esta prioridad**: Sin el registro inicial de materia prima, no existe "Punto Cero" para la trazabilidad. Es el requisito fundacional del módulo.

**Prueba Independiente**: Crear un acopio desde el formulario, verificar que aparezca en la lista de existencias con su ID único, tipo, peso y fecha.

**Escenarios de Aceptación**:

1. **Dado** la pantalla de acopio, **Cuando** selecciono "Café" como macro-rubro, **Entonces** debo ver las opciones de condición: "Café Cereza", "Café Pergamino" y "Café Verde".
2. **Dado** la selección de "Café Pergamino", **Cuando** el tipo tiene subtipos (Lavado, Honey, Natural), **Entonces** el sistema debe presentar una segunda selección antes de mostrar el formulario.
3. **Dado** el formulario completado con peso y fecha, **Cuando** presiono "Guardar", **Entonces** el sistema debe crear el registro con un ID único (formato ACP-XXXX), persistir los datos y mostrar confirmación.
4. **Dado** un ingreso sin precio asignado o sin datos de calidad (humedad, defectos), **Cuando** guardo el formulario, **Entonces** el sistema debe aceptar el registro (campos opcionales).

---

### Historia de Usuario 2 - Formulario Dinámico Guiado por Configuración (Prioridad: P1)

Como administrador del sistema, quiero que los campos del formulario de acopio se generen dinámicamente a partir de una configuración centralizada, para poder agregar nuevas condiciones de materia prima (ej. "Café Pergamino Seco") sin modificar código fuente.

**Por qué esta prioridad**: La parametrización dinámica elimina la dependencia de desarrollo para cada nueva variante de materia prima, dando autonomía operativa al usuario.

**Prueba Independiente**: Agregar una nueva entrada en la configuración, recargar la vista y verificar que el nuevo tipo aparece con sus campos específicos.

**Escenarios de Aceptación**:

1. **Dado** la configuración de acopio con un rubro "Cacao", **Cuando** se carga el formulario para "Baba de Cacao", **Entonces** debe mostrar los campos específicos definidos: "Peso Granos en Baba" y "Precio Total".
2. **Dado** la configuración de acopio para "Café Pergamino", **Cuando** se selecciona el subtipo "Lavado", **Entonces** debe asociar las etapas de acopio correctas (1, 2, 3, 4, 5) para la posterior integración con procesamiento.
3. **Dado** un campo definido como tipo "number" en la configuración, **Cuando** se renderiza el formulario, **Entonces** el input debe validar que solo se acepten valores numéricos.

---

### Historia de Usuario 3 - Vinculación con Origen Geográfico (Prioridad: P2)

Como jefe de planta, quiero vincular cada ingreso de materia prima con una finca de origen registrada en el sistema, para certificar la procedencia exacta del lote desde el Punto Cero de la trazabilidad.

**Por qué esta prioridad**: El origen geográfico es crítico para la trazabilidad, pero el registro puede funcionar sin esta vinculación (campo opcional que se completa después).

**Prueba Independiente**: Crear un acopio seleccionando una finca existente y verificar que la tarjeta del acopio muestre el nombre de la finca vinculada.

**Escenarios de Aceptación**:

1. **Dado** el formulario de acopio, **Cuando** selecciono el campo "Finca de Origen", **Entonces** debo ver un listado de fincas previamente registradas por mi empresa.
2. **Dado** un acopio con finca vinculada, **Cuando** el acopio se consume en un lote de procesamiento, **Entonces** la finca de origen debe propagarse como dato de trazabilidad del lote hijo.

---

### Historia de Usuario 4 - Gestión de Existencias y Transición a Procesamiento (Prioridad: P2)

Como jefe de planta, quiero visualizar mis acopios pendientes como tarjetas de existencias diferenciadas visualmente (color azul) y poder enviar un acopio directamente al módulo de procesamiento con un solo clic.

**Por qué esta prioridad**: La visibilidad del inventario de materia prima en cola y la transición fluida hacia el procesamiento eliminan fricción operativa diaria.

**Prueba Independiente**: Ver la lista de acopios, identificar uno pendiente por su estilo visual diferenciado, hacer clic en "Procesar" y verificar que la vista de procesamiento se abra con el acopio precargado.

**Escenarios de Aceptación**:

1. **Dado** la lista de existencias, **Cuando** existen acopios con estado "disponible", **Entonces** deben renderizarse con distintivo visual azul diferenciándolos de lotes procesados.
2. **Dado** un acopio disponible, **Cuando** hago clic en "Enviar a Procesamiento", **Entonces** el sistema debe redirigir al módulo de procesamiento con el ID del acopio precargado como referencia de materia prima.

---

### Historia de Usuario 5 - Evidencia Fotográfica del Ingreso (Prioridad: P3)

Como operario de báscula, quiero adjuntar fotografías del ticket de romaneo y del estado visual de la materia prima al momento de la recepción, como respaldo documental del peso y la calidad.

**Por qué esta prioridad**: La evidencia fotográfica refuerza la auditoría pero no es bloqueante para el flujo operativo principal.

**Prueba Independiente**: Crear un acopio con 2 imágenes adjuntas, guardar, y verificar que las imágenes se persistan y sean visibles al abrir el detalle del acopio.

**Escenarios de Aceptación**:

1. **Dado** el formulario de acopio, **Cuando** adjunto una fotografía del ticket de báscula, **Entonces** el sistema debe almacenar la imagen y asociarla al registro del acopio.
2. **Dado** un acopio con imágenes guardadas, **Cuando** edito el acopio y elimino una imagen, **Entonces** la imagen debe eliminarse también del almacenamiento.

---

### Casos de Borde

- ¿Qué sucede cuando se intenta eliminar un acopio que ya fue consumido parcialmente por un lote de procesamiento? → El sistema debe realizar una eliminación lógica (soft delete) y mostrar un mensaje informativo.
- ¿Qué sucede cuando el archivo de configuración de acopio tiene un formato inválido? → El sistema debe mostrar un estado de error graceful y no cargar ningún formulario hasta que se corrija.
- ¿Qué sucede si dos operarios registran acopios simultáneamente para la misma finca? → Cada acopio es independiente con su propio ID único; no hay conflicto.
- ¿Qué sucede si el peso registrado es 0 o negativo? → El formulario debe validar que el peso sea un número positivo mayor a cero antes de permitir guardar.
- ¿Qué sucede si el operario intenta enviar a procesamiento una cantidad mayor al saldo disponible del acopio? → El sistema debe bloquear la acción y mostrar un error indicando el saldo máximo permitido.

## Requisitos *(obligatorio)*

### Requisitos Funcionales

- **FR-001**: El sistema DEBE presentar una selección visual en cascada: primero macro-rubro (Café, Cacao), luego condición de acopio (Cereza, Pergamino, Verde, Baba, Grano Seco), y opcionalmente subtipo (Lavado, Honey, Natural).
- **FR-002**: Los campos del formulario de acopio DEBEN generarse dinámicamente a partir de una configuración estructurada, sin campos quemados en el código fuente.
- **FR-003**: Los campos de costos (precio unitario y moneda) DEBEN ser opcionales en el formulario; un acopio puede registrarse solo con peso y tipo.
- **FR-004**: El sistema DEBE generar un identificador único legible (formato ACP-XXXX) para cada registro de acopio.
- **FR-005**: El sistema DEBE permitir vincular opcionalmente cada acopio con una finca de origen registrada en el sistema.
- **FR-006**: El sistema DEBE permitir adjuntar evidencia fotográfica (imágenes del ticket de báscula o materia prima) al registro de acopio.
- **FR-007**: El sistema DEBE impedir la eliminación física de un acopio que ya fue referenciado por un lote de procesamiento, realizando en su lugar una eliminación lógica.
- **FR-008**: El sistema DEBE almacenar datos técnicos adicionales (humedad, rendimiento, defectos) en un campo flexible. Estos datos DEBEN ser opcionales al momento del registro inicial (báscula) para evitar bloqueos, permitiendo su completitud mediante edición diferida (laboratorio).
- **FR-009**: El sistema DEBE permitir la edición de un acopio existente, incluyendo la actualización de imágenes con limpieza de las eliminadas.
- **FR-010**: El sistema DEBE proporcionar un mecanismo de navegación directa desde un acopio existente al módulo de procesamiento, precargando la referencia del acopio.
- **FR-011**: El sistema DEBE mantener un registro del saldo disponible (peso restante) de cada acopio, permitiendo que un acopio se consuma parcialmente en múltiples lotes de procesamiento hasta que su saldo llegue a cero.
- **FR-012**: El sistema DEBE capturar el "Peso Bruto" y la "Tara" al momento de registrar el acopio, calculando y registrando automáticamente el peso neto para evitar errores manuales.

### Entidades Clave

- **Acopio (Acquisition)**: Registro individual de ingreso de materia prima. Atributos: ID único, nombre del producto, tipo de acopio, subtipo, fecha, peso bruto (kg), tara (kg), peso neto normalizado (kg), saldo disponible (kg), precio unitario (opcional), finca de origen, observaciones, evidencia fotográfica, datos adicionales flexibles.
- **Configuración de Acopio**: Estructura jerárquica que define los rubros, condiciones, subtipos y campos dinámicos del formulario. Dicta qué se pregunta al operario según el tipo de materia prima.
- **Finca de Origen**: Unidad productiva vinculada al acopio que provee el ancla geográfica para la trazabilidad.

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: Un operario puede completar el registro de un nuevo acopio (desde selección de tipo hasta confirmación) en menos de 60 segundos.
- **SC-002**: El 100% de los acopios registrados deben persistir con un ID único legible visible en la interfaz.
- **SC-003**: Los campos del formulario deben reflejar correctamente la configuración dinámica para cada combinación de rubro y condición de acopio.
- **SC-004**: El 100% de los intentos de eliminación de acopios vinculados a procesamiento deben resultar en eliminación lógica (no física), preservando la integridad de la trazabilidad.
- **SC-005**: La transición desde un acopio al módulo de procesamiento debe realizarse en un solo clic sin re-ingreso manual de datos.

## Supuestos

- [Supuesto sobre la configuración]: La configuración de acopio se gestiona mediante un archivo estático servido al frontend. Para v1, los cambios de configuración son realizados manualmente por usuarios con acceso técnico. Una interfaz de administración para modificar la configuración es una mejora futura fuera del alcance.
- [Supuesto sobre multi-tenancy]: Cada usuario solo puede ver y gestionar sus propios registros de acopio. El filtrado por `user_id` es suficiente para el aislamiento de datos.
- [Supuesto sobre unidades]: El sistema normaliza todas las cantidades a kilogramos (`peso_kg`) internamente, pero almacena la cantidad original (`original_quantity`) y la unidad seleccionada (`unit_id`) para fidelidad de auditoría.
- [Supuesto sobre almacenamiento de imágenes]: Las imágenes se almacenan en un servicio de almacenamiento cloud externo. El registro del acopio solo guarda las URLs resultantes.
- [Dependencia]: El módulo de procesamiento ya existe y acepta un `acquisition_id` como referencia de materia prima de entrada.
