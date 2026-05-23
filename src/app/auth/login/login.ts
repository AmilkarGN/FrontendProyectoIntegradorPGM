import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router'; // IMPORTANTE EL RouterLink
import { AuthService } from '../../services/auth';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink], // Agregarlo aquí también
  templateUrl: './login.html',
  styleUrls: ['./login.css']
})
// ... tus importaciones ...

export class Login {
  username = '';
  password = '';
  necesita2FA = false;
  codigo2FA = '';
  recordarDispositivo = false;
  verContrasena = false;
  
  // NUEVO: Variable para controlar la ruedita de carga
  cargando = false; 

  constructor(private authService: AuthService, private router: Router) {}

  toggleContrasena() { this.verContrasena = !this.verContrasena; }

  iniciarSesion() {
    // NUEVO: Activamos el loader antes de enviar la petición
    this.cargando = true; 

    const credenciales = { username: this.username, password: this.password };
    this.authService.login(credenciales).subscribe({
      next: (respuesta) => {
        this.cargando = false; 
        if (respuesta.status === 'pending_2fa') { 
          this.necesita2FA = true; 
        }
      },
      error: (err: any) => {
        this.cargando = false; 
        if (err.status === 429) {
          Swal.fire('Bloqueo de Seguridad', 'Has intentado iniciar sesión demasiadas veces. Por favor, espera 5 minutos.', 'error');
        } else {
          Swal.fire('Error', 'Credenciales incorrectas', 'error');
        }
      }
    });
  }

  verificarCodigo() {
    this.cargando = true; 
    const datos = { username: this.username, codigo: this.codigo2FA };
    
    console.log('🟡 1. Enviando código a Django...');

    this.authService.verificar2FA(datos).subscribe({
      next: (respuesta) => {
        console.log('🟢 2. Django respondió OK:', respuesta);
        this.cargando = false; 
        
       if (respuesta.status === 'success') {
          try {
            console.log('🟡 3. Guardando token a través de AuthService...');
            
            // Usar el método unificado que respeta la opción de recordar dispositivo
            this.authService.guardarSesion(respuesta.tokens, respuesta.user, this.recordarDispositivo);
            
            console.log('🟢 4. ¡Sesión guardada con éxito!');
            
            this.router.navigate(['/dashboard']).then(pudoEntrar => {
              if (pudoEntrar) {
                console.log('✅ 5. ¡Bienvenido al Dashboard!');
              } else {
                console.error('🚨 5. ERROR: El Guardia bloqueó la entrada al Dashboard.');
              }
            });

          } catch (errorGuardar) {
            console.error('🚨 ERROR FATAL AL GUARDAR SESIÓN:', errorGuardar);
          }
        }
      },
      error: (err: any) => {
        console.error('🔴 Error del backend en intento 2FA:', err);
        this.cargando = false; 
        if (err.status === 429) {
          Swal.fire('Bloqueo de Seguridad', 'Demasiados intentos fallidos. Por favor, espera 5 minutos.', 'error');
        } else {
          Swal.fire('Error', 'Código incorrecto o caducado', 'error');
        }
      }
    });
  }
}