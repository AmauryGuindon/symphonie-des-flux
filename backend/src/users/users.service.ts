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
import {
  LOYALTY_POINTS_PER_VISIT,
  LOYALTY_REFERRAL_BONUS,
  LOYALTY_BIRTHDAY_BONUS,
} from '../common/enums/role.enum';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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

  async recordVisit(userId: string, points: number = LOYALTY_POINTS_PER_VISIT): Promise<UserDocument> {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $inc: { loyaltyPoints: points, visitCount: 1 },
        lastVisitAt: new Date(),
      },
      { new: true },
    ).select('-password');
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
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

    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $inc: { loyaltyPoints: LOYALTY_BIRTHDAY_BONUS },
          birthdayBonusClaimedThisYear: true,
        },
        { new: true },
      )
      .select('-password');
  }

  async redeemPoints(userId: string, points: number): Promise<UserDocument> {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('Utilisateur non trouvé');
    if (user.loyaltyPoints < points) {
      throw new ConflictException('Points insuffisants');
    }
    return this.userModel
      .findByIdAndUpdate(userId, { $inc: { loyaltyPoints: -points } }, { new: true })
      .select('-password');
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
