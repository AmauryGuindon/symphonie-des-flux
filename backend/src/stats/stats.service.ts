import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GalleryItem, GalleryItemDocument } from '../gallery/schemas/gallery-item.schema';
import { DatasetVersion, DatasetVersionDocument } from '../dataset/schemas/dataset-version.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(GalleryItem.name) private galleryModel: Model<GalleryItemDocument>,
    @InjectModel(DatasetVersion.name) private versionModel: Model<DatasetVersionDocument>,
  ) {}

  async getPipelineStats() {
    const statuses = ['raw', 'validated', 'labeled', 'processed', 'exported'];
    const byStatus = await Promise.all(
      statuses.map(async status => ({
        status,
        count: await this.galleryModel.countDocuments({ status }),
      }))
    );
    const total = await this.galleryModel.countDocuments();
    const versionsCount = await this.versionModel.countDocuments();
    return { total, byStatus, versionsCount };
  }

  async getGrowth() {
    const weeks: { week: string; count: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const count = await this.galleryModel.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });
      weeks.push({ week: start.toISOString().slice(0, 10), count });
    }
    return weeks;
  }

  async getLabelDistribution() {
    const result = await this.galleryModel.aggregate([
      { $unwind: { path: '$labels', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$labels', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { label: '$_id', count: 1, _id: 0 } },
    ]);
    return result;
  }
}
