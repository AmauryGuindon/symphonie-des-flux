import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './schemas/user.schema';
import { Visit, VisitSchema } from '../visits/schemas/visit.schema';
import { LoyaltyScheduler } from './loyalty-scheduler';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Visit.name, schema: VisitSchema },
    ]),
  ],
  providers: [UsersService, LoyaltyScheduler],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
