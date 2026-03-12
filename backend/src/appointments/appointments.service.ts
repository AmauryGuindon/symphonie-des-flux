import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';

// Working hours: Mon–Sat 9h–19h, 60-min slots
const WORK_START = 9;
const WORK_END   = 19;
const SLOT_MIN   = 60;
const CLOSED_WEEKDAY = 0; // Sunday = 0

function generateSlots(): string[] {
  const slots: string[] = [];
  for (let h = WORK_START; h < WORK_END; h++) {
    for (let m = 0; m < 60; m += SLOT_MIN) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }
  return slots;
}

@Injectable()
export class AppointmentsService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // ── Slots disponibles ──────────────────────────────────────────────────────

  async getAvailableSlots(date: string) {
    const d = new Date(date);
    // Close on Sunday
    if (d.getUTCDay() === CLOSED_WEEKDAY) return { date, slots: [], closed: true };

    const allSlots = generateSlots();
    const booked = await this.appointmentModel
      .find({ date, status: { $ne: 'cancelled' } })
      .select('time');

    const bookedTimes = new Set(booked.map(a => a.time));
    const slots = allSlots.map(time => ({
      time,
      available: !bookedTimes.has(time),
    }));

    return { date, slots, closed: false };
  }

  // ── Client : créer un RDV ──────────────────────────────────────────────────

  async createAppointment(
    clientId: string,
    clientName: string,
    clientEmail: string,
    dto: CreateAppointmentDto,
  ) {
    const existing = await this.appointmentModel.findOne({
      date: dto.date,
      time: dto.time,
      status: { $ne: 'cancelled' },
    });
    if (existing) throw new Error('Ce créneau n\'est plus disponible.');

    const appointment = await this.appointmentModel.create({
      clientId,
      clientName,
      clientEmail,
      serviceType: dto.serviceType,
      date: dto.date,
      time: dto.time,
      notes: dto.notes,
      status: 'pending',
    });

    this.sendConfirmationEmail(clientEmail, clientName, appointment).catch(() => {});
    return appointment;
  }

  // ── Client : ses RDV ──────────────────────────────────────────────────────

  async getMyAppointments(clientId: string) {
    return this.appointmentModel
      .find({ clientId })
      .sort({ date: -1, time: -1 });
  }

  async cancelMyAppointment(id: string, clientId: string) {
    return this.appointmentModel.findOneAndUpdate(
      { _id: id, clientId },
      { status: 'cancelled' },
      { new: true },
    );
  }

  // ── Admin ──────────────────────────────────────────────────────────────────

  async getAllAppointments(from?: string, to?: string) {
    const query: Record<string, unknown> = {};
    if (from || to) {
      query['date'] = {};
      if (from) (query['date'] as Record<string, string>)['$gte'] = from;
      if (to)   (query['date'] as Record<string, string>)['$lte'] = to;
    }
    return this.appointmentModel.find(query).sort({ date: 1, time: 1 });
  }

  async updateAppointment(id: string, dto: UpdateAppointmentDto) {
    return this.appointmentModel.findByIdAndUpdate(id, dto, { new: true });
  }

  async deleteAppointment(id: string) {
    return this.appointmentModel.findByIdAndDelete(id);
  }

  // ── Email confirmation ─────────────────────────────────────────────────────

  private async sendConfirmationEmail(
    to: string,
    name: string,
    appt: AppointmentDocument,
  ) {
    if (!process.env.SMTP_USER) return;
    const [year, month, day] = appt.date.split('-');
    const dateStr = `${day}/${month}/${year}`;

    await this.transporter.sendMail({
      from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
      to,
      subject: 'Confirmation de votre rendez-vous — Dany1st Barber',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
          <h2 style="color:#C9A44A">Dany1st Barber</h2>
          <p>Bonjour <strong>${name}</strong>,</p>
          <p>Votre rendez-vous a bien été enregistré :</p>
          <table style="border-collapse:collapse;width:100%">
            <tr><td style="padding:8px;color:#555">Prestation</td><td style="padding:8px"><strong>${appt.serviceType}</strong></td></tr>
            <tr><td style="padding:8px;color:#555">Date</td><td style="padding:8px"><strong>${dateStr}</strong></td></tr>
            <tr><td style="padding:8px;color:#555">Heure</td><td style="padding:8px"><strong>${appt.time}</strong></td></tr>
          </table>
          <p style="color:#888;font-size:13px">Si vous souhaitez modifier ou annuler votre rendez-vous, connectez-vous à votre espace client.</p>
          <p>À bientôt,<br><strong>Dany1st Barber</strong><br>Tournan-en-Brie</p>
        </div>
      `,
    });
  }
}
