require('dotenv').config();
const path = require('path');

module.exports = {
  // Configuración para el entorno de DESARROLLO
  development: {
    client: 'sqlite3', // Le dice a Knex que use SQLite
    connection: {
      // Especifica que la base de datos es un archivo llamado 'database.db'
      filename: path.join(__dirname, 'database.db')
    },
    useNullAsDefault: true, // Una configuración necesaria para SQLite
    migrations: {
      // Le indica dónde están los archivos que crean las tablas
      directory: path.join(__dirname, 'db/migrations')
    }
  },

  // Configuración para el entorno de PRODUCCIÓN
  production: {
    client: 'pg', // Le dice a Knex que use PostgreSQL
    connection: process.env.POSTGRES_URL, // Obtiene la URL de la base de datos desde Vercel
    migrations: {
      // Usa los mismos archivos de migración para mantener la consistencia
      directory: path.join(__dirname, 'db/migrations')
    }
  }
};