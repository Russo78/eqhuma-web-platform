# Usar una imagen base de Node.js
FROM node:18-alpine

# Crear directorio de la aplicación
WORKDIR /app

# Copiar archivos de configuración
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el código fuente
COPY . .

# Exponer el puerto
EXPOSE 5003

# Script de inicio
CMD ["npm", "start"]
