import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  email = '';
  loading = signal(false);
  sent = signal(false);
  error = signal('');

  constructor(private http: HttpClient) {}

  submit() {
    if (!this.email) { this.error.set('Veuillez saisir votre email.'); return; }
    this.loading.set(true);
    this.error.set('');
    this.http.post('http://localhost:3000/api/auth/forgot-password', { email: this.email }).subscribe({
      next: () => { this.sent.set(true); this.loading.set(false); },
      error: () => { this.error.set('Une erreur est survenue. Réessayez.'); this.loading.set(false); },
    });
  }
}
