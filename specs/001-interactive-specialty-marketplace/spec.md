# Especificación de la Función: Marketplace de Especialidad Interactivo

**Rama del Feature**: `001-interactive-specialty-marketplace`  
**Creado**: 2026-04-24  
**Estado**: Borrador  
**Entrada**: Descripción del usuario: "Marketplace de Cafés y Cacaos de Especialidad - Una plataforma pública de descubrimiento de productos (catálogo) donde compradores comerciales, tostadores y clientes pueden buscar lotes de café y cacao de especialidad utilizando filtros sensoriales avanzados basados en datos. Podrás buscar por Rueda de Sabores de la SCA para el Café y la Rueda de Sabores de Cocoa of Excellence para el Cacao."

## Escenarios de Usuario y Pruebas *(obligatorio)*

### Historia de Usuario 1 - Descubrimiento Sensorial mediante Ruedas Interactivas (Prioridad: P1)

Como comprador o tostador de especialidad, quiero explorar productos utilizando una rueda de sabores visual (SCA para Café, Cocoa of Excellence para Cacao) para poder encontrar de manera intuitiva lotes que coincidan con perfiles de sabor específicos.

**Por qué esta prioridad**: Este es el diferenciador central del marketplace. Sin la búsqueda visual interactiva, el sitio se mantiene como un comercio electrónico estándar.

**Prueba Independiente**: Se puede probar completamente interactuando con la rueda, seleccionando un segmento como "Afrutado" y verificando que la lista de productos se actualice con los lotes correspondientes.

**Escenarios de Aceptación**:

1. **Dado** la página principal del marketplace, **Cuando** hago clic en la rueda de sabores de "Café", **Entonces** debo ver los segmentos de la SCA (Afrutado, Floral, Dulce, etc.).
2. **Dado** un segmento seleccionado (ej. "Floral"), **Cuando** profundizo en una nota específica (ej. "Jazmín"), **Entonces** la cuadrícula de productos debe filtrarse para mostrar solo cafés con ese atributo sensorial.
3. **Dado** el selector de "Cacao", **Cuando** cambio a él, **Entonces** la rueda de sabores debe actualizarse al estándar de Cocoa of Excellence.

---

### Historia de Usuario 2 - Filtrado Avanzado Basado en Datos (Prioridad: P2)

Como comprador profesional, quiero filtrar productos por atributos técnicos como puntaje SCA, altitud, variedad y proceso de fermentación, además de las notas sensoriales, para encontrar coincidencias de alta precisión para mis necesidades de inventario.

**Por qué esta prioridad**: Los compradores técnicos confían en algo más que el sabor; necesitan datos específicos de origen y proceso para validar la calidad y el precio.

**Prueba Independiente**: Filtrar por proceso "Lavado" y "Puntaje > 86" y verificar que todos los resultados cumplan con ambos criterios.

**Escenarios de Aceptación**:

1. **Dado** la barra lateral de filtros, **Cuando** establezco un rango para el "Puntaje SCA" (ej. 85-90), **Entonces** solo deben aparecer productos dentro de ese rango.
2. **Dado** múltiples filtros activos (Proceso: Honey + Nota: Chocolate), **Cuando** se aplican, **Entonces** los resultados deben intersectar estrictamente estos requisitos.

---

### Historia de Usuario 3 - Verificación de Trazabilidad y Confianza (Prioridad: P1)

Como comprador consciente, quiero ver pruebas visibles de trazabilidad blockchain y premios directamente en cada tarjeta de producto para poder confiar en el origen y la calidad antes de hacer clic para obtener más detalles.

**Por qué esta prioridad**: La transparencia es un pilar fundamental del proyecto de Trazabilidad y genera credibilidad inmediata para los productos premium.

**Prueba Independiente**: Visualizar una tarjeta de producto y confirmar la presencia de una insignia de "Verificado en Blockchain" que enlace a un registro externo válido.

**Escenarios de Aceptación**:

1. **Dado** una tarjeta de producto en el marketplace, **Cuando** el lote ha sido registrado en blockchain, **Entonces** una insignia de "Trazabilidad Verificada" debe ser claramente visible.
2. **Dado** un producto con premios (ej. Cup of Excellence), **Cuando** se muestra, **Entonces** el emblema del premio debe ser prominente en la tarjeta.

---

## Requisitos *(obligatorio)*

### Requisitos Funcionales

- **FR-001**: El sistema DEBE proporcionar una Rueda de Sabores interactiva basada en SVG para Café según los estándares de la SCA.
- **FR-002**: El sistema DEBE proporcionar una Rueda de Sabores interactiva basada en SVG para Cacao según los estándares de Cocoa of Excellence.
- **FR-003**: El sistema DEBE permitir el filtrado bidireccional: al hacer clic en la rueda se actualiza la lista de productos, y al buscar/filtrar en la lista se actualizan los resaltados en la rueda.
- **FR-004**: Las tarjetas de producto DEBEN mostrar dinámicamente insignias de "Verificado en Blockchain" para los lotes con registros on-chain.
- **FR-005**: El sistema DEBE permitir a los usuarios alternar entre los modos "Café" y "Cacao", actualizando toda la interfaz (rueda, filtros y productos) en consecuencia.
- **FR-006**: Los productos DEBEN poder ser buscados por palabras clave (Origen, Finca, Productor).

### Entidades Clave

- **Producto/Lote**: Representa un lote específico de café o cacao. Atributos: puntaje estándar, variedad, proceso, altitud, productor.
- **Perfil Sensorial**: Una colección de notas de sabor y valores de intensidad asociados con un producto.
- **Estándar de Rueda de Sabores**: La estructura de datos jerárquica (SCA/CoE) utilizada para renderizar las ruedas y mapear las notas del producto.
- **Registro de Trazabilidad**: El punto de datos respaldado por blockchain que confirma el viaje del producto.

## Criterios de Éxito *(obligatorio)*

### Resultados Medibles

- **SC-001**: Los usuarios pueden navegar desde la página de inicio hasta una nota de sabor específica en la rueda en menos de 5 segundos.
- **SC-002**: El filtrado de productos basado en la selección de la rueda debe completarse en menos de 300ms (capacidad de respuesta de la interfaz).
- **SC-003**: El 100% de los productos con datos de hash de blockchain deben mostrar la insignia de verificación.
- **SC-004**: Los usuarios móviles pueden interactuar con la rueda de sabores utilizando gestos táctiles estándar sin que el diseño se rompa.

## Supuestos

- [Supuesto sobre los datos]: Los datos de productos existentes en la base de datos incluyen notas sensoriales mapeadas a las jerarquías de SCA/CoE.
- [Supuesto sobre blockchain]: El sistema tiene una integración o API existente para verificar si un ID de lote tiene una transacción de blockchain correspondiente.
- [Supuesto sobre escala]: La versión inicial manejará hasta 500 lotes activos sin requerir paginación compleja o motores de búsqueda especializados (como Elasticsearch).
- [Dependencia]: Los activos SVG de alta calidad o una librería de renderizado para las ruedas de sabores están disponibles o pueden ser generados.
