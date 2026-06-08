import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DatasetVersion, DatasetVersionDocument } from './schemas/dataset-version.schema';
import { GalleryItem, GalleryItemDocument } from '../gallery/schemas/gallery-item.schema';

@Injectable()
export class DatasetService {
  constructor(
    @InjectModel(DatasetVersion.name) private versionModel: Model<DatasetVersionDocument>,
    @InjectModel(GalleryItem.name) private galleryModel: Model<GalleryItemDocument>,
  ) {}

  findAll() {
    return this.versionModel.find().sort({ createdAt: -1 });
  }

  async create(description?: string) {
    const eligibleStatuses = ['labeled', 'processed', 'exported'];
    const images = await this.galleryModel.find({ status: { $in: eligibleStatuses } });

    const count = await this.versionModel.countDocuments();
    const version = `v${count + 1}`;

    const allLabels = [...new Set(images.flatMap(img => img.labels ?? []))];

    await this.galleryModel.updateMany(
      { _id: { $in: images.map(i => i._id) } },
      { status: 'exported', datasetVersion: version },
    );

    return this.versionModel.create({
      version,
      imageCount: images.length,
      imageIds: images.map(i => (i._id as any).toString()),
      labelsIncluded: allLabels,
      description,
    });
  }

  async exportJson(id: string) {
    const v = await this.versionModel.findById(id);
    if (!v) throw new NotFoundException('Version introuvable');

    const images = await this.galleryModel.find({ _id: { $in: v.imageIds } });

    return {
      version: v.version,
      createdAt: (v as any).createdAt,
      imageCount: v.imageCount,
      labelsIncluded: v.labelsIncluded,
      description: v.description,
      images: images.map(img => ({
        id: (img._id as any).toString(),
        url: img.url,
        labels: img.labels ?? [],
        category: img.category,
        features: img.features ?? null,
        status: img.status,
      })),
    };
  }
}
