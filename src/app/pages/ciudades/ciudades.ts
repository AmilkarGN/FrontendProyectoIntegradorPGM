import { Component, OnInit, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CiudadService, Ciudad } from '../../services/ciudad';
import { ExportService } from '../../services/export.service';
import Swal from 'sweetalert2';

declare const google: any;

@Component({
  selector: 'app-ciudades',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ciudades.html',
  styleUrls: ['./ciudades.css']
})
export class CiudadesComponent implements OnInit {
  ciudades: Ciudad[] = [];
  cargando: boolean = true;
  mostrarFormulario: boolean = false;
  viendoPapelera: boolean = false;
  
  ciudadActual: Ciudad = { nombre: '', region_estado: '', pais: 'Bolivia' };

  // 1. INYECTAMOS NgZone en el constructor
  constructor(
    private ciudadService: CiudadService,
    private exportService: ExportService,
    private ngZone: NgZone 
  ) {}

  ngOnInit(): void {
    this.cargarCiudades();
  }

  cargarCiudades(): void {
    this.cargando = true;
    this.ciudadService.obtenerCiudades(this.viendoPapelera).subscribe({
      next: (data) => {
        this.ciudades = data;
        this.cargando = false;
      },
      error: (error) => {
        console.error('Error al obtener ciudades:', error);
        this.cargando = false;
      }
    });
  }

  // --- GOOGLE MAPS AUTOCOMPLETADO ---

  terminoBusqueda: string = '';

  get filtrados(): Ciudad[] {
    if (!this.terminoBusqueda) return this.ciudades;
    const term = this.terminoBusqueda.toLowerCase();
    return this.ciudades.filter(c => {
      const searchStr = `${c.nombre} ${c.region_estado} ${c.pais}`.toLowerCase();
      return searchStr.includes(term);
    });
  }

  // --- REPORTES ---
  async exportar(tipo: 'pdf' | 'excel'): Promise<void> {
    const { value: nombreArchivo } = await Swal.fire({
      title: `Exportar a ${tipo.toUpperCase()}`,
      input: 'text',
      inputLabel: 'Nombre del archivo',
      inputValue: `Reporte_Bases_Operativas_${new Date().getTime()}`,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return '¡Necesitas escribir un nombre!';
        return null;
      }
    });

    if (nombreArchivo) {
      const columnas = [
        { header: 'ID', key: 'id' },
        { header: 'Nombre Base / Ciudad', key: 'nombre' },
        { header: 'País de Operación', key: 'pais' },
        { header: 'Estado', key: 'activo' }
      ];

      const autor = typeof window !== 'undefined' ? localStorage.getItem('usuario_nombre') || 'Administrador' : 'Administrador';

      const datosProcesados = this.filtrados.map((c: any) => ({
        ...c,
        activo: !c.fecha_eliminacion ? 'Activa' : 'Inactiva'
      }));

      if (tipo === 'excel') {
        this.exportService.exportarExcel(datosProcesados, columnas, nombreArchivo, autor);
      } else {
        this.exportService.exportarPDF(datosProcesados, columnas, 'Reporte de Bases Operativas y Ciudades', nombreArchivo, autor);
      }
      Swal.fire('Éxito', `Reporte ${tipo.toUpperCase()} generado.`, 'success');
    }
  }

  alternarPapelera(): void {
    this.viendoPapelera = !this.viendoPapelera;
    this.cargarCiudades();
  }
  iniciarGoogleAutocomplete(): void {
    setTimeout(() => {
      const inputElement = document.getElementById('inputCiudad') as HTMLInputElement;

      if (inputElement) {
        const autocomplete = new google.maps.places.Autocomplete(inputElement, {
          types: ['(cities)'], 
        });

        autocomplete.addListener('place_changed', () => {
          // 2. Se usa ngZone.run() para forzar a Angular a actualizar la pantalla
          this.ngZone.run(() => {
            const place = autocomplete.getPlace();
            if (!place.address_components) return;
            this.mapearDatosGoogle(place.address_components);
          });
        });
      }
    }, 300);
  }

  mapearDatosGoogle(componentes: any[]): void {
    let ciudad = '';
    let region = '';
    let pais = '';

    for (const component of componentes) {
      const type = component.types[0];
      if (type === 'locality' || type === 'administrative_area_level_2') {
        ciudad = component.long_name;
      } else if (type === 'administrative_area_level_1') {
        region = component.long_name;
      } else if (type === 'country') {
        pais = component.long_name;
      }
    }

    // Al asignar esto dentro del NgZone, los inputs del HTML se llenarán al instante
    this.ciudadActual.nombre = ciudad;
    this.ciudadActual.region_estado = region;
    this.ciudadActual.pais = pais;
  }

  // --- MÉTODOS DEL MODAL Y CRUD ---
  abrirModal(): void {
    this.ciudadActual = { nombre: '', region_estado: '', pais: 'Bolivia' };
    this.mostrarFormulario = true;
    this.iniciarGoogleAutocomplete();
  }

  cerrarModal(): void {
    this.mostrarFormulario = false;
  }

  editarCiudad(ciudad: Ciudad): void {
    this.ciudadActual = { ...ciudad };
    this.mostrarFormulario = true;
    this.iniciarGoogleAutocomplete();
  }

  guardarCiudad(): void {
    if (!this.ciudadActual.nombre || !this.ciudadActual.region_estado || !this.ciudadActual.pais) {
      return; 
    }

    const payload: any = { ...this.ciudadActual };
    delete payload.activo;
    delete payload.eliminado_por_nombre;

    if (payload.id) {
      this.ciudadService.actualizarCiudad(payload.id, payload).subscribe({
        next: () => { 
          this.cargarCiudades(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Ciudad actualizada.', 'success');
        },
        error: (err) => {
          console.error('Error de Django en actualizar Ciudad:', err.error);
          let msg = 'Error al actualizar la ciudad.';
          if (err.error && typeof err.error === 'object') msg += ' Detalles: ' + JSON.stringify(err.error);
          Swal.fire('Error', msg, 'error');
        }
      });
    } else {
      this.ciudadService.crearCiudad(payload).subscribe({
        next: () => { 
          this.cargarCiudades(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Ciudad creada.', 'success');
        },
        error: (err) => {
          console.error('Error de Django en crear Ciudad:', err.error);
          let msg = 'Error al crear la ciudad.';
          if (err.error && typeof err.error === 'object') msg += ' Detalles: ' + JSON.stringify(err.error);
          Swal.fire('Error', msg, 'error');
        }
      });
    }
  }

  eliminarCiudad(id: number | undefined): void {
    if (id) {
      Swal.fire({
        title: '¿Eliminar Ciudad?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.ciudadService.eliminarCiudad(id).subscribe({
            next: () => { 
              this.ciudades = this.ciudades.filter(c => c.id !== id); 
              Swal.fire('¡Eliminado!', 'La ciudad ha sido enviada a la papelera.', 'success');
            },
            error: (err) => {
              console.error('Error al eliminar:', err);
              Swal.fire('Error', 'No se pudo eliminar la ciudad. Es posible que esté en uso.', 'error');
            }
          });
        }
      });
    }
  }

  restaurarCiudad(id: number | undefined): void {
    if (!id) return;
    Swal.fire({
      title: '¿Restaurar Ciudad?',
      text: '¿Deseas restaurar esta locación de la papelera?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ciudadService.restaurarCiudad(id).subscribe({
          next: () => {
            this.cargarCiudades();
            Swal.fire('Restaurada', 'La ciudad ha sido restaurada.', 'success');
          },
          error: () => Swal.fire('Error', 'No se pudo restaurar la ciudad.', 'error')
        });
      }
    });
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