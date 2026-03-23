import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();
  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Expirer la session seulement si l'utilisateur était authentifié
      // (ignore les 401 sur les routes d'auth elles-mêmes : login, forgot-password…)
      if (err.status === 401 && token) {
        auth.expireSession();
      }
      return throwError(() => err);
    }),
  );
};
