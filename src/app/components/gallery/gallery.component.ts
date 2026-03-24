import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

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
    this.http.get<GalleryItem[]>('http://localhost:3000/api/gallery').subscribe({
      next: items => this.items.set(items.length > 0 ? items : this.fallbackItems),
      error: () => this.items.set(this.fallbackItems),
    });
  }
}
