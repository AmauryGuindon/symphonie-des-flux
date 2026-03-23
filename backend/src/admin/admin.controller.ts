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
import { ScheduleService } from '../schedule/schedule.service';
import { UpdateBusinessConfigDto } from '../schedule/dto/update-business-config.dto';
import { CreateManualVisitDto } from './dto/create-manual-visit.dto';
import { CreateServiceDto } from './dto/create-service.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private appointmentsService: AppointmentsService,
    private scheduleService: ScheduleService,
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
  getAllServiceConfigs() {
    return this.adminService.getAllServiceConfigs();
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

  // ── Horaires ──────────────────────────────────────────────────────────────

  @Get('schedule')
  getSchedule() {
    return this.scheduleService.getConfig();
  }

  @Patch('schedule')
  updateSchedule(@Body() dto: UpdateBusinessConfigDto) {
    return this.scheduleService.updateConfig(dto);
  }

  // ── Comptabilité ─────────────────────────────────────────────────────────────

  @Get('accounting')
  getAccounting(
    @Query('period') period: string = 'month',
    @Query('date') date: string,
  ) {
    const resolvedDate = date ?? new Date().toISOString().slice(0, 7);
    return this.adminService.getAccounting(period, resolvedDate);
  }

  @Post('accounting/visits')
  createManualVisit(@Body() dto: CreateManualVisitDto) {
    return this.adminService.createManualVisit(dto);
  }

  @Delete('accounting/visits/:id')
  deleteVisit(@Param('id') id: string) {
    return this.adminService.deleteVisit(id);
  }

  // ── Gestion des prestations ───────────────────────────────────────────────────

  @Post('services')
  createService(@Body() dto: CreateServiceDto) {
    return this.adminService.createService(dto);
  }

  @Patch('services/:id/toggle')
  toggleService(@Param('id') id: string) {
    return this.adminService.toggleService(id);
  }
}
