# Software Requirements Specification (SRS)
## Project: Ruru Lab - Digital Passport & Traceability Ecosystem

---

## 1. Introduction

### 1.1 Purpose
Este documento especifica los requisitos de software para **Ruru Lab**, una plataforma digital para la trazabilidad de café y cacao de especialidad. Sirve como guía para interesados (stakeholders), desarrolladores y evaluadores para asegurar que se cumplan todos los objetivos comerciales y técnicos.

### 1.2 Scope
Ruru Lab es una plataforma web integral que permite a los productores gestionar fincas, a las empresas rastrear procesos industriales y a los consumidores verificar el origen y la calidad de los productos a través de Pasaportes Digitales (códigos QR).

### 1.3 Definitions, Acronyms, and Abbreviations
- **SRS**: Software Requirements Specification.
- **GIS**: Geographic Information System.
- **EUDR**: European Union Deforestation Regulation.
- **JSONB**: Binary JSON (PostgreSQL data type for semi-structured data).
- **Lote**: A specific batch of a product (coffee/cacao).

---

## 2. Overall Description

### 2.1 Product Perspective
Ruru Lab es una plataforma independiente con integraciones externas (Google Maps, Open-Meteo, Supabase). Utiliza una arquitectura multi-tenant donde los subdominios aíslan las páginas de destino públicas específicas de cada empresa.

### 2.2 User Classes and Characteristics
| User Class | Description |
| :--- | :--- |
| **Admin** | Acceso completo al sistema, configuración de la plataforma y gestión de alto nivel. |
| **Standard User (Company/Producer)** | Gestión de fincas, procesos, certificaciones y listados de productos. |
| **Public User (Consumer)** | Acceso de solo lectura al mercado y datos de trazabilidad a través de URLs públicas o códigos QR. |

### 2.3 Operating Environment
- **Platform**: Web (Desktop & Mobile).
- **Browsers**: Modern versions of Chrome, Safari, Firefox, Edge.
- **Cloud Backend**: Node.js/Express on Vercel/DigitalOcean.

---

## 3. System Features (Functional Requirements)

### 3.1 Farm & Geographic Management (GIS)
- **FR-1**: Los usuarios podrán dibujar los límites exactos de las fincas (polígonos) en un mapa satelital.
- **FR-2**: El sistema calculará automáticamente el área en hectáreas y la elevación en msnm basada en el polígono.
- **FR-3**: El sistema permitirá adjuntar imágenes y videos de YouTube a cada finca.

### 3.2 Product Marketplace & Detail
- **FR-4**: El sistema proporcionará una galería de alta fidelidad para la visualización de productos.
- **FR-5**: El sistema permitirá filtrar por origen, variedad, proceso y puntuación sensorial.
- **FR-6**: La página de detalle mostrará pestañas dinámicas (Origen, Proceso, Especificaciones, Análisis, Maridaje).

### 3.3 Traceability & Digital Passport
- **FR-7**: El sistema generará códigos QR únicos para cada lote.
- **FR-8**: El sistema rastreará pasos cronológicos: Cosecha -> Procesamiento -> Producción -> Producto Final.
- **FR-9**: El sistema permitirá "Blockchain Anchoring" para la verificación inmutable de registros.

### 3.4 Sensory Analytics
- **FR-10**: El sistema renderizará gráficos interactivos de 2 niveles Sunburst (Flavor Wheel) usando D3.js.
- **FR-11**: El sistema permitirá la comparación de atributos mediante gráficos de radar.

### 3.5 Enterprise Subdomains (Multi-Tenancy)
- **FR-12**: El sistema servirá páginas de destino personalizadas basadas en el subdominio (ej. `brand.rurulab.com`).

### 3.6 Gestión de Inventarios y Almacenes (Logística)
- **FR-13**: El sistema debe permitir la gestión de Ubicaciones de Almacenamiento (Bodega A, Estante B).
- **FR-14**: El sistema debe alertar sobre niveles críticos de stock una vez que los lotes inmutables se vinculan a un SKU comercial.

### 3.7 Gestión de Maestros de Producto (SKUs)
- **FR-13**: El sistema permitirá la creación de un catálogo maestro de productos (SKUs) con atributos técnicos como Grupo Genético, Código de Barras (GTIN/EAN) e Información Nutricional.
- **FR-14**: El sistema permitirá definir Perfiles Sensoriales Objetivo y asignar Ruedas de Sabor específicas por tipo de producto (Café vs Cacao).

### 3.8 Especificación del Módulo de Acopio
- **FR-15**: El sistema capturará datos financieros y operativos en el punto de recepción: Precio Unitario, Moneda, Variedad Botánica y Clasificación del Grano.
- **FR-16**: El sistema registrará el Método de Secado y la ubicación física del proceso inicial como parte de la cadena de custodia.

### 3.9 Lógica de Transformación y Flujo de Trabajo
- **FR-17**: El sistema gestionará la transformación mediante una interfaz cronológica de pasos configurables (Tostado -> Molienda -> Calidad).
- **FR-18**: El sistema debe realizar un seguimiento de pesos (masa) en cada etapa para permitir el cálculo de rendimientos y mermas entre procesos.

### 3.10 El Estado de "Inmutabilidad"
- **FR-20**: Una vez que un proceso es marcado como "Finalizado", el sistema bloqueará cualquier edición o eliminación de los registros asociados para garantizar la integridad de la trazabilidad (Lockdown de datos).

---

## 4. Data Requirements

### 4.1 Data Modeling Strategy
- **Relational Integrity**: Las entidades principales (Usuarios, Empresas, Granjas, Lotes) utilizan claves foráneas tradicionales.
- **Dynamic Attributes**: El sistema utilizará **JSONB** para campos flexibles como `sabores_json`, `certificaciones_json` y `premios_json` para soportar tipos de productos variados sin migraciones de esquema.

---

## 5. Non-Functional Requirements

### 5.1 Performance
- **NR-1**: Los recursos del front-end DEBERÁN estar optimizados para tiempos de carga menores a 2 segundos en conexiones 4G estándar.
- **NR-2**: Los mapas y gráficos DEBERÁN cargarse de forma diferida para priorizar la legibilidad.

### 5.2 Security
- **NR-3**: La autenticación DEBERÁ gestionarse mediante JWT (JSON Web Tokens) con cookies seguras HTTP-only.
- **NR-4**: El sistema DEBERÁ implementar control de acceso basado en roles (RBAC).

### 5.3 Reliability
- **NR-5**: Database backups SHALL be performed daily (automated via Supabase/PostgreSQL).

### 5.4 Compliance (Legal)
- **NR-6**: The system SHALL comply with EUDR requirements by storing and validating geographic coordinates for every production batch.

---

## 6. External Interface Requirements

### 6.1 User Interfaces
- **Aesthetics**: Premium, modern, using the "Stone & Amber" color palette.
- **Responsive Design**: Mobile-first approach for all public-facing pages.

### 6.2 Software Interfaces
- **Google Maps API**: For drawing and satellite visualization.
- **Open-Meteo**: For automatic elevation data retrieval.
- **Chart.js / D3.js**: For interactive data visualization.
