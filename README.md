Aplicación de Trazabilidad de Chocolate - Arquitectura SQLite
Esta aplicación está configurada para funcionar exclusivamente con SQLite, una base de datos ligera y basada en archivos que no requiere un servidor separado.

Cómo Poner en Marcha la Aplicación
Sigue estos sencillos pasos para tener la aplicación funcionando en tu máquina local.

1. Requisitos Previos
Node.js: Asegúrate de tener Node.js instalado (versión 16 o superior). Puedes descargarlo desde nodejs.org.

2. Instalación
Clona el repositorio (si aplica) y navega a la carpeta del proyecto. Luego, instala todas las dependencias necesarias:

```
npm install
```

3. Inicializar la Base de Datos
Antes de arrancar el servidor por primera vez, necesitas crear el archivo de la base de datos y sus tablas. Ejecuta el siguiente comando:

```
npm run db:init
```

Este comando creará un archivo llamado database.db en la raíz de tu proyecto. Solo necesitas ejecutarlo una vez.

4. Iniciar el Servidor
Ahora, puedes iniciar el servidor. Te recomendamos usar el modo de desarrollo (dev), que se reiniciará automáticamente cada vez que guardes un cambio en el código.

```
npm run dev
```

Si quieres iniciar el servidor en modo normal, usa:

```
npm start
```