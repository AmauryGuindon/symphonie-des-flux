import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GalleryItem, GalleryItemSchema } from '../gallery/schemas/gallery-item.schema';
import { DatasetVersion, DatasetVersionSchema } from '../dataset/schemas/dataset-version.schema';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GalleryItem.name, schema: GalleryItemSchema },
      { name: DatasetVersion.name, schema: DatasetVersionSchema },
    ]),
  ],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
