import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';
import { ServiceConfig, ServiceConfigDocument } from '../services/schemas/service-config.schema';
import { UsersService } from '../users/users.service';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { RecordVisitDto } from './dto/record-visit.dto';
import { UpdateServiceConfigDto } from './dto/update-service-config.dto';
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
    const result = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59);
      const [newClients, activeClients] = await Promise.all([
        this.userModel.countDocuments({ role: 'client', createdAt: { $gte: start, $lte: end } }),
        this.userModel.countDocuments({ role: 'client', lastVisitAt: { $gte: start, $lte: end } }),
      ]);
      result.push({
        month: start.toLocaleString('fr-FR', { month: 'short', year: '2-digit' }),
        newClients,
        activeClients,
      });
    }
    return result;
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

  async getServiceConfigs() {
    return this.serviceConfigModel.find().sort({ name: 1 });
  }

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
}
