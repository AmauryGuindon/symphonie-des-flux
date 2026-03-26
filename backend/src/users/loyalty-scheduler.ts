import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UsersService } from './users.service';

@Injectable()
export class LoyaltyScheduler {
  private readonly logger = new Logger(LoyaltyScheduler.name);

  constructor(private readonly usersService: UsersService) {}

  /** Tous les jours à 3h : dégradation de palier + reset points pour les anniversaires d'inscription */
  @Cron('0 3 * * *')
  async handleAnniversaryDegradations() {
    const count = await this.usersService.evaluateAnniversaryDegradations();
    if (count > 0) {
      this.logger.log(`Dégradation anniversaire : ${count} client(s) traité(s)`);
    }
  }
}
