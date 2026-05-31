import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps';
import { Component, OnInit, ViewChild, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { ViajeService } from '../../services/viaje';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-dashboard-conductor',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './dashboard-conductor.html',
  styleUrls: ['./dashboard-conductor.css']
})
export class DashboardConductor implements OnInit {
  estadisticas: any = null;
  cargando: boolean = true;
  error: string = '';
  mesActual: boolean = false;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.cargarEstadisticas();
  }

  toggleFiltro(mes: boolean) {
    this.mesActual = mes;
    this.cargarEstadisticas();
  }

  cargarEstadisticas() {
    this.cargando = true;
    const url = `http://localhost:8000/api/viajes/estadisticas-conductor/?mes=${this.mesActual}`;
    this.http.get(url).subscribe({
      next: (res: any) => {
        this.estadisticas = res;
        this.cargando = false;
      },
      error: (err: any) => {
        console.error(err);
        this.error = 'No se pudieron cargar las estadísticas.';
        this.cargando = false;
      }
    });
  }
}
