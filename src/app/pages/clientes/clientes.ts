import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ClienteService, Cliente } from '../../services/cliente';
import { UsuarioService, Usuario } from '../../services/usuario';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

import { QueryBuilderComponent, ColumnaFiltrable, ReglaFiltro, evaluarFiltrosDinámicos } from '../../shared/query-builder/query-builder';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [CommonModule, FormsModule, QueryBuilderComponent],
  templateUrl: './clientes.html',
  styleUrls: ['./clientes.css']
})
export class ClientesComponent implements OnInit {
  clientes: Cliente[] = [];
  usuarios: Usuario[] = [];
  usuariosDisponibles: Usuario[] = [];
  
  cargando = true;
  mostrarModal = false;
  modoModal: 'crear' | 'editar' | 'ver' = 'crear';
  
  clienteActual: Cliente | any = {}; 
  baseMediaUrl = 'http://localhost:8000';
  
  kpiClientes: any = null;

  constructor(
    private clienteService: ClienteService,
    private usuarioService: UsuarioService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  // 1. Cargamos Usuarios PRIMERO, luego Clientes para evitar carreras asíncronas
  cargarDatosIniciales(): void {
    this.cargando = true;
    this.usuarioService.obtenerUsuarios().subscribe({
      next: (dataUsuarios) => {
        this.usuarios = dataUsuarios;
        this.cargarClientes();
      },
      error: (err) => { console.error('Error usuarios:', err); this.cargando = false; }
    });
    
    // Cargar KPIs
    this.http.get('http://localhost:8000/api/estadisticas/clientes/').subscribe(data => {
      this.kpiClientes = data;
    });
  }

  cargarClientes(): void {
    this.clienteService.obtenerClientes().subscribe({
      next: (dataClientes) => { 
        this.clientes = dataClientes; 
        this.cargarUsuariosFiltrados(); 
        this.cargando = false; 
      },
      error: (err) => { console.error('Error clientes:', err); this.cargando = false; }
    });
  }

  // 2. Filtramos: Solo rol 'Cliente' y que no estén en la tabla clientes
  cargarUsuariosFiltrados(): void {
    this.usuariosDisponibles = this.usuarios.filter(user => {
      const tieneRolCorrecto = user.rol_detalles?.nombre_rol === 'Cliente';
      const yaTienePerfil = this.clientes.some(cliente => cliente.usuario === user.id);
      return tieneRolCorrecto && !yaTienePerfil;
    });
  }

  // --- QUERY BUILDER CONFIG ---
  columnasFiltro: ColumnaFiltrable[] = [
    { campo: 'razon_social', nombre: 'Razón Social', tipo: 'texto' },
    { campo: 'nit', nombre: 'NIT / Documento', tipo: 'texto' },
    { campo: 'tipo_cliente', nombre: 'Tipo Cliente', tipo: 'texto' },
    { campo: 'usuario_detalles.nombre', nombre: 'Nombre de Usuario Físico', tipo: 'texto' },
    { campo: 'contacto_principal', nombre: 'Contacto', tipo: 'texto' },
    { campo: 'telefono_principal', nombre: 'Teléfono', tipo: 'texto' }
  ];
  
  reglasActivas: ReglaFiltro[] = [];

  aplicarFiltros(reglas: ReglaFiltro[]) {
    this.reglasActivas = reglas;
  }

  get filtrados(): Cliente[] {
    return this.clientes.filter(c => evaluarFiltrosDinámicos(c, this.reglasActivas));
  }

  abrirModalCrear(): void {
    this.modoModal = 'crear';
    this.clienteActual = { 
      usuario: null, tipo_cliente: 'Empresa', razon_social: '', nit: '', 
      direccion_fiscal: '', contacto_principal: '', telefono_principal: '' 
    };
    this.mostrarModal = true;
  }
  editarCliente(cliente: Cliente): void {
    this.modoModal = 'editar';
    this.clienteActual = { ...cliente };
    this.mostrarModal = true;
  }

  verCliente(cliente: Cliente): void {
    this.modoModal = 'ver';
    this.clienteActual = { ...cliente };
    this.mostrarModal = true;
  }

  cerrarModal(): void { 
    this.mostrarModal = false; 
  }

  guardarCliente(): void {
    if (this.modoModal === 'editar' && this.clienteActual.id) {
      this.clienteService.actualizarCliente(this.clienteActual.id, this.clienteActual).subscribe({
        next: () => { 
          this.cargarDatosIniciales(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Cliente actualizado correctamente', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al actualizar el cliente.', 'error')
      });
    } else {
      this.clienteService.crearCliente(this.clienteActual).subscribe({
        next: () => { 
          this.cargarDatosIniciales(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Cliente creado correctamente', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al guardar. Verifica que el usuario no sea ya un cliente.', 'error')
      });
    }
  }

  eliminarCliente(id: number | undefined): void {
    if (id) {
      Swal.fire({
        title: '¿Eliminar Cliente?',
        text: 'El usuario base seguirá existiendo en el sistema.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.clienteService.eliminarCliente(id).subscribe({
            next: () => {
              this.clientes = this.clientes.filter(c => c.id !== id);
              this.cargarUsuariosFiltrados(); 
              Swal.fire('¡Eliminado!', 'El perfil de cliente fue removido.', 'success');
            },
            error: (err) => Swal.fire('Error', 'No se puede eliminar porque este cliente ya tiene rutas asignadas.', 'error')
          });
        }
      });
    }
  }

  obtenerImagenUrl(url: string | undefined): string {
    if (!url) return 'assets/images/icono.png';
    return url.startsWith('http') ? url : `${this.baseMediaUrl}${url}`;
  }
}