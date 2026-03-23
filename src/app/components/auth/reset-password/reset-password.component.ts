import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  password = '';
  confirm = '';
  loading = signal(false);
  done = signal(false);
  error = signal('');

  constructor(private http: HttpClient, private route: ActivatedRoute) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    if (!this.token) this.error.set('Lien invalide. Veuillez refaire une demande.');
  }

  submit() {
    if (!this.password || this.password.length < 6) {
      this.error.set('Le mot de passe doit contenir au moins 6 caractères.'); return;
    }
    if (this.password !== this.confirm) {
      this.error.set('Les mots de passe ne correspondent pas.'); return;
    }
    this.loading.set(true);
    this.error.set('');
    this.http.post('http://localhost:3000/api/auth/reset-password', {
      token: this.token,
      password: this.password,
    }).subscribe({
      next: () => { this.done.set(true); this.loading.set(false); },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Lien invalide ou expiré.');
        this.loading.set(false);
      },
    });
  }
}
