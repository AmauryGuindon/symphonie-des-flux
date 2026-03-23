import { Component, OnInit, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs/operators';
import { NavbarComponent } from './components/navbar/navbar.component';
import { FooterComponent } from './components/footer/footer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, NavbarComponent, FooterComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent implements OnInit {
  private revealObserver: IntersectionObserver | null = null;
  isAdminRoute = signal(false);

  constructor(private router: Router) {}

  ngOnInit() {
    this.initCursor();
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
    ).subscribe((e) => {
      const url = (e as NavigationEnd).urlAfterRedirects;
      this.isAdminRoute.set(url.startsWith('/admin'));
      window.scrollTo(0, 0);
      setTimeout(() => this.initRevealObserver(), 120);
    });
  }

  private initCursor() {
    // Only on mouse devices, not touch
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const cursor = document.querySelector('.cursor') as HTMLElement;
    const follower = document.querySelector('.cursor-follower') as HTMLElement;
    if (!cursor || !follower) return;

    cursor.style.display = 'block';
    follower.style.display = 'block';

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = `${e.clientX}px`;
      cursor.style.top = `${e.clientY}px`;
      setTimeout(() => {
        follower.style.left = `${e.clientX}px`;
        follower.style.top = `${e.clientY}px`;
      }, 80);
    });

    document.addEventListener('mouseenter', (e) => {
      if ((e.target as HTMLElement).matches('a, button, [role="button"]')) {
        cursor.style.transform = 'translate(-50%, -50%) scale(2)';
        follower.style.width = '50px';
        follower.style.height = '50px';
      }
    }, true);

    document.addEventListener('mouseleave', (e) => {
      if ((e.target as HTMLElement).matches('a, button, [role="button"]')) {
        cursor.style.transform = 'translate(-50%, -50%) scale(1)';
        follower.style.width = '32px';
        follower.style.height = '32px';
      }
    }, true);
  }

  private initRevealObserver() {
    if (this.revealObserver) this.revealObserver.disconnect();

    this.revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed');
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.reveal').forEach(el => this.revealObserver!.observe(el));
  }
}
