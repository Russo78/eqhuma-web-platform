const Agenda = require('agenda');
const logger = require('../config/logger');
const emailService = require('./emailService');
const Webinar = require('../models/Webinar');

class AgendaService {
  constructor() {
    this.agenda = new Agenda({
      db: {
        address: process.env.MONGODB_URI,
        collection: 'agendaJobs'
      },
      processEvery: '1 minute'
    });

    this.initializeJobs();
  }

  async initializeJobs() {
    // Definir trabajos
    this.agenda.define('send-webinar-reminder', async (job) => {
      try {
        const { webinarId, type } = job.attrs.data;
        await this.sendWebinarReminder(webinarId, type);
      } catch (error) {
        logger.error('Error en trabajo send-webinar-reminder:', error);
      }
    });

    this.agenda.define('check-webinar-status', async (job) => {
      try {
        const { webinarId } = job.attrs.data;
        await this.checkWebinarStatus(webinarId);
      } catch (error) {
        logger.error('Error en trabajo check-webinar-status:', error);
      }
    });

    this.agenda.define('send-followup-email', async (job) => {
      try {
        const { webinarId } = job.attrs.data;
        await this.sendFollowupEmail(webinarId);
      } catch (error) {
        logger.error('Error en trabajo send-followup-email:', error);
      }
    });

    // Iniciar agenda
    await this.agenda.start();
    logger.info('Agenda iniciada');
  }

  async scheduleWebinarJobs(webinar) {
    try {
      const webinarDate = new Date(webinar.date);

      // Programar recordatorio 24 horas antes
      await this.agenda.schedule(
        new Date(webinarDate.getTime() - 24 * 60 * 60 * 1000),
        'send-webinar-reminder',
        {
          webinarId: webinar._id,
          type: '24h'
        }
      );

      // Programar recordatorio 1 hora antes
      await this.agenda.schedule(
        new Date(webinarDate.getTime() - 60 * 60 * 1000),
        'send-webinar-reminder',
        {
          webinarId: webinar._id,
          type: '1h'
        }
      );

      // Programar verificación de estado al inicio del webinar
      await this.agenda.schedule(
        webinarDate,
        'check-webinar-status',
        {
          webinarId: webinar._id
        }
      );

      // Programar email de seguimiento 1 hora después
      await this.agenda.schedule(
        new Date(webinarDate.getTime() + (webinar.duration + 60) * 60 * 1000),
        'send-followup-email',
        {
          webinarId: webinar._id
        }
      );

      logger.info(`Trabajos programados para webinar ${webinar._id}`);
    } catch (error) {
      logger.error('Error al programar trabajos del webinar:', error);
      throw error;
    }
  }

  async cancelWebinarJobs(webinarId) {
    try {
      await this.agenda.cancel({
        'data.webinarId': webinarId
      });
      logger.info(`Trabajos cancelados para webinar ${webinarId}`);
    } catch (error) {
      logger.error('Error al cancelar trabajos del webinar:', error);
      throw error;
    }
  }

  async sendWebinarReminder(webinarId, type) {
    try {
      const webinar = await Webinar.findById(webinarId)
        .populate('registrants', 'email');

      if (!webinar) {
        throw new Error('Webinar no encontrado');
      }

      // Enviar recordatorio a cada registrado
      for (const registrant of webinar.registrants) {
        await emailService.sendWebinarEmail({
          to: registrant.email,
          webinar,
          type: 'reminder'
        });
      }

      logger.info(`Recordatorios enviados para webinar ${webinarId} (${type})`);
    } catch (error) {
      logger.error('Error al enviar recordatorios:', error);
      throw error;
    }
  }

  async checkWebinarStatus(webinarId) {
    try {
      const webinar = await Webinar.findById(webinarId);

      if (!webinar) {
        throw new Error('Webinar no encontrado');
      }

      // Actualizar estado a 'live'
      webinar.status = 'live';
      await webinar.save();

      logger.info(`Estado actualizado a 'live' para webinar ${webinarId}`);
    } catch (error) {
      logger.error('Error al verificar estado del webinar:', error);
      throw error;
    }
  }

  async sendFollowupEmail(webinarId) {
    try {
      const webinar = await Webinar.findById(webinarId)
        .populate('registrants', 'email attended');

      if (!webinar) {
        throw new Error('Webinar no encontrado');
      }

      // Actualizar estado a 'completed'
      webinar.status = 'completed';
      await webinar.save();

      // Enviar email de seguimiento solo a los que asistieron
      const attendees = webinar.registrants.filter(r => r.attended);
      
      for (const attendee of attendees) {
        await emailService.sendWebinarEmail({
          to: attendee.email,
          webinar,
          type: 'followup'
        });
      }

      logger.info(`Emails de seguimiento enviados para webinar ${webinarId}`);
    } catch (error) {
      logger.error('Error al enviar emails de seguimiento:', error);
      throw error;
    }
  }

  async gracefulShutdown() {
    try {
      await this.agenda.stop();
      logger.info('Agenda detenida correctamente');
    } catch (error) {
      logger.error('Error al detener agenda:', error);
      throw error;
    }
  }
}

// Exportar una única instancia
module.exports = new AgendaService();

// Manejar señales de terminación
process.on('SIGTERM', async () => {
  await module.exports.gracefulShutdown();
});

process.on('SIGINT', async () => {
  await module.exports.gracefulShutdown();
});
