# DataCut — Pipeline IA & Versioning Dataset

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le site barber existant en une plateforme de données coiffure pour l'IA : pipeline de statuts, labellisation, versioning de datasets, stats de supervision, et script d'entraînement Python.

**Architecture:** Le backend NestJS reçoit des images via le module Gallery existant. Chaque image traverse un pipeline de statuts (raw → validated → labeled → processed → exported). Un nouveau module Dataset crée des snapshots versionnés des images labelisées et les exporte en JSON. Un module Stats fournit les agrégations pour le dashboard Angular. Deux nouveaux écrans admin (Pipeline, Datasets) s'ajoutent au panel existant.

**Tech Stack:** NestJS + Mongoose (backend), Angular 17 standalone signals (frontend), sharp (extraction features), Python 3 + scikit-learn (script entraînement)

---

## Map des fichiers

### Backend — Modifiés
- `backend/src/gallery/schemas/gallery-item.schema.ts` — ajout status, labels, features, datasetVersion
- `backend/src/gallery/dto/update-gallery-item.dto.ts` — ajout labels, status
- `backend/src/gallery/gallery.service.ts` — extraction features à l'upload, endpoints pipeline
- `backend/src/gallery/gallery.controller.ts` — routes PATCH status/labels, GET stats pipeline
- `backend/src/app.module.ts` — import DatasetModule, StatsModule
- `backend/src/main.ts` — fix message startup

### Backend — Créés
- `backend/src/dataset/schemas/dataset-version.schema.ts` — snapshot versionné
- `backend/src/dataset/dataset.service.ts` — create version, list, export JSON
- `backend/src/dataset/dataset.controller.ts` — routes admin dataset
- `backend/src/dataset/dataset.module.ts` — module NestJS
- `backend/src/stats/stats.service.ts` — agrégations MongoDB
- `backend/src/stats/stats.controller.ts` — routes admin stats
- `backend/src/stats/stats.module.ts` — module NestJS

### Frontend — Modifiés
- `src/app/app.routes.ts` — ajout routes /admin/pipeline et /admin/datasets
- `src/app/components/admin/admin.component.html` — ajout liens sidebar

### Frontend — Créés
- `src/app/components/admin/pipeline/pipeline.component.ts`
- `src/app/components/admin/pipeline/pipeline.component.html`
- `src/app/components/admin/pipeline/pipeline.component.scss`
- `src/app/components/admin/datasets/datasets.component.ts`
- `src/app/components/admin/datasets/datasets.component.html`
- `src/app/components/admin/datasets/datasets.component.scss`

### Python
- `python/train.py` — lit le JSON exporté, entraîne un classifier, affiche accuracy

---

## Task 1 — Enrichir le schéma GalleryItem

**Files:**
- Modify: `backend/src/gallery/schemas/gallery-item.schema.ts`
- Modify: `backend/src/gallery/dto/update-gallery-item.dto.ts`
- Modify: `backend/src/gallery/dto/upload-gallery-item.dto.ts`

- [ ] **Step 1 : Mettre à jour le schéma Mongoose**

Remplacer le contenu de `backend/src/gallery/schemas/gallery-item.schema.ts` :

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GalleryItemDocument = GalleryItem & Document;

export type PipelineStatus = 'raw' | 'validated' | 'labeled' | 'processed' | 'exported';

export interface ImageFeatures {
  width: number;
  height: number;
  sizeKb: number;
  format: string;
  dominantColor: string;
}

@Schema({ timestamps: true })
export class GalleryItem {
  @Prop({ required: true }) filename: string;
  @Prop({ required: true }) url: string;
  @Prop() alt?: string;
  @Prop({ enum: ['wide', 'tall', 'large', ''], default: '' }) span?: string;
  @Prop({ enum: ['coupe', 'barbe', 'degrade', ''], default: '' }) category?: string;
  @Prop({ default: 0 }) order: number;
  @Prop({ default: true }) active: boolean;

  // ── Nouveaux champs pipeline ─────────────────────────────────────────────
  @Prop({
    enum: ['raw', 'validated', 'labeled', 'processed', 'exported'],
    default: 'raw',
  })
  status: PipelineStatus;

  @Prop({ type: [String], default: [] })
  labels: string[];

  @Prop({ type: Object })
  features?: ImageFeatures;

  @Prop()
  datasetVersion?: string;
}

export const GalleryItemSchema = SchemaFactory.createForClass(GalleryItem);
```

- [ ] **Step 2 : Mettre à jour UpdateGalleryItemDto**

Remplacer le contenu de `backend/src/gallery/dto/update-gallery-item.dto.ts` :

```typescript
import { Type, Transform } from 'class-transformer';
import { IsOptional, IsString, IsBoolean, IsNumber, IsIn, IsArray } from 'class-validator';

export class UpdateGalleryItemDto {
  @IsOptional()
  @IsString()
  alt?: string;

  @IsOptional()
  @IsIn(['', 'wide', 'tall', 'large'])
  span?: string;

  @IsOptional()
  @IsIn(['', 'coupe', 'barbe', 'degrade'])
  category?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  order?: number;

  @IsOptional()
  @IsIn(['raw', 'validated', 'labeled', 'processed', 'exported'])
  status?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  labels?: string[];
}
```

- [ ] **Step 3 : Installer sharp dans le backend**

```bash
cd "c:/Devoir/Amaury/Ecole 89/Master 1/S6/Symphonie des donnees en flux continu/DataCut/backend"
npm install sharp
npm install --save-dev @types/sharp
```

---

## Task 2 — Extraction de features à l'upload + endpoints pipeline

**Files:**
- Modify: `backend/src/gallery/gallery.service.ts`
- Modify: `backend/src/gallery/gallery.controller.ts`

- [ ] **Step 1 : Mettre à jour GalleryService**

Remplacer le contenu de `backend/src/gallery/gallery.service.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GalleryItem, GalleryItemDocument, ImageFeatures } from './schemas/gallery-item.schema';
import * as sharp from 'sharp';

@Injectable()
export class GalleryService {
  constructor(@InjectModel(GalleryItem.name) private model: Model<GalleryItemDocument>) {}

  findAll() {
    return this.model.find().sort({ order: 1, createdAt: -1 });
  }

  findActive() {
    return this.model.find({ active: true }).sort({ order: 1, createdAt: -1 });
  }

  async create(
    filename: string,
    url: string,
    filePath: string,
    sizeBytes: number,
    mimetype: string,
    alt?: string,
    span?: string,
    category?: string,
  ) {
    const count = await this.model.countDocuments();
    const features = await this.extractFeatures(filePath, sizeBytes, mimetype);
    return this.model.create({
      filename,
      url,
      alt,
      span: span ?? '',
      category: category ?? '',
      order: count,
      status: 'raw',
      labels: [],
      features,
    });
  }

  private async extractFeatures(
    filePath: string,
    sizeBytes: number,
    mimetype: string,
  ): Promise<ImageFeatures> {
    try {
      const image = sharp(filePath);
      const meta = await image.metadata();
      const { dominant } = await image.stats();
      const hex = '#' + [dominant.r, dominant.g, dominant.b]
        .map(v => v.toString(16).padStart(2, '0'))
        .join('');
      return {
        width: meta.width ?? 0,
        height: meta.height ?? 0,
        sizeKb: Math.round(sizeBytes / 1024),
        format: meta.format ?? mimetype.split('/')[1] ?? 'unknown',
        dominantColor: hex,
      };
    } catch {
      return {
        width: 0,
        height: 0,
        sizeKb: Math.round(sizeBytes / 1024),
        format: mimetype.split('/')[1] ?? 'unknown',
        dominantColor: '#000000',
      };
    }
  }

  update(id: string, dto: {
    alt?: string;
    span?: string;
    category?: string;
    active?: boolean;
    order?: number;
    status?: string;
    labels?: string[];
  }) {
    return this.model.findByIdAndUpdate(id, dto, { new: true });
  }

  async reorder(items: { id: string; order: number }[]) {
    await Promise.all(items.map(({ id, order }) => this.model.findByIdAndUpdate(id, { order })));
  }

  async delete(id: string, uploadsPath: string) {
    const item = await this.model.findById(id);
    if (!item) return null;
    const fs = await import('fs/promises');
    const filePath = `${uploadsPath}/${item.filename}`;
    await fs.unlink(filePath).catch(() => {});
    return item.deleteOne();
  }

  // ── Pipeline ─────────────────────────────────────────────────────────────

  findByStatus(status: string) {
    return this.model.find({ status }).sort({ createdAt: -1 });
  }

  async pipelineStats() {
    const statuses = ['raw', 'validated', 'labeled', 'processed', 'exported'];
    const counts = await Promise.all(
      statuses.map(async s => ({ status: s, count: await this.model.countDocuments({ status: s }) }))
    );
    const total = await this.model.countDocuments();
    return { total, byStatus: counts };
  }
}
```

- [ ] **Step 2 : Mettre à jour GalleryController**

Remplacer le contenu de `backend/src/gallery/gallery.controller.ts` :

```typescript
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

  // ── Public ──────────────────────────────────────────────────────────────

  @Get('gallery')
  getActive() {
    return this.galleryService.findActive();
  }

  // ── Admin — lecture ──────────────────────────────────────────────────────

  @Get('admin/gallery')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  getAll() {
    return this.galleryService.findAll();
  }

  @Get('admin/gallery/pipeline-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  pipelineStats() {
    return this.galleryService.pipelineStats();
  }

  // ── Admin — upload ───────────────────────────────────────────────────────

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
    limits: { fileSize: 5 * 1024 * 1024 },
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadGalleryItemDto,
  ) {
    if (!file) throw new BadRequestException('Fichier requis');
    const url = `/uploads/gallery/${file.filename}`;
    return this.galleryService.create(
      file.filename,
      url,
      file.path,
      file.size,
      file.mimetype,
      body.alt,
      body.span,
      body.category,
    );
  }

  // ── Admin — modification ─────────────────────────────────────────────────

  @Patch('admin/gallery/reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  async reorder(@Body() body: { items: { id: string; order: number }[] }) {
    await this.galleryService.reorder(body.items);
    return { ok: true };
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
```

---

## Task 3 — Module Dataset (versioning + export)

**Files:**
- Create: `backend/src/dataset/schemas/dataset-version.schema.ts`
- Create: `backend/src/dataset/dataset.service.ts`
- Create: `backend/src/dataset/dataset.controller.ts`
- Create: `backend/src/dataset/dataset.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1 : Créer le schéma DatasetVersion**

Créer `backend/src/dataset/schemas/dataset-version.schema.ts` :

```typescript
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DatasetVersionDocument = DatasetVersion & Document;

@Schema({ timestamps: true })
export class DatasetVersion {
  @Prop({ required: true }) version: string;       // ex: "v1", "v2"
  @Prop({ required: true }) imageCount: number;
  @Prop({ type: [String], default: [] }) imageIds: string[];
  @Prop({ type: [String], default: [] }) labelsIncluded: string[];
  @Prop() description?: string;
}

export const DatasetVersionSchema = SchemaFactory.createForClass(DatasetVersion);
```

- [ ] **Step 2 : Créer DatasetService**

Créer `backend/src/dataset/dataset.service.ts` :

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { DatasetVersion, DatasetVersionDocument } from './schemas/dataset-version.schema';
import { GalleryItem, GalleryItemDocument } from '../gallery/schemas/gallery-item.schema';

@Injectable()
export class DatasetService {
  constructor(
    @InjectModel(DatasetVersion.name) private versionModel: Model<DatasetVersionDocument>,
    @InjectModel(GalleryItem.name) private galleryModel: Model<GalleryItemDocument>,
  ) {}

  findAll() {
    return this.versionModel.find().sort({ createdAt: -1 });
  }

  async create(description?: string) {
    // Snapshot de toutes les images avec statut >= labeled
    const eligibleStatuses = ['labeled', 'processed', 'exported'];
    const images = await this.galleryModel.find({ status: { $in: eligibleStatuses } });

    const count = await this.versionModel.countDocuments();
    const version = `v${count + 1}`;

    const allLabels = [...new Set(images.flatMap(img => img.labels ?? []))];

    // Marquer les images comme exportées
    await this.galleryModel.updateMany(
      { _id: { $in: images.map(i => i._id) } },
      { status: 'exported', datasetVersion: version },
    );

    return this.versionModel.create({
      version,
      imageCount: images.length,
      imageIds: images.map(i => (i._id as any).toString()),
      labelsIncluded: allLabels,
      description,
    });
  }

  async exportJson(id: string) {
    const v = await this.versionModel.findById(id);
    if (!v) throw new NotFoundException('Version introuvable');

    const images = await this.galleryModel.find({
      _id: { $in: v.imageIds },
    });

    return {
      version: v.version,
      createdAt: (v as any).createdAt,
      imageCount: v.imageCount,
      labelsIncluded: v.labelsIncluded,
      description: v.description,
      images: images.map(img => ({
        id: (img._id as any).toString(),
        url: img.url,
        labels: img.labels ?? [],
        category: img.category,
        features: img.features ?? null,
        status: img.status,
      })),
    };
  }
}
```

- [ ] **Step 3 : Créer DatasetController**

Créer `backend/src/dataset/dataset.controller.ts` :

```typescript
import { Controller, Get, Post, Param, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { DatasetService } from './dataset.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '../common/enums/role.enum';

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
  create(@Body() body: { description?: string }) {
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
```

- [ ] **Step 4 : Créer DatasetModule**

Créer `backend/src/dataset/dataset.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DatasetVersion, DatasetVersionSchema } from './schemas/dataset-version.schema';
import { GalleryItem, GalleryItemSchema } from '../gallery/schemas/gallery-item.schema';
import { DatasetService } from './dataset.service';
import { DatasetController } from './dataset.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DatasetVersion.name, schema: DatasetVersionSchema },
      { name: GalleryItem.name, schema: GalleryItemSchema },
    ]),
  ],
  providers: [DatasetService],
  controllers: [DatasetController],
})
export class DatasetModule {}
```

- [ ] **Step 5 : Enregistrer DatasetModule dans AppModule**

Dans `backend/src/app.module.ts`, ajouter l'import :

```typescript
import { DatasetModule } from './dataset/dataset.module';

// Dans @Module({ imports: [...] }) ajouter :
DatasetModule,
```

---

## Task 4 — Module Stats

**Files:**
- Create: `backend/src/stats/stats.service.ts`
- Create: `backend/src/stats/stats.controller.ts`
- Create: `backend/src/stats/stats.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1 : Créer StatsService**

Créer `backend/src/stats/stats.service.ts` :

```typescript
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { GalleryItem, GalleryItemDocument } from '../gallery/schemas/gallery-item.schema';
import { DatasetVersion, DatasetVersionDocument } from '../dataset/schemas/dataset-version.schema';

@Injectable()
export class StatsService {
  constructor(
    @InjectModel(GalleryItem.name) private galleryModel: Model<GalleryItemDocument>,
    @InjectModel(DatasetVersion.name) private versionModel: Model<DatasetVersionDocument>,
  ) {}

  async getPipelineStats() {
    const statuses = ['raw', 'validated', 'labeled', 'processed', 'exported'];
    const byStatus = await Promise.all(
      statuses.map(async status => ({
        status,
        count: await this.galleryModel.countDocuments({ status }),
      }))
    );
    const total = await this.galleryModel.countDocuments();
    const versionsCount = await this.versionModel.countDocuments();
    return { total, byStatus, versionsCount };
  }

  async getGrowth() {
    const weeks: { week: string; count: number }[] = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - i * 7);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);
      const count = await this.galleryModel.countDocuments({
        createdAt: { $gte: start, $lt: end },
      });
      weeks.push({
        week: start.toISOString().slice(0, 10),
        count,
      });
    }
    return weeks;
  }

  async getLabelDistribution() {
    const result = await this.galleryModel.aggregate([
      { $unwind: { path: '$labels', preserveNullAndEmptyArrays: false } },
      { $group: { _id: '$labels', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { label: '$_id', count: 1, _id: 0 } },
    ]);
    return result;
  }
}
```

- [ ] **Step 2 : Créer StatsController**

Créer `backend/src/stats/stats.controller.ts` :

```typescript
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
```

- [ ] **Step 3 : Créer StatsModule**

Créer `backend/src/stats/stats.module.ts` :

```typescript
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { GalleryItem, GalleryItemSchema } from '../gallery/schemas/gallery-item.schema';
import { DatasetVersion, DatasetVersionSchema } from '../dataset/schemas/dataset-version.schema';
import { StatsService } from './stats.service';
import { StatsController } from './stats.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: GalleryItem.name, schema: GalleryItemSchema },
      { name: DatasetVersion.name, schema: DatasetVersionSchema },
    ]),
  ],
  providers: [StatsService],
  controllers: [StatsController],
})
export class StatsModule {}
```

- [ ] **Step 4 : Enregistrer StatsModule dans AppModule**

Dans `backend/src/app.module.ts`, ajouter :

```typescript
import { StatsModule } from './stats/stats.module';

// Dans @Module({ imports: [...] }) ajouter :
StatsModule,
```

- [ ] **Step 5 : Fix message de démarrage dans main.ts**

Dans `backend/src/main.ts`, remplacer :
```typescript
console.log(`Backend Dany1st démarré sur http://localhost:${port}/api`);
```
par :
```typescript
console.log(`Backend DataCut démarré sur http://localhost:${port}/api`);
```

- [ ] **Step 6 : Builder et tester le backend**

```bash
cd "c:/Devoir/Amaury/Ecole 89/Master 1/S6/Symphonie des donnees en flux continu/DataCut/backend"
npm run start:dev
```

Vérifier dans la console : aucune erreur TypeScript, le serveur démarre sur le port 3001.

Tester manuellement avec curl ou un navigateur :
- `GET http://localhost:3001/api/gallery` → tableau JSON (peut être vide)
- `GET http://localhost:3001/api/admin/stats/pipeline` → nécessite un token JWT admin

---

## Task 5 — Frontend : Page Pipeline admin

**Files:**
- Create: `src/app/components/admin/pipeline/pipeline.component.ts`
- Create: `src/app/components/admin/pipeline/pipeline.component.html`
- Create: `src/app/components/admin/pipeline/pipeline.component.scss`
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/components/admin/admin.component.html`

- [ ] **Step 1 : Créer le composant TypeScript**

Créer `src/app/components/admin/pipeline/pipeline.component.ts` :

```typescript
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../../../services/auth.service';

const API = 'http://localhost:3001/api';

export type PipelineStatus = 'raw' | 'validated' | 'labeled' | 'processed' | 'exported';

const PIPELINE_ORDER: PipelineStatus[] = ['raw', 'validated', 'labeled', 'processed', 'exported'];
const STATUS_LABELS: Record<PipelineStatus, string> = {
  raw: 'Brut',
  validated: 'Validé',
  labeled: 'Labelisé',
  processed: 'Traité',
  exported: 'Exporté',
};

interface PipelineItem {
  _id: string;
  url: string;
  alt?: string;
  category?: string;
  status: PipelineStatus;
  labels: string[];
  features?: {
    width: number;
    height: number;
    sizeKb: number;
    format: string;
    dominantColor: string;
  };
  createdAt: string;
}

interface PipelineStats {
  total: number;
  byStatus: { status: string; count: number }[];
  versionsCount: number;
}

const AVAILABLE_LABELS = [
  'fade', 'dégradé', 'taper', 'burst-fade', 'afro', 'tresse',
  'barbe', 'rasage', 'avant', 'après', 'enfant', 'adulte',
];

@Component({
  selector: 'app-admin-pipeline',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './pipeline.component.html',
  styleUrl: './pipeline.component.scss',
})
export class AdminPipelineComponent implements OnInit {
  stats    = signal<PipelineStats | null>(null);
  items    = signal<PipelineItem[]>([]);
  loading  = signal(true);
  toast    = signal<{ message: string; type: 'ok' | 'err' } | null>(null);

  filterStatus = signal<PipelineStatus | 'all'>('all');

  readonly statusOrder = PIPELINE_ORDER;
  readonly statusLabels = STATUS_LABELS;
  readonly availableLabels = AVAILABLE_LABELS;

  filteredItems = computed(() => {
    const f = this.filterStatus();
    const all = this.items();
    return f === 'all' ? all : all.filter(i => i.status === f);
  });

  constructor(private http: HttpClient, private auth: AuthService) {}

  ngOnInit() {
    this.load();
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('datacut_token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  load() {
    this.loading.set(true);
    const h = this.headers();
    this.http.get<PipelineStats>(`${API}/admin/stats/pipeline`, { headers: h }).subscribe({
      next: s => this.stats.set(s),
    });
    this.http.get<PipelineItem[]>(`${API}/admin/gallery`, { headers: h }).subscribe({
      next: items => {
        this.items.set(items.map(i => ({
          ...i,
          url: i.url.startsWith('/') ? `http://localhost:3001${i.url}` : i.url,
        })));
        this.loading.set(false);
      },
      error: () => { this.loading.set(false); this.showToast('Erreur de chargement', 'err'); },
    });
  }

  advance(item: PipelineItem) {
    const idx = PIPELINE_ORDER.indexOf(item.status);
    if (idx >= PIPELINE_ORDER.length - 1) return;
    const nextStatus = PIPELINE_ORDER[idx + 1];
    this.patch(item._id, { status: nextStatus });
  }

  toggleLabel(item: PipelineItem, label: string) {
    const current = item.labels ?? [];
    const updated = current.includes(label)
      ? current.filter(l => l !== label)
      : [...current, label];
    this.patch(item._id, { labels: updated });
  }

  private patch(id: string, body: object) {
    this.http.patch(`${API}/admin/gallery/${id}`, body, { headers: this.headers() }).subscribe({
      next: (updated: any) => {
        this.items.update(items => items.map(i => i._id === id ? { ...i, ...updated, url: i.url } : i));
        this.stats.set(null);
        this.http.get<PipelineStats>(`${API}/admin/stats/pipeline`, { headers: this.headers() }).subscribe({
          next: s => this.stats.set(s),
        });
        this.showToast('Mis à jour', 'ok');
      },
      error: () => this.showToast('Erreur de mise à jour', 'err'),
    });
  }

  getStatusIndex(status: PipelineStatus): number {
    return PIPELINE_ORDER.indexOf(status);
  }

  nextStatusLabel(status: PipelineStatus): string {
    const idx = PIPELINE_ORDER.indexOf(status);
    if (idx >= PIPELINE_ORDER.length - 1) return '';
    return STATUS_LABELS[PIPELINE_ORDER[idx + 1]];
  }

  isLastStatus(status: PipelineStatus): boolean {
    return PIPELINE_ORDER.indexOf(status) >= PIPELINE_ORDER.length - 1;
  }

  private showToast(message: string, type: 'ok' | 'err') {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 2500);
  }
}
```

- [ ] **Step 2 : Créer le template HTML**

Créer `src/app/components/admin/pipeline/pipeline.component.html` :

```html
@if (toast()) {
  <div class="pipe__toast" [class.pipe__toast--err]="toast()!.type === 'err'">
    {{ toast()!.message }}
  </div>
}

<div class="pipe">
  <div class="pipe__header">
    <h2 class="pipe__title">Pipeline de données</h2>
  </div>

  <!-- Funnel stats -->
  @if (stats(); as s) {
    <div class="pipe__funnel">
      @for (step of statusOrder; track step) {
        <div
          class="pipe__funnel-step"
          [class.pipe__funnel-step--active]="filterStatus() === step"
          (click)="filterStatus.set(filterStatus() === step ? 'all' : step)"
        >
          <span class="pipe__funnel-count">
            {{ s.byStatus | pipelineCount:step }}
          </span>
          <span class="pipe__funnel-label">{{ statusLabels[step] }}</span>
          <div class="pipe__funnel-bar">
            <div
              class="pipe__funnel-fill"
              [style.width.%]="s.total > 0 ? ((s.byStatus | pipelineCount:step) / s.total) * 100 : 0"
            ></div>
          </div>
        </div>
        @if (step !== 'exported') {
          <div class="pipe__funnel-arrow">→</div>
        }
      }
    </div>
    <div class="pipe__meta">
      <span>{{ s.total }} image{{ s.total > 1 ? 's' : '' }} au total</span>
      <span>·</span>
      <span>{{ s.versionsCount }} version{{ s.versionsCount > 1 ? 's' : '' }} de dataset</span>
    </div>
  }

  <!-- Filtre -->
  <div class="pipe__filters">
    <button
      class="pipe__filter-btn"
      [class.pipe__filter-btn--active]="filterStatus() === 'all'"
      (click)="filterStatus.set('all')"
    >Toutes</button>
    @for (step of statusOrder; track step) {
      <button
        class="pipe__filter-btn"
        [class.pipe__filter-btn--active]="filterStatus() === step"
        (click)="filterStatus.set(step)"
      >{{ statusLabels[step] }}</button>
    }
  </div>

  <!-- Table -->
  @if (loading()) {
    <p class="pipe__loading">Chargement…</p>
  } @else if (filteredItems().length === 0) {
    <p class="pipe__empty">Aucune image dans cette catégorie.</p>
  } @else {
    <div class="pipe__table-wrap">
      <table class="pipe__table">
        <thead>
          <tr>
            <th>Aperçu</th>
            <th>Fichier</th>
            <th>Features</th>
            <th>Statut</th>
            <th>Labels</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          @for (item of filteredItems(); track item._id) {
            <tr>
              <td>
                <img [src]="item.url" [alt]="item.alt ?? ''" class="pipe__thumb" />
              </td>
              <td>
                <span class="pipe__filename">{{ item.alt || '—' }}</span>
                <span class="pipe__category">{{ item.category || 'non catégorisé' }}</span>
              </td>
              <td>
                @if (item.features) {
                  <div class="pipe__features">
                    <span>{{ item.features.width }}×{{ item.features.height }}</span>
                    <span>{{ item.features.sizeKb }} Ko</span>
                    <span class="pipe__color-dot" [style.background]="item.features.dominantColor"></span>
                  </div>
                } @else {
                  <span class="pipe__na">—</span>
                }
              </td>
              <td>
                <span class="pipe__status pipe__status--{{ item.status }}">
                  {{ statusLabels[item.status] }}
                </span>
              </td>
              <td>
                <div class="pipe__labels">
                  @for (label of availableLabels; track label) {
                    <button
                      class="pipe__label-chip"
                      [class.pipe__label-chip--active]="item.labels?.includes(label)"
                      (click)="toggleLabel(item, label)"
                    >{{ label }}</button>
                  }
                </div>
              </td>
              <td>
                @if (!isLastStatus(item.status)) {
                  <button class="pipe__advance-btn" (click)="advance(item)">
                    → {{ nextStatusLabel(item.status) }}
                  </button>
                } @else {
                  <span class="pipe__done">✓ Exporté</span>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  }
</div>
```

Note : le pipe `pipelineCount` n'existe pas encore — remplacer dans le template en utilisant une méthode du composant à la place. Modifier la ligne dans le template :
```html
{{ s.byStatus | pipelineCount:step }}
```
par une méthode dans le composant :
```typescript
// Ajouter dans la classe :
getCount(byStatus: { status: string; count: number }[], status: string): number {
  return byStatus.find(s => s.status === status)?.count ?? 0;
}
```
Et dans le HTML :
```html
{{ getCount(s.byStatus, step) }}
```
(Faire de même pour le `[style.width.%]`.)

- [ ] **Step 3 : Créer le SCSS**

Créer `src/app/components/admin/pipeline/pipeline.component.scss` :

```scss
@use '../admin-shared' as *;

.pipe {
  @include page-padding;

  &__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
  }

  &__title { @include page-title; }

  &__loading, &__empty {
    @include loading;
  }

  &__toast {
    position: fixed;
    bottom: 2rem; left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    background: #1e3a2e;
    border: 1px solid #4caf82;
    color: #4caf82;
    font-size: .82rem;
    padding: .75rem 2rem;
    border-radius: 6px;
    box-shadow: 0 4px 24px rgba(0,0,0,.5);
    white-space: nowrap;
    &--err { background: #3a1e1e; border-color: #e74c3c; color: #e74c3c; }
  }

  // ── Funnel ──────────────────────────────────────────────────────────────

  &__funnel {
    display: flex;
    align-items: center;
    gap: .5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  &__funnel-step {
    @include card;
    min-width: 110px;
    cursor: pointer;
    transition: border-color .2s;
    &:hover, &--active { border-color: #C9A44A; }
  }

  &__funnel-count {
    display: block;
    font-size: 1.8rem;
    font-weight: 700;
    color: #C9A44A;
    line-height: 1;
  }

  &__funnel-label {
    display: block;
    font-size: .72rem;
    color: rgba(255,255,255,.5);
    text-transform: uppercase;
    letter-spacing: .08em;
    margin: .3rem 0 .5rem;
  }

  &__funnel-bar {
    height: 4px;
    background: rgba(255,255,255,.08);
    border-radius: 2px;
    overflow: hidden;
  }

  &__funnel-fill {
    height: 100%;
    background: #C9A44A;
    border-radius: 2px;
    transition: width .4s ease;
  }

  &__funnel-arrow {
    color: rgba(255,255,255,.2);
    font-size: 1.2rem;
  }

  &__meta {
    display: flex;
    gap: .75rem;
    font-size: .78rem;
    color: rgba(255,255,255,.3);
    margin-bottom: 1.5rem;
  }

  // ── Filtres ──────────────────────────────────────────────────────────────

  &__filters {
    display: flex;
    gap: .5rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
  }

  &__filter-btn {
    padding: .3rem .9rem;
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,.12);
    background: transparent;
    color: rgba(255,255,255,.5);
    font-size: .78rem;
    cursor: pointer;
    transition: all .15s;
    &:hover { border-color: rgba(201,164,74,.4); color: rgba(255,255,255,.8); }
    &--active { background: rgba(201,164,74,.15); border-color: #C9A44A; color: #C9A44A; }
  }

  // ── Table ────────────────────────────────────────────────────────────────

  &__table-wrap { overflow-x: auto; }

  &__table {
    width: 100%;
    border-collapse: collapse;
    font-size: .82rem;

    th {
      text-align: left;
      padding: .6rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,.08);
      color: rgba(255,255,255,.35);
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: .06em;
      font-size: .7rem;
    }

    td {
      padding: .75rem 1rem;
      border-bottom: 1px solid rgba(255,255,255,.04);
      vertical-align: middle;
    }

    tr:hover td { background: rgba(255,255,255,.02); }
  }

  &__thumb {
    width: 60px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    display: block;
  }

  &__filename {
    display: block;
    color: #fff;
    font-size: .82rem;
  }

  &__category {
    display: block;
    font-size: .72rem;
    color: rgba(255,255,255,.3);
    margin-top: .15rem;
  }

  &__features {
    display: flex;
    flex-direction: column;
    gap: .2rem;
    font-size: .72rem;
    color: rgba(255,255,255,.4);
  }

  &__color-dot {
    display: inline-block;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid rgba(255,255,255,.2);
    vertical-align: middle;
  }

  &__na { color: rgba(255,255,255,.2); }

  &__status {
    display: inline-block;
    padding: .2rem .6rem;
    border-radius: 12px;
    font-size: .72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: .06em;

    &--raw       { background: rgba(100,100,100,.2); color: #aaa; }
    &--validated { background: rgba(52,152,219,.15); color: #5dade2; }
    &--labeled   { background: rgba(201,164,74,.15); color: #C9A44A; }
    &--processed { background: rgba(46,204,113,.12); color: #58d68d; }
    &--exported  { background: rgba(155,89,182,.15); color: #af7ac5; }
  }

  &__labels {
    display: flex;
    flex-wrap: wrap;
    gap: .3rem;
    max-width: 280px;
  }

  &__label-chip {
    padding: .15rem .5rem;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,.1);
    background: transparent;
    color: rgba(255,255,255,.4);
    font-size: .68rem;
    cursor: pointer;
    transition: all .15s;
    &:hover { border-color: rgba(201,164,74,.4); }
    &--active { background: rgba(201,164,74,.2); border-color: #C9A44A; color: #C9A44A; }
  }

  &__advance-btn {
    @include btn-primary;
    font-size: .75rem;
    white-space: nowrap;
  }

  &__done {
    color: rgba(46,204,113,.7);
    font-size: .78rem;
  }
}
```

---

## Task 6 — Frontend : Page Datasets admin

**Files:**
- Create: `src/app/components/admin/datasets/datasets.component.ts`
- Create: `src/app/components/admin/datasets/datasets.component.html`
- Create: `src/app/components/admin/datasets/datasets.component.scss`

- [ ] **Step 1 : Créer le composant TypeScript**

Créer `src/app/components/admin/datasets/datasets.component.ts` :

```typescript
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const API = 'http://localhost:3001/api';

interface DatasetVersion {
  _id: string;
  version: string;
  imageCount: number;
  labelsIncluded: string[];
  description?: string;
  createdAt: string;
}

interface GrowthPoint { week: string; count: number; }
interface LabelStat { label: string; count: number; }

@Component({
  selector: 'app-admin-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './datasets.component.html',
  styleUrl: './datasets.component.scss',
})
export class AdminDatasetsComponent implements OnInit {
  versions    = signal<DatasetVersion[]>([]);
  growth      = signal<GrowthPoint[]>([]);
  labels      = signal<LabelStat[]>([]);
  loading     = signal(true);
  creating    = signal(false);
  toast       = signal<{ message: string; type: 'ok' | 'err' } | null>(null);
  description = signal('');

  maxGrowth = 0;
  maxLabelCount = 0;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
  }

  private headers(): HttpHeaders {
    const token = localStorage.getItem('datacut_token');
    return new HttpHeaders({ Authorization: `Bearer ${token}` });
  }

  load() {
    this.loading.set(true);
    const h = this.headers();

    this.http.get<DatasetVersion[]>(`${API}/admin/dataset/versions`, { headers: h }).subscribe({
      next: v => this.versions.set(v),
    });

    this.http.get<GrowthPoint[]>(`${API}/admin/stats/growth`, { headers: h }).subscribe({
      next: g => {
        this.growth.set(g);
        this.maxGrowth = Math.max(...g.map(p => p.count), 1);
      },
    });

    this.http.get<LabelStat[]>(`${API}/admin/stats/labels`, { headers: h }).subscribe({
      next: l => {
        this.labels.set(l);
        this.maxLabelCount = Math.max(...l.map(s => s.count), 1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  createVersion() {
    this.creating.set(true);
    this.http.post<DatasetVersion>(
      `${API}/admin/dataset/versions`,
      { description: this.description() || undefined },
      { headers: this.headers() },
    ).subscribe({
      next: v => {
        this.versions.update(list => [v, ...list]);
        this.description.set('');
        this.creating.set(false);
        this.showToast(`Version ${v.version} créée (${v.imageCount} images)`, 'ok');
        this.load();
      },
      error: () => {
        this.creating.set(false);
        this.showToast('Erreur lors de la création', 'err');
      },
    });
  }

  exportVersion(v: DatasetVersion) {
    const token = localStorage.getItem('datacut_token');
    const url = `${API}/admin/dataset/versions/${v._id}/export`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `dataset-${v.version}-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.showToast(`Export ${v.version} téléchargé`, 'ok');
      })
      .catch(() => this.showToast('Erreur export', 'err'));
  }

  barHeight(count: number, max: number): number {
    return max > 0 ? Math.round((count / max) * 100) : 0;
  }

  private showToast(message: string, type: 'ok' | 'err') {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3000);
  }
}
```

- [ ] **Step 2 : Créer le template HTML**

Créer `src/app/components/admin/datasets/datasets.component.html` :

```html
@if (toast()) {
  <div class="ds__toast" [class.ds__toast--err]="toast()!.type === 'err'">
    {{ toast()!.message }}
  </div>
}

<div class="ds">
  <div class="ds__header">
    <h2 class="ds__title">Datasets & Versions</h2>
  </div>

  <!-- Créer une version -->
  <div class="ds__create-card">
    <h3 class="ds__create-title">Créer une nouvelle version</h3>
    <p class="ds__create-hint">
      Capture un snapshot de toutes les images au statut <strong>labelisé</strong>, <strong>traité</strong> ou <strong>exporté</strong>.
    </p>
    <div class="ds__create-row">
      <input
        class="ds__create-input"
        type="text"
        placeholder="Description (optionnel)"
        [value]="description()"
        (input)="description.set($any($event.target).value)"
      />
      <button
        class="ds__create-btn"
        [disabled]="creating()"
        (click)="createVersion()"
      >
        {{ creating() ? 'Création…' : '+ Créer version' }}
      </button>
    </div>
  </div>

  @if (loading()) {
    <p class="ds__loading">Chargement…</p>
  } @else {

    <!-- Graphes -->
    <div class="ds__charts">

      <!-- Croissance du dataset -->
      <div class="ds__chart-card">
        <h4 class="ds__chart-title">Croissance du dataset (8 semaines)</h4>
        <div class="ds__bar-chart">
          @for (point of growth(); track point.week) {
            <div class="ds__bar-group">
              <div class="ds__bar-wrap">
                <div
                  class="ds__bar"
                  [style.height.%]="barHeight(point.count, maxGrowth)"
                  [title]="point.count + ' images'"
                ></div>
              </div>
              <span class="ds__bar-label">{{ point.week | date:'dd/MM' }}</span>
            </div>
          }
        </div>
      </div>

      <!-- Distribution des labels -->
      <div class="ds__chart-card">
        <h4 class="ds__chart-title">Distribution des labels</h4>
        @if (labels().length === 0) {
          <p class="ds__empty">Aucun label attribué pour l'instant.</p>
        } @else {
          <div class="ds__label-bars">
            @for (stat of labels(); track stat.label) {
              <div class="ds__label-row">
                <span class="ds__label-name">{{ stat.label }}</span>
                <div class="ds__label-bar-wrap">
                  <div
                    class="ds__label-bar-fill"
                    [style.width.%]="barHeight(stat.count, maxLabelCount)"
                  ></div>
                </div>
                <span class="ds__label-count">{{ stat.count }}</span>
              </div>
            }
          </div>
        }
      </div>

    </div>

    <!-- Liste des versions -->
    <div class="ds__versions">
      <h3 class="ds__versions-title">Historique des versions</h3>
      @if (versions().length === 0) {
        <p class="ds__empty">Aucune version créée. Utilisez le formulaire ci-dessus.</p>
      } @else {
        <div class="ds__version-list">
          @for (v of versions(); track v._id) {
            <div class="ds__version-card">
              <div class="ds__version-head">
                <span class="ds__version-tag">{{ v.version }}</span>
                <span class="ds__version-date">{{ v.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
              <div class="ds__version-body">
                <span class="ds__version-stat">{{ v.imageCount }} image{{ v.imageCount > 1 ? 's' : '' }}</span>
                @if (v.description) {
                  <span class="ds__version-desc">{{ v.description }}</span>
                }
                <div class="ds__version-labels">
                  @for (label of v.labelsIncluded; track label) {
                    <span class="ds__version-label">{{ label }}</span>
                  }
                  @if (v.labelsIncluded.length === 0) {
                    <span class="ds__version-no-label">Aucun label</span>
                  }
                </div>
              </div>
              <button class="ds__export-btn" (click)="exportVersion(v)">
                ↓ Exporter JSON
              </button>
            </div>
          }
        </div>
      }
    </div>

  }
</div>
```

- [ ] **Step 3 : Créer le SCSS**

Créer `src/app/components/admin/datasets/datasets.component.scss` :

```scss
@use '../admin-shared' as *;

.ds {
  @include page-padding;

  &__header { margin-bottom: 2rem; }
  &__title   { @include page-title; }
  &__loading, &__empty { @include loading; }

  &__toast {
    position: fixed;
    bottom: 2rem; left: 50%;
    transform: translateX(-50%);
    z-index: 2000;
    background: #1e3a2e;
    border: 1px solid #4caf82;
    color: #4caf82;
    font-size: .82rem;
    padding: .75rem 2rem;
    border-radius: 6px;
    box-shadow: 0 4px 24px rgba(0,0,0,.5);
    white-space: nowrap;
    &--err { background: #3a1e1e; border-color: #e74c3c; color: #e74c3c; }
  }

  // ── Création ─────────────────────────────────────────────────────────────

  &__create-card {
    @include card;
    margin-bottom: 2rem;
  }

  &__create-title {
    font-size: 1rem;
    font-weight: 600;
    color: #fff;
    margin: 0 0 .4rem;
  }

  &__create-hint {
    font-size: .8rem;
    color: rgba(255,255,255,.4);
    margin: 0 0 1rem;
    strong { color: rgba(255,255,255,.6); }
  }

  &__create-row {
    display: flex;
    gap: .75rem;
    @media (max-width: 600px) { flex-direction: column; }
  }

  &__create-input {
    flex: 1;
    background: rgba(255,255,255,.05);
    border: 1px solid rgba(255,255,255,.1);
    border-radius: 6px;
    padding: .55rem 1rem;
    color: #fff;
    font-size: .85rem;
    outline: none;
    &::placeholder { color: rgba(255,255,255,.25); }
    &:focus { border-color: rgba(201,164,74,.4); }
  }

  &__create-btn { @include btn-primary; }

  // ── Graphes ───────────────────────────────────────────────────────────────

  &__charts {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.25rem;
    margin-bottom: 2rem;
    @media (max-width: 900px) { grid-template-columns: 1fr; }
  }

  &__chart-card { @include card; }

  &__chart-title {
    font-size: .85rem;
    font-weight: 600;
    color: rgba(255,255,255,.7);
    margin: 0 0 1.25rem;
  }

  // Bar chart croissance

  &__bar-chart {
    display: flex;
    align-items: flex-end;
    gap: .5rem;
    height: 100px;
  }

  &__bar-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  &__bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
  }

  &__bar {
    width: 100%;
    background: linear-gradient(to top, #C9A44A, rgba(201,164,74,.3));
    border-radius: 3px 3px 0 0;
    min-height: 2px;
    transition: height .3s ease;
  }

  &__bar-label {
    font-size: .62rem;
    color: rgba(255,255,255,.25);
    margin-top: .3rem;
    white-space: nowrap;
  }

  // Distribution labels

  &__label-bars {
    display: flex;
    flex-direction: column;
    gap: .6rem;
  }

  &__label-row {
    display: flex;
    align-items: center;
    gap: .75rem;
  }

  &__label-name {
    font-size: .75rem;
    color: rgba(255,255,255,.6);
    width: 90px;
    flex-shrink: 0;
  }

  &__label-bar-wrap {
    flex: 1;
    height: 6px;
    background: rgba(255,255,255,.06);
    border-radius: 3px;
    overflow: hidden;
  }

  &__label-bar-fill {
    height: 100%;
    background: #C9A44A;
    border-radius: 3px;
    transition: width .4s ease;
  }

  &__label-count {
    font-size: .72rem;
    color: rgba(255,255,255,.35);
    width: 24px;
    text-align: right;
  }

  // ── Versions ──────────────────────────────────────────────────────────────

  &__versions-title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(255,255,255,.7);
    margin: 0 0 1rem;
  }

  &__version-list {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1rem;
  }

  &__version-card {
    @include card;
    display: flex;
    flex-direction: column;
    gap: .75rem;
  }

  &__version-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  &__version-tag {
    font-size: 1.1rem;
    font-weight: 700;
    color: #C9A44A;
    letter-spacing: .05em;
  }

  &__version-date {
    font-size: .72rem;
    color: rgba(255,255,255,.3);
  }

  &__version-body {
    display: flex;
    flex-direction: column;
    gap: .4rem;
  }

  &__version-stat {
    font-size: .82rem;
    color: rgba(255,255,255,.6);
  }

  &__version-desc {
    font-size: .78rem;
    color: rgba(255,255,255,.4);
    font-style: italic;
  }

  &__version-labels {
    display: flex;
    flex-wrap: wrap;
    gap: .3rem;
    margin-top: .2rem;
  }

  &__version-label {
    padding: .15rem .5rem;
    border-radius: 10px;
    background: rgba(201,164,74,.12);
    border: 1px solid rgba(201,164,74,.25);
    color: rgba(201,164,74,.8);
    font-size: .68rem;
  }

  &__version-no-label {
    font-size: .72rem;
    color: rgba(255,255,255,.2);
  }

  &__export-btn {
    @include btn-primary;
    font-size: .78rem;
    align-self: flex-start;
  }
}
```

---

## Task 7 — Câblage des routes et sidebar Angular

**Files:**
- Modify: `src/app/app.routes.ts`
- Modify: `src/app/components/admin/admin.component.html`

- [ ] **Step 1 : Ajouter les routes dans app.routes.ts**

Dans `src/app/app.routes.ts`, ajouter les imports :
```typescript
import { AdminPipelineComponent } from './components/admin/pipeline/pipeline.component';
import { AdminDatasetsComponent } from './components/admin/datasets/datasets.component';
```

Et dans le tableau `children` de la route `/admin`, ajouter :
```typescript
{ path: 'pipeline', component: AdminPipelineComponent },
{ path: 'datasets', component: AdminDatasetsComponent },
```

- [ ] **Step 2 : Ajouter les liens dans la sidebar**

Dans `src/app/components/admin/admin.component.html`, après le lien `Galerie` (avant `Newsletter`), ajouter :

```html
      <a routerLink="/admin/pipeline" routerLinkActive="active" class="admin-sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
        </svg>
        Pipeline
      </a>
      <a routerLink="/admin/datasets" routerLinkActive="active" class="admin-sidebar__link">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <ellipse cx="12" cy="5" rx="9" ry="3"/>
          <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
          <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
        </svg>
        Datasets
      </a>
```

---

## Task 8 — Script Python d'entraînement

**Files:**
- Create: `python/train.py`

- [ ] **Step 1 : Créer le dossier python et train.py**

Créer `python/train.py` :

```python
"""
DataCut — Script d'entraînement
Usage: python train.py <chemin_vers_dataset.json>

Lit un fichier JSON exporté depuis la plateforme DataCut et entraîne
un classificateur de styles de coupe sur les labels.

Prérequis :
  pip install scikit-learn numpy
"""

import sys
import json
import numpy as np
from sklearn.preprocessing import MultiLabelBinarizer
from sklearn.multiclass import OneVsRestClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score
import pickle
import os

def load_dataset(path: str):
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    return data

def build_features(images: list) -> np.ndarray:
    """
    Construit un vecteur de features à partir des métadonnées extraites.
    Features : [width, height, sizeKb, ratio, r, g, b]
    """
    rows = []
    for img in images:
        feat = img.get('features') or {}
        w = feat.get('width', 0)
        h = feat.get('height', 0)
        size = feat.get('sizeKb', 0)
        ratio = w / h if h > 0 else 1.0
        color = feat.get('dominantColor', '#808080')
        r = int(color[1:3], 16) if len(color) == 7 else 128
        g = int(color[3:5], 16) if len(color) == 7 else 128
        b = int(color[5:7], 16) if len(color) == 7 else 128
        rows.append([w, h, size, ratio, r, g, b])
    return np.array(rows, dtype=float)

def main():
    if len(sys.argv) < 2:
        print("Usage: python train.py <dataset.json>")
        sys.exit(1)

    path = sys.argv[1]
    if not os.path.exists(path):
        print(f"Fichier introuvable : {path}")
        sys.exit(1)

    print(f"\n=== DataCut — Entraînement du modèle ===")
    print(f"Fichier : {path}\n")

    data = load_dataset(path)
    print(f"Version : {data.get('version', '?')}")
    print(f"Créé le : {data.get('createdAt', '?')}")
    print(f"Images  : {data.get('imageCount', 0)}\n")

    images = data.get('images', [])
    images = [img for img in images if img.get('labels')]

    if len(images) < 5:
        print("Pas assez d'images labelisées (minimum 5). Labellisez vos images dans le pipeline d'abord.")
        sys.exit(1)

    X = build_features(images)
    mlb = MultiLabelBinarizer()
    y = mlb.fit_transform([img['labels'] for img in images])

    print(f"Labels détectés : {list(mlb.classes_)}")
    print(f"Échantillons utilisés : {len(images)}\n")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    clf = OneVsRestClassifier(RandomForestClassifier(n_estimators=100, random_state=42))
    clf.fit(X_train, y_train)

    y_pred = clf.predict(X_test)

    print("=== Résultats ===")
    print(f"Accuracy (exacte) : {accuracy_score(y_test, y_pred):.2%}")
    print("\nRapport par label :")
    print(classification_report(y_test, y_pred, target_names=mlb.classes_, zero_division=0))

    model_path = "model.pkl"
    with open(model_path, 'wb') as f:
        pickle.dump({'clf': clf, 'mlb': mlb}, f)
    print(f"\nModèle sauvegardé dans : {model_path}")
    print("Pour prédire : charger model.pkl et appeler clf.predict(features)\n")

if __name__ == '__main__':
    main()
```

- [ ] **Step 2 : Créer le requirements.txt**

Créer `python/requirements.txt` :

```
scikit-learn>=1.3.0
numpy>=1.24.0
```

---

## Vérification finale

- [ ] Backend compile sans erreur (`npm run start:dev` dans `/backend`)
- [ ] `GET /api/gallery` retourne des items avec les champs `status`, `labels`, `features`
- [ ] `GET /api/admin/stats/pipeline` retourne `{ total, byStatus, versionsCount }`
- [ ] `GET /api/admin/dataset/versions` retourne la liste des versions
- [ ] `POST /api/admin/dataset/versions` crée un snapshot et marque les images `exported`
- [ ] `GET /api/admin/dataset/versions/:id/export` télécharge un JSON valide
- [ ] Frontend compile (`ng serve` dans `/`) 
- [ ] `/admin/pipeline` affiche le funnel + tableau avec statuts et labels
- [ ] `/admin/datasets` affiche les graphes + liste des versions + bouton export
- [ ] Sidebar contient les liens Pipeline et Datasets
- [ ] Script Python s'exécute : `python python/train.py dataset-v1-2026-04-13.json`
