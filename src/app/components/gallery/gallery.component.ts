import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

const API = 'http://localhost:3001/api';
const API_ORIGIN = API.replace(/\/api.*$/, '');
const PAGE_SIZE = 12;

interface GalleryItem {
  _id: string;
  url: string;
  alt?: string;
  span?: string;
  category?: string;
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
  private allItems = signal<GalleryItem[]>([]);
  activeCategory = signal('');
  private visibleCount = signal(PAGE_SIZE);

  categories: { value: string; label: string }[] = [
    { value: '', label: 'Tout' },
    { value: 'coupe', label: 'Coupe' },
    { value: 'barbe', label: 'Barbe' },
    { value: 'degrade', label: 'Dégradé' },
  ];

  items = computed(() => {
    const cat = this.activeCategory();
    if (!cat) return this.allItems();
    return this.allItems().filter(item => item.category === cat);
  });

  visibleItems = computed(() => this.items().slice(0, this.visibleCount()));
  hasMore = computed(() => this.visibleCount() < this.items().length);
  remainingCount = computed(() => this.items().length - this.visibleCount());

  hasCategories = computed(() =>
    this.allItems().some(item => item.category && item.category !== '')
  );

  setCategory(cat: string) {
    this.activeCategory.set(cat);
    this.visibleCount.set(PAGE_SIZE);
  }

  showMore() {
    this.visibleCount.update(c => c + PAGE_SIZE);
  }

  private readonly fallbackItems: GalleryItem[] = [
    { _id: '1', url: 'assets/taper1.png', alt: 'Dégradé signature', span: 'tall', active: true },
    { _id: '2', url: 'assets/burstfade1.png', alt: 'Burst fade', span: '', active: true },
    { _id: '3', url: 'assets/burstfade2.png', alt: 'Burst fade 2', span: '', active: true },
    { _id: '4', url: 'assets/taper2.png', alt: 'Taper fade', span: 'wide', active: true },
  ];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<GalleryItem[]>(`${API}/gallery`).subscribe({
      next: items => {
        const normalized = items.map(item => this.withAbsoluteUrl(item));
        this.allItems.set(normalized.length > 0 ? normalized : this.fallbackItems);
      },
      error: () => this.allItems.set(this.fallbackItems),
    });
  }

  private withAbsoluteUrl(item: GalleryItem): GalleryItem {
    if (!item.url || item.url.startsWith('http://') || item.url.startsWith('https://') || !item.url.startsWith('/')) {
      return item;
    }
    return { ...item, url: `${API_ORIGIN}${item.url}` };
  }
}
