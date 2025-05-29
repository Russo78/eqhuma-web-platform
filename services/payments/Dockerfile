# Usar una imagen base de Node.js LTS Alpine
FROM node:18-alpine

# Establecer el directorio de trabajo
WORKDIR /usr/src/app

# Instalar dependencias del sistema necesarias
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    openssl

# Copiar archivos de configuración
COPY package*.json ./
COPY .env.example ./.env

# Instalar dependencias
RUN npm ci --only=production

# Copiar el código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p logs certs

# Establecer permisos
RUN chown -R node:node /usr/src/app && \
    chmod 600 /usr/src/app/certs/* || true

# Cambiar al usuario node por seguridad
USER node

# Variables de entorno
ENV NODE_ENV=production \
    PORT=5002 \
    STP_PRIVATE_KEY=/usr/src/app/certs/stp_key.pem \
    STP_CERTIFICATE=/usr/src/app/certs/stp_cert.pem

# Exponer el puerto
EXPOSE 5002

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=30s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:5002/health || exit 1

# Script de entrada para validar certificados y arrancar la aplicación
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD ["node", "src/index.js"]
