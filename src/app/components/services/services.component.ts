import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface ServiceConfig {
  _id: string;
  name: string;
  price: number;
  loyaltyPoints: number;
  active: boolean;
}

const ICONS: Record<string, string> = {
  'Coupe': '✦',
  'Coupe + Dégradé': '◆',
  'Coupe + Barbe': '◈',
  'Barbe seule': '◇',
  'Dégradé': '◉',
  'Coupe enfant': '✧',
};

@Component({
  selector: 'app-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent implements OnInit {
  services = signal<ServiceConfig[]>([]);

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.http.get<ServiceConfig[]>('http://localhost:3000/api/appointments/services')
      .subscribe({ next: s => this.services.set(s), error: () => {} });
  }

  iconFor(name: string): string {
    return ICONS[name] ?? '✦';
  }
}
