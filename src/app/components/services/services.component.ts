import { Component } from '@angular/core';

interface Service {
  icon: string;
  name: string;
  description: string;
  tag?: string;
}

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss'
})
export class ServicesComponent {
  services: Service[] = [
    {
      icon: '✦',
      name: 'Coupe Classique',
      description: 'Dégradé précis ou coupe ciseau — fini propre, contours nets.',
      tag: 'BESTSELLER'
    },
    {
      icon: '◆',
      name: 'Coupe + Barbe',
      description: 'Le duo signature. Coupe sur mesure associée à un travail de barbe soigné.',
      tag: 'SIGNATURE'
    },
    {
      icon: '◈',
      name: 'Dégradé Américain',
      description: 'Dégradé de 0 à 3, précis au millimètre. Propre, net, élégant.',
    },
    {
      icon: '◇',
      name: 'Barbe Express',
      description: 'Taille, contour et finitions — pour une barbe toujours impeccable.',
    },
    {
      icon: '❋',
      name: 'Rasage Traditionnel',
      description: 'Rasoir droit, mousse chaude, serviette chaude. Une expérience old school premium.',
      tag: 'PREMIUM'
    },
    {
      icon: '◉',
      name: 'Retouche',
      description: 'Rafraîchissement rapide des contours — pour garder le style entre deux coupes.',
    }
  ];
}
