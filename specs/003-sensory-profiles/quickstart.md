# Guía de Inicio Rápido: Gestor de Perfiles Sensoriales y Widget

**Fecha**: 2026-04-26  
**Especificación**: [spec.md](./spec.md)

---

## 1. Crear un Perfil de Cata

El laboratorio o el maestro tostador debe trasladar los resultados de la sesión de cata física a la plataforma.

1. Navega a la sección **Perfiles Sensoriales**.
2. Haz clic en **Nuevo Perfil**.
3. Selecciona el **Tipo de Producto** (Café o Cacao). Notarás que los atributos a evaluar (Acidez, Amargor, etc.) cambian dinámicamente según lo seleccionado.
4. Ajusta los sliders para cada atributo. Verás que el gráfico de radar a la derecha se dibuja y adapta en **tiempo real**.
5. Ingresa el **Puntaje Global** (ej. 85.5) y haz clic en Guardar.

## 2. Vincular un Perfil a un Lote de Procesamiento

Para que un producto tenga valor en trazabilidad, su evaluación sensorial debe estar conectada a un lote físico.

1. Ve a **Procesamiento** y abre un lote terminado.
2. En la sección de *Calidad*, haz clic en **Vincular Perfil**.
3. Selecciona el perfil que creaste en el paso anterior.
4. Ahora, cuando los compradores escaneen el QR del lote en el Marketplace, verán el radar asociado al mismo.

## 3. Integrar el Radar en tu Propia Tienda (Shopify / WooCommerce)

Si vendes directamente al consumidor B2C y quieres mostrarles de forma interactiva a qué sabe tu producto:

1. Ve a la lista de tus **Perfiles Sensoriales**.
2. Haz clic en el ícono de **Compartir/Integrar** ( <i class="fas fa-code"></i> ) junto al perfil deseado.
3. El sistema generará un bloque de código HTML (`<iframe>`). Haz clic en "Copiar Código".
4. Abre tu panel de control de Shopify o WooCommerce, ve a la descripción del producto o a un Custom HTML Metafield, y **pega el código**.
5. *Nota:* El gráfico se mostrará automáticamente en tu tienda para siempre, **siempre y cuando tu suscripción a la plataforma se mantenga activa**. Si expira, el gráfico se ocultará de forma segura sin romper tu tienda.
