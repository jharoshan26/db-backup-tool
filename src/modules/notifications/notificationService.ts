import nodemailer from 'nodemailer';
import { prisma } from '@/lib/prisma';
import { config } from '@/config';
import { logger } from '@/lib/logger';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
    });
  }
  return transporter;
}

/** Create an in-app notification and optionally deliver via email. */
export async function notifyUser(params: {
  userId: string;
  subject: string;
  body: string;
  channel?: 'email' | 'inapp';
}): Promise<void> {
  const channel = params.channel ?? 'inapp';
  const notification = await prisma.notification.create({
    data: { userId: params.userId, subject: params.subject, body: params.body, channel, status: 'pending' },
  });

  if (channel === 'email') {
    const user = await prisma.user.findUnique({ where: { id: params.userId } });
    const tx = getTransporter();
    if (user && tx) {
      try {
        await tx.sendMail({ from: config.smtp.from, to: user.email, subject: params.subject, text: params.body });
        await prisma.notification.update({ where: { id: notification.id }, data: { status: 'sent' } });
        return;
      } catch (err) {
        logger.error({ err }, 'failed to send email notification');
        await prisma.notification.update({ where: { id: notification.id }, data: { status: 'failed' } });
        return;
      }
    }
  }
  await prisma.notification.update({ where: { id: notification.id }, data: { status: 'sent' } });
}

/** Notify the actor of a job about its terminal outcome. */
export async function notifyJobOutcome(jobId: string, ok: boolean, summary: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job?.actorId) return;
  await notifyUser({
    userId: job.actorId,
    subject: `${job.type} ${ok ? 'completed' : 'failed'}`,
    body: summary,
    channel: 'inapp',
  });
}
