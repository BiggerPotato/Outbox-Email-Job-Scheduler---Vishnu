import nodemailer from 'nodemailer';

const account = await nodemailer.createTestAccount();
const sender = {
  id: `ethereal-${Date.now()}`,
  name: 'Ethereal test sender',
  host: account.smtp.host,
  port: account.smtp.port,
  secure: account.smtp.secure,
  user: account.user,
  pass: account.pass,
  from: `ReachInbox Demo <${account.user}>`,
};
console.log('Add this sender object to the SMTP_SENDERS_JSON array in your .env file:');
console.log(JSON.stringify(sender, null, 2));
console.log('\nEthereal inbox: https://ethereal.email/login');
