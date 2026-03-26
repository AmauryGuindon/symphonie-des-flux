import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { Appointment, AppointmentSchema } from './schemas/appointment.schema';
import { ServiceConfig, ServiceConfigSchema } from '../services/schemas/service-config.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { UsersModule } from '../users/users.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Appointment.name, schema: AppointmentSchema },
      { name: ServiceConfig.name, schema: ServiceConfigSchema },
      { name: Visit.name, schema: VisitSchema },
    ]),
    UsersModule,
    ScheduleModule,
  ],
  controllers: [AppointmentsController],
  providers: [AppointmentsService],
  exports: [AppointmentsService],
})
export class AppointmentsModule {}
