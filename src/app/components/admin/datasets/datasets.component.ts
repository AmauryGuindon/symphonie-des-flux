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
interface LabelStat   { label: string; count: number; }

@Component({
  selector: 'app-admin-datasets',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe],
  templateUrl: './datasets.component.html',
  styleUrl: './datasets.component.scss',
})
export class AdminDatasetsComponent implements OnInit {
  versions  = signal<DatasetVersion[]>([]);
  growth    = signal<GrowthPoint[]>([]);
  labels    = signal<LabelStat[]>([]);
  loading   = signal(true);
  creating  = signal(false);
  toast     = signal<{ message: string; type: 'ok' | 'err' } | null>(null);
  description = signal('');

  maxGrowth     = 0;
  maxLabelCount = 0;

  constructor(private http: HttpClient) {}

  ngOnInit() { this.load(); }

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
        this.creating.set(false);
        this.description.set('');
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
    const url   = `${API}/admin/dataset/versions/${v._id}/export`;
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
