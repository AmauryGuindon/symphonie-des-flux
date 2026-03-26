import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3000/api';
const API_ORIGIN = API.replace(/\/api.*$/, '');

interface GalleryItem {
  _id: string;
  url: string;
  alt?: string;
  span?: string;
  active: boolean;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss',
})
export class GalleryComponent implements OnInit {
  items = signal<GalleryItem[]>([]);

  // Fallback items shown when API returns empty or fails
  private readonly fallbackItems = [
    { _id: '1', url: 'assets/taper1.png', alt: 'Dégradé signature Dany1st', span: 'tall', active: true },
    { _id: '2', url: 'assets/burstfade1.png', alt: 'Burst fade', span: '', active: true },
    { _id: '3', url: 'assets/burstfade2.png', alt: 'Burst fade 2', span: '', active: true },
    { _id: '4', url: 'assets/taper2.png', alt: 'Taper fade', span: 'wide', active: true },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<GalleryItem[]>(`${API}/gallery`).subscribe({
      next: items => {
        const normalizedItems = items.map(item => this.withAbsoluteUrl(item));
        this.items.set(normalizedItems.length > 0 ? normalizedItems : this.fallbackItems);
      },
      error: () => this.items.set(this.fallbackItems),
    });
  }

  private withAbsoluteUrl(item: GalleryItem): GalleryItem {
    if (!item.url || item.url.startsWith('http://') || item.url.startsWith('https://') || !item.url.startsWith('/')) {
      return item;
    }
    return { ...item, url: `${API_ORIGIN}${item.url}` };
  }
}
