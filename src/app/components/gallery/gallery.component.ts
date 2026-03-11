import { Component } from '@angular/core';

interface GalleryItem {
  src: string;
  alt: string;
  span?: 'wide' | 'tall' | 'large';
  gradient: string;
}

@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [],
  templateUrl: './gallery.component.html',
  styleUrl: './gallery.component.scss'
})
export class GalleryComponent {
  items: GalleryItem[] = [
    {
      src: 'assets/taper1.png',
      alt: 'Dégradé signature Dany1st',
      span: 'tall',
      gradient: 'linear-gradient(135deg, #1a1208 0%, #2d1f0a 50%, #111 100%)'
    },
    {
      src: 'assets/burstfade1.png',
      alt: 'Burst fade',
      gradient: 'linear-gradient(135deg, #0d1a14 0%, #0a1510 100%)'
    },
    {
      src: 'assets/burstfade2.png',
      alt: 'Burst fade 2',
      gradient: 'linear-gradient(135deg, #1a0d0d 0%, #150a0a 100%)'
    },
    {
      src: 'assets/taper2.png',
      alt: 'Taper fade',
      span: 'wide',
      gradient: 'linear-gradient(135deg, #110d1a 0%, #0e0a15 100%)'
    },
    {
      src: '',
      alt: 'Style urbain',
      gradient: 'linear-gradient(135deg, #1a1a0d 0%, #141409 100%)'
    },
    {
      src: '',
      alt: 'Dégradé américain',
      gradient: 'linear-gradient(135deg, #0d1a1a 0%, #091212 100%)'
    },
    {
      src: '',
      alt: 'Coup de lame',
      span: 'tall',
      gradient: 'linear-gradient(135deg, #1a120d 0%, #150e09 100%)'
    },
    {
      src: '',
      alt: 'Résultat premium',
      gradient: 'linear-gradient(135deg, #1a0d1a 0%, #120912 100%)'
    }
  ];
}
