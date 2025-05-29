# Usar una imagen base de Node.js oficial
FROM node:18-alpine

# Crear directorio de la aplicación
WORKDIR /usr/src/app

# Instalar dependencias del sistema
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Copiar package.json y package-lock.json
COPY package*.json ./

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Crear directorio para logs
RUN mkdir -p logs && \
    chown -R node:node logs

# Cambiar a usuario no root
USER node

# Variables de entorno
ENV NODE_ENV=production \
    PORT=5000

# Exponer puerto
EXPOSE 5000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5000/health || exit 1

# Comando para iniciar la aplicación
CMD ["npm", "start"]

# Metadatos
LABEL maintainer="Tu Nombre <tu@email.com>" \
      version="1.0.0" \
      description="Servicio de cursos para Eqhuma Web"

# Buenas prácticas de Docker
# 1. Usar una imagen base específica y ligera (alpine)
# 2. Minimizar el número de capas
# 3. Usar usuario no root
# 4. Incluir healthcheck
# 5. Documentar puertos y variables de entorno
# 6. Optimizar el caché de capas
# 7. Incluir metadatos relevantes
# 8. Ignorar archivos innecesarios con .dockerignore

# Configuración de volúmenes
VOLUME ["/usr/src/app/logs"]

# Argumentos de construcción (build args)
ARG NODE_ENV=production
ARG PORT=5000

# Variables de entorno predeterminadas
ENV NODE_ENV=$NODE_ENV \
    PORT=$PORT \
    NPM_CONFIG_LOGLEVEL=warn \
    NODE_OPTIONS="--max-old-space-size=2048" \
    TZ=UTC

# Configuración de node
ENV NODE_ENV=production \
    NODE_PATH=./build

# Optimizaciones de rendimiento
RUN npm cache clean --force

# Configuración de manejo de señales
STOPSIGNAL SIGTERM

# Tiempo de espera para shutdown graceful
ENV GRACEFUL_SHUTDOWN_TIMEOUT=30000

# Directorio de trabajo persistente
WORKDIR /usr/src/app

# Script de entrada para manejo de señales y limpieza
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
ENTRYPOINT ["docker-entrypoint.sh"]

# Comando por defecto
CMD ["npm", "start"]
