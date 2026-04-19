# 📌 Feature Card: Gestor de Perfil Comercial y Subdominios

## 📖 Resumen
**Nombre de la Función:** Mi Perfil Comercial (Website & Marketing Builder)  
**Descripción:** Es el panel de control de marketing. Permite a cualquier productor u organización integrar sus elementos de diseño y contacto para activar su página web pública (Origen Único). Actúa como el puente que vincula un "Usuario" (Cuenta del Sistema) con una "Entidad Física" (Finca o Procesadora), otorgándole una URL propia (subdominio) para compartir directamente a internet.  
**Público Objetivo:** Dueños de Fincas, Equipos de Marketing de Cooperativas y Pymes Tostadoras/Chocolateras.

---

## 🎯 Objetivos y Propuesta de Valor
- **Página Web Instantánea en Segundos:** Entregar una propuesta de valor brutal (SaaS Website Builder). El usuario llena su historia, sube un banner y un logo, elige un link y automáticamente tiene una página indexable optimizada para vender sus productos.
- **Micro-Tenancy (Subdominios Válidos):** Separar su marca de la de RuruLab. En lugar de compartir un link aburrido tipo `/origen-unico/123`, pueden compartir directamente `mifinca.rurulab.com` atrayendo mayor profesionalismo directo hacia clientes B2B.
- **Consolidación de Identidad:** Funciona como un switch semántico. Un usuario puede tener registradas varias Fincas y Procesadoras en su base de datos. Desde este Perfil, él elige cuál de sus infraestructuras (`company_type` y `company_id`) es la que se mostrará como el frente de batalla principal de su tienda web o "Landing Page Oficial".

---

## 📝 Historias de Usuario
- Como **Dueño de Marca Tostadora**, quiero elegir el tipo de perfil "Planta Procesadora", vincularlo a mi sucursal principal y reservar el subdominio `mitostaduria` para que mis links redirijan a mi catálogo.
- Como **Caficultor**, necesito un panel fácil donde reemplazar mi imagen de portada por la foto reciente de mi cosecha y cambiar mi número de WhatsApp, garantizando que el cambio se replique instantáneamente en la web pública.
- Como **Usuario Nuevo en la Plataforma**, tras loguearme, necesito una pantalla donde pueda colocar el logo B2B de mi empresa agroindustrial para que todas mis confirmaciones de cadena de bloques y documentos técnicos porten mi logotipo.
- Como **Vendedor Global**, quiero poder usar un botón de *Toggle* (`is_published`) para ocultar mi perfil de los motores de búsqueda mientras termino de tomarle fotografías de alta calidad a mis lotes en stock.

---

## 💻 Elementos de UI / UX
- **Dropzones de Medios Activos:** Cajas de arrastrar y soltar (Drag & Drop) para `Logo` y `Cover Image`. Al subir la imagen, se lanza un Preview inmediato mediante `FileReader` antes de guardarse en el servidor.
- **Selector Dual de Vínculo:** Un `<select>` principal escoge "El Tipo de Empresa" (Finca o Procesadora). Al cambiarlo, un segundo `<select>` (`company_id`) se inyecta dinámicamente listando únicamente las Fincas o Procesadoras que el usuario ha dado de alta previamente, evitando enredos de roles.
- **Campo Mágico de Subdominio:** Un *Input* para texto que auto-formatea los espacios por guiones medios (hyphens) e impide caracteres especiales para garantizar compatibilidad con los estándares DNS y URI (`mifinca-especial`). Aparece visualmente junto al prefijo semántico `.rurulab.com`.
- **Información de Enlace Social:** Inputs clásicos con validación para el WhatsApp, Instagram y URL corporativa matriz.
- **Dashboard CTA (Call To Action):** En la cabecera, una vez guardado el perfil estatus "Publicado", emite un botón azul prominente llamado **"Ver Mi Landing Page"** que abre el subdominio generado en una nueva pestaña.

---

## ⚙️ Arquitectura Técnica

### 1. Frontend (`perfil-comercial-app.js`, `perfil-comercial.html`)
- **API Multiplexing:** `Promise.all` carga en paralelo `api('/api/fincas')` y `api('/api/procesadoras')` llenando la caché temporal de la vista para poder permutar instantáneamente la entidad vinculante sin recargar el DOM.
- **Estado Vinculante Base (Hydration):** Recupera la información unificada cargando el endpoint del usuario, pre-poblando todos los inputs nativos con `document.getElementById('xyz').value = response.xyz`.
- **Botón Desactivación (Kill-Switch):** Manejo booleano del estado del perfil `data.is_published`. Si esto es remoto en el servidor, toda consulta pública lanzará código `HTTP 404` (No encontrado).

### 2. Backend (`server.js`, `userController.js`, `db.js`)
- **Endpoint Principal:** `GET/POST/PUT /api/user/company-profile`.
- **Integridad de Base Múltiple:** Al someter este formulario (POST/PUT), el backend sobrescribe campos tanto en la tabla `users` (Como el subdominio, history, socials) como en la relación lógica unificadora `company_type` o `company_id`.
- **Receptor en Middleware DNS:** En el inicio de peticiones de Express.js (`server.js`), se captura el campo `host`. Si se detecta el match con un registro de la base `users.subdomain`, el despachador de ruteo envía la petición de host directo al controlador del Módulo "Landing-Empresa" para procesar el frontend al consumidor web final.

---

## 🔗 Dependencias y Modelos de Datos
- **Tablas de la BD:** `users` (Contiene `subdomain`, `cover`, `logo`, `history_text`, `instagram`, `facebook`, `whatsapp`, `company_type`, `company_id`, `is_published`).
- **Storage / CDN:** Maneja promesas pesadas asíncronas para interceptar los datos en base64 de las imágenes y guardarlas permanentemente (Cloud Storage o local files) bajo URLs sanitizadas.
- **Acoplamiento Directo (Hard Dependencies):** Requiere imperativamente tener configurada por lo menos un registro en `Fincas` o en `Procesadoras` primero; de lo contrario el sistema inyecta alertas rojas bloqueando el puenteo web.
