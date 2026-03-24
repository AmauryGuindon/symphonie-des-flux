import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RemindersService } from './reminders.service';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';

@Module({
  imports: [MongooseModule.forFeature([{ name: Appointment.name, schema: AppointmentSchema }])],
  providers: [RemindersService],
})
export class RemindersModule {}
