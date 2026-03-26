import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AppointmentService } from '../../services/appointment.service';
import { RouterLink } from '@angular/router';

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
  imports: [CommonModule, RouterLink],
  templateUrl: './services.component.html',
  styleUrl: './services.component.scss',
})
export class ServicesComponent implements OnInit {
  services = signal<any[]>([]);

  constructor(private appointmentService: AppointmentService) { }

  ngOnInit() {
    this.appointmentService.getPublicServices()
      .subscribe({ next: s => this.services.set(s), error: () => { } });
  }

  iconFor(name: string): string {
    return ICONS[name] ?? '✦';
  }
}
