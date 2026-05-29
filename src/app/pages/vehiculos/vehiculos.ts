import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { 
  VehiculoService, Vehiculo, ModeloVehiculo, 
  TipoVehiculo 
} from '../../services/vehiculo';
import { ViajeService } from '../../services/viaje';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

import { QueryBuilderComponent, ColumnaFiltrable, ReglaFiltro, evaluarFiltrosDinámicos } from '../../shared/query-builder/query-builder';

@Component({
  selector: 'app-vehiculos',
  standalone: true,
  imports: [CommonModule, FormsModule, QueryBuilderComponent],
  templateUrl: './vehiculos.html',
  styleUrls: ['./vehiculos.css'] // Reutilizamos tu excelente diseño de tablas
})
export class VehiculosComponent implements OnInit {
  vehiculos: Vehiculo[] = [];
  modelos: ModeloVehiculo[] = [];
  tipos: TipoVehiculo[] = [];
  estados: string[] = ['Disponible', 'En Ruta', 'En Taller', 'Averiado en viaje'];

  cargando = true;
  mostrarModal = false;
  modoModal: 'crear' | 'editar' | 'ver' = 'crear';
  
  vehiculoActual: Vehiculo | any = {};
  archivoFoto: File | null = null;
  baseMediaUrl = 'http://localhost:8000';
  foto?: string;
  fecha_eliminacion?: string;
  eliminado_por_nombre?: string;
  fechaHoy: string = new Date().toISOString().split('T')[0];

  // Guardamos la placa original al editar por si el usuario la intenta cambiar
  placaOriginalEdicion: string = '';
  
  kpiVehiculos: any = null;
  viendoPapelera = false;
  alertaDestacada: string | null = null;

  mostrarGuiaEstados: boolean = false;

  constructor(
    private vehiculoService: VehiculoService,
    private viajeService: ViajeService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  abrirGuiaEstados() {
    this.mostrarGuiaEstados = true;
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['alerta']) this.alertaDestacada = String(params['alerta']);
    });
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    this.cargando = true;
    this.vehiculoService.obtenerModelos().subscribe(m => this.modelos = m);
    this.vehiculoService.obtenerTipos().subscribe(t => this.tipos = t);

    this.cargarVehiculos();
    
    // Cargar KPIs
    this.http.get('http://localhost:8000/api/estadisticas/vehiculos/').subscribe(data => {
      this.kpiVehiculos = data;
    });
  }

  cargarVehiculos(): void {
    this.vehiculoService.obtenerVehiculos(this.viendoPapelera).subscribe({
      next: (data) => { this.vehiculos = data; this.cargando = false; },
      error: (err) => { console.error('Error:', err); this.cargando = false; }
    });
  }

  alternarPapelera(estado: boolean) {
    this.viendoPapelera = estado;
    this.cargarVehiculos();
  }

  // --- CAMBIO DE ESTADO RÁPIDO DESDE LA TABLA ---
  cambiarEstadoRapido(vehiculo: Vehiculo, event: Event) {
    const selectElement = event.target as HTMLSelectElement;
    const nuevoEstado = selectElement.value;
    const estadoOriginal = vehiculo.estado;

    // 1. Verificamos si está en un viaje activo
    this.viajeService.obtenerViajes().subscribe(viajes => {
      const enViajeActivo = viajes.some(v => 
        v.vehiculo_placa === vehiculo.placa &&
        v.estado_nombre !== 'Finalizado' && 
        v.estado_nombre !== 'Cancelado'
      );

      if (enViajeActivo) {
        Swal.fire({
          icon: 'error',
          title: 'Acción Bloqueada',
          text: `No puedes cambiar el estado del vehículo ${vehiculo.placa} porque actualmente se encuentra en un viaje activo.`
        });
        // Revertir el modelo de Angular y el select visualmente
        setTimeout(() => {
          vehiculo.estado = estadoOriginal;
          selectElement.value = estadoOriginal;
        });
        return;
      }

      // 2. Si no está en viaje, procedemos con el cambio en el backend
      const estadosInactivos = ['En Taller', 'Averiado en viaje'];

      const ejecutarCambio = () => {
        const payload = new FormData();
        payload.append('estado', nuevoEstado);
        
        this.vehiculoService.actualizarVehiculo(vehiculo.placa, payload).subscribe({
          next: (res) => {
            vehiculo.estado = nuevoEstado;
            // Eliminamos estado_detalles porque ya no se usa
            vehiculo.estado_detalles = null;
            
            Swal.fire({
              toast: true, position: 'top-end', showConfirmButton: false, timer: 3000,
              icon: 'success', title: 'Estado actualizado correctamente'
            });
          },
          error: (err) => {
            console.error('Error al cambiar estado:', err);
            setTimeout(() => {
              vehiculo.estado = estadoOriginal;
              selectElement.value = estadoOriginal;
            });
            Swal.fire('Error', 'No se pudo actualizar el estado.', 'error');
          }
        });
      };

      if (estadosInactivos.includes(nuevoEstado)) {
        Swal.fire({
          title: `¿Cambiar estado a ${nuevoEstado}?`,
          text: '¿Está seguro de que desea cambiar el estado del vehículo?',
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#eab308',
          cancelButtonColor: '#64748b',
          confirmButtonText: 'Sí, continuar',
          cancelButtonText: 'Cancelar'
        }).then((result1) => {
          if (result1.isConfirmed) {
            // Buscamos si tiene un conductor asignado
            this.http.get<any[]>(`http://localhost:8000/api/asignaciones/?vehiculo=${vehiculo.placa}&esta_activa=true`).subscribe(asignaciones => {
              const activas = asignaciones.filter(a => a.vehiculo === vehiculo.placa && a.esta_activa);
              
              if (activas.length > 0) {
                const asignacionActiva = activas[0];
                Swal.fire({
                  title: '¿Desvincular Conductor?',
                  text: 'El vehículo tiene un conductor asignado. ¿Desea desvincular al conductor para que pueda tomar otro vehículo, o mantener la vinculación?',
                  icon: 'question',
                  showCancelButton: true,
                  confirmButtonColor: '#ef4444',
                  cancelButtonColor: '#3b82f6',
                  confirmButtonText: 'Desvincular',
                  cancelButtonText: 'Mantener'
                }).then((result2) => {
                  if (result2.isConfirmed) {
                    const patchPayload = { esta_activa: false, fecha_devolucion: new Date().toISOString().split('T')[0] };
                    this.http.patch(`http://localhost:8000/api/asignaciones/${asignacionActiva.id}/`, patchPayload).subscribe({
                      next: () => {
                        Swal.fire({ toast: true, position: 'top-end', showConfirmButton: false, timer: 3000, icon: 'success', title: 'Conductor desvinculado.' });
                        ejecutarCambio();
                      },
                      error: () => {
                        Swal.fire('Aviso', 'Error al desvincular el conductor.', 'error');
                        ejecutarCambio();
                      }
                    });
                  } else {
                    ejecutarCambio();
                  }
                });
              } else {
                ejecutarCambio();
              }
            });
          } else {
            setTimeout(() => {
              vehiculo.estado = estadoOriginal;
              selectElement.value = estadoOriginal;
            });
          }
        });
      } else {
        ejecutarCambio();
      }
    });
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) this.archivoFoto = file;
  }

  // --- QUERY BUILDER CONFIG ---
  columnasFiltro: ColumnaFiltrable[] = [
    { campo: 'placa', nombre: 'Placa', tipo: 'texto' },
    { campo: 'modelo_detalles.marca', nombre: 'Marca', tipo: 'texto' },
    { campo: 'modelo_detalles.nombre_modelo', nombre: 'Modelo', tipo: 'texto' },
    { campo: 'tipo_detalles.nombre', nombre: 'Tipo de Vehículo', tipo: 'texto' },
    { campo: 'estado_detalles.nombre', nombre: 'Estado Actual', tipo: 'texto' },
    { campo: 'vencimiento_soat', nombre: 'Venc. SOAT', tipo: 'fecha' }
  ];
  
  reglasActivas: ReglaFiltro[] = [];

  aplicarFiltros(reglas: ReglaFiltro[]) {
    this.reglasActivas = reglas;
  }

  get filtrados(): Vehiculo[] {
    return this.vehiculos.filter(v => evaluarFiltrosDinámicos(v, this.reglasActivas));
  }

  abrirModalCrear(): void {
    this.modoModal = 'crear';
    this.vehiculoActual = { placa: '', modelo: null, tipo: null, estado: null };
    this.archivoFoto = null;
    this.mostrarModal = true;
  }

  editarVehiculo(vehiculo: Vehiculo): void {
    this.modoModal = 'editar';
    this.vehiculoActual = { ...vehiculo };
    this.placaOriginalEdicion = vehiculo.placa; // Protegemos la llave primaria
    this.archivoFoto = null;
    this.mostrarModal = true;
  }

  verVehiculo(vehiculo: Vehiculo): void {
    this.modoModal = 'ver';
    this.vehiculoActual = { ...vehiculo };
    this.mostrarModal = true;
  }

  cerrarModal(): void { this.mostrarModal = false; }

  guardarVehiculo(): void {
    const formData = new FormData();
    formData.append('placa', this.vehiculoActual.placa);
    formData.append('modelo', this.vehiculoActual.modelo);
    formData.append('tipo', this.vehiculoActual.tipo);
    formData.append('estado', this.vehiculoActual.estado);
    
    if (this.vehiculoActual.chasis) formData.append('chasis', this.vehiculoActual.chasis);
    if (this.vehiculoActual.color) formData.append('color', this.vehiculoActual.color);
    if (this.vehiculoActual.vencimiento_soat) formData.append('vencimiento_soat', this.vehiculoActual.vencimiento_soat);
    if (this.vehiculoActual.vencimiento_inspeccion_tecnica) formData.append('vencimiento_inspeccion_tecnica', this.vehiculoActual.vencimiento_inspeccion_tecnica);
    
    if (this.archivoFoto) {
      formData.append('foto', this.archivoFoto, this.archivoFoto.name);
    }

    if (this.modoModal === 'editar') {
      this.vehiculoService.actualizarVehiculo(this.placaOriginalEdicion, formData).subscribe({
        next: () => { 
          this.cargarVehiculos(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Vehículo actualizado correctamente', 'success');
        },
        error: (err: any) => {
          console.error('Error de Django al ACTUALIZAR Vehículo:', err?.error);
          let msg = 'Error al actualizar. Revisa la consola o asegúrate de que la placa sea válida.';
          if (err?.error && typeof err.error === 'object') msg += '<br><br><small>' + JSON.stringify(err.error) + '</small>';
          Swal.fire('Error', msg, 'error');
        }
      });
    } else {
      this.vehiculoService.crearVehiculo(formData).subscribe({
        next: () => { 
          this.cargarVehiculos(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Vehículo registrado correctamente', 'success');
        },
        error: (err: any) => {
          console.error('Error de Django al CREAR Vehículo:', err?.error);
          let msg = 'Error al crear. Asegúrate de que la placa no exista ya.';
          if (err?.error && typeof err.error === 'object') msg += '<br><br><small>' + JSON.stringify(err.error) + '</small>';
          Swal.fire('Error', msg, 'error');
        }
      });
    }
  }

  eliminarVehiculo(placa: string): void {
    Swal.fire({
      title: '¿Eliminar Vehículo?',
      text: `¿Estás seguro de eliminar el vehículo con placa ${placa}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.vehiculoService.eliminarVehiculo(placa).subscribe({
          next: () => {
            this.vehiculos = this.vehiculos.filter(v => v.placa !== placa);
            Swal.fire('Eliminado', 'El vehículo fue movido a la papelera.', 'success');
          },
          error: () => Swal.fire('Error', 'No se puede eliminar. Probablemente tiene asignaciones activas.', 'error')
        });
      }
    });
  }

  restaurarVehiculo(placa: string): void {
    Swal.fire({
      title: '¿Restaurar Vehículo?',
      text: `¿Deseas restaurar el vehículo ${placa} de la papelera?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, restaurar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.vehiculoService.restaurarVehiculo(placa).subscribe({
          next: () => {
            this.cargarVehiculos();
            Swal.fire('Restaurado', 'El vehículo ha sido restaurado exitosamente.', 'success');
          },
          error: () => Swal.fire('Error', 'No se pudo restaurar.', 'error')
        });
      }
    });
  }

  obtenerImagenUrl(url: string | undefined): string {
    if (!url) return 'assets/images/icono.png'; // Tu logo de camión por defecto
    return url.startsWith('http') ? url : `${this.baseMediaUrl}${url}`;
  }

  verAuditoria(item: any): void {
    const fecha = item.fecha_eliminacion ? new Date(item.fecha_eliminacion).toLocaleString() : 'Desconocida';
    const autor = item.eliminado_por_nombre || 'Desconocido';
    
    Swal.fire({
      title: 'Información de Eliminación',
      html: `
        <div style="text-align: left; margin-top: 15px;">
          <p><strong>🕒 Fecha y Hora:</strong> ${fecha}</p>
          <p><strong>👤 Eliminado por:</strong> ${autor}</p>
        </div>
      `,
      icon: 'info',
      confirmButtonColor: '#3b82f6',
      confirmButtonText: 'Cerrar'
    });
  }
}