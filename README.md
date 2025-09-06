Aplicación de Trazabilidad de Chocolate - Arquitectura de 3 Capas
Esta es la versión refactorizada de la aplicación de trazabilidad, ahora utilizando una arquitectura de 3 capas:

Frontend: HTML, CSS y JavaScript puro. Se encuentra en la carpeta /public.

Backend: Servidor de API con Node.js y Express.

Base de Datos: PostgreSQL para la persistencia de datos.

1. Configuración de la Base de Datos (PostgreSQL)
Instalar PostgreSQL: Asegúrate de tener PostgreSQL instalado en tu sistema.

Crear Base de Datos: Crea una nueva base de datos. Por ejemplo, chocolate_db.

CREATE DATABASE chocolate_db;

Ejecutar Script: Conéctate a tu nueva base de datos y ejecuta el script que se encuentra en database.sql para crear las tablas fincas y lotes.

psql -U tu_usuario -d chocolate_db -f database.sql

2. Configuración del Backend (Node.js)
Instalar Dependencias: En la raíz del proyecto, ejecuta el siguiente comando para instalar las librerías necesarias (Express, pg, cors).

npm install

Configurar Conexión: Abre el archivo db.js. Modifica los datos de conexión a tu base de datos PostgreSQL si no estás usando los valores por defecto o variables de entorno.

const pool = new Pool({
    user: 'postgres',       // Tu usuario de PostgreSQL
    host: 'localhost',
    database: 'chocolate_db',
    password: 'password',   // Tu contraseña
    port: 5432,
});

Iniciar el Servidor: Una vez configurado, inicia el servidor backend.

node server.js

El servidor estará corriendo en http://localhost:3000.

3. Ejecutar la Aplicación Frontend
El servidor de Node.js ya está configurado para servir los archivos estáticos de la carpeta /public.

Abrir en el Navegador: Simplemente abre tu navegador y ve a la siguiente dirección:
http://localhost:3000

Esto te llevará a la página principal de Trazabilidad (index.html). Desde allí, podrás navegar a las secciones de Fincas y al Dashboard. La aplicación ahora leerá y guardará todos los datos a través de la API, comunicándose con tu base de datos PostgreSQL.