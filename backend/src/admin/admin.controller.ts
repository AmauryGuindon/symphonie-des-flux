import {
  Controller, Get, Patch, Delete, Post,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AppointmentsService } from '../appointments/appointments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateUserDto } from '../users/dto/update-user.dto';
import { AdjustPointsDto } from './dto/adjust-points.dto';
import { RecordVisitDto } from './dto/record-visit.dto';
import { UpdateServiceConfigDto } from './dto/update-service-config.dto';
import { UpdateAppointmentDto } from '../appointments/dto/update-appointment.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private appointmentsService: AppointmentsService,
  ) {}

  // ── Dashboard ─────────────────────────────────────────────────────────────

  @Get('stats')
  getDashboardStats() {
    return this.adminService.getDashboardStats();
  }

  // ── Clients ───────────────────────────────────────────────────────────────

  @Get('clients')
  getAllClients(@Query('search') search?: string) {
    return this.adminService.getAllClients(search);
  }

  @Get('clients/:id')
  getClientById(@Param('id') id: string) {
    return this.adminService.getClientById(id);
  }

  @Patch('clients/:id')
  updateClient(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.adminService.updateClient(id, dto);
  }

  @Delete('clients/:id')
  deleteClient(@Param('id') id: string) {
    return this.adminService.deleteClient(id);
  }

  @Post('clients/:id/visit')
  recordVisit(@Param('id') id: string, @Body() dto: RecordVisitDto) {
    return this.adminService.recordVisit(id, dto);
  }

  @Get('clients/:id/visits')
  getClientVisits(@Param('id') id: string) {
    return this.adminService.getClientVisits(id);
  }

  @Post('clients/:id/points')
  adjustPoints(@Param('id') id: string, @Body() dto: AdjustPointsDto) {
    return this.adminService.adjustPoints(id, dto.delta);
  }

  // ── Configuration des prestations ─────────────────────────────────────────

  @Get('services')
  getServiceConfigs() {
    return this.adminService.getServiceConfigs();
  }

  @Patch('services/:id')
  updateServiceConfig(@Param('id') id: string, @Body() dto: UpdateServiceConfigDto) {
    return this.adminService.updateServiceConfig(id, dto);
  }

  // ── Fidélité ──────────────────────────────────────────────────────────────

  @Get('loyalty')
  getLoyaltyStats() {
    return this.adminService.getLoyaltyStats();
  }

  // ── Parrainages ───────────────────────────────────────────────────────────

  @Get('referrals')
  getReferralStats() {
    return this.adminService.getReferralStats();
  }

  // ── Rendez-vous ───────────────────────────────────────────────────────────

  @Get('appointments')
  getAppointments(@Query('from') from?: string, @Query('to') to?: string) {
    return this.appointmentsService.getAllAppointments(from, to);
  }

  @Patch('appointments/:id')
  updateAppointment(@Param('id') id: string, @Body() dto: UpdateAppointmentDto) {
    return this.appointmentsService.updateAppointment(id, dto);
  }

  @Delete('appointments/:id')
  deleteAppointment(@Param('id') id: string) {
    return this.appointmentsService.deleteAppointment(id);
  }
}
