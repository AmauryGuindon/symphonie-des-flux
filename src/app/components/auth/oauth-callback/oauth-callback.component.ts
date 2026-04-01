import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  template: `<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#0a0a0a;color:#c9a44a;font-family:sans-serif;letter-spacing:.1em">CONNEXION EN COURS…</div>`,
})
export class OAuthCallbackComponent implements OnInit {
  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    this.auth.loginWithToken(token).subscribe({
      next: () => this.router.navigate([this.auth.isAdmin() ? '/admin' : '/account']),
      error: () => this.router.navigate(['/login']),
    });
  }
}
