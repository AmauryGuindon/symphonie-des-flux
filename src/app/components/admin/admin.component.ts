import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent {
  sidebarOpen = signal(false);

  constructor(public auth: AuthService, router: Router) {
    // Close sidebar on navigation (mobile)
    router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(() => {
      this.sidebarOpen.set(false);
    });
  }

  logout() {
    this.auth.logout();
  }
}
