import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  constructor(
    private auth: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {}

  submit() {
    if (!this.email || !this.password) {
      this.error.set('Veuillez remplir tous les champs.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const redirect = this.route.snapshot.queryParamMap.get('redirect');

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const dest = this.auth.isAdmin() ? '/admin' : (redirect ?? '/account');
        this.router.navigateByUrl(dest);
      },
      error: (err) => {
        this.error.set(err.error?.message ?? 'Email ou mot de passe incorrect.');
        this.loading.set(false);
      },
    });
  }
}
