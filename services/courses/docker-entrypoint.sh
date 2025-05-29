#!/bin/sh
set -e

# Función para manejar la señal SIGTERM
handle_sigterm() {
    echo "Recibida señal SIGTERM, iniciando shutdown graceful..."
    
    # Dar tiempo para que las conexiones activas terminen
    sleep 5
    
    # Terminar el proceso principal
    kill -TERM "$child"
    
    # Esperar a que el proceso hijo termine
    wait "$child"
    
    echo "Shutdown completado"
    exit 0
}

# Función para manejar la señal SIGINT
handle_sigint() {
    echo "Recibida señal SIGINT, iniciando shutdown graceful..."
    
    # Dar tiempo para que las conexiones activas terminen
    sleep 2
    
    # Terminar el proceso principal
    kill -TERM "$child"
    
    # Esperar a que el proceso hijo termine
    wait "$child"
    
    echo "Shutdown completado"
    exit 0
}

# Registrar los manejadores de señales
trap 'handle_sigterm' SIGTERM
trap 'handle_sigint' SIGINT

# Verificar directorios necesarios
echo "Verificando directorios necesarios..."
mkdir -p logs
chown -R node:node logs

# Verificar variables de entorno requeridas
echo "Verificando variables de entorno..."
: "${NODE_ENV:?Variable de entorno NODE_ENV no establecida}"
: "${PORT:?Variable de entorno PORT no establecida}"
: "${MONGODB_URI:?Variable de entorno MONGODB_URI no establecida}"

# Esperar a que MongoDB esté disponible
echo "Esperando a que MongoDB esté disponible..."
timeout 30s sh -c 'until nc -z ${MONGODB_URI#mongodb://} 2>/dev/null; do echo "Esperando a MongoDB..."; sleep 1; done'

# Ejecutar migraciones si es necesario
if [ "$RUN_MIGRATIONS" = "true" ]; then
    echo "Ejecutando migraciones..."
    npm run migrate
fi

# Limpiar archivos temporales
echo "Limpiando archivos temporales..."
rm -rf /tmp/* || true

# Verificar permisos
echo "Verificando permisos..."
if [ "$(id -u)" = "0" ]; then
    echo "Advertencia: Corriendo como root"
fi

# Configurar timezone
echo "Configurando timezone..."
if [ -n "$TZ" ]; then
    cp /usr/share/zoneinfo/$TZ /etc/localtime
    echo $TZ > /etc/timezone
fi

# Mostrar información del ambiente
echo "Información del ambiente:"
echo "NODE_ENV: $NODE_ENV"
echo "PORT: $PORT"
echo "NODE_VERSION: $(node -v)"
echo "NPM_VERSION: $(npm -v)"

# Ejecutar comando
echo "Iniciando aplicación..."
exec "$@" &

# Guardar PID del proceso hijo
child=$!

# Esperar a que el proceso hijo termine
wait "$child"
