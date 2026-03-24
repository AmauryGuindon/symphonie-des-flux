import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  @Cron('0 9 * * *')
  async sendDailyReminders() {
    if (!process.env.SMTP_USER) return;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const appointments = await this.appointmentModel.find({
      date: tomorrowStr,
      status: 'confirmed',
    });

    this.logger.log(`Envoi de ${appointments.length} rappel(s) pour le ${tomorrowStr}`);

    for (const appt of appointments) {
      try {
        await this.transporter.sendMail({
          from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
          to: appt.clientEmail,
          subject: 'Rappel — Votre rendez-vous demain chez Dany1st Barber',
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
              <h2 style="color:#C9A44A">Dany1st Barber</h2>
              <p>Bonjour <strong>${appt.clientName}</strong>,</p>
              <p>Rappel : vous avez un rendez-vous <strong>demain</strong> :</p>
              <table style="border-collapse:collapse;width:100%">
                <tr><td style="padding:8px;color:#555">Prestation</td><td><strong>${appt.serviceType}</strong></td></tr>
                <tr><td style="padding:8px;color:#555">Date</td><td><strong>${appt.date.split('-').reverse().join('/')}</strong></td></tr>
                <tr><td style="padding:8px;color:#555">Heure</td><td><strong>${appt.time}</strong></td></tr>
              </table>
              <p style="color:#888;font-size:13px">Pour annuler ou modifier, connectez-vous à votre espace client.</p>
              <p>À demain,<br><strong>Dany1st Barber</strong></p>
            </div>`,
        });
      } catch (err) {
        this.logger.error(`Échec rappel pour ${appt.clientEmail}`, err);
      }
    }
  }
}
