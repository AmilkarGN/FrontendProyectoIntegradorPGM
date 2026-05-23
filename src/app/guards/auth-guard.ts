import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';

export const authGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const platformId = inject(PLATFORM_ID);

  if (isPlatformBrowser(platformId)) {
    const token = localStorage.getItem('transkelion_token') || sessionStorage.getItem('transkelion_token');

    // 👇 MICRÓFONOS ACTIVADOS 👇
    console.log('🕵️‍♂️ GUARDIA: Alguien quiere entrar a la ruta:', state.url);
    console.log('🕵️‍♂️ GUARDIA: En su bolsillo encontré esto:', token);

    if (token) {
      console.log('✅ GUARDIA: Todo en orden. ¡Abriendo las puertas!');
      return true; 
    } else {
      console.error('🚨 GUARDIA: ¡ALTO AHÍ! No tienes el transkelion_token.');
      router.navigate(['/login']); 
      return false;
    }
  }

  return true; 
};