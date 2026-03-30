import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GalleryItem, GalleryItemDocument } from './schemas/gallery-item.schema';

@Injectable()
export class GalleryService {
  constructor(@InjectModel(GalleryItem.name) private model: Model<GalleryItemDocument>) {}

  findAll() {
    return this.model.find().sort({ order: 1, createdAt: -1 });
  }

  findActive() {
    return this.model.find({ active: true }).sort({ order: 1, createdAt: -1 });
  }

  async create(filename: string, url: string, alt?: string, span?: string, category?: string) {
    const count = await this.model.countDocuments();
    return this.model.create({ filename, url, alt, span: span ?? '', category: category ?? '', order: count });
  }

  update(id: string, dto: { alt?: string; span?: string; category?: string; active?: boolean; order?: number }) {
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
}
