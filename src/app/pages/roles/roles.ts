import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RolService, Rol } from '../../services/rol';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './roles.html',
  styleUrls: ['./roles.css']
})
export class RolesComponent implements OnInit {
  roles: Rol[] = [];
  cargando: boolean = true;
  mostrarFormulario: boolean = false;
  
  // Roles que la interfaz no dejará borrar
  rolesProtegidos: string[] = ['Administrador', 'Gerente', 'Operador', 'Conductor', 'Cliente'];

  rolActual: Rol = {
    id: 0,
    nombre_rol: '',
    descripcion: ''
  };

  constructor(private rolService: RolService) {}

  ngOnInit(): void {
    this.cargarRoles();
  }

  cargarRoles(): void {
    this.cargando = true;
    this.rolService.obtenerRoles().subscribe({
      next: (data) => { this.roles = data; this.cargando = false; },
      error: (error) => { console.error('Error al obtener roles:', error); this.cargando = false; }
    });
  }

  terminoBusqueda: string = '';

  get filtrados(): Rol[] {
    if (!this.terminoBusqueda) return this.roles;
    const term = this.terminoBusqueda.toLowerCase();
    return this.roles.filter(r => {
      const searchStr = `${r.nombre_rol} ${r.descripcion}`.toLowerCase();
      return searchStr.includes(term);
    });
  }

  abrirModal(): void {
    this.rolActual = { id: 0, nombre_rol: '', descripcion: '' };
    this.mostrarFormulario = true;
  }

  cerrarModal(): void {
    this.mostrarFormulario = false;
  }

  editarRol(rol: Rol): void {
    this.rolActual = { ...rol };
    this.mostrarFormulario = true;
  }

  guardarRol(): void {
    if (this.rolActual.id && this.rolActual.id > 0) {
      this.rolService.actualizarRol(this.rolActual.id, this.rolActual).subscribe({
        next: () => { 
          this.cargarRoles(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Rol actualizado correctamente', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al actualizar el rol.', 'error')
      });
    } else {
      this.rolService.crearRol(this.rolActual).subscribe({
        next: () => { 
          this.cargarRoles(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Rol creado correctamente', 'success');
        },
        error: (err) => Swal.fire('Error', 'Hubo un error. Verifica que el nombre del rol no exista ya.', 'error')
      });
    }
  }

  eliminarRol(rol: Rol): void {
    if (this.rolesProtegidos.includes(rol.nombre_rol)) {
      Swal.fire('Protegido', `El rol ${rol.nombre_rol} está protegido y no se puede borrar.`, 'info');
      return;
    }

    if (rol.id) {
      Swal.fire({
        title: `¿Eliminar Rol?`,
        text: `¿Estás seguro de eliminar el rol "${rol.nombre_rol}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.rolService.eliminarRol(rol.id!).subscribe({
            next: () => { 
              this.roles = this.roles.filter(r => r.id !== rol.id); 
              Swal.fire('¡Eliminado!', 'El rol ha sido eliminado.', 'success');
            },
            error: (err) => Swal.fire('Error', 'No se pudo eliminar. Es posible que haya personal usando este rol en el sistema.', 'error')
          });
        }
      });
    }
  }

  // --- AQUÍ ESTÁ LA FUNCIÓN QUE FALTABA ---
  // Está justo antes de cerrar la clase, al mismo nivel que las otras funciones.
  esProtegido(nombre_rol: string): boolean {
    return this.rolesProtegidos.includes(nombre_rol);
  }

} // <-- Y aquí cierra el componente