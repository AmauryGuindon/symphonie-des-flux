import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PointsHistory, PointsHistoryDocument, PointsHistoryReason } from './schemas/points-history.schema';
import {
  LOYALTY_POINTS_PER_VISIT,
  LOYALTY_REFERRAL_BONUS,
  LOYALTY_BIRTHDAY_BONUS,
  LOYALTY_TIER_BONUS,
  LoyaltyTier,
  computeTier,
} from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(PointsHistory.name) private pointsHistoryModel: Model<PointsHistoryDocument>,
  ) {}

  private logPoints(userId: string, amount: number, reason: PointsHistoryReason, description?: string) {
    return this.pointsHistoryModel.create({ userId, amount, reason, description });
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email: dto.email });
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email');
    }

    const hashed = await bcrypt.hash(dto.password, 12);
    const referralCode = uuidv4().split('-')[0].toUpperCase();

    let referredBy: string | undefined;
    if (dto.referralCode) {
      const referrer = await this.userModel.findOne({
        referralCode: dto.referralCode,
      });
      if (referrer) {
        referredBy = referrer._id.toString();

        // Limite : 3 parrainages avec bonus par période de 60 jours
        const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
        const recentBonuses = (referrer.referralDates ?? []).filter(
          (d) => d >= twoMonthsAgo,
        ).length;

        if (recentBonuses < 3) {
          await this.userModel.findByIdAndUpdate(referrer._id, {
            $inc: { loyaltyPoints: LOYALTY_REFERRAL_BONUS, referralCount: 1 },
            $push: { referralDates: new Date() },
          });
          await this.logPoints(referrer._id.toString(), LOYALTY_REFERRAL_BONUS, 'referral_bonus', `Parrainage de ${dto.firstName} ${dto.lastName}`);
        } else {
          // Parrainage comptabilisé mais sans bonus
          await this.userModel.findByIdAndUpdate(referrer._id, {
            $inc: { referralCount: 1 },
          });
        }
      }
    }

    const user = await this.userModel.create({
      ...dto,
      password: hashed,
      referralCode,
      referredBy,
      birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
    });

    return user;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email: email.toLowerCase() });
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).select('-password');
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().select('-password').sort({ createdAt: -1 });
  }

  async update(id: string, dto: UpdateUserDto): Promise<UserDocument> {
    const existing = await this.userModel.findById(id).select('birthDate');
    if (!existing) throw new NotFoundException('Utilisateur non trouvé');

    // La date de naissance ne peut être définie qu'une seule fois
    const birthDate = existing.birthDate
      ? undefined
      : dto.birthDate ? new Date(dto.birthDate) : undefined;

    const user = await this.userModel
      .findByIdAndUpdate(
        id,
        { ...dto, birthDate },
        { new: true },
      )
      .select('-password');
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    return user;
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Utilisateur non trouvé');
  }

  // --- Fidélité ---

  async recordVisit(userId: string, basePoints: number = LOYALTY_POINTS_PER_VISIT, description?: string): Promise<UserDocument> {
    // Récupérer le visitCount actuel pour calculer le palier avant cette visite
    const current = await this.userModel.findById(userId).select('visitCount');
    if (!current) throw new NotFoundException('Utilisateur non trouvé');

    const tier = computeTier(current.visitCount);
    const totalPoints = basePoints + LOYALTY_TIER_BONUS[tier];
    const newTier = computeTier(current.visitCount + 1);

    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $inc: { loyaltyPoints: totalPoints, visitCount: 1 },
        lastVisitAt: new Date(),
        loyaltyTier: newTier,
      },
      { new: true },
    ).select('-password');
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (totalPoints > 0) {
      await this.logPoints(userId, totalPoints, 'visit', description ?? 'Visite enregistrée');
    }
    return user;
  }

  async claimBirthdayBonus(userId: string): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');

    if (user.birthdayBonusClaimedThisYear) {
      throw new ConflictException('Bonus anniversaire déjà réclamé cette année');
    }

    const now = new Date();
    const birth = user.birthDate;
    if (!birth) throw new NotFoundException('Date de naissance non renseignée');

    const isNearBirthday =
      Math.abs(
        new Date(now.getFullYear(), birth.getMonth(), birth.getDate()).getTime() -
          now.getTime(),
      ) <=
      7 * 24 * 60 * 60 * 1000;

    if (!isNearBirthday) {
      throw new ConflictException('Le bonus n\'est disponible que dans les 7 jours autour de votre anniversaire');
    }

    const updated = await this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: { loyaltyPoints: LOYALTY_BIRTHDAY_BONUS },
          birthdayBonusClaimedThisYear: true,
        },
        { new: true },
      )
      .select('-password');
    await this.logPoints(userId, LOYALTY_BIRTHDAY_BONUS, 'birthday_bonus', 'Bonus anniversaire');
    return updated;
  }

  async redeemPoints(userId: string, points: number): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    if (user.loyaltyPoints < points) {
      throw new ConflictException('Points insuffisants');
    }
    const updated = await this.userModel
      .findByIdAndUpdate(userId, { $inc: { loyaltyPoints: -points } }, { new: true })
      .select('-password');
    await this.logPoints(userId, -points, 'redemption', `Paiement par points (${points} pts)`);
    return updated;
  }

  async refundPoints(userId: string, points: number): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { $inc: { loyaltyPoints: points } });
    await this.logPoints(userId, points, 'refund', `Remboursement de points (${points} pts)`);
  }

  async evaluateAnniversaryDegradations(): Promise<number> {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    const year = today.getFullYear();

    // Utilisateurs dont l'anniversaire d'inscription est aujourd'hui (créés une année précédente)
    const users = await this.userModel
      .find({
        $expr: {
          $and: [
            { $eq: [{ $month: '$createdAt' }, month] },
            { $eq: [{ $dayOfMonth: '$createdAt' }, day] },
            { $lt: [{ $year: '$createdAt' }, year] },
          ],
        },
      })
      .select('loyaltyTier loyaltyPoints');

    const tierDowngrade: Partial<Record<LoyaltyTier, LoyaltyTier>> = {
      [LoyaltyTier.PLATINUM]: LoyaltyTier.GOLD,
      [LoyaltyTier.GOLD]:     LoyaltyTier.SILVER,
      [LoyaltyTier.SILVER]:   LoyaltyTier.BRONZE,
    };

    // Plancher de visitCount pour chaque palier (cohérence après dégradation)
    const tierFloors: Record<LoyaltyTier, number> = {
      [LoyaltyTier.BRONZE]:    0,
      [LoyaltyTier.SILVER]:    5,
      [LoyaltyTier.GOLD]:     15,
      [LoyaltyTier.PLATINUM]: 30,
    };

    const tierLabels: Record<string, string> = { bronze: 'Bronze', silver: 'Argent', gold: 'Or', platinum: 'Platine' };

    for (const user of users) {
      const newTier = tierDowngrade[user.loyaltyTier] ?? user.loyaltyTier;
      const update: Record<string, unknown> = { loyaltyPoints: 0 };
      if (newTier !== user.loyaltyTier) {
        update.loyaltyTier = newTier;
        update.visitCount = tierFloors[newTier];
      }
      await this.userModel.findByIdAndUpdate(user._id, update);
      if (user.loyaltyPoints > 0) {
        await this.logPoints(
          user._id.toString(),
          -user.loyaltyPoints,
          'annual_reset',
          `Remise à zéro annuelle${newTier !== user.loyaltyTier ? ` — passage ${tierLabels[user.loyaltyTier]} → ${tierLabels[newTier]}` : ''}`,
        );
      }
    }

    return users.length;
  }

  async getPointsHistory(userId: string, limit = 30) {
    return this.pointsHistoryModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }

  async setResetToken(userId: string, token: string, expiry: Date) {
    await this.userModel.findByIdAndUpdate(userId, { resetToken: token, resetTokenExpiry: expiry });
  }

  async findByResetToken(token: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ resetToken: token }).select('+resetToken +resetTokenExpiry');
  }

  async updatePassword(userId: string, hashedPassword: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      password: hashedPassword,
      resetToken: null,
      resetTokenExpiry: null,
    });
  }
}
