const nodemailer = require('nodemailer');
const logger = require('../config/logger');
const { formatDate } = require('../utils/dateFormatter');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    // Verificar conexión
    this.transporter.verify((error) => {
      if (error) {
        logger.error('Error con el servidor SMTP:', error);
      } else {
        logger.info('Servidor SMTP listo');
      }
    });
  }

  async sendWebinarEmail({ to, webinar, type }) {
    try {
      const emailContent = this.getEmailContent(type, webinar);
      
      const mailOptions = {
        from: `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM_ADDRESS}>`,
        to,
        ...emailContent
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email enviado: ${info.messageId}`);
      return info;
    } catch (error) {
      logger.error('Error al enviar email:', error);
      throw new Error('Error al enviar email');
    }
  }

  getEmailContent(type, webinar) {
    switch (type) {
      case 'registration':
        return this.getRegistrationEmail(webinar);
      case 'reminder':
        return this.getReminderEmail(webinar);
      case 'cancellation':
        return this.getCancellationEmail(webinar);
      case 'followup':
        return this.getFollowupEmail(webinar);
      default:
        throw new Error('Tipo de email no válido');
    }
  }

  getRegistrationEmail(webinar) {
    const formattedDate = formatDate(webinar.date);
    
    return {
      subject: `Confirmación de registro: ${webinar.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">¡Registro Confirmado!</h1>
          
          <p>Te has registrado exitosamente para el webinar:</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #2c5282;">${webinar.title}</h2>
            <p><strong>Fecha:</strong> ${formattedDate}</p>
            <p><strong>Duración:</strong> ${webinar.duration} minutos</p>
            <p><strong>Presentador:</strong> ${webinar.presenter.name}</p>
          </div>

          <div style="background-color: #ebf8ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h3 style="color: #2b6cb0;">Detalles de Acceso</h3>
            <p><strong>Enlace:</strong> <a href="${webinar.meetingUrl}">${webinar.meetingUrl}</a></p>
            ${webinar.meetingPassword ? `<p><strong>Contraseña:</strong> ${webinar.meetingPassword}</p>` : ''}
          </div>

          <div style="margin: 20px 0;">
            <h3>Recomendaciones:</h3>
            <ul>
              <li>Ingresa 5-10 minutos antes del inicio</li>
              <li>Asegúrate de tener una buena conexión a internet</li>
              <li>Ten listo papel y lápiz para tomar notas</li>
              <li>Prepara tus preguntas con anticipación</li>
            </ul>
          </div>

          <div style="margin: 20px 0;">
            <p>Agrega este evento a tu calendario:</p>
            <a href="${this.generateCalendarLink(webinar)}" style="background-color: #4299e1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Agregar al Calendario
            </a>
          </div>

          <p style="color: #666; font-size: 0.9em; margin-top: 30px;">
            Si tienes alguna pregunta, no dudes en contactarnos respondiendo este email.
          </p>
        </div>
      `
    };
  }

  getReminderEmail(webinar) {
    const formattedDate = formatDate(webinar.date);
    
    return {
      subject: `Recordatorio: ${webinar.title} - ¡Comienza pronto!`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">¡Tu webinar comienza pronto!</h1>
          
          <p>Te recordamos que el webinar "${webinar.title}" comienza en 1 hora.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <h2 style="color: #2c5282;">${webinar.title}</h2>
            <p><strong>Fecha:</strong> ${formattedDate}</p>
            <p><strong>Duración:</strong> ${webinar.duration} minutos</p>
          </div>

          <div style="background-color: #ebf8ff; padding: 20px; border-radius: 5px;">
            <h3 style="color: #2b6cb0;">Accede aquí:</h3>
            <p><a href="${webinar.meetingUrl}" style="color: #4299e1;">${webinar.meetingUrl}</a></p>
            ${webinar.meetingPassword ? `<p><strong>Contraseña:</strong> ${webinar.meetingPassword}</p>` : ''}
          </div>

          <p style="margin-top: 20px;">¡Te esperamos!</p>
        </div>
      `
    };
  }

  getCancellationEmail(webinar) {
    return {
      subject: `Cancelación de Webinar: ${webinar.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">Webinar Cancelado</h1>
          
          <p>Lamentamos informarte que el webinar "${webinar.title}" ha sido cancelado.</p>
          
          <div style="background-color: #fff5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p>Si realizaste algún pago, se procesará el reembolso en los próximos días hábiles.</p>
          </div>

          <p>Nos disculpamos por cualquier inconveniente.</p>
        </div>
      `
    };
  }

  getFollowupEmail(webinar) {
    return {
      subject: `Gracias por asistir a ${webinar.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #333;">¡Gracias por tu participación!</h1>
          
          <p>Esperamos que hayas disfrutado el webinar "${webinar.title}".</p>
          
          ${webinar.recordingUrl ? `
            <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Grabación disponible</h3>
              <p>Puedes ver la grabación aquí: <a href="${webinar.recordingUrl}">${webinar.recordingUrl}</a></p>
            </div>
          ` : ''}

          ${webinar.materials.length > 0 ? `
            <div style="background-color: #ebf8ff; padding: 20px; border-radius: 5px; margin: 20px 0;">
              <h3>Materiales del Webinar</h3>
              <ul>
                ${webinar.materials.map(material => `
                  <li><a href="${material.url}">${material.title}</a></li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <div style="margin-top: 20px;">
            <p>Nos encantaría conocer tu opinión:</p>
            <a href="/feedback/${webinar._id}" style="background-color: #4299e1; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
              Dar Feedback
            </a>
          </div>
        </div>
      `
    };
  }

  generateCalendarLink(webinar) {
    // Implementar generación de enlace para calendario
    // Puede ser para Google Calendar, iCal, etc.
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(webinar.title)}&dates=${this.formatDateForCalendar(webinar.date, webinar.duration)}&details=${encodeURIComponent(webinar.description)}`;
  }

  formatDateForCalendar(date, duration) {
    const start = new Date(date);
    const end = new Date(start.getTime() + duration * 60000);
    
    return `${start.toISOString().replace(/-|:|\.\d+/g, '')}/${end.toISOString().replace(/-|:|\.\d+/g, '')}`;
  }
}

module.exports = new EmailService();
