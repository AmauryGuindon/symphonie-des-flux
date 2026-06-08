import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { gsap } from 'gsap';

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  maxOpacity: number;
  life: number;
  maxLife: number;
  drift: number;
}

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.scss'
})
export class HeroComponent implements AfterViewInit, OnDestroy {
  @ViewChild('particleCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('heroSection') heroRef!: ElementRef;

  titleChars = 'DATACUT'.split('');
  private animFrameId: number | null = null;
  private particles: Particle[] = [];
  private ctx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;

  ngAfterViewInit() {
    this.initCanvas();
    this.initParticles();
    this.animateCanvas();
    this.animateHero();
  }

  ngOnDestroy() {
    if (this.animFrameId) cancelAnimationFrame(this.animFrameId);
  }

  private initCanvas() {
    this.canvas = this.canvasRef.nativeElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  private resizeCanvas() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  private createParticle(): Particle {
    return {
      x: Math.random() * this.canvas.width,
      y: this.canvas.height + 10,
      size: Math.random() * 2.5 + 0.5,
      speed: Math.random() * 0.8 + 0.3,
      opacity: 0,
      maxOpacity: Math.random() * 0.5 + 0.15,
      life: 0,
      maxLife: Math.random() * 200 + 150,
      drift: (Math.random() - 0.5) * 0.4
    };
  }

  private initParticles() {
    for (let i = 0; i < 60; i++) {
      const p = this.createParticle();
      p.y = Math.random() * this.canvas.height;
      p.life = Math.random() * p.maxLife;
      this.particles.push(p);
    }
  }

  private animateCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p, i) => {
      p.life++;
      p.y -= p.speed;
      p.x += p.drift;

      // Fade in / fade out
      const progress = p.life / p.maxLife;
      if (progress < 0.2) {
        p.opacity = (progress / 0.2) * p.maxOpacity;
      } else if (progress > 0.7) {
        p.opacity = ((1 - progress) / 0.3) * p.maxOpacity;
      } else {
        p.opacity = p.maxOpacity;
      }

      if (p.life >= p.maxLife || p.y < -10) {
        this.particles[i] = this.createParticle();
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.opacity;

      // Gold shimmer
      const gradient = this.ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
      gradient.addColorStop(0, '#E8C96D');
      gradient.addColorStop(1, 'rgba(201, 164, 74, 0)');

      this.ctx.fillStyle = gradient;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    });

    this.animFrameId = requestAnimationFrame(() => this.animateCanvas());
  }

  private animateHero() {
    const tl = gsap.timeline({ delay: 0.3 });

    tl.fromTo('.hero__eyebrow',
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out' }
    )
    .fromTo('.hero__title-char',
      { opacity: 0, y: 80, rotateX: -90, transformPerspective: 800 },
      {
        opacity: 1, y: 0, rotateX: 0,
        duration: 0.7,
        stagger: 0.06,
        ease: 'power3.out'
      },
      '-=0.4'
    )
    .fromTo('.hero__title-spade',
      { opacity: 0, scale: 0, rotation: -30 },
      { opacity: 1, scale: 1, rotation: 0, duration: 0.5, ease: 'back.out(1.7)' },
      '-=0.2'
    )
    .fromTo('.hero__subtitle',
      { opacity: 0, letterSpacing: '0.6em' },
      { opacity: 1, letterSpacing: '0.3em', duration: 1, ease: 'power2.out' },
      '-=0.3'
    )
    .fromTo('.hero__cta',
      { opacity: 0, y: 25 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' },
      '-=0.3'
    )
    .fromTo('.hero__scroll',
      { opacity: 0 },
      { opacity: 1, duration: 0.6 },
      '-=0.2'
    );
  }
}
