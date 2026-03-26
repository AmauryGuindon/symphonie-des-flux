import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VisitDocument = Visit & Document;

@Schema({ timestamps: true })
export class Visit {
  @Prop({ required: true })
  clientId: string;

  @Prop({ trim: true })
  clientName?: string;

  @Prop({ required: true, trim: true })
  serviceType: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ enum: ['especes', 'virement', 'en_ligne'], default: 'especes' })
  paymentMethod?: string;

  @Prop({ trim: true })
  visitDate?: string; // YYYY-MM-DD, pour saisie rétroactive manuelle

  @Prop({ default: 0 })
  pointsEarned: number;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
