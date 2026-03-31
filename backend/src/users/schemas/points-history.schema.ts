import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PointsHistoryDocument = PointsHistory & Document;

export type PointsHistoryReason =
  | 'visit'
  | 'birthday_bonus'
  | 'referral_bonus'
  | 'admin_adjustment'
  | 'redemption'
  | 'refund'
  | 'annual_reset';

@Schema({ timestamps: true })
export class PointsHistory {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  amount: number; // positif = gain, négatif = dépense/perte

  @Prop({
    required: true,
    enum: ['visit', 'birthday_bonus', 'referral_bonus', 'admin_adjustment', 'redemption', 'refund', 'annual_reset'],
  })
  reason: PointsHistoryReason;

  @Prop()
  description?: string;
}

export const PointsHistorySchema = SchemaFactory.createForClass(PointsHistory);
