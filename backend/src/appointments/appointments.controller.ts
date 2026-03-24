import {
  Controller, Get, Post, Patch,
  Body, Param, Query, UseGuards, Request,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppointmentsService } from './appointments.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateAppointmentDto } from './dto/create-appointment.dto';
import { RescheduleAppointmentDto } from './dto/reschedule-appointment.dto';
import { ServiceConfig, ServiceConfigDocument } from '../services/schemas/service-config.schema';
import { ScheduleService } from '../schedule/schedule.service';

@Controller('appointments')
export class AppointmentsController {
  constructor(
    private appointmentsService: AppointmentsService,
    private usersService: UsersService,
    private scheduleService: ScheduleService,
    @InjectModel(ServiceConfig.name) private serviceConfigModel: Model<ServiceConfigDocument>,
  ) {}

  // Public: list of services (for the booking form)
  @Get('services')
  getServices() {
    return this.serviceConfigModel.find({ active: true }).sort({ name: 1 });
  }

  // Public: business schedule config
  @Get('schedule')
  getSchedule() {
    return this.scheduleService.getConfig();
  }

  // Public: available slots for a date
  @Get('slots')
  getSlots(@Query('date') date: string) {
    if (!date) throw new BadRequestException('date required');
    return this.appointmentsService.getAvailableSlots(date);
  }

  // Auth: book an appointment
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Request() req: any, @Body() dto: CreateAppointmentDto) {
    const { userId, email } = req.user as { userId: string; email: string };
    const user = await this.usersService.findById(userId);
    const clientName = `${user.firstName} ${user.lastName}`;
    try {
      return await this.appointmentsService.createAppointment(userId, clientName, email, dto);
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }

  // Auth: my appointments
  @Get('my')
  @UseGuards(JwtAuthGuard)
  getMyAppointments(@Request() req: any) {
    return this.appointmentsService.getMyAppointments(req.user.userId);
  }

  // Auth: cancel my appointment
  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  cancelMyAppointment(@Param('id') id: string, @Request() req: any) {
    return this.appointmentsService.cancelMyAppointment(id, req.user.userId);
  }

  // Auth: reschedule my appointment
  @Patch(':id/reschedule')
  @UseGuards(JwtAuthGuard)
  async rescheduleMyAppointment(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: RescheduleAppointmentDto,
  ) {
    try {
      return await this.appointmentsService.rescheduleMyAppointment(
        id, req.user.userId, dto.date, dto.time,
      );
    } catch (e: any) {
      throw new BadRequestException(e.message);
    }
  }
}
