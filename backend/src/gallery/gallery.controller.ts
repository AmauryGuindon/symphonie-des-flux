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
import { AdminGuard } from '../auth/guards/admin.guard';

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
  @UseGuards(JwtAuthGuard, AdminGuard)
  getAll() {
    return this.galleryService.findAll();
  }

  @Post('admin/gallery')
  @UseGuards(JwtAuthGuard, AdminGuard)
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
    @Body() body: { alt?: string; span?: string },
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const url = `/uploads/gallery/${file.filename}`;
    return this.galleryService.create(file.filename, url, body.alt, body.span);
  }

  @Patch('admin/gallery/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id') id: string,
    @Body() dto: { alt?: string; span?: string; active?: boolean; order?: number },
  ) {
    return this.galleryService.update(id, dto);
  }

  @Delete('admin/gallery/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  delete(@Param('id') id: string) {
    return this.galleryService.delete(id, UPLOADS_PATH);
  }
}
