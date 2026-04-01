# Ruru Lab: Trazabilidad Radical y Pasaportes Digitales
> **El estándar de oro para la transparencia en Café y Cacao de Especialidad.**

---

## 1. Visión Ejecutiva
Ruru Lab es una plataforma B2B/B2C diseñada para devolverle el valor al origen. Resolvemos la falta de confianza y transparencia en las cadenas de suministro de café y cacao mediante **Pasaportes Digitales Inmutables** que conectan al productor con el tostador y el consumidor final a través de una experiencia digital inmersiva.

---

## 2. El Problema y Nuestra Solución

### El Problema
Los consumidores de especialidad demandan saber de dónde viene lo que consumen, pero la información se pierde en intermediarios y empaques estáticos. El productor no tiene voz y el tostador carece de herramientas para contar la historia real.

### La Solución: Ruru Lab
- **Pasaportes Digitales**: Cada lote tiene un código QR único que revela su ADN: finca, coordenadas exactas, sensores de proceso y perfil de cata.
- **Marketplace de Alta Fidelidad**: Una vitrina digital que no solo muestra un producto, sino una historia validada geográficamente y técnicamente.

---

## 3. Pilares Funcionales (Product Core)

### 🗺️ Precisión Geográfica (GIS & Satélite)
Integramos **Google Maps API** para delimitar polígonos exactos de cultivo. 
- **Inmersión Total**: El usuario puede ver la finca en modo satélite de alta resolución.
- **Validación Automática**: Cálculo de Ha, altitud msnm y centroide mediante APIs de elevación, fundamental para normativas como la **EUDR** (Deforestación Cero).

### 🧪 Experiencia Sensorial Interactiva
Traducimos datos complejos en visualizaciones digeribles:
- **Rueda de Sabores (D3.js Sunburst)**: Permite explorar las notas de sabor de forma jerárquica y visual.
- **Gráficos de Atributos (Radar Charts)**: Visualización inmediata de Acidez, Cuerpo, Aroma y Dulzor para decisiones de compra informadas.

### 🛤️ Trazabilidad de Extremo a Extremo
Seguimiento cronológico de cada proceso industrial:
- **Hitos de Lote**: Registro de Cosecha, Fermentación, Secado y Tostado con responsables, fechas y parámetros de calidad.
- **Línea de Tiempo Visual**: Un mapa de ruta intuitivo que muestra el viaje físico del producto.

### 🚀 Ecosistema Multi-Tenancy (Marca Blanca)
Nuestra arquitectura permite que cada empresa (Tostadora / Cooperativa) tenga su propio ecosistema:
- **Subdominios Dinámicos**: `finca-esperanza.rurulab.com` sirve una landing personalizada y optimizada para SEO de forma automática.
- **Gestión Empresarial**: Panel administrativo para gestionar productores, lotes y perfiles comerciales.

---

## 4. Fundamentos Técnicos y Escalabilidad

> [!NOTE]
> Nuestra tecnología está diseñada para la rapidez de iteración y la robustez de datos.

| Capa | Tecnología | Justificación |
| :--- | :--- | :--- |
| **Backend** | Node.js / Express | Escalabilidad horizontal y manejo eficiente de APIs concurrentes. |
| **Base de Datos** | PostgreSQL (Supabase) | Estabilidad con el poder de **JSONB** para atributos dinámicos (Schema-less flexibility). |
| **Mapas** | Google Maps SDK | Precisión satelital líder en el mercado y herramientas de dibujo GIS. |
| **Vistas** | Vanilla JS / Tailwind | Rendimiento extremo, sin sobrecarga de frameworks, SEO nativo. |
| **Gráficos** | D3.js + Chart.js | Visualizaciones de datos de grado científico con estética premium. |

---

## 5. Valor para el Inversor (Diferenciales)

1. **Cumplimiento Normativo (Compliance)**: Listos para regulaciones internacionales de exportación (EUDR) gracias a la delimitación geográfica poligonal.
2. **Engagement del Consumidor**: El QR no es solo un enlace, es un pasaporte interactivo que aumenta el valor percibido del producto hasta en un **20-30%**.
3. **Escalabilidad Global**: Arquitectura agnóstica al producto (Café, Cacao, Miel, Especias) gracias a nuestra estructura de datos JSON flexible.
4. **Bajo Time-to-Market**: La automatización de Landings personalizadas permite que una marca esté "en el aire" con trazabilidad completa en minutos.

---

## 6. Próximos Pasos (Roadmap)
- **Blockchain Integration**: Anclaje de hashes de trazabilidad en redes inmutables para máxima confianza.
- **IoT Connect**: Conexión directa con sensores de humedad y temperatura en planta.
- **Inteligencia Artificial**: Predicción de puntaje de cata basado en variables meteorológicas y de proceso.

---

**Ruru Lab: Transformando el consumo responsable en una experiencia digital inolvidable.**
