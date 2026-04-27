# Guía de Inicio Rápido: Módulo de Acopio

**Fecha**: 2026-04-24  
**Especificación**: [spec.md](./spec.md)

---

## 1. Configuración de Nuevos Tipos de Materia Prima

El formulario de la báscula es totalmente dinámico. Si la planta decide empezar a comprar un nuevo producto o requiere medir una variable nueva, **NO necesitas cambiar código**.

1. Abre el archivo `public/data/acopio_config.json`.
2. Busca la sección correspondiente ("Café" o "Cacao").
3. Agrega la nueva condición en el array `acopios`.

**Ejemplo: Agregar "Cacao Premium"**
```json
{
  "nombre_acopio": "Cacao Premium",
  "descripcion": "Cacao seco con selección manual",
  "campos": [
    { "id": "peso_bruto", "label": "Peso Bruto (Kg)", "type": "number", "required": true },
    { "id": "tara", "label": "Tara (Kg)", "type": "number", "required": true }
  ],
  "calidad_opcional": [
    { "id": "porcentaje_fermentacion", "label": "% Fermentación", "type": "number" }
  ]
}
```

## 2. Flujo Operativo en Planta

El diseño del sistema permite dividir el trabajo entre la persona que recibe el producto físico en la báscula y el analista de laboratorio:

**Rol 1: Operario de Báscula (Recepción Inmediata)**
- Selecciona el producto (Ej: Café Cereza).
- Ingresa Finca, Peso Bruto y Tara. El sistema calcula el Peso Neto solo.
- Guarda el acopio rápido. El camión puede retirarse.

**Rol 2: Analista de Laboratorio (Edición Diferida)**
- Toma la muestra del mismo acopio que acaba de entrar.
- Va a la lista de "Acopios Disponibles" en el sistema.
- Edita el acopio recién creado y completa los campos de calidad (humedad, defectos) sin alterar el peso original.

## 3. Entendiendo el "Saldo Disponible"

En este sistema, un ingreso de materia prima (Acopio) no desaparece mágicamente ni se "bloquea" por completo al iniciar un proceso.

- Cuando entra un camión con **4,500 Kg** de Cereza, el Acopio muestra un saldo de 4,500 Kg.
- Si envías ese acopio a un proceso (Lote) y usas **2,000 Kg**, el saldo del acopio baja a **2,500 Kg**.
- El Acopio se mantendrá en estado "Disponible" hasta que su saldo llegue exactamente a **0**.
- **Regla de oro:** No puedes procesar más kilos de los que quedan en el saldo del acopio original.

## 4. Transición Directa a Procesamiento

Para acelerar el trabajo del jefe de planta, no es necesario copiar y pegar IDs.
En la tarjeta del Acopio Disponible hay un botón azul **"Procesar"**. Al presionarlo, el sistema saltará a la pantalla de Lotes de Producción con la materia prima ya pre-seleccionada como el ingrediente de entrada.
