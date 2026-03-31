import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  Request,
  Post,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from './users.service';
import { StorageService } from './storage.service';
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
    private readonly storageService: StorageService,
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

  // Upload photo de profil
  @Post('me/profile-picture')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: join(process.cwd(), 'uploads', 'profile'),
      filename: (_req, file, cb) => {
        const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, unique + extname(file.originalname));
      },
    }),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) {
        return cb(new BadRequestException('Seules les images sont acceptées'), false);
      }
      cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async uploadProfilePicture(@Request() req, @UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Fichier requis');
    const currentUser = await this.usersService.findById(req.user.userId);
    if (currentUser.profilePictureUrl) {
      this.storageService.delete(currentUser.profilePictureUrl);
    }
    const url = this.storageService.save(file);
    try {
      return await this.usersService.updateProfilePicture(req.user.userId, url);
    } catch (err) {
      this.storageService.delete(url);
      throw err;
    }
  }

  // Supprimer photo de profil
  @Delete('me/profile-picture')
  async deleteProfilePicture(@Request() req) {
    const currentUser = await this.usersService.findById(req.user.userId);
    if (currentUser.profilePictureUrl) {
      this.storageService.delete(currentUser.profilePictureUrl);
    }
    return this.usersService.updateProfilePicture(req.user.userId, null);
  }

  // Bonus anniversaire
  @Post('me/birthday-bonus')
  claimBirthdayBonus(@Request() req) {
    return this.usersService.claimBirthdayBonus(req.user.userId);
  }

  // Mon historique de points
  @Get('me/points-history')
  getMyPointsHistory(@Request() req) {
    return this.usersService.getPointsHistory(req.user.userId);
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
