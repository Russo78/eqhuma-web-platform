// src/utils/emailService.js
const nodemailer = require('nodemailer');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const handlebars = require('handlebars');

/**
 * Email Service for sending various notifications related to webinars
 */
class EmailService {
  constructor() {
    this.transporter = null;
    this.emailTemplates = {};
    this.initialize();
  }

  /**
   * Initialize email transporter and load templates
   */
  initialize() {
    // Only initialize if SMTP settings are provided
    if (config.smtp.host && config.smtp.user && config.smtp.pass) {
      this.transporter = nodemailer.createTransport({
        host: config.smtp.host,
        port: config.smtp.port,
        secure: config.smtp.port === 465, // true for 465, false for other ports
        auth: {
          user: config.smtp.user,
          pass: config.smtp.pass,
        },
      });

      // Test connection
      this.transporter.verify()
        .then(() => {
          console.log('SMTP server connection established successfully');
          this.loadTemplates();
        })
        .catch((error) => {
          console.error('Error connecting to SMTP server:', error);
          this.transporter = null;
        });
    } else {
      console.warn('Email service not configured. Missing SMTP settings.');
    }
  }

  /**
   * Load email templates from file system
   */
  loadTemplates() {
    try {
      const templatesDir = path.join(__dirname, '..', 'templates', 'emails');
      
      // Create templates directory if it doesn't exist
      if (!fs.existsSync(templatesDir)) {
        fs.mkdirSync(templatesDir, { recursive: true });
        this.createDefaultTemplates(templatesDir);
      }
      
      // Load all template files
      const templateFiles = fs.readdirSync(templatesDir);
      
      templateFiles.forEach(file => {
        if (file.endsWith('.hbs')) {
          const templateName = path.basename(file, '.hbs');
          const templateContent = fs.readFileSync(path.join(templatesDir, file), 'utf8');
          this.emailTemplates[templateName] = handlebars.compile(templateContent);
        }
      });
      
      console.log(`Loaded ${Object.keys(this.emailTemplates).length} email templates`);
    } catch (error) {
      console.error('Error loading email templates:', error);
    }
  }

  /**
   * Create default email templates if they don't exist
   * @param {string} templatesDir - Directory path for templates
   */
  createDefaultTemplates(templatesDir) {
    const defaultTemplates = {
      'webinar-registration': `
        <h1>Registration Confirmation</h1>
        <p>Hello {{name}},</p>
        <p>Thank you for registering for the webinar: <strong>{{webinarTitle}}</strong></p>
        <p><strong>Date:</strong> {{webinarDate}}</p>
        <p><strong>Time:</strong> {{webinarTime}} ({{webinarTimeZone}})</p>
        <p>You will receive a reminder email with the webinar link before the event.</p>
        <p>If you have any questions, please contact us.</p>
        <p>Best regards,<br>EQHuma Team</p>
      `,
      'webinar-reminder': `
        <h1>Webinar Reminder</h1>
        <p>Hello {{name}},</p>
        <p>This is a reminder that you are registered for the webinar: <strong>{{webinarTitle}}</strong></p>
        <p><strong>Date:</strong> {{webinarDate}}</p>
        <p><strong>Time:</strong> {{webinarTime}} ({{webinarTimeZone}})</p>
        <p><strong>Join Link:</strong> <a href="{{webinarUrl}}">Click here to join the webinar</a></p>
        <p>We look forward to seeing you there!</p>
        <p>Best regards,<br>EQHuma Team</p>
      `,
      'webinar-followup': `
        <h1>Thank You for Attending</h1>
        <p>Hello {{name}},</p>
        <p>Thank you for attending our webinar: <strong>{{webinarTitle}}</strong></p>
        <p>We hope you found the session informative and valuable.</p>
        {{#if recordingUrl}}
        <p><strong>Recording:</strong> <a href="{{recordingUrl}}">View the recording</a></p>
        {{/if}}
        <p>We would appreciate your feedback. Please take a moment to complete our <a href="{{feedbackUrl}}">feedback survey</a>.</p>
        <p>Best regards,<br>EQHuma Team</p>
      `,
      'webinar-certificate': `
        <h1>Your Certificate of Completion</h1>
        <p>Hello {{name}},</p>
        <p>Congratulations on completing the webinar: <strong>{{webinarTitle}}</strong></p>
        <p>We have attached your certificate of completion to this email.</p>
        <p>You can also download your certificate by visiting your account dashboard.</p>
        <p>Best regards,<br>EQHuma Team</p>
      `
    };

    // Create each template file
    for (const [name, content] of Object.entries(defaultTemplates)) {
      fs.writeFileSync(path.join(templatesDir, `${name}.hbs`), content);
    }

    console.log('Created default email templates');
  }

  /**
   * Send an email
   * @param {Object} mailOptions - Email options
   * @returns {Promise} - Email sending result
   */
  async sendEmail(mailOptions) {
    if (!this.transporter) {
      console.warn('Email service not available');
      return false;
    }

    try {
      // Add default sender if not specified
      if (!mailOptions.from) {
        mailOptions.from = config.emailFrom;
      }

      const result = await this.transporter.sendMail(mailOptions);
      console.log('Email sent:', result.messageId);
      return result;
    } catch (error) {
      console.error('Error sending email:', error);
      throw error;
    }
  }

  /**
   * Send webinar registration confirmation email
   * @param {Object} user - User receiving the email
   * @param {Object} webinar - Webinar data
   * @returns {Promise} - Email sending result
   */
  async sendRegistrationConfirmation(user, webinar) {
    if (!this.transporter) return false;

    try {
      const startDate = new Date(webinar.startDate);
      const template = this.emailTemplates['webinar-registration'];
      
      if (!template) {
        throw new Error('Registration email template not found');
      }

      const htmlContent = template({
        name: user.userName,
        webinarTitle: webinar.title,
        webinarDate: startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        webinarTime: startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        webinarTimeZone: webinar.timeZone,
        instructorName: webinar.instructorName
      });

      const mailOptions = {
        to: user.email,
        subject: `Registration Confirmation: ${webinar.title}`,
        html: htmlContent
      };

      return this.sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending registration email:', error);
      return false;
    }
  }

  /**
   * Send webinar reminder email
   * @param {Object} registration - Registration data
   * @param {Object} webinar - Webinar data
   * @returns {Promise} - Email sending result
   */
  async sendWebinarReminder(registration, webinar) {
    if (!this.transporter) return false;

    try {
      const startDate = new Date(webinar.startDate);
      const template = this.emailTemplates['webinar-reminder'];
      
      if (!template) {
        throw new Error('Reminder email template not found');
      }

      const htmlContent = template({
        name: registration.userName,
        webinarTitle: webinar.title,
        webinarDate: startDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        webinarTime: startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        webinarTimeZone: webinar.timeZone,
        webinarUrl: webinar.meetingUrl || webinar.registrationUrl,
        instructorName: webinar.instructorName
      });

      const mailOptions = {
        to: registration.email,
        subject: `Reminder: ${webinar.title} starts soon`,
        html: htmlContent
      };

      return this.sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending reminder email:', error);
      return false;
    }
  }

  /**
   * Send follow-up email after webinar completion
   * @param {Object} registration - Registration data
   * @param {Object} webinar - Webinar data
   * @param {Object} recording - Optional recording data if available
   * @returns {Promise} - Email sending result
   */
  async sendFollowUpEmail(registration, webinar, recording = null) {
    if (!this.transporter) return false;

    try {
      const template = this.emailTemplates['webinar-followup'];
      
      if (!template) {
        throw new Error('Follow-up email template not found');
      }

      // Generate feedback URL
      const feedbackBaseUrl = config.frontendUrl;
      const feedbackUrl = `${feedbackBaseUrl}/feedback/${webinar._id}?registrationId=${registration._id}`;
      
      const htmlContent = template({
        name: registration.userName,
        webinarTitle: webinar.title,
        recordingUrl: recording ? `${config.frontendUrl}/recordings/${recording._id}` : null,
        feedbackUrl: feedbackUrl
      });

      const mailOptions = {
        to: registration.email,
        subject: `Thank you for attending: ${webinar.title}`,
        html: htmlContent
      };

      return this.sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending follow-up email:', error);
      return false;
    }
  }

  /**
   * Send certificate of completion email
   * @param {Object} registration - Registration data
   * @param {Object} webinar - Webinar data
   * @param {String} certificateUrl - URL to download certificate
   * @param {Buffer} certificatePdf - PDF buffer of the certificate
   * @returns {Promise} - Email sending result
   */
  async sendCertificateEmail(registration, webinar, certificateUrl, certificatePdf) {
    if (!this.transporter) return false;

    try {
      const template = this.emailTemplates['webinar-certificate'];
      
      if (!template) {
        throw new Error('Certificate email template not found');
      }

      const htmlContent = template({
        name: registration.userName,
        webinarTitle: webinar.title,
        certificateUrl: certificateUrl
      });

      const mailOptions = {
        to: registration.email,
        subject: `Your Certificate for ${webinar.title}`,
        html: htmlContent,
        attachments: [
          {
            filename: `${registration.userName.replace(/\s+/g, '-')}-certificate.pdf`,
            content: certificatePdf,
            contentType: 'application/pdf'
          }
        ]
      };

      return this.sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending certificate email:', error);
      return false;
    }
  }

  /**
   * Send webinar cancellation notice
   * @param {Object} registration - Registration data
   * @param {Object} webinar - Webinar data
   * @param {String} reason - Optional cancellation reason
   * @returns {Promise} - Email sending result
   */
  async sendCancellationNotice(registration, webinar, reason = '') {
    if (!this.transporter) return false;

    try {
      const htmlContent = `
        <h1>Webinar Cancellation</h1>
        <p>Hello ${registration.userName},</p>
        <p>We regret to inform you that the webinar <strong>${webinar.title}</strong> has been cancelled.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>We apologize for any inconvenience this may cause.</p>
        <p>Best regards,<br>EQHuma Team</p>
      `;

      const mailOptions = {
        to: registration.email,
        subject: `Cancellation Notice: ${webinar.title}`,
        html: htmlContent
      };

      return this.sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending cancellation email:', error);
      return false;
    }
  }

  /**
   * Send webinar rescheduling notice
   * @param {Object} registration - Registration data
   * @param {Object} webinar - Updated webinar data
   * @param {Date} originalStartDate - Original webinar date
   * @returns {Promise} - Email sending result
   */
  async sendReschedulingNotice(registration, webinar, originalStartDate) {
    if (!this.transporter) return false;

    try {
      const newStartDate = new Date(webinar.startDate);
      const originalDate = new Date(originalStartDate);
      
      const htmlContent = `
        <h1>Webinar Rescheduled</h1>
        <p>Hello ${registration.userName},</p>
        <p>We would like to inform you that the webinar <strong>${webinar.title}</strong> has been rescheduled.</p>
        <p><strong>Original Date/Time:</strong> ${originalDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 
        at ${originalDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (${webinar.timeZone})</p>
        <p><strong>New Date/Time:</strong> ${newStartDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} 
        at ${newStartDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} (${webinar.timeZone})</p>
        <p>Your registration for this webinar is still valid. You will receive a reminder email before the event.</p>
        <p>If you are unable to attend at the new time, you can cancel your registration by visiting your dashboard.</p>
        <p>We apologize for any inconvenience this may cause.</p>
        <p>Best regards,<br>EQHuma Team</p>
      `;

      const mailOptions = {
        to: registration.email,
        subject: `Rescheduling Notice: ${webinar.title}`,
        html: htmlContent
      };

      return this.sendEmail(mailOptions);
    } catch (error) {
      console.error('Error sending rescheduling email:', error);
      return false;
    }
  }
}

// Create and export a singleton instance
const emailService = new EmailService();
module.exports = emailService;