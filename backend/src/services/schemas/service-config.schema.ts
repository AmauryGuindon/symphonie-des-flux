import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ServiceConfigDocument = ServiceConfig & Document;

@Schema()
export class ServiceConfig {
  @Prop({ required: true, unique: true, trim: true })
  name: string;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, min: 0 })
  loyaltyPoints: number;

  @Prop({ default: 0 })
  duration: number;

  @Prop({ default: true })
  active: boolean;
}

export const ServiceConfigSchema = SchemaFactory.createForClass(ServiceConfig);
