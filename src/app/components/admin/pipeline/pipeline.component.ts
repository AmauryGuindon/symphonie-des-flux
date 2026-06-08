import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

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
  stats   = signal<PipelineStats | null>(null);
  items   = signal<PipelineItem[]>([]);
  loading = signal(true);
  toast   = signal<{ message: string; type: 'ok' | 'err' } | null>(null);

  filterStatus = signal<PipelineStatus | 'all'>('all');

  readonly statusOrder    = PIPELINE_ORDER;
  readonly statusLabels   = STATUS_LABELS;
  readonly availableLabels = AVAILABLE_LABELS;

  filteredItems = computed(() => {
    const f   = this.filterStatus();
    const all = this.items();
    return f === 'all' ? all : all.filter(i => i.status === f);
  });

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

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
    const updated  = current.includes(label)
      ? current.filter(l => l !== label)
      : [...current, label];
    this.patch(item._id, { labels: updated });
  }

  private patch(id: string, body: object) {
    this.http.patch(`${API}/admin/gallery/${id}`, body, { headers: this.headers() }).subscribe({
      next: (updated: any) => {
        this.items.update(items =>
          items.map(i => i._id === id ? { ...i, ...updated, url: i.url } : i)
        );
        this.refreshStats();
        this.showToast('Mis à jour', 'ok');
      },
      error: () => this.showToast('Erreur de mise à jour', 'err'),
    });
  }

  private refreshStats() {
    this.http.get<PipelineStats>(`${API}/admin/stats/pipeline`, { headers: this.headers() }).subscribe({
      next: s => this.stats.set(s),
    });
  }

  getCount(byStatus: { status: string; count: number }[], status: string): number {
    return byStatus.find(s => s.status === status)?.count ?? 0;
  }

  getBarWidth(byStatus: { status: string; count: number }[], status: string, total: number): number {
    if (total === 0) return 0;
    return Math.round((this.getCount(byStatus, status) / total) * 100);
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
