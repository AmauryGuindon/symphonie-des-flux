import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000/api';

interface GalleryItem {
  _id: string;
  filename: string;
  url: string;
  alt?: string;
  span?: string;
  order: number;
  active: boolean;
}

@Component({
  selector: 'app-admin-gallery',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class AdminGalleryComponent implements OnInit {
  items = signal<GalleryItem[]>([]);
  loading = signal(true);
  uploading = signal(false);
  dragOver = signal(false);
  savingId = signal<string | null>(null);

  spanOptions = ['', 'wide', 'tall', 'large'];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.http.get<GalleryItem[]>(`${API}/admin/gallery`).subscribe({
      next: items => {
        this.items.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.uploadFile(file, input);
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragOver.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (!file) return;
    this.uploadFile(file);
  }

  save(item: GalleryItem) {
    this.savingId.set(item._id);
    this.http
      .patch(`${API}/admin/gallery/${item._id}`, {
        alt: item.alt,
        span: item.span,
        active: item.active,
        order: item.order,
      })
      .subscribe({
        next: () => this.savingId.set(null),
        error: () => this.savingId.set(null),
      });
  }

  delete(item: GalleryItem) {
    if (!confirm(`Supprimer "${item.alt || item.filename}" ?`)) return;
    this.http.delete(`${API}/admin/gallery/${item._id}`).subscribe({
      next: () => this.items.update(list => list.filter(i => i._id !== item._id)),
      error: () => {},
    });
  }

  imageUrl(item: GalleryItem): string {
    const origin = API.replace(/\/api.*$/, '');
    return `${origin}${item.url}`;
  }

  private uploadFile(file: File, input?: HTMLInputElement) {
    const formData = new FormData();
    formData.append('file', file);
    this.uploading.set(true);

    this.http.post<GalleryItem>(`${API}/admin/gallery`, formData).subscribe({
      next: item => {
        this.items.update(list => [item, ...list]);
        this.uploading.set(false);
        if (input) input.value = '';
      },
      error: () => {
        this.uploading.set(false);
        if (input) input.value = '';
      },
    });
  }
}
