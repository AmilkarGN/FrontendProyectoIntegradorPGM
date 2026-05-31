import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ViajeService } from '../../services/viaje';

@Component({
  selector: 'app-dashboard-cliente',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './dashboard-cliente.html',
  styleUrls: ['./dashboard-cliente.css'],
})
export class DashboardCliente implements OnInit {
  viajesActivos: any[] = [];
  historial: any[] = [];
  reservasPendientes: number = 0;
  cargando: boolean = true;

  constructor(private viajeService: ViajeService) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.viajeService.obtenerMisViajes().subscribe({
      next: (res) => {
        // Formatear los viajes activos recibidos del backend
        this.viajesActivos = res.activos.map((v: any) => {
          let origen = 'N/A';
          let destino = 'N/A';
          let carga = 'Carga Mixta';
          
          if (v.reservas_del_viaje && v.reservas_del_viaje.length > 0) {
            origen = v.reservas_del_viaje[0].direccion_origen || 'Orígen';
            destino = v.reservas_del_viaje[0].direccion_destino || 'Destino';
          }
          
          return {
            id: v.codigo_viaje,
            origen: origen,
            destino: destino,
            estado: v.estado_viaje?.nombre || 'Pendiente',
            porcentaje: v.progreso_simulado || 0, // Podrías tener una lógica de progreso
            eta: v.fecha_salida ? 'Fecha de Salida: ' + v.fecha_salida : 'Pendiente',
            ultima_ubicacion: v.asignacion?.vehiculo?.placa ? 'Camión Placa: ' + v.asignacion.vehiculo.placa : 'Asignando...',
            carga: carga
          };
        });

        this.historial = res.historial;
        this.reservasPendientes = res.reservas_pendientes || 0;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando los viajes del cliente:', err);
        this.cargando = false;
      }
    });
  }
}
