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
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { computeTier } from '../common/enums/role.enum';

@Injectable()
export class AppointmentsService {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    @InjectModel(ServiceConfig.name) private serviceConfigModel: Model<ServiceConfigDocument>,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    private scheduleService: ScheduleService,
    private usersService: UsersService,
    private notificationsService: NotificationsService,
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

    // Pour aujourd'hui : calcul des minutes actuelles pour bloquer les créneaux passés
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const isToday = date === todayStr;
    const currentMinutes = isToday ? now.getHours() * 60 + now.getMinutes() : -1;

    const slots = allSlots.map(time => {
      const [h, m] = time.split(':').map(Number);
      const slotStart = h * 60 + m;
      const slotEnd = slotStart + serviceDuration;

      // Créneau passé (aujourd'hui seulement)
      if (isToday && slotStart <= currentMinutes) {
        return { time, available: false };
      }

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
      price: svcCfg?.price ?? 0,
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
    const appt = await this.appointmentModel.findOne({ _id: id, clientId });
    if (appt && appt.paymentMethod === 'points' && appt.price > 0) {
      await this.usersService.refundPoints(clientId, appt.price * 10);
    }
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
    if (dto.status === 'cancelled') {
      const appt = await this.appointmentModel.findById(id);
      if (appt && appt.paymentMethod === 'points' && appt.price > 0) {
        await this.usersService.refundPoints(appt.clientId, appt.price * 10);
      }
    }
    if (dto.status === 'confirmed') {
      const appt = await this.appointmentModel.findById(id);
      if (appt) {
        const dateFormatted = appt.date.split('-').reverse().join('/');
        await this.notificationsService.create(
          appt.clientId,
          'appointment_confirmed',
          `Votre RDV du ${dateFormatted} à ${appt.time} est confirmé ✓`,
        );
      }
    }
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

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (appt.date > todayStr) throw new BadRequestException('Le rendez-vous n\'est pas encore passé');

    const config = await this.serviceConfigModel.findOne({ name: appt.serviceType });
    const points = config?.loyaltyPoints ?? 0;
    const price = config?.price ?? 0;

    // Créer l'entrée dans l'historique des visites
    await this.visitModel.create({
      clientId: appt.clientId,
      clientName: appt.clientName,
      serviceType: appt.serviceType,
      price,
      paymentMethod: appt.paymentMethod,
      visitDate: appt.date,
      pointsEarned: points,
    });

    await this.appointmentModel.findByIdAndUpdate(id, { visitRecorded: true });
    const updatedUser = await this.usersService.recordVisit(appt.clientId, points, `Prestation : ${appt.serviceType}`);

    // Notification points gagnés
    if (points > 0) {
      await this.notificationsService.create(
        appt.clientId,
        'points_earned',
        `+${points} points gagnés pour votre prestation "${appt.serviceType}" !`,
      );
    }

    // Notification + email changement de palier
    const tierLabels: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine' };
    const tierBefore = computeTier(updatedUser.visitCount - 1);
    const tierAfter  = computeTier(updatedUser.visitCount);
    if (tierBefore !== tierAfter) {
      await this.notificationsService.create(
        appt.clientId,
        'tier_up',
        `Félicitations ! Vous passez au palier ${tierLabels[tierAfter] ?? tierAfter} 🎉`,
      );
      await this.sendTierUpEmail(appt.clientEmail, appt.clientName, tierAfter);
    }

    return updatedUser;
  }

  // ── Annulation pour fermeture exceptionnelle ──────────────────────────────

  async cancelDueToClosure(newClosedDates: string[]): Promise<void> {
    if (!newClosedDates.length) return;

    const affected = await this.appointmentModel.find({
      date: { $in: newClosedDates },
      status: { $in: ['pending', 'confirmed'] },
    });

    for (const appt of affected) {
      await this.appointmentModel.findByIdAndUpdate(appt._id, { status: 'cancelled' });

      const dateStr = appt.date.split('-').reverse().join('/');

      // Notification in-app
      await this.notificationsService.create(
        appt.clientId,
        'appointment_cancelled',
        `Votre RDV du ${dateStr} (${appt.serviceType}) a été annulé — le salon sera fermé ce jour-là. Reprogrammez en cliquant ici.`,
      );

      // Email
      await this.sendCancellationEmail(appt.clientEmail, appt.clientName, appt.date, appt.time, appt.serviceType);
    }
  }

  private async sendTierUpEmail(to: string, name: string, tier: string) {
    if (!process.env.SMTP_USER) return;
    const accountUrl = `${process.env.APP_URL ?? 'http://localhost:4200'}/account`;
    const tierLabels: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine' };
    const tierColors: Record<string, string> = { bronze: '#cd7f32', silver: '#c0c0c0', gold: '#C9A44A', platinum: '#e8f4ff' };
    const tierPerks: Record<string, string[]> = {
      bronze:   ['Points de prestation + 5 pts bonus/visite', 'Bonus anniversaire (+15 pts)', 'Code de parrainage'],
      silver:   ['Points de prestation + 10 pts bonus/visite', 'Accès aux offres promotionnelles', 'Bonus anniversaire (+15 pts)'],
      gold:     ['Points de prestation + 15 pts bonus/visite', 'Priorité sur les créneaux', 'Bonus anniversaire (+15 pts)'],
      platinum: ['Points de prestation + 20 pts bonus/visite', 'Accès VIP', 'Bonus anniversaire (+15 pts)'],
    };
    const tierLabel = tierLabels[tier] ?? tier;
    const tierColor = tierColors[tier] ?? '#C9A44A';
    const perks = tierPerks[tier] ?? [];
    const perksHtml = perks.map(p => `<li style="padding:4px 0;font-size:14px;color:#444">✓ ${p}</li>`).join('');

    try {
      await this.transporter.sendMail({
        from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
        to,
        subject: `Félicitations ! Vous êtes maintenant ${tierLabel} — Dany1st Barber`,
        html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a1a1a;padding:24px 32px;text-align:center">
      <img src="${process.env.APP_URL ?? 'http://localhost:4200'}/assets/logo/logo_dany1st.webp" alt="Dany1st Barber" width="120" style="display:block;margin:0 auto 10px;width:120px;height:auto" />
      <div style="font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">Barber Shop · Tournan-en-Brie</div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,${tierColor},${tierColor}aa,${tierColor})"></div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a">Bonjour <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
        Grâce à votre fidélité, vous venez de franchir un nouveau palier !
      </p>
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-block;background:#1a1a1a;border-radius:8px;padding:20px 40px">
          <div style="font-size:11px;letter-spacing:3px;color:#888;text-transform:uppercase;margin-bottom:8px">Nouveau palier</div>
          <div style="font-size:28px;font-weight:700;color:${tierColor};letter-spacing:2px;text-transform:uppercase">${tierLabel}</div>
        </div>
      </div>
      <div style="background:#fafafa;border:1px solid #ebebeb;border-radius:6px;overflow:hidden;margin-bottom:24px">
        <div style="background:#1a1a1a;padding:10px 16px">
          <span style="font-size:11px;font-weight:700;letter-spacing:2px;color:${tierColor};text-transform:uppercase">Vos avantages</span>
        </div>
        <ul style="margin:0;padding:16px 16px 16px 32px;list-style:none">
          ${perksHtml}
        </ul>
      </div>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${accountUrl}" style="display:inline-block;background:${tierColor};color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;padding:12px 28px;border-radius:4px;text-transform:uppercase">
          Voir mon compte
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;text-align:center">
        Merci de votre confiance. À très bientôt !
      </p>
    </div>
    <div style="background:#f8f8f8;border-top:1px solid #ebebeb;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#bbb;letter-spacing:0.5px">© Dany1st Barber · Tournan-en-Brie</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (_) {}
  }

  private async sendCancellationEmail(
    to: string,
    name: string,
    date: string,
    time: string,
    serviceType: string,
  ) {
    if (!process.env.SMTP_USER) return;
    const dateStr = date.split('-').reverse().join('/');
    const accountUrl = `${process.env.APP_URL ?? 'http://localhost:4200'}/appointment`;

    try {
      await this.transporter.sendMail({
        from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
        to,
        subject: `Annulation de votre RDV du ${dateStr} — Dany1st Barber`,
        html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)">
    <div style="background:#1a1a1a;padding:24px 32px;text-align:center">
      <img src="${process.env.APP_URL ?? 'http://localhost:4200'}/assets/logo/logo_dany1st.webp" alt="Dany1st Barber" width="120" style="display:block;margin:0 auto 10px;width:120px;height:auto" />
      <div style="font-size:11px;letter-spacing:2px;color:#888;text-transform:uppercase">Barber Shop · Tournan-en-Brie</div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#C9A44A,#e8c870,#C9A44A)"></div>
    <div style="padding:32px">
      <p style="margin:0 0 8px;font-size:16px;color:#1a1a1a">Bonjour <strong>${name}</strong>,</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
        Nous sommes désolés de vous informer que votre rendez-vous a dû être annulé en raison d'une <strong>fermeture exceptionnelle</strong> du salon ce jour-là.
      </p>
      <div style="background:#fafafa;border:1px solid #ebebeb;border-radius:6px;overflow:hidden;margin-bottom:24px">
        <div style="background:#e74c3c;padding:10px 16px">
          <span style="font-size:11px;font-weight:700;letter-spacing:2px;color:#fff;text-transform:uppercase">Rendez-vous annulé</span>
        </div>
        <table style="width:100%;border-collapse:collapse">
          <tr><td style="padding:12px 16px;color:#666;font-size:14px;border-bottom:1px solid #f0f0f0">Prestation</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0">${serviceType}</td></tr>
          <tr><td style="padding:12px 16px;color:#666;font-size:14px;border-bottom:1px solid #f0f0f0">Date</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1a1a1a;border-bottom:1px solid #f0f0f0">${dateStr}</td></tr>
          <tr><td style="padding:12px 16px;color:#666;font-size:14px">Heure</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1a1a1a">${time}</td></tr>
        </table>
      </div>
      <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6">
        Nous vous invitons à reprogrammer votre rendez-vous à une date qui vous convient.
      </p>
      <div style="text-align:center;margin-bottom:24px">
        <a href="${accountUrl}" style="display:inline-block;background:#C9A44A;color:#1a1a1a;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:1px;padding:12px 28px;border-radius:4px;text-transform:uppercase">
          Reprogrammer mon RDV
        </a>
      </div>
      <p style="margin:0;font-size:12px;color:#aaa;line-height:1.6;text-align:center">
        Toutes nos excuses pour la gêne occasionnée.
      </p>
    </div>
    <div style="background:#f8f8f8;border-top:1px solid #ebebeb;padding:16px 32px;text-align:center">
      <p style="margin:0;font-size:11px;color:#bbb;letter-spacing:0.5px">© Dany1st Barber · Tournan-en-Brie</p>
    </div>
  </div>
</body>
</html>`,
      });
    } catch (_) {}
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
