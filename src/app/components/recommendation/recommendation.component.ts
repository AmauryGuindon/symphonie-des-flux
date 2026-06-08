import {
  Component, signal, computed, ElementRef, ViewChild, OnDestroy, NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

const API = 'http://localhost:3001/api';
const API_ORIGIN = API.replace(/\/api.*$/, '');

const BUFFER_SIZE     = 45;   // frames à conserver
const STABLE_THRESHOLD = 35;  // frames identiques pour verrouiller

interface GalleryItem {
  _id: string; url: string; alt?: string;
  category?: string; labels: string[]; active: boolean;
}

export type FaceShape = 'ovale' | 'ronde' | 'carrée' | 'cœur' | 'oblongue';
export type SkinTone  = 'clair' | 'médium' | 'foncé';

interface ShapeInfo {
  label: FaceShape; description: string; baseLabels: string[]; tips: string;
}

const HAIR_LABELS: Record<SkinTone, string[]> = {
  clair:  ['fade', 'taper', 'dégradé', 'burst-fade', 'barbe', 'rasage'],
  médium: ['fade', 'taper', 'dégradé', 'burst-fade', 'barbe', 'tresse'],
  foncé:  ['afro', 'tresse', 'burst-fade', 'barbe', 'taper', 'dégradé'],
};

const SKIN_EXCLUDE: Record<SkinTone, string[]> = {
  clair: ['afro', 'tresse'], médium: [], foncé: [],
};

const SKIN_DESC: Record<SkinTone, string> = {
  clair:  'Cheveux généralement lisses à ondulés',
  médium: 'Cheveux ondulés à bouclés',
  foncé:  'Cheveux crépus à bouclés serrés',
};

const SHAPE_MAP: Record<FaceShape, ShapeInfo> = {
  ovale:    { label: 'ovale',    description: 'Forme équilibrée — presque toutes les coupes te vont.', baseLabels: ['fade','dégradé','taper','afro','tresse','burst-fade'], tips: 'Profite de ta polyvalence : du fade classique à l\'afro, tout fonctionne.' },
  ronde:    { label: 'ronde',    description: 'Visage arrondi, mâchoire et joues similaires.', baseLabels: ['fade','taper','burst-fade','dégradé'], tips: 'Privilégie les coupes qui ajoutent de la hauteur et affinent les côtés.' },
  carrée:   { label: 'carrée',   description: 'Mâchoire forte et angulaire, front large.', baseLabels: ['burst-fade','dégradé','taper','barbe'], tips: 'Les coupes texturées adoucissent les angles de la mâchoire.' },
  cœur:     { label: 'cœur',    description: 'Front large, menton pointu et fin.', baseLabels: ['dégradé','taper','barbe','fade'], tips: 'Les dégradés doux équilibrent le front et le menton.' },
  oblongue: { label: 'oblongue', description: 'Visage long et étroit.', baseLabels: ['afro','tresse','barbe','burst-fade'], tips: 'Évite les coupes très hautes — préfère du volume sur les côtés.' },
};

@Component({
  selector: 'app-recommendation',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './recommendation.component.html',
  styleUrl: './recommendation.component.scss',
})
export class RecommendationComponent implements OnDestroy {
  @ViewChild('videoEl')   videoRef!:   ElementRef<HTMLVideoElement>;
  @ViewChild('snapCanvas') snapCanvas!: ElementRef<HTMLCanvasElement>;

  step      = signal<'upload' | 'camera' | 'analyzing' | 'result'>('upload');
  error     = signal('');
  photoUrl  = signal<SafeUrl | string>('');
  faceShape = signal<FaceShape | null>(null);
  skinTone  = signal<SkinTone | null>(null);
  matchingPhotos = signal<GalleryItem[]>([]);

  // Mode vidéo temps réel
  liveShape      = signal<FaceShape | null>(null);
  liveStability  = signal(0);   // 0–100 %
  liveDetecting  = signal(false);

  shapeInfo = computed(() => { const s = this.faceShape(); return s ? SHAPE_MAP[s] : null; });
  skinDesc  = computed(() => { const t = this.skinTone();  return t ? SKIN_DESC[t]  : null; });

  finalLabels = computed((): string[] => {
    const info = this.shapeInfo();
    const tone = this.skinTone();
    if (!info) return [];
    if (!tone) return info.baseLabels;
    const excluded = new Set(SKIN_EXCLUDE[tone]);
    const hairSet  = new Set(HAIR_LABELS[tone]);
    const base     = info.baseLabels.filter(l => !excluded.has(l));
    const inter    = base.filter(l => hairSet.has(l));
    return inter.length >= 2 ? inter : HAIR_LABELS[tone];
  });

  private landmarker:   FaceLandmarker | null = null;
  private allGallery:   GalleryItem[]         = [];
  private stream:       MediaStream | null    = null;
  private rafId:        number | null         = null;
  private shapeBuffer:  FaceShape[]           = [];
  private skinBuffer:   SkinTone[]            = [];
  private tempCanvas:   HTMLCanvasElement | null = null;

  constructor(
    private http: HttpClient,
    private sanitizer: DomSanitizer,
    private zone: NgZone,
  ) { this.preloadGallery(); }

  ngOnDestroy() {
    this.landmarker?.close();
    this.stopCamera();
  }

  // ── Galerie ───────────────────────────────────────────────────────────────

  private preloadGallery() {
    this.http.get<GalleryItem[]>(`${API}/gallery`).subscribe({
      next: items => {
        this.allGallery = items.map(item => ({
          ...item,
          url: item.url?.startsWith('/') ? `${API_ORIGIN}${item.url}` : item.url,
          labels: item.labels ?? [],
        }));
      },
    });
  }

  // ── Caméra + analyse temps réel ───────────────────────────────────────────

  async openCamera() {
    this.error.set('');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      this.step.set('camera');
      this.shapeBuffer  = [];
      this.skinBuffer   = [];
      this.liveShape.set(null);
      this.liveStability.set(0);

      setTimeout(async () => {
        const video = this.videoRef?.nativeElement;
        if (!video) return;
        video.srcObject = this.stream;
        await video.play();
        await this.initLandmarkerVideo();
        this.startAnalysisLoop();
      }, 100);
    } catch {
      this.error.set('Impossible d\'accéder à la caméra. Vérifie les permissions du navigateur.');
    }
  }

  private async initLandmarkerVideo() {
    if (this.landmarker) {
      // Recréer en mode VIDEO si nécessaire
      try { this.landmarker.close(); } catch {}
      this.landmarker = null;
    }
    const resolver = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    this.landmarker = await FaceLandmarker.createFromOptions(resolver, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numFaces: 1,
    });
  }

  private startAnalysisLoop() {
    this.liveDetecting.set(true);
    const loop = () => {
      this.analyzeFrame();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  private analyzeFrame() {
    const video = this.videoRef?.nativeElement;
    if (!video || !this.landmarker || video.readyState < 2) return;

    const result = this.landmarker.detectForVideo(video, performance.now());
    if (!result.faceLandmarks?.length) {
      // Pas de visage → vider le buffer progressivement
      if (this.shapeBuffer.length > 0) this.shapeBuffer.shift();
      this.zone.run(() => {
        this.liveShape.set(null);
        this.liveStability.set(0);
      });
      return;
    }

    const lm    = result.faceLandmarks[0];
    const shape = this.computeShape(lm);

    // Teinte de peau (1 frame sur 10 — opération lourde)
    if (this.shapeBuffer.length % 10 === 0) {
      const tone = this.computeSkinToneFromVideo(lm, video);
      this.skinBuffer.push(tone);
      if (this.skinBuffer.length > BUFFER_SIZE) this.skinBuffer.shift();
    }

    this.shapeBuffer.push(shape);
    if (this.shapeBuffer.length > BUFFER_SIZE) this.shapeBuffer.shift();

    // Forme dominante dans le buffer
    const counts = this.shapeBuffer.reduce((acc, s) => {
      acc[s] = (acc[s] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);
    const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    const stability = Math.round((dominant[1] / BUFFER_SIZE) * 100);

    this.zone.run(() => {
      this.liveShape.set(dominant[0] as FaceShape);
      this.liveStability.set(stability);

      // Verrouillage automatique quand assez stable
      if (dominant[1] >= STABLE_THRESHOLD && this.step() === 'camera') {
        this.lockResult();
      }
    });
  }

  private lockResult() {
    this.stopLoop();

    // Capture la frame courante comme photo souvenir
    const video  = this.videoRef?.nativeElement;
    const canvas = this.snapCanvas?.nativeElement;
    if (video && canvas) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(-1, 1);
      ctx.drawImage(video, -canvas.width, 0);
      this.photoUrl.set(this.sanitizer.bypassSecurityTrustUrl(canvas.toDataURL('image/jpeg', 0.9)));
    }

    this.stopCamera();

    // Forme dominante
    const shape = this.liveShape()!;

    // Teinte dominante
    const tCounts = this.skinBuffer.reduce((acc, t) => {
      acc[t] = (acc[t] ?? 0) + 1; return acc;
    }, {} as Record<string, number>);
    const tone = (Object.entries(tCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'clair') as SkinTone;

    this.faceShape.set(shape);
    this.skinTone.set(tone);

    const labels = this.finalLabels();
    this.matchingPhotos.set(
      this.allGallery.filter(item => item.labels.some(l => labels.includes(l)))
    );
    this.step.set('result');
  }

  // Bouton manuel si l'utilisateur ne veut pas attendre le verrouillage auto
  confirmNow() {
    if (this.liveShape()) this.lockResult();
  }

  private stopLoop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.liveDetecting.set(false);
  }

  stopCamera() {
    this.stopLoop();
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  cancelCamera() {
    this.stopCamera();
    this.step.set('upload');
  }

  // ── Upload (mode image) ───────────────────────────────────────────────────

  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file  = input.files?.[0];
    if (!file) return;
    this.photoUrl.set(this.sanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file)));
    await this.analyzeImage(file);
  }

  private async analyzeImage(file: File) {
    this.error.set('');
    this.step.set('analyzing');
    try {
      // Recréer le landmarker en mode IMAGE si besoin
      if (!this.landmarker) {
        const resolver = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        this.landmarker = await FaceLandmarker.createFromOptions(resolver, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU',
          },
          runningMode: 'IMAGE',
          numFaces: 1,
        });
      }

      const img    = await this.loadImage(file);
      const result = this.landmarker.detect(img);
      if (!result.faceLandmarks?.length) throw new Error('Aucun visage détecté. Essaie avec une photo plus nette, de face.');

      const lm    = result.faceLandmarks[0];
      const shape = this.computeShape(lm);
      const tone  = this.computeSkinToneFromImage(lm, img);

      this.faceShape.set(shape);
      this.skinTone.set(tone);
      const labels = this.finalLabels();
      this.matchingPhotos.set(this.allGallery.filter(item => item.labels.some(l => labels.includes(l))));
      this.step.set('result');
    } catch (e: any) {
      this.error.set(e?.message ?? 'Erreur lors de l\'analyse.');
      this.step.set('upload');
    }
  }

  private loadImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // ── Calculs ───────────────────────────────────────────────────────────────

  private dist(a: { x: number; y: number }, b: { x: number; y: number }) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
  }

  private computeShape(lm: { x: number; y: number; z: number }[]): FaceShape {
    const faceHeight    = this.dist(lm[10],  lm[152]);
    const cheekWidth    = this.dist(lm[234], lm[454]);
    const jawWidth      = this.dist(lm[172], lm[397]);
    const foreheadWidth = this.dist(lm[70],  lm[300]);

    const ratio         = faceHeight    / cheekWidth;
    const jawRatio      = jawWidth      / cheekWidth;
    const foreheadRatio = foreheadWidth / cheekWidth;

    if (ratio > 1.60)                                       return 'oblongue';
    if (ratio < 1.20 && jawRatio > 0.85)                   return 'ronde';
    if (foreheadRatio > 1.08 && jawRatio < 0.72)           return 'cœur';
    if (jawRatio > 0.80 && ratio >= 1.10 && ratio <= 1.55) return 'carrée';
    return 'ovale';
  }

  private sampleSkinTone(lm: { x: number; y: number; z: number }[], canvas: HTMLCanvasElement, w: number, h: number): SkinTone {
    const ctx = canvas.getContext('2d')!;
    const pts = [lm[10], lm[9], lm[151], lm[116], lm[117], lm[345], lm[346]];
    let totalR = 0, totalG = 0, totalB = 0;
    for (const pt of pts) {
      const d = ctx.getImageData(Math.round(pt.x * w), Math.round(pt.y * h), 1, 1).data;
      totalR += d[0]; totalG += d[1]; totalB += d[2];
    }
    const n = pts.length;
    const max = Math.max(totalR/n, totalG/n, totalB/n) / 255;
    const min = Math.min(totalR/n, totalG/n, totalB/n) / 255;
    const l = (max + min) / 2;
    if (l > 0.58) return 'clair';
    if (l > 0.36) return 'médium';
    return 'foncé';
  }

  private computeSkinToneFromImage(lm: { x: number; y: number; z: number }[], img: HTMLImageElement): SkinTone {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d')!.drawImage(img, 0, 0);
    return this.sampleSkinTone(lm, c, img.naturalWidth, img.naturalHeight);
  }

  private computeSkinToneFromVideo(lm: { x: number; y: number; z: number }[], video: HTMLVideoElement): SkinTone {
    if (!this.tempCanvas) {
      this.tempCanvas = document.createElement('canvas');
    }
    const c = this.tempCanvas;
    c.width = video.videoWidth; c.height = video.videoHeight;
    c.getContext('2d')!.drawImage(video, 0, 0);
    return this.sampleSkinTone(lm, c, video.videoWidth, video.videoHeight);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  reset() {
    this.stopCamera();
    this.step.set('upload');
    this.faceShape.set(null);
    this.skinTone.set(null);
    this.liveShape.set(null);
    this.liveStability.set(0);
    this.photoUrl.set('');
    this.matchingPhotos.set([]);
    this.error.set('');
    this.shapeBuffer = [];
    this.skinBuffer  = [];
  }
}
