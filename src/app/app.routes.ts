import { Routes } from '@angular/router';
import { HeroComponent } from './components/hero/hero.component';
import { ServicesComponent } from './components/services/services.component';
import { GalleryComponent } from './components/gallery/gallery.component';
import { AboutComponent } from './components/about/about.component';
import { BookingComponent } from './components/booking/booking.component';
import { AppointmentBookingComponent } from './components/appointment-booking/appointment-booking.component';
import { LoginComponent } from './components/auth/login/login.component';
import { RegisterComponent } from './components/auth/register/register.component';
import { ForgotPasswordComponent } from './components/auth/forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './components/auth/reset-password/reset-password.component';
import { AccountComponent } from './components/account/account.component';
import { AdminComponent } from './components/admin/admin.component';
import { AdminDashboardComponent } from './components/admin/dashboard/dashboard.component';
import { AdminClientsComponent } from './components/admin/clients/clients.component';
import { AdminClientDetailComponent } from './components/admin/client-detail/client-detail.component';
import { AdminLoyaltyComponent } from './components/admin/loyalty/loyalty.component';
import { AdminReferralsComponent } from './components/admin/referrals/referrals.component';
import { AdminAppointmentsComponent } from './components/admin/appointments/appointments.component';
import { AdminScheduleComponent } from './components/admin/schedule/schedule.component';
import { AdminAccountingComponent } from './components/admin/accounting/accounting.component';
import { AdminServicesComponent } from './components/admin/services/services.component';
import { AdminGalleryComponent } from './components/admin/gallery/gallery.component';
import { AdminNewsletterComponent } from './components/admin/newsletter/newsletter.component';
import { AdminPipelineComponent } from './components/admin/pipeline/pipeline.component';
import { AdminDatasetsComponent } from './components/admin/datasets/datasets.component';
import { OAuthCallbackComponent } from './components/auth/oauth-callback/oauth-callback.component';
import { RecommendationComponent } from './components/recommendation/recommendation.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { MentionsLegalesComponent } from './components/legal/mentions-legales/mentions-legales.component';
import { CguComponent } from './components/legal/cgu/cgu.component';
import { CgvComponent } from './components/legal/cgv/cgv.component';
import { authGuard, adminGuard, guestGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', component: HeroComponent },
  { path: 'services', component: ServicesComponent },
  { path: 'gallery', component: GalleryComponent },
  { path: 'about', component: AboutComponent },
  { path: 'booking', component: BookingComponent },
  { path: 'recommendation', component: RecommendationComponent },
  { path: 'appointment', component: AppointmentBookingComponent },
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  { path: 'register', component: RegisterComponent, canActivate: [guestGuard] },
  { path: 'forgot-password', component: ForgotPasswordComponent, canActivate: [guestGuard] },
  { path: 'reset-password', component: ResetPasswordComponent },
  { path: 'auth/callback', component: OAuthCallbackComponent },
  { path: 'account', component: AccountComponent, canActivate: [authGuard] },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'clients', component: AdminClientsComponent },
      { path: 'clients/:id', component: AdminClientDetailComponent },
      { path: 'loyalty', component: AdminLoyaltyComponent },
      { path: 'referrals', component: AdminReferralsComponent },
      { path: 'appointments', component: AdminAppointmentsComponent },
      { path: 'schedule', component: AdminScheduleComponent },
      { path: 'comptabilite', component: AdminAccountingComponent },
      { path: 'prestations', component: AdminServicesComponent },
      { path: 'gallery', component: AdminGalleryComponent },
      { path: 'newsletter', component: AdminNewsletterComponent },
      { path: 'pipeline', component: AdminPipelineComponent },
      { path: 'datasets', component: AdminDatasetsComponent },
    ],
  },
  { path: 'mentions-legales', component: MentionsLegalesComponent },
  { path: 'cgu', component: CguComponent },
  { path: 'cgv', component: CgvComponent },
  { path: '**', component: NotFoundComponent },
];
