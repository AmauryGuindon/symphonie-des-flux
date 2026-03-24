import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AdminModule } from './admin/admin.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { ScheduleModule } from './schedule/schedule.module';
import { RemindersModule } from './reminders/reminders.module';

@Module({
  imports: [
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://localhost:27017/dany1st',
    ),
    ThrottlerModule.forRoot([{
      name: 'global',
      ttl: 60_000,   // fenêtre 1 minute
      limit: 60,     // max 60 req/min par IP (usage normal)
    }]),
    NestScheduleModule.forRoot(),
    AuthModule,
    UsersModule,
    AdminModule,
    AppointmentsModule,
    ScheduleModule,
    RemindersModule,
  ],
})
export class AppModule {}
