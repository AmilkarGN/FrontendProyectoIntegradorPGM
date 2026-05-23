import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // 1. Intentar obtener el token de localStorage o sessionStorage
  const token = localStorage.getItem('transkelion_token') || sessionStorage.getItem('transkelion_token');

  let clonedReq = req;

  // 2. Si existe el token, clonar la petición y añadir el header de Authorization
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  // 3. Pasar la petición y capturar globalmente errores de conexión caída y de base de datos
  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // status === 0 indica error de red / servidor no responde
      if (error.status === 0) {
        console.error('🚨 ERROR DE CONEXIÓN: No se puede establecer comunicación con el backend.');
        alert('⚠️ Error de conexión: El servidor de datos (Backend) no responde. Por favor, asegúrate de que el backend esté encendido.');
      } 
      // status >= 500 indica error del servidor (base de datos o error de lógica)
      else if (error.status >= 500) {
        console.error('🚨 ERROR DEL SERVIDOR (5xx):', error);
        alert(`⚠️ Error en la Base de Datos o Servidor (${error.status}): Ocurrió un fallo en el backend del sistema al procesar la solicitud.`);
      }
      
      return throwError(() => error);
    })
  );
};
