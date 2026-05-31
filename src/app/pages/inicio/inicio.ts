import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import { DashboardCliente } from '../dashboard-cliente/dashboard-cliente';
import { DashboardConductor } from '../dashboard-conductor/dashboard-conductor';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [CommonModule, DashboardCliente, DashboardConductor],
  templateUrl: './inicio.html',
  styleUrls: ['./inicio.css'],
})
export class Inicio implements OnInit {
  metricas: any = {
    flota_activa: 0,
    alertas_ruta: 0,
    eficiencia_porcentaje: 0,
    carga_movilizada: 0,
    ultimos_viajes: []
  };

  cargando = true;
  saludo: string = '';
  fechaActual: string = '';
  esCliente: boolean = false;
  esConductor: boolean = false;

  constructor(private http: HttpClient, private router: Router, public authService: AuthService) {}

  ngOnInit(): void {
    this.esCliente = this.authService.tieneRol('Cliente');
    this.esConductor = this.authService.tieneRol('Conductor');
    
    if (!this.esCliente && !this.esConductor) {
      this.obtenerMetricas();
    } else {
      // El dashboard del cliente y conductor manejan su propia carga
      this.cargando = false;
    }
    this.generarSaludo();
  }

  obtenerMetricas() {
    this.http.get<any>('http://localhost:8000/api/dashboard-metricas/').subscribe({
      next: (data) => {
        this.metricas = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error("Error al cargar las métricas", err);
        this.cargando = false;
      }
    });
  }

  generarSaludo() {
    const hora = new Date().getHours();
    if (hora >= 5 && hora < 12) {
      this.saludo = '☀️ Buenos días';
    } else if (hora >= 12 && hora < 19) {
      this.saludo = '🌤️ Buenas tardes';
    } else {
      this.saludo = '🌙 Buenas noches';
    }
    
    // Formatear la fecha actual (ej: "Lunes, 3 de Mayo")
    const opciones: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    this.fechaActual = new Date().toLocaleDateString('es-ES', opciones);
  }

  // --- ACCIONES RÁPIDAS ---
  irANuevoViaje() {
    this.router.navigate(['/dashboard/viajes'], { queryParams: { abrir_modal: 'true' } });
  }

  irANuevaReserva() {
    this.router.navigate(['/dashboard/reservas'], { queryParams: { abrir_modal: 'true' } });
  }

  obtenerColorEstado(estado: string): any {
    switch (estado) {
      case 'Finalizado': return { bg: '#dcfce7', text: '#166534' }; 
      case 'En Curso': return { bg: '#fef9c3', text: '#854d0e' };   
      case 'Programado': return { bg: '#eff6ff', text: '#1e40af' }; 
      case 'Cancelado': return { bg: '#fee2e2', text: '#991b1b' };  
      default: return { bg: '#f1f5f9', text: '#475569' };           
    }
  }
}