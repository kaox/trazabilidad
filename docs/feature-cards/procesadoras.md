# 📌 Feature Card: Gestor de Organizaciones y Procesadoras

## 📖 Resumen
**Nombre de la Función:** Mis Procesadoras (Gestión de Infraestructura / Actores de la Cadena)  
**Descripción:** Es el módulo comercial central que registra las entidades corporativas u organizaciones involucradas en las facetas de poscosecha, producción y venta. A diferencia de las "Fincas" (que mapean terreno fértil), las "Procesadoras" documentan las instalaciones estructurales especializadas (Beneficios Húmedos/Secos, Tostadurías, Chocolaterías). Permite una gestión ramificada mediante la vinculación de múltiples sedes físicas o "Sucursales" asociadas.  
**Público Objetivo:** Cooperativas, Tostadores de Especialidad, Beneficios Secos, Centros de Acopio Centrales, Exportadoras y Marcas Comerciales D2C (Direct to Consumer).

---

## 🎯 Objetivos y Propuesta de Valor
- **Identidad Corporativa Blockchain:** Permite que no solo la finca tenga exposición. Si un núcleo de familias cosecha, pero "Tostaduría XYZ" es quien hace la alquimia del tueste, la Tostaduría tiene su propia identidad trazable y certificable dentro de la cadena global.
- **Multisede Logística (Sucursales):** Ayuda a corporaciones y grandes cooperativas a mapear su infraestructura. Permite asentar de qué sucursal / planta de recolección específica entró o salió un producto geográficamente.
- **Duality (Productor-Procesador):** Permite resolver el caso donde una misma empresa es dueña de las tierras y además procesa el grano. El sistema entiende su rol Dual (combinando Fincas y Procesadores en una Landing Page dinámica) bajo su ID Organizacional.

---

## 📝 Historias de Usuario
- Como **Tostador de Café Especial**, quiero registrar los detalles fiscales (RUC o NIF) y nombre comercial de mi tostaduría, además de subir el logo de la marca para que la etiqueta final de mis lotes procesados proyecte profesionalidad.
- Como **Presidente de una Cooperativa**, quiero registrar nuestra Procesadora en la app y luego agregar 3 "Sucursales" (Norte, Sur y Centro) donde acopiamos el café, para posteriormente saber exactamente el flujo geográfico del grano.
- Como **Consumidor / Usuario de Marketplace**, quiero hacer clic en el nombre de la empresa tostadora o chocolatera y que me lleve a una Landing Page oficial donde pueda conocer su equipo (Ej: Número de trabajadores involucrados), premios corporativos o certificaciones (ISO, HACCP).
- Como **Operario**, quiero seleccionar a la empresa como origen o destino legal mientras redacto y paso un Lote entre la etapa de `Limpieza` y `Descascarillado`.

---

## 💻 Elementos de UI / UX
- **Formulario Corporativo Delineado:** Recopila datos B2B esenciales: RUC, Razón Social, Nombre Comercial, Categoría de Establecimiento (Selects: *Beneficio Seco*, *Tostadora*, *Laboratorio*, etc) e indicadores sociales (Ej: `Número de Trabajadores`).
- **Modal de Sucursales Anidadas:** Dentro de la tarjeta de cada Procesadora general, se despliega un segundo nivel transaccional CRUD específicamente diseñado para registrar, listar o eliminar establecimientos fijos (Sucursales) con sus coordenadas cartográficas.
- **Mapas de Cobertura (Geo-Vectores):** Campo unificado de Coordenadas de la matriz principal o sus sucursales.
- **Gestión Visual Multimedia:** Soporte para links multimedia como videos inyectados vía YouTube (para tours inmersivos del establecimiento) y bibliotecas JSON de imágenes corporativas que configuran la "Fachada Digital".

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`procesadoras-app.js`, HTML Base)
- **Cascada Promesa / Listeners:** La interfaz se asienta sobre dos API calls principales; una obtiene el array de Matrices (`loadProcesadoras()`) y otra, al hace clic interactivo "Ver Sucursales" abre un panel lateral/modal intercediendo (`loadSucursales(id)`).
- **Controlador Adaptativo por Entidad:** En el módulo `Landing-Empresa`, el renderizador condicional JavaScript dictamina: si `IS_FINCA === false`, inyectará el string `"Planta de Procesamiento"` en lugar de `"Finca de Origen"`, y el logo pasará a visualizarse dinámicamente con estilos urbanos/corporativos.

### 2. Backend (`server.js`, `procesadorasController.js`, `db.js`)
- **Dual Table Schema (Relación 1 a Muchos):**
  - **CRUD Nivel 1 (`procesadoras`):** `GET`, `POST`, `PUT`, `DELETE` en la URI `/api/procesadoras`.
  - **CRUD Nivel 2 (`sucursales`):** Rutas encadenadas o anidadas (`/api/procesadoras/:id/sucursales`) asegurando consistencia e integridad referencial forzada bajo la llave Foránea de ID Matriz.
- **Data Hydration (Queries Transversales):** En las búsquedas del `BatchesController` (para llenar la trazabilidad), el sistema hace un JOIN con las procesadoras (`getProcesadorasByUserId`) asociando los perfiles de la compañía a los lotes despachados para mostrar sus metadatos orgánicamente.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** 
  - `procesadoras` (`id`, `user_id`, `ruc`, `razon_social`, `nombre_comercial`, `tipo` Enum, `direccion`, `certificaciones_json`, `premios_json`, `historia`, `numero_trabajadores`).
  - `sucursales` (`id`, `procesadora_id`, `nombre`, `direccion`, `coordenadas`)  *→ FK hacia procesadoras*.
- **Construcción de Meta-Red (El Ecosistema Público):** 
  En conjunto directo con `Fincas`, consolidan toda la inteligencia para conformar y alimentar a **Origen Único (Landing Page)**, proporcionando los pilares tanto de los productores agrícolas, como de los transformadores comerciales.
