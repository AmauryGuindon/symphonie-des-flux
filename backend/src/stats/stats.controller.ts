import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

@Controller('admin/stats')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('pipeline')
  getPipeline() {
    return this.statsService.getPipelineStats();
  }

  @Get('growth')
  getGrowth() {
    return this.statsService.getGrowth();
  }

  @Get('labels')
  getLabels() {
    return this.statsService.getLabelDistribution();
  }
}
