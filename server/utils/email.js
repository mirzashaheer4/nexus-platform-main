const nodemailer = require('nodemailer');

let transporter;

async function initializeMailer() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    // Production: use real SMTP (e.g., Gmail, SendGrid)
    transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE || 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  } else {
    // Development: use Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }
}

async function sendEmail(to, subject, html) {
  if (!transporter) await initializeMailer();
  const info = await transporter.sendMail({
    from: '"Nexus Platform" <noreply@nexus.com>',
    to,
    subject,
    html
  });
  if (process.env.NODE_ENV !== 'production') {
    console.log('Test email URL:', nodemailer.getTestMessageUrl(info));
  }
  return info;
}

module.exports = { initializeMailer, sendEmail };
