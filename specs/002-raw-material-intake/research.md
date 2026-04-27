# Investigación: Centro de Acopio y Recepción de Materia Prima

**Fecha**: 2026-04-24  
**Especificación**: [spec.md](./spec.md)

---

## Decisión 1: Almacenamiento de Peso Bruto y Tara sin Migraciones SQL

**Decisión**: Almacenar los valores de `peso_bruto` y `tara` dentro del campo `data_adicional` (tipo JSONB) de la tabla `acquisitions`.

**Razonamiento**:
- La constitución del proyecto y el historial favorecen arquitecturas resilientes y evitar migraciones complejas (alter table) cuando existe un mecanismo de datos flexibles.
- El campo `peso_kg` de la tabla se mantendrá como el peso neto oficial (Peso Bruto - Tara) para mantener la compatibilidad con reportes y consultas existentes.
- Los campos originales (bruto y tara) quedan guardados para auditoría en el JSON, cumpliendo con la especificación FR-012.

**Alternativas consideradas**:
- **Alterar la tabla `acquisitions`**: Agregar columnas `peso_bruto` y `tara`. Rechazado por ser innecesario existiendo el campo flexible `data_adicional` específicamente para este propósito.

---

## Decisión 2: Cálculo del Saldo Disponible (Consumo Parcial)

**Decisión**: Calcular el `saldo_disponible` de manera dinámica (on-the-fly) cruzando el `peso_kg` original del acopio con la suma de `input_quantity` de los lotes (`batches`) que lo referencian, en lugar de almacenar un campo estático que deba actualizarse.

**Razonamiento**:
- El esquema SQL ya tiene la columna `input_quantity` en la tabla `batches` y un índice sobre `acquisition_id`.
- Calcular la suma (`SUM(input_quantity) WHERE acquisition_id = ?`) es extremadamente rápido.
- Evita condiciones de carrera y desincronización de datos que ocurrirían si guardamos un valor estático `saldo_disponible` y múltiples operarios crean lotes simultáneamente.
- Cumple con FR-011 asegurando integridad referencial total.

**Alternativas consideradas**:
- **Agregar columna `saldo` en `acquisitions`**: Requiere triggers o transacciones complejas en la aplicación para mantenerlo sincronizado. Rechazado por mayor riesgo de inconsistencia.

---

## Decisión 3: Generador de Formularios Dinámicos y UI en Cascada

**Decisión**: Implementar la lógica de selección en cascada puramente en Vanilla JS (frontend) leyendo el archivo `acopio_config.json`, utilizando manipulación del DOM nativa.

**Razonamiento**:
- El proyecto actual no usa React/Vue, depende de Vanilla JS + Tailwind.
- El JSON tiene solo 3 niveles de profundidad (Macro → Acopio → Subtipo). Es manejable con tres selects secuenciales o grupos de botones renderizados dinámicamente.
- Cumple con FR-001 y FR-002 sin introducir nuevas dependencias al proyecto.

---

## Decisión 4: Controles de Calidad Diferidos

**Decisión**: Los campos de calidad (humedad, defectos, etc.) se inyectan dinámicamente desde `acopio_config.json`, pero no tendrán el atributo `required` en el HTML del formulario inicial. Se guardarán en `data_adicional`.

**Razonamiento**:
- Cumple con la resolución de que son opcionales al inicio (báscula).
- La misma vista/modal de edición servirá para que el laboratorio agregue estos valores posteriormente.
