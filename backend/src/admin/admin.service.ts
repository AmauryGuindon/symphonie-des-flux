import { BadRequestException, ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as nodemailer from 'nodemailer';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { ServiceConfig, ServiceConfigDocument } from '../services/schemas/service-config.schema';
import { Appointment, AppointmentDocument } from '../appointments/schemas/appointment.schema';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { RecordVisitDto } from './dto/record-visit.dto';
import { UpdateServiceConfigDto } from './dto/update-service-config.dto';
import { CreateManualVisitDto } from './dto/create-manual-visit.dto';
import { SendNewsletterDto } from './dto/send-newsletter.dto';
import { LOYALTY_POINTS_PER_VISIT, LOYALTY_TIER_BONUS, computeTier } from '../common/enums/role.enum';

const DEFAULT_SERVICES = [
  { name: 'Coupe + Taille de Barbe',      price: 25, loyaltyPoints: 13, duration: 55 },
  { name: 'Coupe adulte',                 price: 20, loyaltyPoints: 10, duration: 40 },
  { name: 'Taille de barbe',              price: 15, loyaltyPoints: 8,  duration: 30 },
  { name: 'Coupe enfant (4 à 12ans)',     price: 12, loyaltyPoints: 6,  duration: 30 },
  { name: 'Contours (Cheveux ou Barbe)',  price: 8,  loyaltyPoints: 4,  duration: 15 },
];

@Injectable()
export class AdminService implements OnModuleInit {
  private transporter: nodemailer.Transporter;

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    @InjectModel(ServiceConfig.name) private serviceConfigModel: Model<ServiceConfigDocument>,
    @InjectModel(Appointment.name) private appointmentModel: Model<AppointmentDocument>,
    private usersService: UsersService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }

  async onModuleInit() {
    for (const s of DEFAULT_SERVICES) {
      await this.serviceConfigModel.findOneAndUpdate(
        { name: s.name },
        { $set: { price: s.price, duration: s.duration }, $setOnInsert: { name: s.name, active: true, loyaltyPoints: s.loyaltyPoints } },
        { upsert: true },
      );
    }

    // Supprimer les services qui ne sont plus dans la liste officielle
    const activeNames = DEFAULT_SERVICES.map(s => s.name);
    await this.serviceConfigModel.deleteMany({ name: { $nin: activeNames } });
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const now = new Date();
    const startOfDay    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek   = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const startOfMonth  = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear   = new Date(now.getFullYear(), 0, 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const sevenDaysAgo  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const revenueAgg = (from: Date) =>
      this.visitModel.aggregate([
        { $match: { createdAt: { $gte: from }, paymentMethod: { $ne: 'points' } } },
        { $group: { _id: null, total: { $sum: '$price' } } },
      ]);

    const [
      totalClients,
      newThisMonth,
      newLastMonth,
      activeThisWeek,
      activeThisMonth,
      activeLastMonth,
      neverVisited,
      tierCounts,
      totalPointsAgg,
      referralsThisMonth,
      recentClients,
      topClientThisMonth,
      revDay, revWeek, revMonth, revYear,
    ] = await Promise.all([
      this.userModel.countDocuments({ role: 'client' }),
      this.userModel.countDocuments({ role: 'client', createdAt: { $gte: startOfMonth } }),
      this.userModel.countDocuments({ role: 'client', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      this.userModel.countDocuments({ role: 'client', lastVisitAt: { $gte: sevenDaysAgo } }),
      this.userModel.countDocuments({ role: 'client', lastVisitAt: { $gte: thirtyDaysAgo } }),
      this.userModel.countDocuments({ role: 'client', lastVisitAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } }),
      this.userModel.countDocuments({ role: 'client', $or: [{ lastVisitAt: { $exists: false } }, { lastVisitAt: null }] }),
      this.userModel.aggregate([
        { $match: { role: 'client' } },
        { $group: { _id: '$loyaltyTier', count: { $sum: 1 } } },
      ]),
      this.userModel.aggregate([
        { $match: { role: 'client' } },
        { $group: { _id: null, total: { $sum: '$loyaltyPoints' } } },
      ]),
      this.userModel.countDocuments({ role: 'client', createdAt: { $gte: startOfMonth }, referredBy: { $exists: true, $ne: null } }),
      this.userModel.find({ role: 'client' }).select('-password').sort({ createdAt: -1 }).limit(5),
      this.userModel.find({ role: 'client', lastVisitAt: { $gte: startOfMonth } }).select('-password').sort({ visitCount: -1 }).limit(1),
      revenueAgg(startOfDay),
      revenueAgg(startOfWeek),
      revenueAgg(startOfMonth),
      revenueAgg(startOfYear),
    ]);

    const tiers = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const t of tierCounts) {
      tiers[t._id as keyof typeof tiers] = t.count;
    }

    const inactiveClients = totalClients - activeThisMonth - neverVisited;
    const monthlyActivity = await this.getMonthlyActivity(6);

    // Créneaux perdus aujourd'hui : annulés dont aucun RDV actif n'a pris la même heure
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cancelledToday = await this.appointmentModel
      .find({ date: todayStr, status: 'cancelled' })
      .select('time');
    const activeToday = await this.appointmentModel
      .find({ date: todayStr, status: { $ne: 'cancelled' } })
      .select('time');
    const activeTimes = new Set(activeToday.map(a => a.time));
    const uniqueCancelledTimes = [...new Set(cancelledToday.map(a => a.time))];
    const lostSlotsToday = uniqueCancelledTimes.filter(t => !activeTimes.has(t)).length;

    const retentionRate = activeLastMonth > 0
      ? Math.round((activeThisMonth / activeLastMonth) * 100)
      : null;

    const newClientsTrend = newLastMonth > 0
      ? Math.round(((newThisMonth - newLastMonth) / newLastMonth) * 100)
      : null;

    return {
      totalClients,
      newThisMonth,
      newClientsTrend,
      activeThisWeek,
      activeThisMonth,
      inactiveClients,
      neverVisited,
      tiers,
      totalPoints: totalPointsAgg[0]?.total ?? 0,
      referralsThisMonth,
      retentionRate,
      recentClients,
      topClientThisMonth: topClientThisMonth[0] ?? null,
      monthlyActivity,
      revenue: {
        today: revDay[0]?.total ?? 0,
        week:  revWeek[0]?.total ?? 0,
        month: revMonth[0]?.total ?? 0,
        year:  revYear[0]?.total ?? 0,
      },
      lostSlotsToday,
    };
  }

  private async getMonthlyActivity(months: number) {
    const now = new Date();
    const monthRanges = Array.from({ length: months }, (_, i) => {
      const offset = months - 1 - i;
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0, 23, 59, 59);
      return { start, end };
    });

    return Promise.all(
      monthRanges.map(async ({ start, end }) => {
        const [newClients, activeClients, revenueAgg] = await Promise.all([
          this.userModel.countDocuments({ role: 'client', createdAt: { $gte: start, $lte: end } }),
          this.userModel.countDocuments({ role: 'client', lastVisitAt: { $gte: start, $lte: end } }),
          this.visitModel.aggregate([
            { $match: { createdAt: { $gte: start, $lte: end }, paymentMethod: { $ne: 'points' } } },
            { $group: { _id: null, total: { $sum: '$price' } } },
          ]),
        ]);
        return {
          month: start.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
          newClients,
          activeClients,
          revenue: revenueAgg[0]?.total ?? 0,
        };
      }),
    );
  }

  // ── Clients ───────────────────────────────────────────────────────────────

  async getAllClients(search?: string) {
    const query: Record<string, unknown> = { role: 'client' };
    if (search) {
      const regex = new RegExp(search, 'i');
      query['$or'] = [
        { firstName: regex },
        { lastName: regex },
        { email: regex },
        { phone: regex },
      ];
    }
    return this.userModel.find(query).select('-password').sort({ createdAt: -1 });
  }

  async getClientById(id: string) {
    return this.usersService.findById(id);
  }

  async updateClient(id: string, dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  async deleteClient(id: string) {
    return this.usersService.delete(id);
  }

  async recordVisit(clientId: string, dto: RecordVisitDto) {
    const config = await this.serviceConfigModel.findOne({ name: dto.serviceType });
    const points = config?.loyaltyPoints ?? LOYALTY_POINTS_PER_VISIT;
    await this.visitModel.create({ clientId, ...dto, pointsEarned: points });
    return this.usersService.recordVisit(clientId, points);
  }

  async getClientVisits(clientId: string) {
    return this.visitModel
      .find({ clientId })
      .sort({ createdAt: -1 })
      .limit(50);
  }

  async adjustPoints(clientId: string, delta: number) {
    return this.userModel
      .findByIdAndUpdate(
        clientId,
        { $inc: { loyaltyPoints: delta } },
        { new: true },
      )
      .select('-password');
  }

  // ── Configuration des prestations ─────────────────────────────────────────

  async updateServiceConfig(id: string, dto: UpdateServiceConfigDto) {
    return this.serviceConfigModel.findByIdAndUpdate(id, dto, { new: true });
  }

  // ── Fidélité ──────────────────────────────────────────────────────────────

  async getLoyaltyStats() {
    const [topClients, tierCounts, birthdayAvailable] = await Promise.all([
      this.userModel
        .find({ role: 'client' })
        .select('-password')
        .sort({ visitCount: -1 })
        .limit(10),
      this.userModel.aggregate([
        { $match: { role: 'client' } },
        { $group: { _id: '$loyaltyTier', count: { $sum: 1 }, totalPoints: { $sum: '$loyaltyPoints' } } },
        { $sort: { count: -1 } },
      ]),
      this.getBirthdayAvailableClients(),
    ]);

    const tiers = { bronze: 0, silver: 0, gold: 0, platinum: 0 };
    for (const t of tierCounts) {
      tiers[t._id as keyof typeof tiers] = t.count;
    }

    return { topClients, tierCounts, tiers, birthdayAvailable };
  }

  private async getBirthdayAvailableClients() {
    const now = new Date();
    const clients = await this.userModel
      .find({ role: 'client', birthDate: { $exists: true }, birthdayBonusClaimedThisYear: false })
      .select('-password');

    return clients.filter(c => {
      if (!c.birthDate) return false;
      const birth = c.birthDate;
      const diff = Math.abs(
        new Date(now.getFullYear(), birth.getMonth(), birth.getDate()).getTime() - now.getTime(),
      );
      return diff <= 7 * 24 * 60 * 60 * 1000;
    });
  }

  // ── Parrainages ───────────────────────────────────────────────────────────

  async getReferralStats() {
    const topReferrers = await this.userModel
      .find({ role: 'client', referralCount: { $gt: 0 } })
      .select('-password')
      .sort({ referralCount: -1 })
      .limit(20);

    const totalReferrals = await this.userModel.aggregate([
      { $match: { role: 'client' } },
      { $group: { _id: null, total: { $sum: '$referralCount' } } },
    ]);

    return {
      topReferrers,
      totalReferrals: totalReferrals[0]?.total ?? 0,
    };
  }

  // ── Comptabilité ──────────────────────────────────────────────────────────────

  async getAccounting(period: string, date: string) {
    const { start, end } = this.parsePeriod(period, date);

    const startStr = start.toISOString().slice(0, 10);
    const endStr = end.toISOString().slice(0, 10);

    // visitDate: null matches both missing field and explicit null
    const dateFilter = {
      $or: [
        { visitDate: { $gte: startStr, $lte: endStr } },
        { visitDate: null, createdAt: { $gte: start, $lte: end } },
      ],
    };

    const cashFilter = { ...dateFilter, paymentMethod: { $ne: 'points' } };

    const [rawVisits, byService, byPayment, totalVisits] = await Promise.all([
      this.visitModel.find(dateFilter).sort({ createdAt: -1 }).limit(500),
      this.visitModel.aggregate([
        { $match: cashFilter },
        { $group: { _id: '$serviceType', total: { $sum: '$price' }, count: { $sum: 1 } } },
        { $sort: { total: -1 } },
      ]),
      this.visitModel.aggregate([
        { $match: dateFilter },
        { $group: { _id: { $ifNull: ['$paymentMethod', 'especes'] }, total: { $sum: '$price' }, count: { $sum: 1 } } },
      ]),
      this.visitModel.countDocuments(dateFilter),
    ]);

    // Enrichir les visites avec le nom des clients enregistrés
    const clientIds = [...new Set(
      rawVisits
        .filter(v => v.clientId && v.clientId !== 'walk-in' && !v.clientName)
        .map(v => v.clientId),
    )];
    const userMap = new Map<string, string>();
    if (clientIds.length) {
      const users = await this.userModel
        .find({ _id: { $in: clientIds } })
        .select('firstName lastName');
      for (const u of users) {
        userMap.set(u._id.toString(), `${u.firstName} ${u.lastName}`);
      }
    }
    const visits = rawVisits.map(v => ({
      ...v.toObject(),
      clientName: v.clientName || userMap.get(v.clientId) || null,
    }));

    const totalRevenue = visits.filter(v => v.paymentMethod !== 'points').reduce((sum, v) => sum + v.price, 0);

    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const yStart = new Date(now.getFullYear(), 0, 1);
    const qStartStr = qStart.toISOString().slice(0, 10);
    const yStartStr = yStart.toISOString().slice(0, 10);

    const qFilter = { $or: [{ visitDate: { $gte: qStartStr } }, { visitDate: null, createdAt: { $gte: qStart } }] };
    const yFilter = { $or: [{ visitDate: { $gte: yStartStr } }, { visitDate: null, createdAt: { $gte: yStart } }] };

    const qCashFilter = { ...qFilter, paymentMethod: { $ne: 'points' } };
    const yCashFilter = { ...yFilter, paymentMethod: { $ne: 'points' } };

    const [revQuarter, revYear] = await Promise.all([
      this.visitModel.aggregate([{ $match: qCashFilter }, { $group: { _id: null, t: { $sum: '$price' } } }]),
      this.visitModel.aggregate([{ $match: yCashFilter }, { $group: { _id: null, t: { $sum: '$price' } } }]),
    ]);

    return {
      kpis: {
        revenue: totalRevenue,
        visits: totalVisits,
        quarter: revQuarter[0]?.t ?? 0,
        year: revYear[0]?.t ?? 0,
      },
      byService,
      byPayment,
      visits,
    };
  }

  async createManualVisit(dto: CreateManualVisitDto) {
    const visitData = {
      clientId: dto.clientId ?? 'walk-in',
      clientName: dto.clientName,
      serviceType: dto.serviceType,
      price: dto.price,
      paymentMethod: dto.paymentMethod ?? 'especes',
      visitDate: dto.visitDate,
    };
    const visit = await this.visitModel.create(visitData);
    if (dto.clientId && dto.clientId !== 'walk-in') {
      const config = await this.serviceConfigModel.findOne({ name: dto.serviceType });
      const points = config?.loyaltyPoints ?? LOYALTY_POINTS_PER_VISIT;
      await this.usersService.recordVisit(dto.clientId, points);
    }
    return visit;
  }

  async deleteVisit(id: string) {
    const visit = await this.visitModel.findById(id);
    if (!visit) return null;
    if (visit.clientId && visit.clientId !== 'walk-in') {
      const config = await this.serviceConfigModel.findOne({ name: visit.serviceType });
      const basePoints = config?.loyaltyPoints ?? LOYALTY_POINTS_PER_VISIT;
      // Recalcule le bonus palier tel qu'il était avant cette visite (visitCount - 1)
      const user = await this.userModel.findById(visit.clientId).select('visitCount');
      const tierAtVisit = computeTier(Math.max(0, (user?.visitCount ?? 1) - 1));
      const totalPoints = basePoints + LOYALTY_TIER_BONUS[tierAtVisit];
      await this.userModel.findByIdAndUpdate(visit.clientId, {
        $inc: { loyaltyPoints: -totalPoints, visitCount: -1 },
      });
    }
    return visit.deleteOne();
  }

  private parsePeriod(period: string, date: string): { start: Date; end: Date } {
    if (period === 'month') {
      const [y, m] = date.split('-').map(Number);
      return {
        start: new Date(y, m - 1, 1),
        end: new Date(y, m, 0, 23, 59, 59),
      };
    }
    if (period === 'quarter') {
      const [y, q] = date.split('-');
      const qNum = parseInt(q.replace('Q', '')) - 1;
      const startMonth = qNum * 3;
      return {
        start: new Date(parseInt(y), startMonth, 1),
        end: new Date(parseInt(y), startMonth + 3, 0, 23, 59, 59),
      };
    }
    if (period === 'year') {
      const y = parseInt(date);
      return {
        start: new Date(y, 0, 1),
        end: new Date(y, 11, 31, 23, 59, 59),
      };
    }
    throw new BadRequestException(`Période invalide : ${period}`);
  }

  // ── Gestion des prestations ───────────────────────────────────────────────────

  async createService(dto: { name: string; price: number; loyaltyPoints?: number }) {
    try {
      return await this.serviceConfigModel.create({
        name: dto.name,
        price: dto.price,
        loyaltyPoints: dto.loyaltyPoints ?? 0,
        active: true,
      });
    } catch (err: any) {
      if (err?.code === 11000) throw new ConflictException(`Une prestation nommée "${dto.name}" existe déjà.`);
      throw err;
    }
  }

  async toggleService(id: string) {
    const svc = await this.serviceConfigModel.findById(id);
    if (!svc) return null;
    svc.active = !svc.active;
    return svc.save();
  }

  async getAllServiceConfigs() {
    return this.serviceConfigModel.find().sort({ name: 1 });
  }

  // ── Newsletter ─────────────────────────────────────────────────────────────

  private buildNewsletterQuery(filter: string) {
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);
    const base: any = { role: 'client', email: { $exists: true, $nin: ['', null] } };

    switch (filter) {
      case 'active':
        return { ...base, visitCount: { $gt: 0 }, lastVisitAt: { $gte: threeMonthsAgo } };
      case 'inactive':
        return { ...base, visitCount: { $gt: 0 }, lastVisitAt: { $lt: threeMonthsAgo } };
      case 'never':
        return { ...base, $or: [{ visitCount: 0 }, { visitCount: { $exists: false } }] };
      case 'tier_bronze':   return { ...base, loyaltyTier: 'bronze' };
      case 'tier_silver':   return { ...base, loyaltyTier: 'silver' };
      case 'tier_gold':     return { ...base, loyaltyTier: 'gold' };
      case 'tier_platinum': return { ...base, loyaltyTier: 'platinum' };
      default:              return base; // 'all'
    }
  }

  async getNewsletterCount(filter: string): Promise<number> {
    return this.userModel.countDocuments(this.buildNewsletterQuery(filter));
  }

  async sendNewsletter(dto: SendNewsletterDto): Promise<{ sent: number; skipped: number }> {
    if (!process.env.SMTP_USER) throw new BadRequestException('SMTP non configuré');

    const query = dto.clientIds?.length
      ? { _id: { $in: dto.clientIds }, email: { $exists: true, $nin: ['', null] } }
      : this.buildNewsletterQuery(dto.filter);

    const clients = await this.userModel.find(query).select('firstName email');

    const bannerBlock = dto.bannerUrl
      ? `<img src="${dto.bannerUrl}" alt="" style="width:100%;border-radius:8px;display:block;margin-bottom:24px">`
      : '';

    const ctaBlock = dto.ctaUrl && dto.ctaLabel
      ? `<div style="margin:28px 0;text-align:center">
           <a href="${dto.ctaUrl}" style="background:#C9A44A;color:#000;padding:13px 32px;border-radius:6px;text-decoration:none;font-weight:700;font-size:15px;display:inline-block">${dto.ctaLabel}</a>
         </div>`
      : '';

    const messageHtml = dto.message.replace(/\n/g, '<br>');

    let sent = 0;
    let skipped = 0;

    for (const client of clients) {
      if (!client.email) { skipped++; continue; }
      try {
        await this.transporter.sendMail({
          from: `"Dany1st Barber" <${process.env.SMTP_USER}>`,
          to: client.email,
          subject: dto.subject,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;background:#111111;color:#ffffff;padding:36px;border-radius:12px;border:1px solid #2a2a2a">
              ${bannerBlock}
              <div style="margin-bottom:24px">
                <span style="font-family:Georgia,serif;font-size:22px;color:#C9A44A;font-weight:400;letter-spacing:.04em">DANY<span style="font-weight:700">1ST</span></span>
                <span style="font-size:12px;color:rgba(255,255,255,.35);margin-left:8px">Barber Shop</span>
              </div>
              <hr style="border:none;border-top:1px solid #2a2a2a;margin:0 0 24px">
              ${client.firstName ? `<p style="margin:0 0 18px;font-size:15px;color:rgba(255,255,255,.85)">Bonjour <strong>${client.firstName}</strong>,</p>` : ''}
              <div style="font-size:15px;line-height:1.75;color:rgba(255,255,255,.8)">${messageHtml}</div>
              ${ctaBlock}
              <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0 20px">
              <p style="color:rgba(255,255,255,.3);font-size:12px;margin:0;line-height:1.6">
                Dany1st Barber · Paris<br>
                Vous recevez ce message car vous êtes inscrit(e) chez Dany1st Barber.
              </p>
            </div>`,
        });
        sent++;
      } catch {
        skipped++;
      }
    }

    return { sent, skipped };
  }
}
