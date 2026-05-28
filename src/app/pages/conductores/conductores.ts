import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConductorService, Conductor, CategoriaLicencia } from '../../services/conductor';
import { UsuarioService, Usuario } from '../../services/usuario';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

import { QueryBuilderComponent, ColumnaFiltrable, ReglaFiltro, evaluarFiltrosDinámicos } from '../../shared/query-builder/query-builder';

@Component({
  selector: 'app-conductores',
  standalone: true,
  imports: [CommonModule, FormsModule, QueryBuilderComponent],
  templateUrl: './conductores.html',
  styleUrls: ['./conductores.css'] 
})
export class ConductoresComponent implements OnInit {
  conductores: Conductor[] = [];
  usuarios: Usuario[] = [];
  categorias: CategoriaLicencia[] = [];
  
  cargando = true;
  mostrarModal = false;
  modoModal: 'crear' | 'editar' | 'ver' = 'crear';
  
  fechaHoy: string = new Date().toISOString().split('T')[0];
  fechaMenos18Anios: string = new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split('T')[0];
  usuariosDisponibles: Usuario[] = [];
  conductorActual: Conductor | any = {}; 
  baseMediaUrl = 'http://localhost:8000';
  
  kpiConductores: any = null;
  filtroDisponibilidad: string = '';

  constructor(
    private conductorService: ConductorService,
    private usuarioService: UsuarioService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    this.cargarDatosIniciales();
  }

  cargarDatosIniciales(): void {
    this.cargando = true;
    this.conductorService.obtenerCategorias().subscribe(c => this.categorias = c);
    
    this.usuarioService.obtenerUsuarios().subscribe({
      next: (dataUsuarios) => {
        this.usuarios = dataUsuarios;
        this.cargarConductores();
      },
      error: (err) => {
        console.error('Error al cargar usuarios:', err);
        Swal.fire('Error de Carga', 'No se pudieron cargar los usuarios disponibles.', 'error');
        this.cargando = false;
      }
    });
  }

  cargarConductores(): void {
    this.conductorService.obtenerConductores().subscribe({
      next: (dataConductores) => { 
        this.conductores = dataConductores; 
        this.cargarUsuariosFiltrados(); 
        this.cargando = false; 
      },
      error: (err) => { 
        console.error('Error al cargar conductores:', err); 
        Swal.fire('Error de Carga', 'No se pudieron cargar los datos de los conductores.', 'error');
        this.cargando = false; 
      }
    });
  }

  cargarUsuariosFiltrados(): void {
    this.usuariosDisponibles = this.usuarios.filter(user => {
      const tieneRolCorrecto = user.rol_detalles?.nombre_rol === 'Conductor';
      const yaTienePerfil = this.conductores.some(conductor => conductor.usuario === user.id);
      return tieneRolCorrecto && !yaTienePerfil;
    });
  }
  // --- QUERY BUILDER CONFIG ---
  columnasFiltro: ColumnaFiltrable[] = [
    { campo: 'usuario_detalles.nombre', nombre: 'Nombre', tipo: 'texto' },
    { campo: 'usuario_detalles.apellido_paterno', nombre: 'Apellido Paterno', tipo: 'texto' },
    { campo: 'usuario_detalles.ci', nombre: 'Carnet de Identidad', tipo: 'texto' },
    { campo: 'nro_licencia', nombre: 'Nro. Licencia', tipo: 'texto' },
    { campo: 'categoria_detalles.nombre', nombre: 'Categoría', tipo: 'texto' },
    { campo: 'vencimiento_licencia', nombre: 'Venc. Licencia', tipo: 'fecha' },
    { campo: 'disponible', nombre: 'Está Disponible', tipo: 'booleano' },
    { campo: 'grupo_sanguineo', nombre: 'Grupo Sanguíneo', tipo: 'texto' }
  ];
  
  reglasActivas: ReglaFiltro[] = [];

  aplicarFiltros(reglas: ReglaFiltro[]) {
    this.reglasActivas = reglas;
  }

  get filtrados(): Conductor[] {
    return this.conductores.filter(c => evaluarFiltrosDinámicos(c, this.reglasActivas));
  }

  // --- MÉTODOS DEL MODAL PRINCIPAL ---
  abrirModalCrear(): void {
    this.modoModal = 'crear';
    this.conductorActual = { 
      usuario: null, 
      nro_licencia: '', 
      categoria_licencia: null, 
      fecha_emision_licencia: '', 
      vencimiento_licencia: '',
      fecha_nacimiento: '', 
      direccion: '', 
      grupo_sanguineo: '',
      contacto_emergencia_nombre: '', 
      contacto_emergencia_telefono: '',
      disponible: true // Campo necesario para Django
    };
    this.mostrarModal = true;
  }

  editarConductor(conductor: Conductor): void {
    this.modoModal = 'editar';
    this.conductorActual = { ...conductor };
    this.mostrarModal = true;
  }

  verConductor(conductor: Conductor): void {
    this.modoModal = 'ver';
    this.conductorActual = { ...conductor };
    this.mostrarModal = true;
  }

  cerrarModal(): void { 
    this.mostrarModal = false; 
  }

  calcularEdad(fechaNacimiento: string): number {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const nacimiento = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mes = hoy.getMonth() - nacimiento.getMonth();
    
    if (mes < 0 || (mes === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad--;
    }
    return edad;
  }

  // --- LÓGICA DE GUARDADO MEJORADA (Con validación y sanitización) ---
guardarConductor(form: any): void {
    if (form.invalid) {
      Swal.fire('Formulario Incompleto', 'Por favor, llena todos los campos obligatorios marcados con asterisco (*).', 'warning');
      Object.keys(form.controls).forEach(key => form.controls[key].markAsTouched());
      return; 
    }

    const categoriaSeleccionada = this.categorias.find(c => c.id === Number(this.conductorActual.categoria_licencia));
    
    if (categoriaSeleccionada && categoriaSeleccionada.edad_minima) {
      const edadConductor = this.calcularEdad(this.conductorActual.fecha_nacimiento);
      
      // 👇 NUEVA VALIDACIÓN: Bloquea a los "viajeros del tiempo"
      if (edadConductor < 0) {
        Swal.fire('Fecha de Nacimiento Inválida', 'La fecha seleccionada está en el futuro. Verifica el año de nacimiento.', 'error');
        return; // Detenemos todo aquí
      }
      
      if (edadConductor < categoriaSeleccionada.edad_minima) {
        Swal.fire({
          title: '⚠️ Alerta de Normativa',
          html: `La ${categoriaSeleccionada.nombre} exige una edad mínima de ${categoriaSeleccionada.edad_minima} años.<br><br>El conductor seleccionado tiene <strong>${edadConductor} años.</strong><br><br>¿Desea asignar esta licencia bajo su responsabilidad administrativa?`,
          icon: 'warning',
          showCancelButton: true,
          confirmButtonColor: '#eab308',
          cancelButtonColor: '#64748b',
          confirmButtonText: 'Sí, Asignar',
          cancelButtonText: 'Cancelar'
        }).then((result) => {
          if (result.isConfirmed) {
            this.ejecutarGuardado();
          }
        });
        return; 
      }
    }
    
    this.ejecutarGuardado();
  }

  // Sanitiza los datos y los envía a Django
  private ejecutarGuardado(): void {
    const payload: any = { ...this.conductorActual };

    // Limpiamos campos relacionales que vienen del GET
    delete payload.usuario_nombre;
    delete payload.categoria_nombre;
    delete payload.fecha_eliminacion;
    delete payload.eliminado_por_nombre;

    // TRUCO DE SANITIZACIÓN: Django rechaza strings vacíos en opciones fijas
    if (payload.grupo_sanguineo === '') payload.grupo_sanguineo = null;
    if (payload.usuario) payload.usuario = Number(payload.usuario);
    if (payload.categoria_licencia) payload.categoria_licencia = Number(payload.categoria_licencia);

    if (this.modoModal === 'editar' && payload.id) {
      this.conductorService.actualizarConductor(payload.id, payload).subscribe({
        next: () => { 
          this.cargarDatosIniciales(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Perfil de conductor actualizado correctamente.', 'success');
        },
        error: (err) => this.mostrarErrorBackend(err)
      });
    } else {
      this.conductorService.crearConductor(payload).subscribe({
        next: () => { 
          this.cargarDatosIniciales(); 
          this.cerrarModal(); 
          Swal.fire('¡Éxito!', 'Nuevo conductor registrado correctamente.', 'success');
        },
        error: (err) => this.mostrarErrorBackend(err)
      });
    }
  }

  // Procesa los errores exactos que devuelve Django
  private mostrarErrorBackend(err: any): void {
    console.error('Error Django en Conductor:', err?.error);
    let msg = 'Verifica los datos proporcionados.';
    
    if (err.error && typeof err.error === 'object') {
      const errores = Object.values(err.error).flat();
      if (errores.length > 0) {
        msg = errores.join('<br>');
      }
      msg += '<br><br><small>' + JSON.stringify(err.error) + '</small>';
    }
    
    Swal.fire('Error del Servidor', msg, 'error');
  }

  eliminarConductor(id: number | undefined): void {
    if (id) {
      Swal.fire({
        title: '¿Eliminar Perfil?',
        text: '¿Estás seguro de eliminar este perfil de conductor? (El usuario base seguirá existiendo en el sistema).',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, Eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.conductorService.eliminarConductor(id).subscribe({
            next: () => {
              this.conductores = this.conductores.filter(c => c.id !== id);
              this.cargarUsuariosFiltrados();
              Swal.fire('Eliminado', 'El perfil ha sido removido exitosamente.', 'success');
            },
            error: (err) => {
              console.error('Error:', err);
              Swal.fire('Error', 'No se pudo eliminar el perfil.', 'error');
            }
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