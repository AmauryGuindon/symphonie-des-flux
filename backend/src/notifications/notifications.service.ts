import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Notification, NotificationDocument } from './schemas/notification.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private model: Model<NotificationDocument>,
  ) {}

  async create(userId: string, type: string, message: string): Promise<void> {
    await this.model.create({ userId, type, message });
  }

  async getForUser(userId: string) {
    return this.model.find({ userId }).sort({ createdAt: -1 }).limit(30);
  }

  async deleteOne(id: string, userId: string): Promise<void> {
    await this.model.deleteOne({ _id: id, userId });
  }

  async deleteAll(userId: string): Promise<void> {
    await this.model.deleteMany({ userId });
  }
}
