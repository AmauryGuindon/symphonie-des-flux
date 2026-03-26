import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BusinessConfig, BusinessConfigDocument } from './schemas/business-config.schema';
import { UpdateBusinessConfigDto } from './dto/update-business-config.dto';

@Injectable()
export class ScheduleService {
  constructor(
    @InjectModel(BusinessConfig.name)
    private configModel: Model<BusinessConfigDocument>,
  ) {}

  async getConfig(): Promise<BusinessConfig> {
    const cfg = await this.configModel.findById('main');
    if (cfg) return cfg;
    // Bootstrap default config if not yet in DB
    return this.configModel.create({ _id: 'main' });
  }

  async updateConfig(dto: UpdateBusinessConfigDto): Promise<BusinessConfig> {
    return this.configModel.findByIdAndUpdate('main', dto, {
      new: true,
      upsert: true,
    });
  }

  /** Generate all time slots for a given config, excluding break time */
  generateSlots(cfg: BusinessConfig): string[] {
    const slots: string[] = [];
    const [startH, startM] = cfg.openTime.split(':').map(Number);
    const [endH, endM] = cfg.closeTime.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    const endTotal   = endH   * 60 + endM;

    const breakStart = cfg.breakStart ? (() => {
      const [h, m] = cfg.breakStart.split(':').map(Number);
      return h * 60 + m;
    })() : -1;
    const breakEnd = cfg.breakEnd ? (() => {
      const [h, m] = cfg.breakEnd.split(':').map(Number);
      return h * 60 + m;
    })() : -1;

    for (let t = startTotal; t < endTotal; t += cfg.slotDuration) {
      // Skip slots that start within the break window
      if (breakStart >= 0 && t >= breakStart && t < breakEnd) continue;
      const h = Math.floor(t / 60);
      const m = t % 60;
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
    return slots;
  }
}
