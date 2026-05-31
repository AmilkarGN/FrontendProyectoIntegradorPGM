import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';
import { VehiculoService, Vehiculo } from './vehiculo';
import { ConductorService, Conductor } from './conductor';
import { ReservaService, Reserva } from './reserva';
import { ViajeService } from './viaje';
import { AuthService } from './auth.service';

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
  
  private alertasIgnoradas: Set<string> = new Set<string>();

  constructor(
    private vehiculoService: VehiculoService,
    private conductorService: ConductorService,
    private reservaService: ReservaService,
    private viajeService: ViajeService,
    private authService: AuthService
  ) { 
    // Recuperar alertas ignoradas de localStorage si existe
    if (typeof window !== 'undefined') {
      const ignoradas = localStorage.getItem('alertas_ignoradas');
      if (ignoradas) {
        this.alertasIgnoradas = new Set(JSON.parse(ignoradas));
      }
    }
  }

  public ignorarAlerta(id: string): void {
    this.alertasIgnoradas.add(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem('alertas_ignoradas', JSON.stringify(Array.from(this.alertasIgnoradas)));
    }
    // Forzar re-emisión para que los componentes se actualicen (con la misma lista completa)
    this.alertasSubject.next(this.alertasSubject.getValue());
  }

  public esIgnorada(id: string): boolean {
    return this.alertasIgnoradas.has(id);
  }

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

      const esConductor = this.authService.tieneRol('Conductor');
      const usr = this.authService.getUsuarioActual();
      let misViajesIDs: string[] = [];
      
      // Si es conductor, identificar cuáles son sus viajes 
      if (esConductor) {
        // En frontend no tenemos una forma directa sincrónica de saber qué viajes son del conductor sin filtrar el array completo
        // Filtramos viajes asumiendo que asignacion.conductor.usuario.id == usr.id
        misViajesIDs = viajes.filter(v => 
          v.asignacion && v.asignacion.conductor && v.asignacion.conductor.usuario && v.asignacion.conductor.usuario.id === usr?.id
        ).map(v => v.codigo_viaje);
      }

      // 1. VEHÍCULOS (Solo Admin)
      if (!esConductor && this.authService.tienePermiso('gestionar_vehiculos')) {
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
      }

      // 2. CONDUCTORES (Admin ve todos, Conductor ve el suyo)
      if (this.authService.tienePermiso('gestionar_conductores') || esConductor) {
        conductores.forEach(c => {
          // c.usuario viene como ID (number) según la interfaz, por lo que TS rechaza acceder a .id
          const usuarioId = (c as any).usuario?.id ? (c as any).usuario.id : c.usuario;
          if (esConductor && usuarioId !== usr?.id) return; // Solo procesar su propio perfil

          if (c.vencimiento_licencia) {
            const fLic = new Date(c.vencimiento_licencia);
            const diffDias = this.diferenciaDias(hoy, fLic);
            if (diffDias < 0) {
              const nom = c.usuario_detalles?.nombre || 'Desconocido';
              alertasNuevas.push({ id: 'c_l_'+c.id, tipo: 'conductor', prioridad: 'critica', titulo: `Licencia Vencida (${nom})`, mensaje: `La licencia caducó el ${c.vencimiento_licencia}`, fechaRef: c.vencimiento_licencia, enlace: esConductor ? '/dashboard/perfil' : '/dashboard/conductores', registroId: c.id! });
            } else if (diffDias <= 30) {
              const nom = c.usuario_detalles?.nombre || 'Desconocido';
              alertasNuevas.push({ id: 'c_l_'+c.id, tipo: 'conductor', prioridad: 'preventiva', titulo: `Licencia por Vencer (${nom})`, mensaje: `Caduca en ${diffDias} días.`, fechaRef: c.vencimiento_licencia, enlace: esConductor ? '/dashboard/perfil' : '/dashboard/conductores', registroId: c.id! });
            }
          }
        });
      }

      // 3. RESERVAS (Solo Admin)
      if (!esConductor) {
        reservas.forEach(r => {
        if (r.fecha_tentativa_viaje && r.estado_reserva === 1) { // 1 = Pendiente
          const fRes = new Date(r.fecha_tentativa_viaje);
          // Si la fecha solicitada ya pasó o es hoy, y sigue pendiente...
          if (fRes.getTime() <= hoy.getTime()) {
            alertasNuevas.push({ id: 'r_'+r.codigo_reserva, tipo: 'reserva', prioridad: 'critica', titulo: `Reserva Retrasada (${r.codigo_reserva})`, mensaje: `Debía viajar el ${r.fecha_tentativa_viaje} pero sigue Pendiente.`, fechaRef: r.fecha_tentativa_viaje, enlace: '/dashboard/reservas', registroId: r.codigo_reserva! });
          } else {
            // Reserva en el futuro pero sin viaje asignado
            alertasNuevas.push({ id: 'r_n_'+r.codigo_reserva, tipo: 'reserva', prioridad: 'preventiva', titulo: `Nueva Reserva (${r.codigo_reserva})`, mensaje: `Carga programada para el ${r.fecha_tentativa_viaje} espera asignación de camión.`, fechaRef: r.fecha_tentativa_viaje, enlace: '/dashboard/reservas', registroId: r.codigo_reserva! });
          }
        }
      });
      }

      // 4. VIAJES (Admin ve todos, Conductor ve los suyos)
      viajes.forEach(v => {
        if (esConductor && !misViajesIDs.includes(v.codigo_viaje)) return; // Conductor solo ve sus viajes

        if (v.estado_nombre === 'Programado' && v.fecha_salida) {
          if (esConductor) {
            // Alerta de Nuevo Viaje Asignado
            alertasNuevas.push({ id: 'vi_n_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'preventiva', titulo: `Nuevo Viaje Asignado`, mensaje: `Tienes un viaje programado para salir el ${new Date(v.fecha_salida).toLocaleString()}`, fechaRef: v.fecha_salida, enlace: '/dashboard/inicio', registroId: v.codigo_viaje });
          } else {
            const fSal = new Date(v.fecha_salida);
            if (fSal.getTime() < new Date().getTime()) { // Usamos hora real aquí
              alertasNuevas.push({ id: 'vi_s_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'critica', titulo: `Retraso de Salida (${v.codigo_viaje})`, mensaje: `Debió salir a las ${fSal.toLocaleString()}`, fechaRef: v.fecha_salida, enlace: '/dashboard/viajes', registroId: v.codigo_viaje });
            }
          }
        }
        
        if (v.estado_nombre === 'En Curso' && v.fecha_llegada_estimada) {
          if (!esConductor) {
            const fLleg = new Date(v.fecha_llegada_estimada);
            if (fLleg.getTime() < new Date().getTime()) {
              alertasNuevas.push({ id: 'vi_l_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'critica', titulo: `Demora en Ruta (${v.codigo_viaje})`, mensaje: `Debió llegar a las ${fLleg.toLocaleString()}`, fechaRef: v.fecha_llegada_estimada, enlace: '/dashboard/viajes', registroId: v.codigo_viaje });
            }
          }
        }
        
        if (v.estado_nombre === 'Finalizado') {
          if (esConductor) {
             alertasNuevas.push({ id: 'vi_f_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'preventiva', titulo: `Viaje Finalizado`, mensaje: `Has completado el viaje ${v.codigo_viaje}.`, fechaRef: v.fecha_salida || 'Reciente', enlace: '/dashboard/inicio', registroId: v.codigo_viaje });
          } else {
            // Alertar sobre un viaje recién finalizado que quizás necesite cierre contable
            alertasNuevas.push({ id: 'vi_f_'+v.codigo_viaje, tipo: 'viaje', prioridad: 'preventiva', titulo: `Viaje Finalizado (${v.codigo_viaje})`, mensaje: `El viaje concluyó. Revisar viáticos y rendimiento.`, fechaRef: v.fecha_salida || 'Reciente', enlace: '/dashboard/viajes', registroId: v.codigo_viaje });
          }
        }
      });

      // Ordenar: Críticas primero, luego preventivas
      alertasNuevas.sort((a, b) => {
        if (a.prioridad === 'critica' && b.prioridad !== 'critica') return -1;
        if (a.prioridad !== 'critica' && b.prioridad === 'critica') return 1;
        return 0;
      });

      // Emitimos todas las alertas sin filtrar, el filtrado lo hará la campanita
      this.alertasSubject.next(alertasNuevas);
    });
  }

  private diferenciaDias(fechaActual: Date, fechaFutura: Date): number {
    const diffTime = fechaFutura.getTime() - fechaActual.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
