import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetVersion, DatasetVersionSchema } from './schemas/dataset-version.schema';
import { GalleryItem, GalleryItemSchema } from '../gallery/schemas/gallery-item.schema';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DatasetVersion.name, schema: DatasetVersionSchema },
      { name: GalleryItem.name, schema: GalleryItemSchema },
    ]),
  ],
  providers: [DatasetService],
  controllers: [DatasetController],
  exports: [MongooseModule],
})
export class DatasetModule {}
