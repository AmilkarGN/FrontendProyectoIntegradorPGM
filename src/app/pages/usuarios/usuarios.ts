import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuarioService, Usuario } from '../../services/usuario';
import { RolService, Rol } from '../../services/rol';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.html',
  styleUrls: ['./usuarios.css']
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  roles: Rol[] = [];
  cargando: boolean = true;
  baseMediaUrl: string = 'http://localhost:8000';
  // Control del modal
  mostrarModal: boolean = false;
  modoModal: 'crear' | 'editar' | 'ver' = 'crear'; // <-- Nuevo control de estados

  usuarioActual: Usuario = {
    username: '', nombre: '', apellido_paterno: '', apellido_materno: '', 
    email: '', ci: '', celular: '', rol_id: undefined, is_active: true
  };

  archivoFoto: File | null = null; // <-- Aquí guardaremos la imagen seleccionada

  constructor(private usuarioService: UsuarioService, private rolService: RolService) {}

  obtenerImagenUrl(url: string | undefined): string {
    if (!url) return 'assets/images/icono.png';
    
    // Si la URL ya es completa (empieza con http), la devolvemos tal cual
    if (url.startsWith('http')) return url;
    
    // Si es una ruta relativa, le pegamos la dirección del servidor de Django
    return `${this.baseMediaUrl}${url}`;
  }

  ngOnInit(): void {
    this.cargarUsuarios();
    this.cargarRoles();
  }

  cargarUsuarios(): void {
    this.cargando = true;
    this.usuarioService.obtenerUsuarios().subscribe({
      next: (data) => { this.usuarios = data; this.cargando = false; },
      error: (err) => { console.error('Error:', err); this.cargando = false; }
    });
  }

  cargarRoles(): void {
    this.rolService.obtenerRoles().subscribe(data => this.roles = data);
  }

  // --- CONTROL DEL MODAL ---
  abrirModalCrear(): void {
    this.usuarioActual = { username: '', nombre: '', apellido_paterno: '', apellido_materno: '', email: '', ci: '', celular: '', rol_id: undefined, is_active: true, password: '' };
    this.archivoFoto = null;
    this.modoModal = 'crear';
    this.mostrarModal = true;
  }

  editarUsuario(usuario: Usuario): void {
    this.usuarioActual = { ...usuario, rol_id: usuario.rol_detalles?.id, password: '' };
    this.archivoFoto = null;
    this.modoModal = 'editar';
    this.mostrarModal = true;
  }

  verUsuario(usuario: Usuario): void {
    this.usuarioActual = { ...usuario, rol_id: usuario.rol_detalles?.id };
    this.modoModal = 'ver';
    this.mostrarModal = true;
  }

  cerrarModal(): void {
    this.mostrarModal = false;
  }

  // --- MANEJO DE IMAGEN ---
  onFileSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      this.archivoFoto = file;
    }
  }

  // --- GUARDAR (Limpio y con FormData) ---
  guardarUsuario(): void {
    if (!this.usuarioActual.id && !this.usuarioActual.password) {
      Swal.fire('Atención', 'La contraseña es obligatoria para nuevos usuarios.', 'warning'); return;
    }
    if (!this.usuarioActual.rol_id) {
      Swal.fire('Atención', 'Debes asignar un Rol.', 'warning'); return;
    }

    const formData = new FormData();
    formData.append('username', this.usuarioActual.username);
    formData.append('email', this.usuarioActual.email);
    formData.append('nombre', this.usuarioActual.nombre);
    formData.append('apellido_paterno', this.usuarioActual.apellido_paterno);
    if (this.usuarioActual.apellido_materno) formData.append('apellido_materno', this.usuarioActual.apellido_materno);
    formData.append('ci', this.usuarioActual.ci);
    formData.append('celular', this.usuarioActual.celular);
    formData.append('rol_id', this.usuarioActual.rol_id.toString());
    formData.append('is_active', this.usuarioActual.is_active ? 'true' : 'false');
    
    if (this.usuarioActual.password) {
      formData.append('password', this.usuarioActual.password);
    }
    if (this.archivoFoto) {
      formData.append('foto_perfil', this.archivoFoto, this.archivoFoto.name);
    }

    if (this.modoModal === 'editar' && this.usuarioActual.id) {
      this.usuarioService.actualizarUsuario(this.usuarioActual.id, formData).subscribe({
        next: () => { 
          this.cargarUsuarios(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Usuario actualizado correctamente.', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al actualizar: Verifica los datos.', 'error')
      });
    } else {
      this.usuarioService.crearUsuario(formData).subscribe({
        next: () => { 
          this.cargarUsuarios(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Usuario creado correctamente.', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al crear: El CI o el Username ya están registrados.', 'error')
      });
    }
  }

  eliminarUsuario(id: number | undefined): void {
    if (id) {
      Swal.fire({
        title: '¿Eliminar Usuario?',
        text: 'Esta acción no se puede deshacer.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.usuarioService.eliminarUsuario(id).subscribe({
            next: () => { 
              this.usuarios = this.usuarios.filter(u => u.id !== id); 
              Swal.fire('¡Eliminado!', 'El usuario ha sido eliminado del sistema.', 'success');
            },
            error: (err) => Swal.fire('Error', 'No se pudo eliminar el usuario.', 'error')
          });
        }
      });
    }
  }
}