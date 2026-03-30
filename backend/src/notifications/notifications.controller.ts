import { Controller, Get, Patch, Request, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private svc: NotificationsService) {}

  @Get('my')
  getMyNotifications(@Request() req: any) {
    return this.svc.getForUser(req.user.userId);
  }

  @Patch('read')
  markRead(@Request() req: any) {
    return this.svc.markAllRead(req.user.userId);
  }
}
