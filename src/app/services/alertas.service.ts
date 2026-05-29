import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { VehiculoService, Vehiculo } from './vehiculo';
import { ConductorService, Conductor } from './conductor';
import { ReservaService, Reserva } from './reserva';
import { ViajeService } from './viaje';

export interface AlertaItem {
  id: string;
  tipo: 'vehiculo' | 'conductor' | 'reserva' | 'viaje';
  prioridad: 'critica' | 'preventiva'; // critica = rojo, preventiva = amarillo
  titulo: string;
  mensaje: string;
  fechaRef: string;
  enlace: string;
  registroId: string | number; // NUEVO
}

@Injectable({
  providedIn: 'root'
})
export class AlertasService {
  
  private alertasSubject = new BehaviorSubject<AlertaItem[]>([]);
  public alertas$ = this.alertasSubject.asObservable();

  constructor(
    private vehiculoService: VehiculoService,
    private conductorService: ConductorService,
    private reservaService: ReservaService,
    private viajeService: ViajeService
  ) { }

  // Llama a esto para recalcular las alertas (e.g., desde el Dashboard al iniciar, o con un botón de refresco)
  public calcularAlertasGlobales(): void {
    forkJoin({
      vehiculos: this.vehiculoService.obtenerVehiculos(),
      conductores: this.conductorService.obtenerConductores(),
      reservas: this.reservaService.obtenerReservas(),
      viajes: this.viajeService.obtenerViajes()
    }).subscribe(({ vehiculos, conductores, reservas, viajes }) => {
      
      const alertasNuevas: AlertaItem[] = [];
      const hoy = new Date();
      hoy.setHours(0,0,0,0);

      // 1. VEHÍCULOS
      vehiculos.forEach(v => {
        if (v.vencimiento_soat) {
          const fSoat = new Date(v.vencimiento_soat);
          const diffDias = this.diferenciaDias(hoy, fSoat);
          if (diffDias < 0) {
            alertasNuevas.push({ id: 'v_s_'+v.placa, tipo: 'vehiculo', prioridad: 'critica', titulo: `SOAT Vencido (${v.placa})`, mensaje: `El SOAT venció el ${v.vencimiento_soat}`, fechaRef: v.vencimiento_soat, enlace: '/dashboard/vehiculos', registroId: v.placa });
          } else if (diffDias <= 30) {
            alertasNuevas.push({ id: 'v_s_'+v.placa, tipo: 'vehiculo', prioridad: 'preventiva', titulo: `SOAT por Vencer (${v.placa})`, mensaje: `Vence en ${diffDias} días.`, fechaRef: v.vencimiento_soat, enlace: '/dashboard/vehiculos', registroId: v.placa });
          }
        }
        
        if (v.vencimiento_inspeccion_tecnica) {
          const fIns = new Date(v.vencimiento_inspeccion_tecnica);
          const diffDias = this.diferenciaDias(hoy, fIns);
          if (diffDias < 0) {
            alertasNuevas.push({ id: 'v_i_'+v.placa, tipo: 'vehiculo', prioridad: 'critica', titulo: `Inspección Vencida (${v.placa})`, mensaje: `Venció el ${v.vencimiento_inspeccion_tecnica}`, fechaRef: v.vencimiento_inspeccion_tecnica, enlace: '/dashboard/vehiculos', registroId: v.placa });
          } else if (diffDias <= 30) {
            alertasNuevas.push({ id: 'v_i_'+v.placa, tipo: 'vehiculo', prioridad: 'preventiva', titulo: `Inspección por Vencer (${v.placa})`, mensaje: `Vence en ${diffDias} días.`, fechaRef: v.vencimiento_inspeccion_tecnica, enlace: '/dashboard/vehiculos', registroId: v.placa });
          }
        }
      });

      // 2. CONDUCTORES
      conductores.forEach(c => {
        if (c.vencimiento_licencia) {
          const fLic = new Date(c.vencimiento_licencia);
          const diffDias = this.diferenciaDias(hoy, fLic);
          if (diffDias < 0) {
            const nom = c.usuario_detalles?.nombre || 'Desconocido';
            alertasNuevas.push({ id: 'c_l_'+c.id, tipo: 'conductor', prioridad: 'critica', titulo: `Licencia Vencida (${nom})`, mensaje: `La licencia caducó el ${c.vencimiento_licencia}`, fechaRef: c.vencimiento_licencia, enlace: '/dashboard/conductores', registroId: c.id! });
          } else if (diffDias <= 30) {
            const nom = c.usuario_detalles?.nombre || 'Desconocido';
            alertasNuevas.push({ id: 'c_l_'+c.id, tipo: 'conductor', prioridad: 'preventiva', titulo: `Licencia por Vencer (${nom})`, mensaje: `Caduca en ${diffDias} días.`, fechaRef: c.vencimiento_licencia, enlace: '/dashboard/conductores', registroId: c.id! });
          }
        }
      });

      // 3. RESERVAS
      reservas.forEach(r => {
        if (r.fecha_tentativa_viaje && r.estado_reserva === 1) { // 1 = Pendiente
          const fRes = new Date(r.fecha_tentativa_viaje);
          // Si la fecha solicitada ya pasó o es hoy, y sigue pendiente...
          if (fRes.getTime() <= hoy.getTime()) {
            alertasNuevas.push({ id: 'r_'+r.codigo_reserva, tipo: 'reserva', prioridad: 'critica', titulo: `Reserva Retrasada (${r.codigo_reserva})`, mensaje: `Debía viajar el ${r.fecha_tentativa_viaje} pero sigue Pendiente.`, fechaRef: r.fecha_tentativa_viaje, enlace: '/dashboard/reservas', registroId: r.codigo_reserva! });
          }
        }
      });

      // 4. VIAJES
      viajes.forEach(v => {
        if (v.estado_nombre === 'Programado' && v.fecha_salida) {
          const fSal = new Date(v.fecha_salida);
          if (fSal.getTime() < new Date().getTime()) { // Usamos hora real aquí
            alertasNuevas.push({ id: 'vi_s_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'critica', titulo: `Retraso de Salida (${v.codigo_viaje})`, mensaje: `Debió salir a las ${fSal.toLocaleString()}`, fechaRef: v.fecha_salida, enlace: '/dashboard/viajes', registroId: v.codigo_viaje });
          }
        }
        
        if (v.estado_nombre === 'En Curso' && v.fecha_llegada_estimada) {
          const fLleg = new Date(v.fecha_llegada_estimada);
          if (fLleg.getTime() < new Date().getTime()) {
            alertasNuevas.push({ id: 'vi_l_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'critica', titulo: `Demora en Ruta (${v.codigo_viaje})`, mensaje: `Debió llegar a las ${fLleg.toLocaleString()}`, fechaRef: v.fecha_llegada_estimada, enlace: '/dashboard/viajes', registroId: v.codigo_viaje });
          }
        }
      });

      // Ordenar: Críticas primero, luego preventivas
      alertasNuevas.sort((a, b) => {
        if (a.prioridad === 'critica' && b.prioridad !== 'critica') return -1;
        if (a.prioridad !== 'critica' && b.prioridad === 'critica') return 1;
        return 0;
      });

      this.alertasSubject.next(alertasNuevas);
    });
  }

  private diferenciaDias(fechaActual: Date, fechaFutura: Date): number {
    const diffTime = fechaFutura.getTime() - fechaActual.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
