import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type BusinessConfigDocument = HydratedDocument<BusinessConfig>;

@Schema()
export class BusinessConfig {
  // Singleton document — always use _id: 'main'
  @Prop({ type: String, default: 'main' }) _id: string;

  /** Weekdays open: 0=Sun, 1=Mon, …, 6=Sat */
  @Prop({ type: [Number], default: [1, 2, 3, 4, 5, 6] })
  openDays: number[];

  /** Opening time HH:mm */
  @Prop({ default: '09:00' }) openTime: string;

  /** Closing time HH:mm (exclusive) */
  @Prop({ default: '19:00' }) closeTime: string;

  /** Slot duration in minutes */
  @Prop({ default: 30 }) slotDuration: number;

  /** Lunch break start HH:mm (empty = no break) */
  @Prop({ default: '13:00' }) breakStart: string;

  /** Lunch break end HH:mm (exclusive) */
  @Prop({ default: '14:00' }) breakEnd: string;

  /** Exceptional closed dates YYYY-MM-DD */
  @Prop({ type: [String], default: [] }) closedDates: string[];
}

export const BusinessConfigSchema = SchemaFactory.createForClass(BusinessConfig);
