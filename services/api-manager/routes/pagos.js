const express = require('express');
const Stripe = require('stripe');
const router = express.Router();

// Inicializar Stripe con la clave secreta
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Crear intención de pago
router.post('/crear-intencion', async (req, res) => {
  try {
    const { monto, moneda = 'mxn', descripcion, metadatos } = req.body;

    // Crear PaymentIntent con Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: monto, // Monto en centavos
      currency: moneda,
      description,
      metadata: {
        usuarioId: req.usuario.id,
        ...metadatos
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Error al crear intención de pago:', error);
    res.status(500).json({
      mensaje: 'Error al procesar el pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Confirmar pago exitoso y procesar la compra
router.post('/confirmar/:paymentIntentId', async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const { tipo, itemId } = req.body; // tipo puede ser 'curso' o 'webinar'

    // Verificar el estado del pago con Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        mensaje: 'El pago no ha sido completado'
      });
    }

    // Procesar la compra según el tipo
    let resultado;
    if (tipo === 'curso') {
      // Registrar la compra del curso
      resultado = await axios.post(`http://courses:5000/cursos/${itemId}/compra`, {
        usuarioId: req.usuario.id,
        paymentIntentId,
        monto: paymentIntent.amount
      });
    } else if (tipo === 'webinar') {
      // Registrar la compra del webinar
      resultado = await axios.post(`http://webinars:5001/webinars/${itemId}/compra`, {
        usuarioId: req.usuario.id,
        paymentIntentId,
        monto: paymentIntent.amount
      });
    } else {
      throw new Error('Tipo de compra no válido');
    }

    // Enviar confirmación por correo (implementar según necesidades)
    // await enviarConfirmacionCompra(req.usuario.email, tipo, itemId);

    res.json({
      mensaje: 'Pago procesado exitosamente',
      detalles: resultado.data
    });
  } catch (error) {
    console.error('Error al confirmar pago:', error);
    res.status(500).json({
      mensaje: 'Error al procesar la confirmación del pago',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Webhook para eventos de Stripe
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        // Actualizar estado de pago en la base de datos
        await actualizarEstadoPago(paymentIntent);
        break;

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        // Manejar fallo de pago
        await manejarPagoFallido(failedPayment);
        break;

      // Agregar más casos según necesidades
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error en webhook de Stripe:', error);
    res.status(400).json({
      mensaje: 'Error al procesar webhook',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Obtener historial de pagos del usuario
router.get('/historial', async (req, res) => {
  try {
    const usuarioId = req.usuario.id;

    // Obtener pagos de cursos
    const pagosCursos = await axios.get(`http://courses:5000/pagos/usuario/${usuarioId}`);
    
    // Obtener pagos de webinars
    const pagosWebinars = await axios.get(`http://webinars:5001/pagos/usuario/${usuarioId}`);

    // Combinar y ordenar por fecha
    const todosLosPagos = [...pagosCursos.data, ...pagosWebinars.data]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    res.json(todosLosPagos);
  } catch (error) {
    console.error('Error al obtener historial de pagos:', error);
    res.status(500).json({
      mensaje: 'Error al obtener el historial de pagos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Funciones auxiliares
async function actualizarEstadoPago(paymentIntent) {
  // Implementar lógica para actualizar estado de pago
  const { metadata } = paymentIntent;
  // Actualizar en el servicio correspondiente según metadata
}

async function manejarPagoFallido(paymentIntent) {
  // Implementar lógica para manejar pagos fallidos
  const { metadata } = paymentIntent;
  // Notificar al usuario y actualizar estado en el sistema
}

module.exports = router;
