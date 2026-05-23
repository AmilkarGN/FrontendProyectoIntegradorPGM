import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConductorService, CategoriaLicencia } from '../../services/conductor';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-categorias-licencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categorias-licencia.html',
  styleUrls: ['./categorias-licencia.css'] // Reutilizamos los estilos
})
export class CategoriasLicenciaComponent implements OnInit {
  categorias: CategoriaLicencia[] = [];
  cargando = true;
  mostrarModal = false;
  
  categoriaActual: CategoriaLicencia = { id: 0, nombre: '', permite_maquinaria_pesada: false };

  constructor(private conductorService: ConductorService) {}

  ngOnInit(): void { this.cargarCategorias(); }

  cargarCategorias(): void {
    this.cargando = true;
    this.conductorService.obtenerCategorias().subscribe({
      next: (data) => { this.categorias = data; this.cargando = false; },
      error: (err) => { console.error('Error:', err); this.cargando = false; }
    });
  }

  abrirModal(categoria?: CategoriaLicencia): void {
    if (categoria) {
      this.categoriaActual = { ...categoria };
    } else {
      this.categoriaActual = { id: 0, nombre: '', permite_maquinaria_pesada: false };
    }
    this.mostrarModal = true;
  }

  cerrarModal(): void { this.mostrarModal = false; }

  guardarCategoria(): void {
    if (this.categoriaActual.id && this.categoriaActual.id > 0) {
      this.conductorService.actualizarCategoria(this.categoriaActual.id, this.categoriaActual).subscribe({
        next: () => { 
          this.cargarCategorias(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Categoría actualizada correctamente', 'success');
        },
        error: () => Swal.fire('Error', 'Error al actualizar la categoría.', 'error')
      });
    } else {
      this.conductorService.crearCategoria(this.categoriaActual).subscribe({
        next: () => { 
          this.cargarCategorias(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Categoría creada correctamente', 'success');
        },
        error: () => Swal.fire('Error', 'Error al crear la categoría.', 'error')
      });
    }
  }

  readonly CATEGORIAS_PROTEGIDAS = ['P', 'A', 'B', 'C', 'M', 'T', 'Provisional'];

  eliminarCategoria(id: number): void {
    const cat = this.categorias.find(c => c.id === id);
    
    if (cat && this.CATEGORIAS_PROTEGIDAS.includes(cat.nombre)) {
      Swal.fire('Seguridad del Sistema', `La categoría '${cat.nombre}' es una categoría base de la normativa nacional y no puede ser eliminada.`, 'error');
      return;
    }

    Swal.fire({
      title: '¿Eliminar Categoría?',
      text: '¿Está seguro de eliminar esta categoría personalizada?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.conductorService.eliminarCategoria(id).subscribe({
          next: () => {
            this.categorias = this.categorias.filter(c => c.id !== id);
            Swal.fire('¡Eliminada!', 'La categoría fue eliminada.', 'success');
          },
          error: () => Swal.fire('Error', 'No se puede eliminar. Hay conductores asignados.', 'error')
        });
      }
    });
  }
}