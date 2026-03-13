import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { ServiceConfig, ServiceConfigSchema } from '../services/schemas/service-config.schema';
import { Appointment, AppointmentSchema } from '../appointments/schemas/appointment.schema';
import { AppointmentsModule } from '../appointments/appointments.module';
import { ScheduleModule } from '../schedule/schedule.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Visit.name, schema: VisitSchema },
      { name: ServiceConfig.name, schema: ServiceConfigSchema },
      { name: Appointment.name, schema: AppointmentSchema },
    ]),
    UsersModule,
    AppointmentsModule,
    ScheduleModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
