import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Role, LoyaltyTier, computeTier } from '../../common/enums/role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  firstName: string;

  @Prop({ required: true, trim: true })
  lastName: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ trim: true })
  phone?: string;

  @Prop({ enum: Role, default: Role.CLIENT })
  role: Role;

  // --- Fidélité ---
  @Prop({ default: 0 })
  loyaltyPoints: number;

  @Prop({ default: 0 })
  visitCount: number;

  @Prop({ enum: LoyaltyTier, default: LoyaltyTier.BRONZE })
  loyaltyTier: LoyaltyTier;

  // --- Préférences ---
  @Prop({ trim: true })
  favoriteStyle?: string;

  @Prop({ trim: true })
  preferences?: string;

  // --- Anniversaire ---
  @Prop()
  birthDate?: Date;

  @Prop({ default: false })
  birthdayBonusClaimedThisYear: boolean;

  // --- Parrainage ---
  @Prop({ unique: true, sparse: true })
  referralCode?: string;

  @Prop({ type: String, ref: 'User' })
  referredBy?: string;

  @Prop({ default: 0 })
  referralCount: number;

  /** Dates des parrainages ayant généré un bonus (max 3 par période de 60 jours) */
  @Prop({ type: [Date], default: [] })
  referralDates: Date[];

  // --- Dernière visite ---
  @Prop()
  lastVisitAt?: Date;

  // --- Notes internes (admin uniquement) ---
  @Prop({ trim: true })
  internalNotes?: string;

  // --- Photo de profil ---
  @Prop()
  profilePictureUrl?: string;

  // --- Réinitialisation mot de passe ---
  @Prop({ select: false })
  resetToken?: string;

  @Prop()
  resetTokenExpiry?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Mise à jour auto du palier fidélité avant save
UserSchema.pre('save', function (next) {
  this.loyaltyTier = computeTier(this.visitCount);
  next();
});
