import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { VehiculoService, ModeloVehiculo, TipoVehiculo, EstadoVehiculo } from '../../services/vehiculo';
import { ConductorService, CategoriaLicencia } from '../../services/conductor';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-config-flota',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './config-flota.html',
  styleUrls: ['./config-flota.css'] 
})
export class ConfigFlotaComponent implements OnInit {
  // Datos de Catálogos
  modelos: ModeloVehiculo[] = [];
  tipos: TipoVehiculo[] = [];
  estados: EstadoVehiculo[] = [];
  categorias: CategoriaLicencia[] = [];

  // Datos de Asignaciones
  asignacionesActivas: any[] = [];
  conductores: any[] = [];
  vehiculos: any[] = [];
  
  // 👇 NUEVAS LISTAS FILTRADAS
  conductoresDisponibles: any[] = [];
  vehiculosDisponibles: any[] = [];

  nuevaAsignacion = { conductor: '', vehiculo: '', observaciones: '' };

  // UI
  tabActiva: 'modelos' | 'tipos' | 'estados' | 'asignaciones' = 'modelos';
  mostrarModal = false;
  objetoActual: any = {};

  // 👇 VARIABLES PARA EL MENSAJE FLOTANTE (TOAST)
  mensajeToast: string = '';
  tipoToast: 'success' | 'error' = 'success';
  mostrarToast: boolean = false;
  
  terminoBusqueda: string = '';

  get filtrados(): any[] {
    if (!this.terminoBusqueda) {
      if (this.tabActiva === 'modelos') return this.modelos;
      if (this.tabActiva === 'tipos') return this.tipos;
      if (this.tabActiva === 'estados') return this.estados;
      if (this.tabActiva === 'asignaciones') return this.asignacionesActivas;
    }
    
    const term = this.terminoBusqueda.toLowerCase();
    
    if (this.tabActiva === 'modelos') {
      return this.modelos.filter((m: any) => `${m.marca} ${m.nombre_modelo} ${m.anio}`.toLowerCase().includes(term));
    }
    if (this.tabActiva === 'tipos') {
      return this.tipos.filter((t: any) => `${t.nombre}`.toLowerCase().includes(term));
    }
    if (this.tabActiva === 'estados') {
      return this.estados.filter((e: any) => `${e.nombre}`.toLowerCase().includes(term));
    }
    if (this.tabActiva === 'asignaciones') {
      return this.asignacionesActivas.filter((a: any) => `${a.vehiculo} ${a.conductor_nombre} ${a.conductor_licencia}`.toLowerCase().includes(term));
    }
    return [];
  }

  constructor(
    private vehiculoService: VehiculoService,
    private conductorService: ConductorService,
    private http: HttpClient 
  ) {}

  ngOnInit(): void {
    this.cargarTodo();
  }

  // 👇 NUEVA FUNCIÓN PARA MENSAJES BONITOS
  mostrarMensaje(mensaje: string, tipo: 'success' | 'error' = 'success'): void {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    setTimeout(() => { this.mostrarToast = false; }, 3500); // Se oculta solo en 3.5s
  }

  cargarTodo(): void {
    this.vehiculoService.obtenerModelos().subscribe(m => this.modelos = m);
    this.vehiculoService.obtenerTipos().subscribe(t => this.tipos = t);
    this.vehiculoService.obtenerEstados().subscribe(e => this.estados = e);
    this.conductorService.obtenerCategorias().subscribe(c => this.categorias = c);
    this.cargarDatosAsignacion();
  }

  // --- LÓGICA DE ASIGNACIONES MEJORADA ---

  cargarDatosAsignacion(): void {
    this.http.get<any[]>('http://localhost:8000/api/conductores/').subscribe(conds => {
      this.conductores = conds;
      
      this.http.get<any[]>('http://localhost:8000/api/vehiculos/').subscribe(vehs => {
        this.vehiculos = vehs;
        
        this.http.get<any[]>('http://localhost:8000/api/asignaciones/?activas=true').subscribe(asigs => {
          
          // 👇 EL DOBLE CANDADO: Filtramos estrictamente en Angular
          this.asignacionesActivas = asigs.filter(a => a.esta_activa === true);
          
          this.filtrarDisponibles(); 
        });
      });
    });
  }

  filtrarDisponibles(): void {
    // Extraemos los IDs y Placas que YA están trabajando
    const idsAsignados = this.asignacionesActivas.map(a => a.conductor);
    const placasAsignadas = this.asignacionesActivas.map(a => a.vehiculo);

    // Filtramos para quedarnos solo con los libres
    this.conductoresDisponibles = this.conductores.filter(c => !idsAsignados.includes(c.id));
    this.vehiculosDisponibles = this.vehiculos.filter(v => !placasAsignadas.includes(v.placa));
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
    console.log('ID a desvincular que llegó de la tabla:', id); // 🕵️‍♂️ Investigador

    if (!id) {
      this.mostrarMensaje('Error interno: No se detectó el ID de la asignación.', 'error');
      return;
    }

    Swal.fire({
      title: '¿Desvincular?',
      text: '¿Desvincular este vehículo de su conductor actual?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#eab308',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, desvincular',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        const payload = { esta_activa: false, fecha_devolucion: new Date().toISOString() };
        
        console.log('Enviando petición a Django...'); // 🕵️‍♂️ Investigador

        this.http.patch(`http://localhost:8000/api/asignaciones/${id}/`, payload).subscribe({
          next: (res) => {
            console.log('Respuesta exitosa de Django:', res); // 🕵️‍♂️ Investigador
            this.mostrarMensaje('Unidad liberada correctamente.', 'success');
            this.cargarDatosAsignacion();
          },
          error: (err) => {
            console.error('ERROR COMPLETO HTTP:', err); // 🕵️‍♂️ Investigador
            this.mostrarMensaje('Error al desvincular. Revisa la consola (F12).', 'error');
          }
        });
      }
    });
  }

  // --- LÓGICA DE CATÁLOGOS (Reemplazando alerts) ---

  abrirModal(item?: any): void {
    this.objetoActual = item ? { ...item } : {};
    this.mostrarModal = true;
  }

  guardar(): void {
    let op: any; // 👇 AQUÍ ESTÁ EL ARREGLO MÁGICO
    
    if (this.tabActiva === 'modelos') {
      op = this.objetoActual.id ? this.vehiculoService.actualizarModelo(this.objetoActual.id, this.objetoActual) : this.vehiculoService.crearModelo(this.objetoActual);
    } else if (this.tabActiva === 'tipos') {
      op = this.objetoActual.id ? this.vehiculoService.actualizarTipo(this.objetoActual.id, this.objetoActual) : this.vehiculoService.crearTipo(this.objetoActual);
    } else if (this.tabActiva === 'estados') {
      op = this.objetoActual.id ? this.vehiculoService.actualizarEstado(this.objetoActual.id, this.objetoActual) : this.vehiculoService.crearEstado(this.objetoActual);
    }

    if(op) {
      op.subscribe(() => { 
        this.mostrarMensaje('Registro guardado.', 'success');
        this.cargarTodo(); 
        this.mostrarModal = false; 
      });
    }
  }

  eliminar(id: number): void {
    Swal.fire({
      title: '¿Eliminar Registro?',
      text: '¿Seguro que deseas eliminar este registro? Esta acción es irreversible.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        let serv;
        if (this.tabActiva === 'modelos') serv = this.vehiculoService.eliminarModelo(id);
        else if (this.tabActiva === 'tipos') serv = this.vehiculoService.eliminarTipo(id);
        else serv = this.vehiculoService.eliminarEstado(id);

        if (serv) {
          serv.subscribe({
            next: () => {
              this.mostrarMensaje('Registro eliminado.', 'success');
              this.cargarTodo();
            },
            error: () => this.mostrarMensaje('No se puede eliminar: está siendo usado.', 'error')
          });
        }
      }
    });
  }
}