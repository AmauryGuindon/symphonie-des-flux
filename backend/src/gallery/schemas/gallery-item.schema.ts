import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryItemDocument = GalleryItem & Document;

@Schema({ timestamps: true })
export class GalleryItem {
  @Prop({ required: true }) filename: string;
  @Prop({ required: true }) url: string;
  @Prop() alt?: string;
  @Prop({ enum: ['wide', 'tall', 'large', ''], default: '' }) span?: string;
  @Prop({ enum: ['coupe', 'barbe', 'degrade', ''], default: '' }) category?: string;
  @Prop({ default: 0 }) order: number;
  @Prop({ default: true }) active: boolean;
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);
