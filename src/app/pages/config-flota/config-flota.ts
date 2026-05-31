import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { VehiculoService, ModeloVehiculo, TipoVehiculo } from '../../services/vehiculo';
import { ConductorService, CategoriaLicencia } from '../../services/conductor';
import { ExportService } from '../../services/export.service';
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
  categoriasLicencia: CategoriaLicencia[] = [];

  // UI
  tabActiva: 'modelos' | 'tipos' | 'licencias' = 'modelos';
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
      if (this.tabActiva === 'licencias') return this.categoriasLicencia;
    }
    
    const term = this.terminoBusqueda.toLowerCase();
    
    if (this.tabActiva === 'modelos') {
      return this.modelos.filter((m: any) => `${m.marca} ${m.nombre_modelo} ${m.anio}`.toLowerCase().includes(term));
    }
    if (this.tabActiva === 'tipos') {
      return this.tipos.filter((t: any) => `${t.nombre}`.toLowerCase().includes(term));
    }
    if (this.tabActiva === 'licencias') {
      return this.categoriasLicencia.filter((c: any) => `${c.nombre} ${c.id}`.toLowerCase().includes(term));
    }
    return [];
  }

  constructor(
    private vehiculoService: VehiculoService,
    private conductorService: ConductorService,
    private http: HttpClient,
    private exportService: ExportService
  ) {}

  ngOnInit(): void {
    this.cargarCatalogos();
  }

  exportarListado(tipo: 'pdf' | 'excel'): void {
    let estado = '';
    let columnas: any[] = [];
    let datosMapeados: any[] = [];

    if (this.tabActiva === 'modelos') {
      estado = 'Modelos de Vehículos';
      columnas = [
        { header: '#', key: 'nro' },
        { header: 'Marca', key: 'marca' },
        { header: 'Modelo', key: 'nombre_modelo' },
        { header: 'Año', key: 'anio' }
      ];
      datosMapeados = this.filtrados.map((m, index) => ({
        nro: index + 1,
        marca: m.marca || '',
        nombre_modelo: m.nombre_modelo || '',
        anio: m.anio || ''
      }));
    } else if (this.tabActiva === 'tipos') {
      estado = 'Tipos de Vehículos y Capacidad';
      columnas = [
        { header: '#', key: 'nro' },
        { header: 'Nombre', key: 'nombre' },
        { header: 'Capacidad (Kg)', key: 'capacidad_carga_kg' },
        { header: 'Largo (m)', key: 'largo_m' },
        { header: 'Ancho (m)', key: 'ancho_m' },
        { header: 'Alto (m)', key: 'alto_m' }
      ];
      datosMapeados = this.filtrados.map((t, index) => ({
        nro: index + 1,
        nombre: t.nombre || '',
        capacidad_carga_kg: t.capacidad_carga_kg || 0,
        largo_m: t.largo_m || 0,
        ancho_m: t.ancho_m || 0,
        alto_m: t.alto_m || 0
      }));
    } else if (this.tabActiva === 'licencias') {
      estado = 'Categorías de Licencia Permitidas';
      columnas = [
        { header: '#', key: 'nro' },
        { header: 'Categoría', key: 'nombre' },
        { header: 'Maquinaria Pesada', key: 'permite_maquinaria_pesada' },
        { header: 'Edad Mínima', key: 'edad_minima' }
      ];
      datosMapeados = this.filtrados.map((l, index) => ({
        nro: index + 1,
        nombre: l.nombre || '',
        permite_maquinaria_pesada: l.permite_maquinaria_pesada ? 'Sí' : 'No',
        edad_minima: l.edad_minima || 'Sin restricción'
      }));
    }

    const columnasExcel = columnas.filter(c => c.key !== 'nro');

    if (tipo === 'pdf') {
      this.exportService.exportarPDF(datosMapeados, columnas, estado, 'Config_Flota');
    } else {
      this.exportService.exportarExcel(datosMapeados, columnasExcel, 'Config_Flota');
    }
  }

  // 👇 NUEVA FUNCIÓN PARA MENSAJES BONITOS
  mostrarMensaje(mensaje: string, tipo: 'success' | 'error' = 'success'): void {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    setTimeout(() => { this.mostrarToast = false; }, 3500); // Se oculta solo en 3.5s
  }

  cargarCatalogos(): void {
    this.vehiculoService.obtenerModelos().subscribe(m => this.modelos = m);
    this.vehiculoService.obtenerTipos().subscribe(t => this.tipos = t);
    this.conductorService.obtenerCategorias().subscribe(c => this.categoriasLicencia = c);
  }

  // --- LÓGICA DE CATÁLOGOS (Reemplazando alerts) ---

  obtenerQuintales(pesoKg: number): number {
    return pesoKg ? parseFloat((pesoKg / 45).toFixed(2)) : 0;
  }

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
    } else if (this.tabActiva === 'licencias') {
      op = this.objetoActual.id ? this.conductorService.actualizarCategoria(this.objetoActual.id, this.objetoActual) : this.conductorService.crearCategoria(this.objetoActual);
    }

    if(op) {
      op.subscribe({
        next: () => { 
          this.mostrarMensaje('Registro guardado.', 'success');
          this.cargarCatalogos(); 
          this.mostrarModal = false; 
        },
        error: (err: any) => {
          console.error('Error Django en Config Flota:', err?.error);
          let msg = 'Error al guardar el registro.';
          if (err?.error && typeof err.error === 'object') {
            msg += ' Detalles: ' + JSON.stringify(err.error);
          }
          this.mostrarMensaje(msg, 'error');
        }
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
        let serv: any;
        if (this.tabActiva === 'modelos') serv = this.vehiculoService.eliminarModelo(id);
        else if (this.tabActiva === 'tipos') serv = this.vehiculoService.eliminarTipo(id);
        else {
          const cat = this.categoriasLicencia.find(c => c.id === id);
          if (cat && ['P', 'A', 'B', 'C', 'M', 'T', 'Provisional'].includes(cat.nombre)) {
            Swal.fire('Seguridad del Sistema', `La categoría '${cat.nombre}' es una categoría base y no puede ser eliminada.`, 'error');
            return;
          }
          serv = this.conductorService.eliminarCategoria(id);
        }

        if (serv) {
          serv.subscribe({
            next: () => {
              this.mostrarMensaje('Registro eliminado.', 'success');
              this.cargarCatalogos();
            },
            error: () => this.mostrarMensaje('No se puede eliminar: está siendo usado.', 'error')
          });
        }
      }
    });
  }
}