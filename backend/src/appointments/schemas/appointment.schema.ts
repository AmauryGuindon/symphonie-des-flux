import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type AppointmentDocument = HydratedDocument<Appointment>;

@Schema({ timestamps: true })
export class Appointment {
  @Prop({ required: true }) clientId: string;
  @Prop({ required: true }) clientName: string;
  @Prop({ required: true }) clientEmail: string;
  @Prop({ required: true, trim: true }) serviceType: string;
  @Prop({ required: true }) date: string; // YYYY-MM-DD
  @Prop({ required: true }) time: string; // HH:mm
  @Prop({
    required: true,
    enum: ['pending', 'confirmed', 'cancelled'],
    default: 'pending',
  })
  status: string;
  @Prop({ trim: true }) notes?: string;
  @Prop({ enum: ['especes', 'virement', 'en_ligne', 'points'], default: 'especes' }) paymentMethod: string;
  @Prop({ default: 0 }) price: number;
  @Prop({ default: 0 }) duration: number;
  @Prop({ default: false }) visitRecorded: boolean;
  @Prop({ default: false }) reminderSent: boolean;
}

export const AppointmentSchema = SchemaFactory.createForClass(Appointment);
