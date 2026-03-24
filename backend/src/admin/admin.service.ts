import { BadRequestException, ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { ServiceConfig, ServiceConfigDocument } from '../services/schemas/service-config.schema';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { RecordVisitDto } from './dto/record-visit.dto';
import { UpdateServiceConfigDto } from './dto/update-service-config.dto';
import { CreateManualVisitDto } from './dto/create-manual-visit.dto';
import { LOYALTY_POINTS_PER_VISIT } from '../common/enums/role.enum';

const DEFAULT_SERVICES = [
  { name: 'Coupe',           price: 20, loyaltyPoints: 10 },
  { name: 'Coupe + Dégradé', price: 22, loyaltyPoints: 12 },
  { name: 'Coupe + Barbe',   price: 30, loyaltyPoints: 15 },
  { name: 'Barbe seule',     price: 15, loyaltyPoints: 8  },
  { name: 'Dégradé',         price: 18, loyaltyPoints: 9  },
  { name: 'Coupe enfant',    price: 15, loyaltyPoints: 8  },
];

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
    @InjectModel(ServiceConfig.name) private serviceConfigModel: Model<ServiceConfigDocument>,
    private usersService: UsersService,
  ) {}

  async onModuleInit() {
    for (const s of DEFAULT_SERVICES) {
      await this.serviceConfigModel.findOneAndUpdate(
        { name: s.name },
        { $setOnInsert: s },
        { upsert: true },
      );
    }

    // Migration : backfiller active: true sur les services déjà seedés
    await this.serviceConfigModel.updateMany(
      { active: { $exists: false } },
      { $set: { active: true } },
    );
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
        { $match: { createdAt: { $gte: from } } },
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
            { $match: { createdAt: { $gte: start, $lte: end } } },
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
    await this.visitModel.create({ clientId, ...dto });
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

    const [rawVisits, byService, byPayment, totalVisits] = await Promise.all([
      this.visitModel.find(dateFilter).sort({ createdAt: -1 }).limit(500),
      this.visitModel.aggregate([
        { $match: dateFilter },
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

    const totalRevenue = visits.reduce((sum, v) => sum + v.price, 0);

    const now = new Date();
    const qStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    const yStart = new Date(now.getFullYear(), 0, 1);
    const qStartStr = qStart.toISOString().slice(0, 10);
    const yStartStr = yStart.toISOString().slice(0, 10);

    const qFilter = { $or: [{ visitDate: { $gte: qStartStr } }, { visitDate: null, createdAt: { $gte: qStart } }] };
    const yFilter = { $or: [{ visitDate: { $gte: yStartStr } }, { visitDate: null, createdAt: { $gte: yStart } }] };

    const [revQuarter, revYear] = await Promise.all([
      this.visitModel.aggregate([{ $match: qFilter }, { $group: { _id: null, t: { $sum: '$price' } } }]),
      this.visitModel.aggregate([{ $match: yFilter }, { $group: { _id: null, t: { $sum: '$price' } } }]),
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
      const points = config?.loyaltyPoints ?? LOYALTY_POINTS_PER_VISIT;
      await this.userModel.findByIdAndUpdate(visit.clientId, {
        $inc: { loyaltyPoints: -points, visitCount: -1 },
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
}
