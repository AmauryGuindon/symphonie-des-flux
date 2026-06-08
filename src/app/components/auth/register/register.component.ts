import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  form = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    phone: '',
    birthDate: '',
    referralCode: '',
  };
  loading = signal(false);
  error = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  registerWithGoogle() {
    window.location.href = 'http://localhost:3001/api/auth/google';
  }

  submit() {
    const { firstName, lastName, email, password, birthDate } = this.form;
    if (!firstName || !lastName || !email || !password || !birthDate) {
      this.error.set('Veuillez remplir les champs obligatoires.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      this.error.set('Veuillez entrer une adresse email valide.');
      return;
    }

    if (password.length < 8) {
      this.error.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    const payload: any = { firstName, lastName, email, password };
    if (this.form.phone) payload.phone = this.form.phone;
    if (this.form.birthDate) payload.birthDate = this.form.birthDate;
    if (this.form.referralCode) payload.referralCode = this.form.referralCode.toUpperCase();

    this.auth.register(payload).subscribe({
      next: () => this.router.navigate(['/account']),
      error: (err) => {
        this.error.set(err.error?.message ?? 'Une erreur est survenue.');
        this.loading.set(false);
      },
    });
  }
}
