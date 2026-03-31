import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.scss',
})
export class NavbarComponent implements OnInit {
  scrolled = false;
  menuOpen = false;
  notifOpen = false;

  constructor(public auth: AuthService, public notif: NotificationService) {}

  ngOnInit() {}

  @HostListener('window:scroll')
  onScroll() {
    this.scrolled = window.scrollY > 60;
  }

  @HostListener('document:click')
  onDocClick() {
    this.notifOpen = false;
  }

  toggleMenu() {
    this.menuOpen = !this.menuOpen;
    document.body.style.overflow = this.menuOpen ? 'hidden' : '';
  }

  closeMenu() {
    this.menuOpen = false;
    document.body.style.overflow = '';
  }

  toggleNotif(e: Event) {
    e.stopPropagation();
    this.notifOpen = !this.notifOpen;
    if (this.notifOpen && this.notif.unreadCount() > 0) {
      this.notif.markAllRead().subscribe();
    }
  }

  deleteOne(id: string, e: Event) {
    e.stopPropagation();
    this.notif.deleteOne(id).subscribe();
  }

  deleteAll(e: Event) {
    e.stopPropagation();
    this.notif.deleteAll().subscribe();
  }
}
