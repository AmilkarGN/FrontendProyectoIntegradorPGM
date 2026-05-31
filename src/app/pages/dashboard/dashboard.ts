import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service'; 
import { AlertasService } from '../../services/alertas.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, 
    RouterOutlet,      
    RouterLink,        
    RouterLinkActive   
  ],
  templateUrl: './dashboard.html',
  styleUrls: ['./dashboard.css']
})
export class Dashboard {
  
  alertasActivas: number = 0;
  listaAlertas: any[] = [];
  mostrarNotificaciones: boolean = false;

  esCliente: boolean = false;
  nombreUsuario: string = 'Usuario';
  rolUsuario: string = 'Rol';

  constructor(private authService: AuthService, private alertasService: AlertasService) {}

  ngOnInit() {
    this.esCliente = this.authService.tieneRol('Cliente');
    const user = this.authService.getUsuarioActual();
    if (user) {
      this.nombreUsuario = user.nombre || user.username;
      this.rolUsuario = user.rol || 'Sin Rol';
    }
    
    this.alertasService.calcularAlertasGlobales();
    this.alertasService.alertas$.subscribe(alertas => {
      // En la campanita filtramos las ignoradas
      this.listaAlertas = alertas.filter(a => !this.alertasService.esIgnorada(a.id));
      this.alertasActivas = this.listaAlertas.length;
    });
  }

  alternarNotificaciones() {
    this.mostrarNotificaciones = !this.mostrarNotificaciones;
  }

  cerrarNotificaciones() {
    this.mostrarNotificaciones = false;
  }

  ignorarAlerta(event: Event, id: string) {
    event.preventDefault();
    event.stopPropagation();
    this.alertasService.ignorarAlerta(id);
  }

  cerrarSesion() {
    Swal.fire({
      title: '¿Cerrar Sesión?',
      text: 'Tendrás que ingresar tus credenciales nuevamente para acceder.',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout();
      }
    });
  }
}