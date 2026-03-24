import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  Post,
  Query,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { Visit, VisitDocument } from '../visits/schemas/visit.schema';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    @InjectModel(Visit.name) private visitModel: Model<VisitDocument>,
  ) {}

  // Mon profil
  @Get('me')
  getMe(@Request() req) {
    return this.usersService.findById(req.user.userId);
  }

  // Mettre à jour mon profil
  @Patch('me')
  updateMe(@Request() req, @Body() dto: UpdateUserDto) {
    return this.usersService.update(req.user.userId, dto);
  }

  // Bonus anniversaire
  @Post('me/birthday-bonus')
  claimBirthdayBonus(@Request() req) {
    return this.usersService.claimBirthdayBonus(req.user.userId);
  }

  // Mes visites passées
  @Get('me/visits')
  async getMyVisits(@Request() req, @Query('limit') limit?: string) {
    const n = Math.min(parseInt(limit ?? '10', 10) || 10, 50);
    return this.visitModel
      .find({ clientId: req.user.userId })
      .sort({ visitDate: -1, createdAt: -1 })
      .limit(n)
      .lean();
  }

  // --- Admin uniquement ---

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get()
  findAll() {
    return this.usersService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Post(':id/visit')
  recordVisit(@Param('id') id: string) {
    return this.usersService.recordVisit(id);
  }

  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.usersService.delete(id);
  }
}
