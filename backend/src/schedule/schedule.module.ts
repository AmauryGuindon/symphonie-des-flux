import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleService } from './schedule.service';
import { BusinessConfig, BusinessConfigSchema } from './schemas/business-config.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: BusinessConfig.name, schema: BusinessConfigSchema },
    ]),
  ],
  providers: [ScheduleService],
  exports: [ScheduleService],
})
export class ScheduleModule {}
