const nodemailer = require('nodemailer');
require('dotenv').config();

function validateSmtpConfig() {
  const requiredVariables = [
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
  ];

  const missingVariables = requiredVariables.filter(
    (variable) => !process.env[variable]
  );

  if (missingVariables.length > 0) {
    throw new Error(
      `Faltan variables SMTP: ${missingVariables.join(', ')}`
    );
  }
}

function createEmailTransport() {
  validateSmtpConfig();

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function verifyEmailTransport() {
  const transporter = createEmailTransport();
  return transporter.verify();
}

async function sendTransactionalEmail({
  recipient,
  subject,
  text,
  html,
  attachments = [],
}) {
  if (!recipient) {
    throw new Error('El destinatario del correo es obligatorio.');
  }

  if (!subject) {
    throw new Error('El asunto del correo es obligatorio.');
  }

  const transporter = createEmailTransport();

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: recipient,
    subject,
    text,
    html,
    attachments,
  });

  if (!info.messageId) {
    throw new Error('El servidor SMTP no devolvió un messageId.');
  }

  return {
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
    response: info.response,
  };
}

module.exports = {
  createEmailTransport,
  verifyEmailTransport,
  sendTransactionalEmail,
};
