import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { Appointment, AppointmentDocument } from './schemas/appointment.schema';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { UpdateAppointmentDto } from './dto/update-appointment.dto';
import { ScheduleService } from '../schedule/schedule.service';
import { UsersService } from '../users/users.service';
import { ServiceConfig, ServiceConfigDocument } from '../services/schemas/service-config.schema';

@Injectable()
export class AppointmentsService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(ServiceConfig.name) private serviceConfigModel: Model<ServiceConfigDocument>,
    private scheduleService: ScheduleService,
    private usersService: UsersService,
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

  async getAvailableSlots(date: string, serviceType?: string) {
    const cfg = await this.scheduleService.getConfig();
    const d = new Date(date + 'T00:00:00');
    const weekday = d.getDay();

    // Closed if weekday not in openDays or date is an exceptional closure
    if (!cfg.openDays.includes(weekday) || cfg.closedDates.includes(date)) {
      return { date, slots: [], closed: true };
    }

    // Service duration for the requested service (defaults to slotDuration)
    let serviceDuration = cfg.slotDuration;
    if (serviceType) {
      const svc = await this.serviceConfigModel.findOne({ name: serviceType });
      if (svc?.duration) serviceDuration = svc.duration;
    }

    // Break window in minutes
    const breakStartMin = cfg.breakStart ? (() => {
      const [h, m] = cfg.breakStart.split(':').map(Number);
      return h * 60 + m;
    })() : -1;
    const breakEndMin = cfg.breakEnd ? (() => {
      const [h, m] = cfg.breakEnd.split(':').map(Number);
      return h * 60 + m;
    })() : -1;

    const allSlots = this.scheduleService.generateSlots(cfg);
    const booked = await this.appointmentModel
      .find({ date, status: { $ne: 'cancelled' } })
      .select('time duration serviceType');

    // Resolve each booked appointment to a [start, end) interval in minutes
    const blockedIntervals: { start: number; end: number }[] = await Promise.all(
      booked.map(async (a) => {
        let dur: number = (a as any).duration ?? 0;
        if (!dur) {
          const svcCfg = await this.serviceConfigModel.findOne({ name: a.serviceType });
          dur = svcCfg?.duration ?? cfg.slotDuration;
        }
        const [h, m] = a.time.split(':').map(Number);
        const start = h * 60 + m;
        return { start, end: start + dur };
      }),
    );

    const slots = allSlots.map(time => {
      const [h, m] = time.split(':').map(Number);
      const slotStart = h * 60 + m;
      const slotEnd = slotStart + serviceDuration;

      // Service window must not overlap with the break
      if (breakStartMin >= 0 && slotStart < breakEndMin && slotEnd > breakStartMin) {
        return { time, available: false };
      }

      // Service window must not overlap with any booked appointment
      const hasConflict = blockedIntervals.some(
        iv => slotStart < iv.end && slotEnd > iv.start,
      );
      return { time, available: !hasConflict };
    });

    return { date, slots, closed: false };
  }

  // ── Client : créer un RDV ──────────────────────────────────────────────────

  async createAppointment(
    clientId: string,
    clientName: string,
    clientEmail: string,
    dto: CreateAppointmentDto,
  ) {
    // Look up service config (needed for points and duration)
    const svcCfg = await this.serviceConfigModel.findOne({ name: dto.serviceType });

    // Duration-based conflict check
    const cfg = await this.scheduleService.getConfig();
    const serviceDuration = svcCfg?.duration ?? cfg.slotDuration;
    const [newH, newM] = dto.time.split(':').map(Number);
    const newStart = newH * 60 + newM;
    const newEnd = newStart + serviceDuration;

    const dayBooked = await this.appointmentModel
      .find({ date: dto.date, status: { $ne: 'cancelled' } })
      .select('time duration serviceType');

    for (const a of dayBooked) {
      let dur: number = (a as any).duration ?? 0;
      if (!dur) {
        const s = await this.serviceConfigModel.findOne({ name: a.serviceType });
        dur = s?.duration ?? cfg.slotDuration;
      }
      const [h, m] = a.time.split(':').map(Number);
      const aStart = h * 60 + m;
      if (newStart < aStart + dur && newEnd > aStart) {
        throw new Error('Ce créneau n\'est plus disponible.');
      }
    }

    // Paiement par points : vérifier et déduire avant de créer le RDV
    if (dto.paymentMethod === 'points') {
      if (!svcCfg) throw new BadRequestException('Prestation introuvable.');
      const required = svcCfg.price * 10;
      await this.usersService.redeemPoints(clientId, required);
    }

    const appointment = await this.appointmentModel.create({
      clientId,
      clientName,
      clientEmail,
      serviceType: dto.serviceType,
      date: dto.date,
      time: dto.time,
      notes: dto.notes,
      paymentMethod: dto.paymentMethod ?? 'especes',
      status: 'pending',
      duration: serviceDuration,
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

  async rescheduleMyAppointment(id: string, clientId: string, date: string, time: string) {
    // Vérifier que le créneau cible est disponible
    const conflict = await this.appointmentModel.findOne({
      date, time, status: { $ne: 'cancelled' }, _id: { $ne: id },
    });
    if (conflict) throw new Error('Ce créneau n\'est plus disponible.');

    return this.appointmentModel.findOneAndUpdate(
      { _id: id, clientId },
      { date, time, status: 'pending' },
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
