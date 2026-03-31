import { Injectable } from '@nestjs/common';
import { join } from 'path';
import * as fs from 'fs';

const PROFILE_PATH = join(process.cwd(), 'uploads', 'profile');

@Injectable()
export class StorageService {
  constructor() {
    fs.mkdirSync(PROFILE_PATH, { recursive: true });
  }

  save(file: Express.Multer.File): string {
    return `/uploads/profile/${file.filename}`;
  }

  delete(url: string): void {
    if (!url) return;
    const filename = url.split('/').pop();
    if (!filename) return;
    try {
      fs.unlinkSync(join(PROFILE_PATH, filename));
    } catch {
      // silencieux — fichier peut déjà être absent
    }
  }
}
