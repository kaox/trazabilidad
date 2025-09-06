# --- Etapa 1: Build ---
# Usar una imagen oficial de Node.js como base.
# La versión Alpine es ligera y recomendada para producción.
FROM node:18-alpine AS base

# Establecer el directorio de trabajo dentro del contenedor
WORKDIR /app

# Copiar los archivos de definición de dependencias
COPY package*.json ./

# Instalar las dependencias del backend
RUN npm install

# Copiar el resto del código de la aplicación (backend y frontend)
COPY . .

# --- Etapa 2: Run ---
# No es necesaria una segunda etapa para esta configuración simple,
# pero es una buena práctica tenerla en mente para builds más complejos.

# Exponer el puerto en el que corre el servidor Express
EXPOSE 3000

# El comando que se ejecutará cuando se inicie el contenedor
CMD [ "node", "server.js" ]
