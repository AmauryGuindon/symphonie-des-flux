import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GalleryItem, GalleryItemDocument, ImageFeatures } from './schemas/gallery-item.schema';
import * as sharp from 'sharp';

@Injectable()
export class GalleryService {
  constructor(@InjectModel(GalleryItem.name) private model: Model<GalleryItemDocument>) {}

  findAll() {
    return this.model.find().sort({ order: 1, createdAt: -1 });
  }

  findActive() {
    return this.model.find({ active: true }).sort({ order: 1, createdAt: -1 });
  }

  async create(
    filename: string,
    url: string,
    filePath: string,
    sizeBytes: number,
    mimetype: string,
    alt?: string,
    span?: string,
    category?: string,
  ) {
    const count = await this.model.countDocuments();
    const features = await this.extractFeatures(filePath, sizeBytes, mimetype);
    return this.model.create({
      filename,
      url,
      alt,
      span: span ?? '',
      category: category ?? '',
      order: count,
      status: 'raw',
      labels: [],
      features,
    });
  }

  private async extractFeatures(
    filePath: string,
    sizeBytes: number,
    mimetype: string,
  ): Promise<ImageFeatures> {
    try {
      const image = sharp(filePath);
      const meta = await image.metadata();
      const stats = await image.stats();
      const dominant = stats.dominant;
      const hex = '#' + [dominant.r, dominant.g, dominant.b]
        .map(v => Math.round(v).toString(16).padStart(2, '0'))
        .join('');
      return {
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        sizeKb: Math.round(sizeBytes / 1024),
        format: meta.format ?? mimetype.split('/')[1] ?? 'unknown',
        dominantColor: hex,
      };
    } catch {
      return {
        width: 0,
        height: 0,
        sizeKb: Math.round(sizeBytes / 1024),
        format: mimetype.split('/')[1] ?? 'unknown',
        dominantColor: '#808080',
      };
    }
  }

  update(id: string, dto: {
    alt?: string;
    span?: string;
    category?: string;
    active?: boolean;
    order?: number;
    status?: string;
    labels?: string[];
  }) {
    return this.model.findByIdAndUpdate(id, dto, { new: true });
  }

  async reorder(items: { id: string; order: number }[]) {
    await Promise.all(items.map(({ id, order }) => this.model.findByIdAndUpdate(id, { order })));
  }

  async delete(id: string, uploadsPath: string) {
    const item = await this.model.findById(id);
    if (!item) return null;
    const fs = await import('fs/promises');
    const filePath = `${uploadsPath}/${item.filename}`;
    await fs.unlink(filePath).catch(() => {});
    return item.deleteOne();
  }

  // ── Pipeline ─────────────────────────────────────────────────────────────

  async pipelineStats() {
    const statuses = ['raw', 'validated', 'labeled', 'processed', 'exported'];
    const counts = await Promise.all(
      statuses.map(async s => ({ status: s, count: await this.model.countDocuments({ status: s }) }))
    );
    const total = await this.model.countDocuments();
    return { total, byStatus: counts };
  }
}
