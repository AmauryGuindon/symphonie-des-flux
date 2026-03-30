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
  category?: string;
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
  toast = signal<{ message: string; type: 'ok' | 'err' } | null>(null);
  savingOrder = signal(false);
  orderDirty = signal(false);
  draggedIndex = signal<number | null>(null);
  dragOverIndex = signal<number | null>(null);

  spanOptions = ['', 'wide', 'tall', 'large'];
  categoryOptions: { value: string; label: string }[] = [
    { value: '', label: 'Non catégorisé' },
    { value: 'coupe', label: 'Coupe' },
    { value: 'barbe', label: 'Barbe' },
    { value: 'degrade', label: 'Dégradé' },
  ];

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

  // --- Drag & drop reorder ---

  onItemDragStart(index: number) {
    this.draggedIndex.set(index);
  }

  onItemDragOver(event: DragEvent, index: number) {
    event.preventDefault();
    this.dragOverIndex.set(index);
  }

  onItemDragLeave() {
    this.dragOverIndex.set(null);
  }

  onItemDrop(targetIndex: number) {
    const from = this.draggedIndex();
    if (from === null || from === targetIndex) {
      this.draggedIndex.set(null);
      this.dragOverIndex.set(null);
      return;
    }
    const arr = [...this.items()];
    const [moved] = arr.splice(from, 1);
    arr.splice(targetIndex, 0, moved);
    this.items.set(arr.map((item, i) => ({ ...item, order: i })));
    this.draggedIndex.set(null);
    this.dragOverIndex.set(null);
    this.orderDirty.set(true);
  }

  onItemDragEnd() {
    this.draggedIndex.set(null);
    this.dragOverIndex.set(null);
  }

  saveOrder() {
    this.savingOrder.set(true);
    const payload = { items: this.items().map((item, i) => ({ id: item._id, order: i })) };
    this.http.patch(`${API}/admin/gallery/reorder`, payload).subscribe({
      next: () => {
        this.savingOrder.set(false);
        this.orderDirty.set(false);
        this.showToast('Ordre sauvegardé', 'ok');
      },
      error: () => {
        this.savingOrder.set(false);
        this.showToast('Erreur lors de la sauvegarde', 'err');
      },
    });
  }

  // --- Item save / delete ---

  save(item: GalleryItem) {
    this.savingId.set(item._id);
    this.http
      .patch(`${API}/admin/gallery/${item._id}`, {
        alt: item.alt,
        span: item.span,
        category: item.category,
        active: item.active,
      })
      .subscribe({
        next: () => {
          this.savingId.set(null);
          this.showToast('Photo sauvegardée', 'ok');
        },
        error: () => {
          this.savingId.set(null);
          this.showToast('Erreur lors de la sauvegarde', 'err');
        },
      });
  }

  delete(item: GalleryItem) {
    if (!confirm(`Supprimer "${item.alt || item.filename}" ?`)) return;
    this.http.delete(`${API}/admin/gallery/${item._id}`).subscribe({
      next: () => this.items.update(list => list.filter(i => i._id !== item._id)),
      error: () => {},
    });
  }

  private showToast(message: string, type: 'ok' | 'err') {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 3000);
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
