import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DatasetVersionDocument = DatasetVersion & Document;

@Schema({ timestamps: true })
export class DatasetVersion {
  @Prop({ required: true }) version: string;
  @Prop({ required: true }) imageCount: number;
  @Prop({ type: [String], default: [] }) imageIds: string[];
  @Prop({ type: [String], default: [] }) labelsIncluded: string[];
  @Prop() description?: string;
}

export const DatasetVersionSchema = SchemaFactory.createForClass(DatasetVersion);
