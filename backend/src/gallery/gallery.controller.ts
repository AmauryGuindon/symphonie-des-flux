import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { GalleryService } from './gallery.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { UpdateGalleryItemDto } from './dto/update-gallery-item.dto';
import { UploadGalleryItemDto } from './dto/upload-gallery-item.dto';

const UPLOADS_PATH = join(process.cwd(), 'uploads', 'gallery');

@Controller()
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  // Public endpoint
  @Get('gallery')
  getActive() {
    return this.galleryService.findActive();
  }

  // Admin endpoints
  @Get('admin/gallery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAll() {
    return this.galleryService.findAll();
  }

  @Post('admin/gallery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: UPLOADS_PATH,
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
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadGalleryItemDto,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const url = `/uploads/gallery/${file.filename}`;
    return this.galleryService.create(file.filename, url, body.alt, body.span);
  }

  @Patch('admin/gallery/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateGalleryItemDto,
  ) {
    return this.galleryService.update(id, dto);
  }

  @Delete('admin/gallery/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  delete(@Param('id') id: string) {
    return this.galleryService.delete(id, UPLOADS_PATH);
  }
}
