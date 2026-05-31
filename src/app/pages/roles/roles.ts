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
  rolesProtegidos: string[] = ['Administrador', 'Operador', 'Conductor', 'Cliente'];

  rolActual: Rol = {
    id: 0,
    nombre_rol: '',
    descripcion: '',
    permisos: []
  };

  modulosPermisos = [
    {
      nombre: 'Comando Logístico (Admins)',
      permisos: [
        { id: 'admin_ver_dashboard', nombre: 'Ver Panel de Control Global' },
        { id: 'admin_ver_mapa_vivo', nombre: 'Monitoreo de Flota en Vivo' },
        { id: 'admin_ver_calendario', nombre: 'Gestión de Calendario Logístico' }
      ]
    },
    {
      nombre: 'Portal de Clientes',
      permisos: [
        { id: 'cliente_ver_dashboard', nombre: 'Panel Resumen de Cliente (KPIs)' },
        { id: 'cliente_gestionar_reservas', nombre: 'Crear y Gestionar Mis Reservas' },
        { id: 'cliente_seguimiento_vivo', nombre: 'Seguimiento de Envíos (Línea de Tiempo y ETA)' },
        { id: 'cliente_historial_documentos', nombre: 'Historial y Descarga de Comprobantes (POD)' }
      ]
    },
    {
      nombre: 'Portal de Conductores',
      permisos: [
        { id: 'conductor_ver_viaje_activo', nombre: 'Panel de Viaje Asignado Actual' },
        { id: 'conductor_actualizar_estado', nombre: 'Actualizar Checkpoints de Ruta' },
        { id: 'conductor_reportar_incidencia', nombre: 'Botón de Novedades (S.O.S/Retrasos)' },
        { id: 'conductor_subir_pod', nombre: 'Subir Foto de Prueba de Entrega (POD)' },
        { id: 'conductor_ver_vehiculo', nombre: 'Ficha Técnica de Vehículo Asignado' }
      ]
    },
    {
      nombre: 'Operaciones (Central)',
      permisos: [
        { id: 'gestionar_todas_reservas', nombre: 'Aprobar/Administrar Todas las Reservas' },
        { id: 'gestionar_todos_viajes', nombre: 'Asignar y Administrar Todos los Viajes' },
        { id: 'ver_rutas', nombre: 'Configuración de Rutas y Tramos' },
        { id: 'ver_ciudades', nombre: 'Gestión de Ciudades y Zonas' }
      ]
    },
    {
      nombre: 'Flota y Personal',
      permisos: [
        { id: 'gestionar_vehiculos', nombre: 'Mantenimiento y Control de Vehículos' },
        { id: 'gestionar_conductores', nombre: 'Expedientes de Conductores' },
        { id: 'gestionar_asignaciones', nombre: 'Emparejar Conductores y Vehículos' },
        { id: 'configurar_flota', nombre: 'Ajustes de Modelos y Tipos de Flota' },
        { id: 'gestionar_alertas', nombre: 'Monitor de Fatiga con IA' }
      ]
    },
    {
      nombre: 'Administración del Sistema',
      permisos: [
        { id: 'gestionar_clientes', nombre: 'Cartera de Clientes' },
        { id: 'gestionar_usuarios', nombre: 'Seguridad, Usuarios y Roles' }
      ]
    }
  ];

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
    this.rolActual = { id: 0, nombre_rol: '', descripcion: '', permisos: [] };
    this.mostrarFormulario = true;
  }

  cerrarModal(): void {
    this.mostrarFormulario = false;
  }

  editarRol(rol: Rol): void {
    this.rolActual = { ...rol, permisos: rol.permisos ? [...rol.permisos] : [] };
    this.mostrarFormulario = true;
  }

  togglePermiso(idPermiso: string): void {
    if (!this.rolActual.permisos) this.rolActual.permisos = [];
    
    const index = this.rolActual.permisos.indexOf(idPermiso);
    if (index > -1) {
      this.rolActual.permisos.splice(index, 1);
    } else {
      this.rolActual.permisos.push(idPermiso);
    }
  }

  tienePermiso(idPermiso: string): boolean {
    return this.rolActual.permisos?.includes(idPermiso) || false;
  }

  toggleAll(grupo: any): void {
    if (!this.rolActual.permisos) this.rolActual.permisos = [];
    
    const todosSeleccionados = grupo.permisos.every((p: any) => this.tienePermiso(p.id));
    
    if (todosSeleccionados) {
      // Remover todos los de este grupo
      grupo.permisos.forEach((p: any) => {
        const idx = this.rolActual.permisos!.indexOf(p.id);
        if (idx > -1) this.rolActual.permisos!.splice(idx, 1);
      });
    } else {
      // Añadir los que falten
      grupo.permisos.forEach((p: any) => {
        if (!this.rolActual.permisos!.includes(p.id)) {
          this.rolActual.permisos!.push(p.id);
        }
      });
    }
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