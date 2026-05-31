import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import Swal from 'sweetalert2';

export const permisoGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Obtener el permiso requerido desde la configuración de la ruta
  const permisoRequerido = route.data?.['permiso'];

  if (!permisoRequerido) {
    return true; // Si no pide permiso, pasa
  }

  if (authService.tienePermiso(permisoRequerido)) {
    return true;
  }

  // Si no tiene permiso, bloqueamos y mandamos alerta
  Swal.fire({
    title: 'Acceso Denegado',
    text: 'No tienes los permisos necesarios para entrar a esta sección.',
    icon: 'error',
    confirmButtonColor: '#4f46e5'
  });
  
  router.navigate(['/dashboard/inicio']);
  return false;
};
