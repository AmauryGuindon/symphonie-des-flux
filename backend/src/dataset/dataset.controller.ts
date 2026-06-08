import { Controller, Get, Post, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { DatasetService } from './dataset.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';
import { IsOptional, IsString } from 'class-validator';

class CreateVersionDto {
  @IsOptional()
  @IsString()
  description?: string;
}

@Controller('admin/dataset')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class DatasetController {
  constructor(private datasetService: DatasetService) {}

  @Get('versions')
  findAll() {
    return this.datasetService.findAll();
  }

  @Post('versions')
  create(@Body() body: CreateVersionDto) {
    return this.datasetService.create(body.description);
  }

  @Get('versions/:id/export')
  async export(@Param('id') id: string, @Res() res: Response) {
    const data = await this.datasetService.exportJson(id);
    const filename = `dataset-${data.version}-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(data, null, 2));
  }
}
