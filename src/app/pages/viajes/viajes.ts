import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViajeService } from '../../services/viaje';
import { ActivatedRoute } from '@angular/router';
import Swal from 'sweetalert2';
@Component({
  selector: 'app-viajes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './viajes.html',
  styleUrls: ['./viajes.css']
})
export class ViajesComponent implements OnInit {
  viajes: any[] = [];
  estados: any[] = [];
  asignacionesActivas: any[] = [];
  asignacionesDisponibles: any[] = []; // Vehículos que NO están en ruta
  rutas: any[] = [];
  reservasPendientes: any[] = [];

// Código del viaje que se está rastreando en vivo

  esEdicion = false;
  mostrarModalViaje = false;
  mostrarModalViaticos = false;
  mostrarModalDetalles = false;
  viajeSeleccionado: any = null;

  nuevoViaje: any = { 
    codigo_viaje: '', 
    ruta: '', 
    asignacion: '', 
    estado_viaje: '', 
    fecha_salida: '', 
    fecha_llegada_estimada: '',
    reservas_seleccionadas: [] 
  };
  nuevoViatico: any = { descripcion: '', monto_total: null, viaje: '', estado: 'Pendiente' };

  pesoTotalCalculado = 0;
  capacidadCamion = 0;
  rutaNombreSeleccionada = ''; 

  mensajeToast = '';
  tipoToast: 'success' | 'error' = 'success';
  mostrarToast = false;

  constructor(
  private viajeService: ViajeService,
  private route: ActivatedRoute, 
  ) {}

  ngOnInit(): void {
    // 👇 ¡AQUÍ ESTABA EL PRIMER BUG! Faltaba llamar a esta función al iniciar
    this.cargarDatosMaestros(); 
    this.cargarViajes(); 

    // El escuchador inteligente
    this.route.queryParams.subscribe(params => {
      if (params['abrir_modal'] === 'true') {
        setTimeout(() => {
          this.abrirModalViaje(); 
          if (params['fecha_nueva']) {
            this.nuevoViaje.fecha_salida = params['fecha_nueva'];
            console.log('🚛 Programando viaje para:', params['fecha_nueva']);
          }
        }, 400);
      }
    });
  }
  mostrarMensaje(mensaje: string, tipo: 'success' | 'error' = 'success') {
    this.mensajeToast = mensaje;
    this.tipoToast = tipo;
    this.mostrarToast = true;
    setTimeout(() => this.mostrarToast = false, 3500);
  }

  cargarDatosMaestros() {
      this.viajeService.obtenerEstadosViaje().subscribe(res => this.estados = res);
      this.viajeService.obtenerRutas().subscribe(res => this.rutas = res);
      
      this.viajeService.obtenerReservasPendientes().subscribe(res => {
        // 👈 Filtramos: Solo entran las que digan "Pendiente" Y que no tengan viaje
        this.reservasPendientes = res.filter((r: any) => 
          r.estado_nombre === 'Pendiente' && r.viaje_asignado === null
        );
      });

      this.viajeService.obtenerAsignacionesActivas().subscribe(res => {
        this.asignacionesActivas = res;
        this.filtrarEquiposDisponibles();
      });
      
      
    }

  cargarViajes() {
    this.viajeService.obtenerViajes().subscribe(res => {
      this.viajes = res;
      this.filtrarEquiposDisponibles(); // Volvemos a filtrar por si un viaje terminó
    });
  }

  // --- INTELIGENCIA DE NEGOCIO ---

  filtrarEquiposDisponibles() {
    if (!this.asignacionesActivas.length || !this.viajes) return;

    const estadosOcupados = ['Programado', 'En Espera', 'En Curso'];

    this.asignacionesDisponibles = this.asignacionesActivas.filter(asig => {
      const estaOcupado = this.viajes.some(v => 
        v.asignacion === asig.id && estadosOcupados.includes(v.estado_nombre)
      );
      return !estaOcupado; 
    });
  }

alSeleccionarVehiculo() {
    const asig = this.asignacionesDisponibles.find(a => a.id == this.nuevoViaje.asignacion);
    
    if (asig) {
      // 👈 Usamos el nombre exacto que le pusimos en el AsignacionSerializer de Django
      this.capacidadCamion = parseFloat(asig.vehiculo_capacidad || 0); 
    } else {
      this.capacidadCamion = 0;
    }
  }

  toggleReserva(reserva: any, event: any) {
    const peso = parseFloat(reserva.peso_estimado_kg || 0);
    const codigo = reserva.codigo_reserva;

    if (event.target.checked) {
      this.nuevoViaje.reservas_seleccionadas.push(codigo);
      this.pesoTotalCalculado += peso;

      if (this.nuevoViaje.reservas_seleccionadas.length === 1) {
        this.nuevoViaje.ruta = reserva.ruta_macro;
        this.actualizarNombreRuta(reserva.ruta_macro);
        
        if (reserva.fecha_tentativa_viaje) {
          this.nuevoViaje.fecha_salida = reserva.fecha_tentativa_viaje + "T08:00"; 
          this.calcularLlegadaAutomatica(reserva.tiempo_estimado_horas);
        }
      }
    } else {
      this.nuevoViaje.reservas_seleccionadas = this.nuevoViaje.reservas_seleccionadas.filter((c:any) => c !== codigo);
      this.pesoTotalCalculado -= peso;
      if (this.nuevoViaje.reservas_seleccionadas.length === 0) {
        this.nuevoViaje.ruta = '';
        this.rutaNombreSeleccionada = '';
      }
    }
  }

  actualizarNombreRuta(idRuta: any) {
    const rutaObj = this.rutas.find(r => r.id == idRuta);
    if (rutaObj) {
      this.rutaNombreSeleccionada = `${rutaObj.origen} ➡️ ${rutaObj.destino}`;
    }
  }

  calcularLlegadaAutomatica(horasViaje: any) {
    if (!this.nuevoViaje.fecha_salida || !horasViaje) return;
    const fechaSalida = new Date(this.nuevoViaje.fecha_salida);
    const fechaLlegada = new Date(fechaSalida.getTime() + (parseFloat(horasViaje) * 60 * 60 * 1000));
    this.nuevoViaje.fecha_llegada_estimada = fechaLlegada.toISOString().slice(0, 16);
  }

  // --- CRUD VIAJES ---

  abrirModalViaje() {
    this.esEdicion = false; 
    this.nuevoViaje = { codigo_viaje: `VIA-${Math.floor(Math.random() * 10000)}`, ruta: '', asignacion: '', estado_viaje: '', fecha_salida: '', fecha_llegada_estimada: '', reservas_seleccionadas: [] };
    this.pesoTotalCalculado = 0;
    this.capacidadCamion = 0;
    this.rutaNombreSeleccionada = '';
    this.mostrarModalViaje = true;
  }

  abrirModalEditar(viaje: any) {
    this.esEdicion = true;
    this.nuevoViaje = {
      codigo_viaje: viaje.codigo_viaje,
      ruta: viaje.ruta,
      asignacion: viaje.asignacion,
      estado_viaje: viaje.estado_viaje,
      fecha_salida: viaje.fecha_salida ? new Date(viaje.fecha_salida).toISOString().slice(0, 16) : '',
      fecha_llegada_estimada: viaje.fecha_llegada_estimada ? new Date(viaje.fecha_llegada_estimada).toISOString().slice(0, 16) : '',
      reservas_seleccionadas: [] 
    };
    this.mostrarModalViaje = true;
  }

  guardarViaje() {
    if (!this.nuevoViaje.asignacion || !this.nuevoViaje.estado_viaje) {
      this.mostrarMensaje('Falta información obligatoria.', 'error'); return;
    }

    if (this.esEdicion) {
      this.viajeService.actualizarViaje(this.nuevoViaje.codigo_viaje, this.nuevoViaje).subscribe({
        next: () => {
          this.mostrarMensaje('Viaje actualizado correctamente.', 'success');
          this.mostrarModalViaje = false;
          this.cargarViajes();
        },
        error: () => this.mostrarMensaje('Error al actualizar.', 'error')
      });
    } else {
      this.viajeService.crearViaje(this.nuevoViaje).subscribe({
        next: () => {
          this.mostrarMensaje('Viaje despachado.', 'success');
          this.mostrarModalViaje = false;
          this.cargarViajes();
          this.cargarDatosMaestros(); 
        },
        error: () => this.mostrarMensaje('Error al crear el viaje.', 'error')
      });
    }
  }

  eliminarViaje(viaje: any) {
    Swal.fire({
      title: '¿Eliminar Viaje?',
      text: `¿Estás seguro de que deseas cancelar y eliminar el viaje ${viaje.codigo_viaje}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.viajeService.eliminarViaje(viaje.codigo_viaje).subscribe({
          next: () => {
            this.mostrarMensaje('Viaje eliminado correctamente.', 'success');
            this.cargarViajes();
            this.cargarDatosMaestros();
          },
          error: () => this.mostrarMensaje('No se puede eliminar.', 'error')
        });
      }
    });
  }

  cambiarEstadoViaje(v: any, nuevoEstadoId: any) { 
      // 🔥 EL ARREGLO: Le quitamos el "_id" para que coincida exactamente con el serializador
      const payload = { estado_viaje: Number(nuevoEstadoId) };

      this.viajeService.actualizarEstadoViaje(v.codigo_viaje, payload).subscribe({
        next: () => {
          this.mostrarMensaje('¡Estado del viaje y recursos sincronizados! 🔄', 'success');
          this.cargarViajes();
          this.cargarDatosMaestros(); 
        },
        error: (err) => {
          console.error("Error al sincronizar:", err);
          this.mostrarMensaje('Error al sincronizar el estado.', 'error');
        }
      }); 
    }

  // --- DETALLES Y MAPA ---

  abrirDetalles(v: any) {
    this.viajeSeleccionado = v;
    this.mostrarModalDetalles = true;
    
    if (this.viajeSeleccionado.reservas_detalle?.length > 0) {
      this.dibujarRutaDetalle(); 
    }
  }

  dibujarRutaDetalle() {
    if (!this.viajeSeleccionado || !this.viajeSeleccionado.reservas_detalle.length) return;

    const g = (window as any).google.maps;
    const directionsService = new g.DirectionsService();
    const directionsRenderer = new g.DirectionsRenderer({
      polylineOptions: { strokeColor: '#2563eb', strokeWeight: 5 }
    });

    const primeraReserva = this.viajeSeleccionado.reservas_detalle[0];
    
    const request = {
      origin: { lat: primeraReserva.latitud_origen, lng: primeraReserva.longitud_origen },
      destination: { lat: primeraReserva.latitud_destino, lng: primeraReserva.longitud_destino },
      travelMode: g.TravelMode.DRIVING
    };

    setTimeout(() => {
      const mapaElement = document.getElementById('mapa-detalle');
      if (mapaElement) {
        const mapa = new g.Map(mapaElement, { zoom: 12, center: request.origin });
        directionsRenderer.setMap(mapa);
        directionsService.route(request, (result: any, status: any) => {
          if (status === 'OK') directionsRenderer.setDirections(result);
        });
      }
    }, 200);
  }

  // --- CRUD VIÁTICOS ---

  abrirViaticos(v:any) { 
    this.viajeSeleccionado = v; 
    this.nuevoViatico = {descripcion: '', monto_total: null, viaje: v.codigo_viaje, estado: 'Pendiente'}; 
    this.mostrarModalViaticos = true; 
  }

  guardarViatico() {
    if (!this.nuevoViatico.descripcion || !this.nuevoViatico.monto_total) {
      this.mostrarMensaje('Ingresa una descripción y un monto.', 'error');
      return;
    }
    this.viajeService.crearViatico(this.nuevoViatico).subscribe({
      next: () => {
        this.mostrarMensaje('Viático guardado.', 'success');
        this.mostrarModalViaticos = false;
        this.cargarViajes(); 
      },
      error: () => this.mostrarMensaje('Error al guardar viático.', 'error')
    });
  }

  pagarViatico(viaticoId: number) {
    this.viajeService.pagarViatico(viaticoId, { estado: 'Pagado' }).subscribe({
      next: () => {
        this.mostrarMensaje('Viático marcado como pagado.', 'success');
        this.mostrarModalViaticos = false;
        this.cargarViajes();
      },
      error: () => this.mostrarMensaje('Error al pagar viático.', 'error')
    });
  }

  // Usamos un 'getter' para que el HTML lea el dato directamente del servicio (que nunca se apaga)
  get viajeEnRastreo() {
    return this.viajeService.viajeEnRastreoActual;
  }

  toggleRastreo(viaje: any) {
    if (this.viajeEnRastreo === viaje.codigo_viaje) {
      this.viajeService.detenerRastreoGlobal();
      this.mostrarMensaje(`🛑 Transmisión detenida.`, 'success');
    } else {
      if (this.viajeEnRastreo) {
        this.viajeService.detenerRastreoGlobal(); // Apaga el anterior si había uno
      }
      
      this.mostrarMensaje(`📡 Conectando satélites para ${viaje.codigo_viaje}...`, 'success');
      
      // Llamamos al servicio global para que se encargue de todo en segundo plano
      this.viajeService.iniciarRastreoGlobal(
        viaje.codigo_viaje,
        (payload: any) => {
          console.log(`📍 Punto GPS enviado: ${payload.latitud_actual}, ${payload.longitud_actual}`);
        },
        (errorMsg: string) => {
          this.mostrarMensaje(`Error GPS: ${errorMsg}`, 'error');
        }
      );
    }
  }
}