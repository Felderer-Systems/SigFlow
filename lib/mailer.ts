// Copyright (c) 2026 Felderer Systems. Licensed under MIT.
import nodemailer from 'nodemailer';
import { getRuntimeConfig } from '@/lib/runtime-config';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (transporter) {
    return transporter;
  }

  const config = getRuntimeConfig();
  transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    connectionTimeout: config.SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: config.SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: config.SMTP_SOCKET_TIMEOUT_MS,
  });

  return transporter;
}

export async function sendOtpEmail(params: {
  to: string;
  otp: string;
  expiresInMinutes: number;
  appName: string;
  companyName: string;
  legalPrivacyUrl: string;
  legalImprintUrl: string;
}): Promise<void> {
  const config = getRuntimeConfig();
  const mailer = getTransporter();

  const subject = `${params.appName}: Your verification code`;
  const text = [
    `Hello,`,
    '',
    `your one-time password for ${params.appName} is: ${params.otp}`,
    `This code expires in ${params.expiresInMinutes} minutes.`,
    '',
    `If you did not request this code, you can ignore this email.`,
    '',
    `${params.companyName}`,
    `${params.legalPrivacyUrl}`,
    `${params.legalImprintUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#11213a;line-height:1.5;max-width:600px;margin:0 auto;">
      <h2 style="margin-bottom:10px;">${params.appName} Verification</h2>
      <p>Your one-time password is:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:10px 0 20px;">${params.otp}</p>
      <p>This code expires in ${params.expiresInMinutes} minutes.</p>
      <p style="margin-top:20px;">If you did not request this code, you can ignore this email.</p>
      <hr style="border:0;border-top:1px solid #d7dde6;margin:22px 0;" />
      <p style="margin:0;">${params.companyName}</p>
      <p style="margin:4px 0;"><a href="${params.legalPrivacyUrl}" style="color:#005a9c;">Privacy Policy</a> | <a href="${params.legalImprintUrl}" style="color:#005a9c;">Imprint</a></p>
    </div>
  `;

  await mailer.sendMail({
    from: config.SMTP_FROM,
    to: params.to,
    replyTo: config.SMTP_REPLY_TO,
    subject,
    text,
    html,
  });
}
