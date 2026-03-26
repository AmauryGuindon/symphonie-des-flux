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

  async validateVisitFromAppointment(id: string) {
    const appt = await this.appointmentModel.findById(id);
    if (!appt) throw new BadRequestException('Rendez-vous introuvable');
    if (appt.status !== 'confirmed') throw new BadRequestException('Le rendez-vous doit être confirmé');
    if (appt.visitRecorded) throw new BadRequestException('Visite déjà enregistrée');

    const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
    if (apptDateTime > new Date()) throw new BadRequestException('Le rendez-vous n\'est pas encore passé');

    const config = await this.serviceConfigModel.findOne({ name: appt.serviceType });
    const points = config?.loyaltyPoints ?? 0;

    await this.appointmentModel.findByIdAndUpdate(id, { visitRecorded: true });
    return this.usersService.recordVisit(appt.clientId, points);
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

    const paymentLabels: Record<string, string> = {
      especes: 'Espèces',
      virement: 'Virement bancaire',
      en_ligne: 'Paiement en ligne',
      points: 'Points fidélité',
    };
    const paymentLabel = paymentLabels[appt.paymentMethod] ?? appt.paymentMethod;

    const dur = (appt as any).duration as number | undefined;
    let endTimeStr = '';
    if (dur) {
      const [h, m] = appt.time.split(':').map(Number);
      const endMin = h * 60 + m + dur;
      endTimeStr = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    }

    const row = (label: string, value: string) =>
      `<tr>
        <td style="padding:12px 16px;color:#666;font-size:14px;border-bottom:1px solid #f0f0f0;white-space:nowrap">${label}</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0">${value}</td>
      </tr>`;

    await this.transporter.sendMail({
      from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
      to,
      subject: `Votre RDV du ${dateStr} à ${appt.time} — Dany1st Barber`,
      html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">

    <!-- Header -->
    <div style="background:#1a1a1a;padding:24px 32px;text-align:center">
      <img
        src="${process.env.APP_URL ?? 'http://localhost:4200'}/assets/logo/logo_dany1st.webp"
        alt="Dany1st Barber"
        width="120"
        style="display:block;margin:0 auto 10px;width:120px;height:auto"
      />
      <div style="font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">Barber Shop · Tournan-en-Brie</div>
    </div>

    <!-- Gold bar -->
    <div style="height:3px;background:linear-gradient(90deg,#C9A44A,#e8c870,#C9A44A)"></div>

    <!-- Body -->
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a">Bonjour <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
        Votre rendez-vous a bien été enregistré. Nous avons hâte de vous accueillir !
      </p>

      <!-- Details card -->
      <div style="background:#fafafa;border:1px solid #ebebeb;border-radius:6px;overflow:hidden;margin-bottom:24px">
        <div style="background:#C9A44A;padding:10px 16px">
          <span style="font-size:11px;font-weight:700;letter-spacing:2px;color:#1a1a1a;text-transform:uppercase">Récapitulatif</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          ${row('Prestation', appt.serviceType)}
          ${row('Date', dateStr)}
          ${row('Heure', endTimeStr ? `${appt.time} – ${endTimeStr}` : appt.time)}
          ${row('Règlement', paymentLabel)}
        </table>
      </div>

      <!-- CTA -->
      <div style="text-align:center;margin-bottom:24px">
        <a href="${process.env.APP_URL ?? 'http://localhost:4200'}/appointment"
           style="display:inline-block;background:#C9A44A;color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;padding:12px 28px;border-radius:4px;text-transform:uppercase">
          Gérer mon rendez-vous
        </a>
      </div>

      <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;text-align:center">
        Besoin d'annuler ou de reporter ? Connectez-vous à votre espace client<br>jusqu'à 24h avant votre rendez-vous.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8f8f8;border-top:1px solid #ebebeb;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#bbb;letter-spacing:0.5px">
        © Dany1st Barber · Tournan-en-Brie
      </p>
    </div>

  </div>
</body>
</html>
      `,
    });
  }
}
