import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryItemDocument = GalleryItem & Document;

export type PipelineStatus = 'raw' | 'validated' | 'labeled' | 'processed' | 'exported';

export interface ImageFeatures {
  width: number;
  height: number;
  sizeKb: number;
  format: string;
  dominantColor: string;
}

@Schema({ timestamps: true })
export class GalleryItem {
  @Prop({ required: true }) filename: string;
  @Prop({ required: true }) url: string;
  @Prop() alt?: string;
  @Prop({ enum: ['wide', 'tall', 'large', ''], default: '' }) span?: string;
  @Prop({ enum: ['coupe', 'barbe', 'degrade', ''], default: '' }) category?: string;
  @Prop({ default: 0 }) order: number;
  @Prop({ default: true }) active: boolean;

  // ── Pipeline ─────────────────────────────────────────────────────────────
  @Prop({
    enum: ['raw', 'validated', 'labeled', 'processed', 'exported'],
    default: 'raw',
  })
  status: PipelineStatus;

  @Prop({ type: [String], default: [] })
  labels: string[];

  @Prop({ type: Object })
  features?: ImageFeatures;

  @Prop()
  datasetVersion?: string;
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);
