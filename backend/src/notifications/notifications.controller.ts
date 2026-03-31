import { Controller, Delete, Get, Param, Request, UseGuards } from '@nestjs/common';
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

  @Delete('all')
  deleteAll(@Request() req: any) {
    return this.svc.deleteAll(req.user.userId);
  }

  @Delete(':id')
  deleteOne(@Param('id') id: string, @Request() req: any) {
    return this.svc.deleteOne(id, req.user.userId);
  }
}
