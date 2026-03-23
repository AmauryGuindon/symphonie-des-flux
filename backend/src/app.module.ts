import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ScheduleModule } from './schedule/schedule.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/dany1st',
    ),
    AuthModule,
    UsersModule,
    AdminModule,
    AppointmentsModule,
    ScheduleModule,
  ],
})
export class AppModule {}
