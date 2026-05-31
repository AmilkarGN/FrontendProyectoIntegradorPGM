import { Injectable, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private ngZone: NgZone
  ) {
    if (isPlatformBrowser(this.platformId)) {
      window.addEventListener('storage', (event) => {
        if (event.key === 'transkelion_token' && event.newValue === null) {
          console.warn('Cierre de sesión detectado en otra pestaña. Protegiendo sistema...');
          this.ngZone.run(() => {
            this.router.navigate(['/login']);
          });
        }
      });
    }
  }

  // ---  AQUÍ ESTÁ LA NUEVA FUNCIÓN  ---
  guardarSesion(tokens: any, user: any, recordarDispositivo: boolean) {
    console.log('📦 SERVICIO: Intentando escribir en el disco duro...');
    
    // Lo guardamos a la fuerza, sin el "if", porque un clic siempre es en el navegador
    localStorage.setItem('transkelion_token', tokens.access);
    localStorage.setItem('transkelion_refresh', tokens.refresh);
    localStorage.setItem('transkelion_user', JSON.stringify(user));

    console.log('📦 SERVICIO: ¡Escritura confirmada! El disco duro tiene:', localStorage.getItem('transkelion_token'));
  }
  // ----------------------------------------

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      // Borramos todo rastro de la sesión
      localStorage.removeItem('transkelion_token');
      localStorage.removeItem('transkelion_refresh');
      localStorage.removeItem('transkelion_user');
    }
    this.router.navigate(['/login']);
  }

  // --- MÉTODOS DE ROLES Y PERMISOS ---
  getUsuarioActual() {
    if (isPlatformBrowser(this.platformId)) {
      const userStr = localStorage.getItem('transkelion_user') || sessionStorage.getItem('transkelion_user');
      return userStr ? JSON.parse(userStr) : null;
    }
    return null;
  }

  tieneRol(rol: string): boolean {
    const user = this.getUsuarioActual();
    if (!user) return false;
    const rolStr = (typeof user.rol === 'string') ? user.rol : (user.rol?.nombre_rol || '');
    return rolStr === rol;
  }

  tienePermiso(permiso: string): boolean {
    const user = this.getUsuarioActual();
    
    // Si es superadmin en cualquiera de sus formas, entra a todo
    if (user) {
      const rolStr = (typeof user.rol === 'string') ? user.rol : (user.rol?.nombre_rol || '');
      if (rolStr === 'Admin' || rolStr === 'Administrador') {
        return true;
      }
    }

    return user && user.permisos && user.permisos.includes(permiso);
  }
}