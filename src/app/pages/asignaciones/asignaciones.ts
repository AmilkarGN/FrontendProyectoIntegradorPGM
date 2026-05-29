import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { VehiculoService } from '../../services/vehiculo';
import { ExportService } from '../../services/export.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-asignaciones',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './asignaciones.html',
  styleUrls: ['./asignaciones.css']
})
export class AsignacionesComponent implements OnInit {
  asignacionesActivas: any[] = [];
  conductores: any[] = [];
  vehiculos: any[] = [];
  
  conductoresDisponibles: any[] = [];
  vehiculosDisponibles: any[] = [];

  estadosVehiculo: string[] = ['Disponible', 'En Ruta', 'En Taller'];
  viajes: any[] = []; // <-- Viajes activos
  viendoHistorial: boolean = false;

  nuevaAsignacion = { conductor: '', vehiculo: '', observaciones: '' };

  mensajeToast: string = '';
  tipoToast: 'success' | 'error' = 'success';
  mostrarToast: boolean = false;
  
  terminoBusqueda: string = '';
  fechaFiltro: string = '';
  
  mostrarGuiaEstados: boolean = false;

  get filtrados(): any[] {
    if (!this.terminoBusqueda) return this.asignacionesActivas;
    const term = this.terminoBusqueda.toLowerCase();
    return this.asignacionesActivas.filter((a: any) => 
      `${a.vehiculo} ${a.conductor_nombre} ${a.conductor_licencia}`.toLowerCase().includes(term)
    );
  }

  private vehiculoService = inject(VehiculoService);
  private exportService = inject(ExportService);
  private http = inject(HttpClient);

  constructor() {}

  abrirGuiaEstados() {
    this.mostrarGuiaEstados = true;
  }

  ngOnInit(): void {
    this.cargarDatosAsignacion();
  }

  mostrarMensaje(mensaje: string, tipo: 'success' | 'error' = 'success'): void {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    setTimeout(() => { this.mostrarToast = false; }, 3500);
  }

  cargarDatosAsignacion(): void {
    this.http.get<any[]>('http://localhost:8000/api/conductores/').subscribe(conds => {
      this.conductores = conds;
      
      this.http.get<any[]>('http://localhost:8000/api/vehiculos/').subscribe(vehs => {
        this.vehiculos = vehs;
        
        this.http.get<any[]>(`http://localhost:8000/api/asignaciones/?activas=${!this.viendoHistorial}`).subscribe(asigs => {
          this.asignacionesActivas = asigs.filter(a => a.esta_activa === !this.viendoHistorial);
          
          this.http.get<any[]>('http://localhost:8000/api/viajes/').subscribe(viajes => {
             this.viajes = viajes;
             this.filtrarDisponibles(); 
          });
        });
      });
    });
  }

  getEstadoAsignacion(asignacion: any): string {
    const enViajeActivo = this.viajes.some(v => 
      v.asignacion === asignacion.id &&
      v.estado_nombre !== 'Finalizado' &&
      v.estado_nombre !== 'Cancelado'
    );
    if (enViajeActivo) return 'En Viaje';

    const v = this.vehiculos.find(x => x.placa === asignacion.vehiculo);
    const c = this.conductores.find(x => x.id === asignacion.conductor);

    if (v && (v.estado === 'En Taller' || v.estado === 'Averiado en viaje')) {
      return 'Vehículo Inactivo';
    }
    const inactivosCond = ['Vacaciones', 'Baja Medica', 'Permiso', 'Descanso'];
    if (c && inactivosCond.includes(c.estado)) {
      return 'Conductor Inactivo';
    }

    return 'Disponible';
  }

  filtrarDisponibles(): void {
    const idsAsignados = this.asignacionesActivas.map(a => a.conductor);
    const placasAsignadas = this.asignacionesActivas.map(a => a.vehiculo);

    // Conductor libre y en estado Disponible
    this.conductoresDisponibles = this.conductores.filter(c => 
      !idsAsignados.includes(c.id) && c.estado === 'Disponible'
    );
    // Vehículos libres y en estado Disponible
    this.vehiculosDisponibles = this.vehiculos.filter(v => 
      !placasAsignadas.includes(v.placa) && v.estado === 'Disponible'
    );
  }

  toggleHistorial(): void {
    this.viendoHistorial = !this.viendoHistorial;
    this.cargarDatosAsignacion();
  }

  exportarListado(tipo: 'pdf' | 'excel'): void {
    const estado = this.viendoHistorial ? 'Historial de Asignaciones' : 'Asignaciones Activas';
    const columnas = [
      { header: 'ID', key: 'id' },
      { header: 'Conductor', key: 'conductor_nombre' },
      { header: 'Vehículo', key: 'vehiculo' },
      { header: 'Fecha Asignación', key: 'fecha_asignacion' },
      { header: 'Fecha Devolución', key: 'fecha_devolucion' }
    ];
    if (tipo === 'pdf') {
      this.exportService.exportarPDF(this.filtrados, columnas, estado, 'Asignaciones');
    } else {
      this.exportService.exportarExcel(this.filtrados, columnas, 'Asignaciones');
    }
  }

  asignarVehiculo(): void {
    if (!this.nuevaAsignacion.conductor || !this.nuevaAsignacion.vehiculo) {
      this.mostrarMensaje('Faltan datos por seleccionar.', 'error');
      return;
    }

    const payload = { ...this.nuevaAsignacion, esta_activa: true };

    this.http.post('http://localhost:8000/api/asignaciones/', payload).subscribe({
      next: () => {
        this.mostrarMensaje('¡Vínculo operativo establecido!', 'success');
        this.cargarDatosAsignacion(); 
        this.nuevaAsignacion = { conductor: '', vehiculo: '', observaciones: '' };
      },
      error: () => this.mostrarMensaje('Error al crear la asignación.', 'error')
    });
  }

  desvincular(id: number): void {
    if (!id) {
      this.mostrarMensaje('Error interno: No se detectó el ID de la asignación.', 'error');
      return;
    }

    const asignacion = this.filtrados.find(a => a.id === id);
    const estadoVehiculo = asignacion ? this.getEstadoVehiculo(asignacion.vehiculo) : '';
    
    let alertTitle = '¿Desvincular?';
    let alertText = '¿Desvincular este vehículo de su conductor actual?';
    let alertIcon: 'question' | 'warning' = 'question';
    let confirmColor = '#eab308';

    if (estadoVehiculo === 'Averiado en viaje') {
      alertTitle = '⚠️ Atención: Vehículo Averiado';
      alertText = 'El conductor tiene la responsabilidad de quedarse con el vehículo hasta que se asigne rescate. Solo desvincule en casos especiales autorizados. ¿Está seguro de desvincular?';
      alertIcon = 'warning';
      confirmColor = '#ef4444'; // Red para peligro
    }

    Swal.fire({
      title: alertTitle,
      text: alertText,
      icon: alertIcon,
      showCancelButton: true,
      confirmButtonColor: confirmColor,
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, desvincular',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const payload = { esta_activa: false, fecha_devolucion: new Date().toISOString() };
        
        this.http.patch(`http://localhost:8000/api/asignaciones/${id}/`, payload).subscribe({
          next: () => {
            this.mostrarMensaje('Unidad liberada correctamente.', 'success');
            this.cargarDatosAsignacion();
          },
          error: () => {
            this.mostrarMensaje('Error al desvincular. Revisa la consola (F12).', 'error');
          }
        });
      }
    });
  }

  cambiarEstadoVehiculo(asignacion: any, event: Event): void {
    const selectElement = event.target as HTMLSelectElement;
    const nuevoEstado = selectElement.value;
    
    // Obtenemos el vehículo de la lista principal de vehículos cargados
    const vehiculoBase = this.vehiculos.find(v => v.placa === asignacion.vehiculo);
    if (!vehiculoBase) {
        this.mostrarMensaje('No se encontró información del vehículo.', 'error');
        return;
    }
    
    const estadoOriginal = vehiculoBase.estado;

    // Verificar si el vehículo está en viaje (En Curso o Programado)
    this.http.get<any[]>('http://localhost:8000/api/viajes/').subscribe(viajes => {
      const enViajeActivo = viajes.some(v => 
        v.vehiculo_placa === vehiculoBase.placa &&
        v.estado_nombre !== 'Finalizado' &&
        v.estado_nombre !== 'Cancelado'
      );

      if (enViajeActivo) {
        Swal.fire({
          icon: 'error',
          title: 'Acción Bloqueada',
          text: `No puedes cambiar el estado del vehículo ${vehiculoBase.placa} porque actualmente se encuentra en un viaje activo.`
        });
        setTimeout(() => {
          vehiculoBase.estado = estadoOriginal;
          selectElement.value = estadoOriginal;
        });
        return;
      }

      const payload = new FormData();
      payload.append('estado', nuevoEstado);
      
      this.vehiculoService.actualizarVehiculo(vehiculoBase.placa, payload).subscribe({
        next: () => {
          vehiculoBase.estado = nuevoEstado;
          this.mostrarMensaje('Estado de vehículo actualizado', 'success');
        },
        error: () => {
          this.mostrarMensaje('Error al actualizar el estado', 'error');
          setTimeout(() => {
            vehiculoBase.estado = estadoOriginal;
            selectElement.value = estadoOriginal;
          });
        }
      });
    });
  }

  // Getter para ayudar a la plantilla a mostrar el ID del estado actual del vehículo vinculado
  getEstadoVehiculo(placa: string): string | null {
    const v = this.vehiculos.find(ve => ve.placa === placa);
    return v ? v.estado : null;
  }
}
