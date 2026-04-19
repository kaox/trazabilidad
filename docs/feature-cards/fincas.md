# 📌 Feature Card: Gestor de Fincas y Orígenes

## 📖 Resumen
**Nombre de la Función:** Mis Fincas (Gestión de Origen y Terroir)  
**Descripción:** Es el módulo fundacional del perfil de un productor dentro de la plataforma. Permite registrar y administrar las propiedades agrícolas (fincas o parcelas) documentando sus variables ambientales (altitud, ubicación), reconocimientos, certificaciones y polígonos geoespaciales. La información aquí depositada alimenta automáticamente tanto la trazabilidad como las páginas de aterrizaje públicas (Origen Único).  
**Público Objetivo:** Productores, Administradores de Fincas, Cooperativas (para registrar fincas de sus socios) y Acopiadores.

---

## 🎯 Objetivos y Propuesta de Valor
- **Trazabilidad Auténtica:** Sin una finca registrada, un lote de grano no tiene origen real. Este módulo garantiza que todo café o cacao que entra al sistema esté anclado a un predio verídico y verificable.
- **Cero Esfuerzo de Marketing:** Al llenar los datos técnicos de la finca (historia, fotos, altitud), el sistema auto-construye una página web completa (Landing Page de Origen Único) sin que el agricultor sepa nada de programación o diseño web.
- **Micro-Segmentación:** Permite diferenciar sub-lotes dentro de una misma propiedad. Un productor puede tener "Finca El Paraíso - Parcela Alta" y "Finca El Paraíso - Valle", separando la data de terroir (ej. diferentes altitudes que afectan drásticamente la calidad de taza).

---

## 📝 Historias de Usuario
- Como **Productor Cafetalero**, quiero registrar mi "Finca Alto Vuelo", especificando que estamos a 1,800 msnm en Cajamarca y subir 3 fotos del paisaje para que mis compradores conozcan de dónde viene el grano.
- Como **Administrador de Cooperativa**, quiero registrar masivamente las ubicaciones GPS (Lat/Lng) de los 50 socios de la cooperativa, para posteriormente generar mapas de impacto de nuestra zona de recolección.
- Como **Comprador Internacional**, al escanear un código QR de RuruLab, quiero ver las certificaciones oficiales (Fair Trade, Orgánico) anexadas al perfil de la Finca donde se curó mi lote.
- Como **Operario de Báscula (Módulo de Acopio)**, al recibir un camión de cereza, quiero desplegar una lista de fincas pre-registradas para asentar rápidamente qué proveedor entregó hoy la carga.

---

## 💻 Elementos de UI / UX
- **Formulario Extendido de Propiedad:** Permite capturar nombre de la finca, ubicación detallada (País, Departamento/Estado, Distrito), rango de Altitud (msnm) e Historia Crónica (Storytelling de la herencia familiar o la visión climática).
- **Selector Integrado de Mapas:** Un input dedicado para Coordenadas Geográficas (`Lat, Lng`) o vectores de Polígonos, pensado para alimentar mini-mapas de Google Maps / Mapbox inyectados en la visualización pública.
- **Gestor de Galería Fotográfica:** Input transaccional optimizado para que el caficultor suba fotografías desde su celular, sirviendo como imágenes de Hero/Cover para sus futuras campañas de venta directa.
- **Listas Vinculantes de Premios y Certificados:** Contenedores dinámicos donde se anclan JSON de certificados ecológicos y premios obtenidos en subastas (Taza de Excelencia).
- **Lista de Predios (Data Grid):** Vista de tarjetas o tabla para productores que poseen múltiples terrenos separados, facilitando su edición.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`fincas-app.js`, `fincas.html`)
- **Prompeos de Creación Obligatoria:** Scripts cruzados (ej. `trazabilidad-app.js` y `acopio-app.js`) envían alertas y redirecciones suaves (`if(confirm("Ir a Fincas?"))`) si detectan que la tabla de fincas del usuario está vacía para forzar la inicialización.
- **Inyección Transversal:** Provee el bloque `<select name="finca_origen">` a lo largo de toda la plataforma a través de un endpoint ligero o mapeo en caché del estado global del frontend.

### 2. Backend (`server.js`, Métodos `db.js`, `empresasController.js`)
- **Endpoints Autenticados (CRUD):** 
  - `GET /api/fincas`: Obtiene el vector de terrenos del inquilino (tenant/empresa en sesión).
  - `POST /api/fincas`: Crea el predio registrando variables físicas y archivos multimedia estáticos.
  - `PUT /api/fincas/:id` y `DELETE /api/fincas/:id`
- **Replicación a Single Origin:** Cuando un usuario consulta `/origen-unico/:slug`, el backend intercepta el "slug", localiza la base en la tabla `users` o `empresas` y hace un *JOIN* silencioso con la tabla `fincas` para inyectar JSON-LD (Schema.org GeoCoordinates). Si un usuario tiene el atributo `tipo='finca'`, los datos de altitud, historia y galería mutan orgánicamente la interfaz de ese comercio al diseño adaptado a granjas reales.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `fincas` (`id`, `empresa_id`, `nombre_finca`, `historia`, `altura`, `departamento`, `provincia`, `distrito`, `pais`, `coordenadas`, `imagenes`, `certificaciones`, `premios`).
- **Sinergias con otros Módulos:**
  - **Módulo de Trazabilidad (`procesamiento-app` / `acopio`):** Los lotes actúan como el ente "hijo" y la finca como el "padre".
  - **Identidad de Marca (`perfil-comercial-app`):** Convive cercanamente con los datos de registro fiscal/legal del productor (empresa_id) para generar una dualidad (Finca de Mieles SA. vs Finca física El Paraíso).
  - **APIs de Mapas Externos:** Los vectores alimentan dinámicamente `maps.googleapis.com` en los endpoints públicos de la App.
