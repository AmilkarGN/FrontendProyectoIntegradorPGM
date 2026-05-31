import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError, EMPTY } from 'rxjs';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import Swal from 'sweetalert2';

let isAlertShown = false; // Bloqueador para evitar spam de alertas simultáneas

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Obtenemos el contexto de ejecución (Navegador vs Servidor NodeJS)
  const platformId = inject(PLATFORM_ID);
  const isBrowser = isPlatformBrowser(platformId);

  // 1. Intentar obtener el token SOLAMENTE si estamos en el navegador
  let token = null;
  if (isBrowser) {
    token = localStorage.getItem('transkelion_token') || sessionStorage.getItem('transkelion_token');
  }

  // 2. Si estamos en SSR y la petición es a la API, la cancelamos devolviendo EMPTY 
  // para evitar errores 401 en la terminal de Node (ya que no hay localStorage ni token en SSR)
  if (!isBrowser && req.url.includes('/api/')) {
    return EMPTY;
  }

  let clonedReq = req;

  // 3. Si existe el token, clonar la petición y añadir el header de Authorization
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 4. Pasar la petición y capturar globalmente errores
  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (isBrowser) {
        if (error.status === 401) {
          // Excluimos las peticiones de login para que sus errores se manejen localmente
          const isAuthEndpoint = req.url.includes('/api/login/') || req.url.includes('/api/verificar-2fa/');
          if (!isAuthEndpoint && !isAlertShown) {
            isAlertShown = true;
            console.warn('🚨 SESIÓN EXPIRADA (401): El token de seguridad ya no es válido.');
            localStorage.removeItem('transkelion_token');
            localStorage.removeItem('transkelion_refresh');
            localStorage.removeItem('transkelion_user');
            
            Swal.fire({
              icon: 'warning',
              title: 'Sesión Expirada',
              text: 'Tu sesión ha caducado por seguridad. Por favor, vuelve a iniciar sesión.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#4f46e5',
              allowOutsideClick: false,
              allowEscapeKey: false
            }).then(() => {
              window.location.href = '/login';
            });
          }
        }
        else if (error.status === 0) {
          if (!isAlertShown) {
            isAlertShown = true;
            console.error('🚨 ERROR DE CONEXIÓN: No se puede establecer comunicación con el backend.');
            Swal.fire({
              icon: 'error',
              title: 'Error de conexión',
              text: 'El servidor de datos (Backend) no responde. Por favor, asegúrate de que esté encendido.',
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#d33',
              allowOutsideClick: false,
              allowEscapeKey: false
            }).then(() => {
              window.location.href = '/';
            });
          }
        } 
        else if (error.status >= 500) {
          const isAiEndpoint = req.url.includes('/api/vehiculos/autocompletar-ia/');
          if (!isAiEndpoint && !isAlertShown) {
            isAlertShown = true;
            console.error('🚨 ERROR DEL SERVIDOR (5xx):', error);
            Swal.fire({
              icon: 'error',
              title: 'Error Interno del Servidor',
              text: `Ocurrió un fallo en el backend (Código ${error.status}). Por favor contacta a soporte.`,
              confirmButtonText: 'Aceptar',
              confirmButtonColor: '#d33',
              allowOutsideClick: false,
              allowEscapeKey: false
            }).then(() => {
              window.location.href = '/';
            });
          }
        }
      }
      
      return throwError(() => error);
    })
  );
};
