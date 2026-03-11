import { Component } from '@angular/core';

@Component({
  selector: 'app-about',
  standalone: true,
  imports: [],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  stats = [
    { value: '5+', label: 'Années d\'expérience' },
    { value: '67', label: 'Avis 5 étoiles' },
    { value: '5.0★', label: 'Note Google' }
  ];

  reviews1 = [
    { name: 'Mathieu', text: 'Dany quel homme et surtout quel coiffeur ! Toujours de bonne humeur, à l\'écoute et prends en compte nos demandes. Je recommande les yeux fermés.' },
    { name: 'William Ramanadapoulle', text: '1ère fois que j\'y vais et franchement c\'était parfait. L\'accueil, la prestation tout était parfait. J\'ai trouvé mon nouveau barber !' },
    { name: 'Nolann', text: 'Des dizaines de coupe plus tard et je recommande fortement Dany, c\'est un super coiffeur à l\'écoute et super sympathique. Je recommande fortement !!' },
    { name: 'Clément', text: 'Une vingtaine de coupes plus tard et toujours aussi satisfait. La qualité de la coupe, l\'ambiance pendant la séance m\'ont fait venir toutes les deux semaines !' },
    { name: 'Kayden', text: 'Au top, Dany est très pro et connaît son taf. Très satisfait de la coupe !! Je recommande.' },
    { name: 'William Vicente', text: 'Dany comprend totalement les attentes qu\'un client peut avoir et réalise des coupes à la perfection. Je recommande à 100% !' },
    { name: 'Quentin Chambonnier', text: 'Prestation incroyable, il prend vraiment le temps de comprendre ce que l\'ont veux. Ont sent la passion.' },
    { name: 'Kelyan', text: 'Coupe au top et barber super cool ! Je recommande.' },
    { name: 'Maël', text: 'Dany est très professionnel à l\'écoute, la coiffure est au top je recommande.' },
  ];

  reviews2 = [
    { name: 'Melvin', text: 'Parfait dans le détail à l\'écoute et très bonne hygiène.' },
    { name: 'Estéban De Oliveira', text: 'Satisfait de la présentation, il est professionnel et prend soin de chaques petits détails.' },
    { name: 'Mohamed', text: 'Un coiffeur au top. Un réel prodige ! Toujours bien accueilli. Je recommande vivement !' },
    { name: 'Hugo', text: 'Coupe super bien et très professionnel. Je recommande !' },
    { name: 'Thomas Violas', text: 'Super studio merci pour l\'accueil.' },
    { name: 'Jo Hos', text: 'Super coiffeur accueillant, avenant et professionnel, je recommande ce coiffeur.' },
    { name: 'Clarico Andrew', text: 'Très accueillant, boulot impeccable, je suis ressorti bien soigné !' },
    { name: 'Mathieu Gouveia', text: 'Super barber au top.' },
  ];
}
