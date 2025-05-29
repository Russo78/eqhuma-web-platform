#!/bin/sh
set -e

# Verificar y crear certificados si no existen
if [ ! -f "/app/certs/stp_key.pem" ] || [ ! -f "/app/certs/stp_cert.pem" ]; then
    echo "Generando certificados SSL para STP..."
    
    # Generar llave privada
    openssl genrsa -out /app/certs/stp_key.pem 2048
    chmod 600 /app/certs/stp_key.pem
    
    # Generar certificado
    openssl req -new -x509 -key /app/certs/stp_key.pem -out /app/certs/stp_cert.pem -days 365 -subj "/CN=eqhuma-payments"
    chmod 600 /app/certs/stp_cert.pem
    
    echo "Certificados SSL generados exitosamente"
fi

# Verificar variables de entorno requeridas
required_vars="NODE_ENV PORT MONGODB_URI"

for var in $required_vars; do
    if [ -z "$(eval echo \$$var)" ]; then
        echo "Error: Variable de entorno requerida no está definida: $var"
        exit 1
    fi
done

# Esperar a que MongoDB esté disponible
echo "Esperando a que MongoDB esté disponible..."
timeout=15
while ! nc -z mongodb 27017; do
    if [ "$timeout" -le 0 ]; then
        echo "Error: Tiempo de espera agotado para MongoDB"
        exit 1
    fi
    timeout=$((timeout-1))
    sleep 1
done

# Esperar a que Redis esté disponible
echo "Esperando a que Redis esté disponible..."
timeout=15
while ! nc -z redis 6379; do
    if [ "$timeout" -le 0 ]; then
        echo "Error: Tiempo de espera agotado para Redis"
        exit 1
    fi
    timeout=$((timeout-1))
    sleep 1
done

echo "Servicios de base de datos disponibles"

# Ejecutar el comando proporcionado
exec "$@"
