import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type VisitDocument = Visit & Document;

@Schema({ timestamps: true })
export class Visit {
  @Prop({ required: true })
  clientId: string;

  @Prop({ required: true, trim: true })
  serviceType: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ trim: true })
  notes?: string;
}

export const VisitSchema = SchemaFactory.createForClass(Visit);
