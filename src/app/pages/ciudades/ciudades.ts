import { Component, OnInit, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CiudadService, Ciudad } from '../../services/ciudad';
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

    if (this.ciudadActual.id) {
      this.ciudadService.actualizarCiudad(this.ciudadActual.id, this.ciudadActual).subscribe({
        next: () => { this.cargarCiudades(); this.cerrarModal(); },
        error: (err) => console.error('Error al actualizar:', err)
      });
    } else {
      this.ciudadService.crearCiudad(this.ciudadActual).subscribe({
        next: () => { this.cargarCiudades(); this.cerrarModal(); },
        error: (err) => console.error('Error al crear:', err)
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