import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type NotificationDocument = HydratedDocument<Notification>;

@Schema({ timestamps: true })
export class Notification {
  @Prop({ required: true }) userId: string;

  @Prop({
    required: true,
    enum: ['appointment_confirmed', 'appointment_cancelled', 'points_earned', 'tier_up'],
  })
  type: string;

  @Prop({ required: true }) message: string;
  @Prop({ default: false }) read: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
