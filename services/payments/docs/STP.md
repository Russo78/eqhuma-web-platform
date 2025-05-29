# Integración con STP (Sistema de Transferencias y Pagos)

## Descripción General

Este módulo implementa la integración con el Sistema de Transferencias y Pagos (STP) para procesar pagos SPEI y pagos de servicios en México.

## Configuración

### Variables de Entorno

```env
# STP Core
STP_API_URL=https://demo.stpmex.com/speiws/rest
STP_PRIVATE_KEY=/path/to/private.key
STP_CERTIFICATE=/path/to/certificate.pem
STP_ACCOUNT_NUMBER=1234567890
STP_INSTITUTION=90646
STP_WEBHOOK_SECRET=your_webhook_secret

# STP Servicios
STP_UTILITY_API_URL=https://demo.stpmex.com/servicios/rest
STP_UTILITY_API_KEY=your_api_key
```

### Certificados

Los certificados deben estar en formato PEM y ubicados en el directorio `/app/certs/` dentro del contenedor:

- `stp_key.pem`: Llave privada
- `stp_cert.pem`: Certificado público

## API Endpoints

### Pagos SPEI

#### Crear Pago SPEI

```http
POST /api/v1/payments/stp/payments
Content-Type: application/json

{
  "amount": 1000.00,
  "billingDetails": {
    "beneficiaryName": "JUAN PEREZ",
    "beneficiaryAccount": "012345678901234567",
    "beneficiaryBank": {
      "code": "40012",
      "name": "BBVA BANCOMER"
    },
    "reference": "INV-2023-001"
  }
}
```

#### Validar Cuenta Beneficiaria

```http
POST /api/v1/payments/stp/validate-account
Content-Type: application/json

{
  "accountNumber": "012345678901234567",
  "bankCode": "40012"
}
```

### Pagos de Servicios

#### Crear Pago de Servicio

```http
POST /api/v1/payments/stp/utility-payments
Content-Type: application/json

{
  "amount": 500.00,
  "serviceType": "CFE",
  "billingDetails": {
    "agreementCode": "123456",
    "reference": "1234567890",
    "dueDate": "2023-12-31"
  }
}
```

#### Validar Referencia de Servicio

```http
POST /api/v1/payments/stp/validate-service-reference
Content-Type: application/json

{
  "serviceType": "CFE",
  "reference": "1234567890"
}
```

### Consultas

#### Obtener Saldo

```http
GET /api/v1/payments/stp/account-balance
```

#### Obtener Estado de Cuenta

```http
GET /api/v1/payments/stp/account-statement?startDate=2023-01-01&endDate=2023-01-31
```

#### Obtener Catálogo de Bancos

```http
GET /api/v1/payments/stp/banks
```

## Webhooks

### URL del Webhook

```
POST /api/v1/payments/webhooks/stp
```

### Headers Requeridos

- `stp-signature`: Firma del webhook
- `stp-timestamp`: Timestamp del evento

### Eventos Soportados

- `payment.completed`: Pago completado
- `payment.failed`: Pago fallido
- `payment.returned`: Pago devuelto
- `utility.payment.completed`: Pago de servicio completado
- `utility.payment.failed`: Pago de servicio fallido

## Manejo de Errores

Los errores específicos de STP incluyen:

- `InvalidAccountError`: Cuenta beneficiaria inválida
- `InsufficientFundsError`: Fondos insuficientes
- `InvalidServiceReferenceError`: Referencia de servicio inválida
- `ServiceUnavailableError`: Servicio no disponible
- `WebhookValidationError`: Error de validación de webhook

## Tipos de Servicios Soportados

- `CFE`: Comisión Federal de Electricidad
- `TELMEX`: Teléfonos de México
- `AGUA`: Servicios de agua
- `GAS`: Gas natural

## Consideraciones de Seguridad

1. Los certificados deben tener permisos 600 (lectura/escritura solo para el propietario)
2. La llave privada nunca debe ser expuesta en logs o respuestas de API
3. Todas las peticiones deben ser autenticadas
4. Los webhooks deben ser validados usando la firma proporcionada

## Monitoreo y Logs

Los eventos importantes se registran usando Winston:

```javascript
logger.info('Pago STP creado:', { paymentId, amount });
logger.error('Error en webhook STP:', error);
```

## Pruebas

Para ejecutar las pruebas:

```bash
npm test -- --grep="STP"
```

## Ambiente de Sandbox

Para desarrollo y pruebas, usar las siguientes credenciales de sandbox:

```env
STP_API_URL=https://demo.stpmex.com/speiws/rest
STP_INSTITUTION=90646
```

## Limitaciones y Consideraciones

1. El monto máximo por transacción es de $999,999.99 MXN
2. Las transferencias solo están disponibles en horario SPEI
3. Los pagos de servicios tienen validez según el tipo de servicio
4. Las devoluciones solo están disponibles el mismo día hábil

## Referencias

- [Documentación oficial de STP](https://stpmex.com/docs)
- [Especificación SPEI](https://www.banxico.org.mx/spei/)
