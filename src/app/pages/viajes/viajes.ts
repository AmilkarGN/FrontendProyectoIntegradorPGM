import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ViajeService } from '../../services/viaje';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ExportService } from '../../services/export.service';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';
import { QueryBuilderComponent, ColumnaFiltrable, ReglaFiltro, evaluarFiltrosDinámicos } from '../../shared/query-builder/query-builder';

@Component({
  selector: 'app-viajes',
  standalone: true,
  imports: [CommonModule, FormsModule, QueryBuilderComponent],
  templateUrl: './viajes.html',
  styleUrls: ['./viajes.css']
})
export class ViajesComponent implements OnInit {
  viajes: any[] = [];
  estados: any[] = [];
  asignacionesActivas: any[] = [];
  asignacionesDisponibles: any[] = []; // Vehículos que NO están en ruta
  vehiculos: any[] = []; // Vehículos para chequear el estado (Taller, etc)
  conductores: any[] = []; // Conductores para chequear estado (Vacaciones, etc)
  rutas: any[] = [];
  reservasPendientes: any[] = [];

// Código del viaje que se está rastreando en vivo

  esEdicion = false;
  mostrarModalViaje: boolean = false;
  mostrarModalDetalles: boolean = false;
  mostrarModalViaticos: boolean = false;
  mostrarGuiaEstados: boolean = false;
  viendoPapelera: boolean = false;

  viajeSeleccionado: any = null;
  rutaOptimizada: any[] | null = null;
  mapaAdmin: any = null;

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
  
  kpiViajes: any = null;
  alertaDestacada: string | null = null;

  constructor(
    private viajeService: ViajeService,
    private route: ActivatedRoute,
    private exportService: ExportService,
    private http: HttpClient,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // El escuchador inteligente para alertas
    this.route.queryParams.subscribe(params => {
      if (params['alerta']) this.alertaDestacada = String(params['alerta']);
    });
    
    // 👇 Inicialización original
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

      this.http.get<any[]>('http://localhost:8000/api/vehiculos/').subscribe(vehs => {
        this.vehiculos = vehs;
        this.http.get<any[]>('http://localhost:8000/api/conductores/').subscribe(conds => {
          this.conductores = conds;
          this.viajeService.obtenerAsignacionesActivas().subscribe(res => {
            this.asignacionesActivas = res;
            this.filtrarEquiposDisponibles();
          });
        });
      });
      
      this.http.get('http://localhost:8000/api/estadisticas/viajes/').subscribe(data => {
        this.kpiViajes = data;
      });
    }

  cargarViajes() {
    this.viajeService.obtenerViajes(this.viendoPapelera).subscribe(res => {
      this.viajes = res;
      this.filtrarEquiposDisponibles(); // Volvemos a filtrar por si un viaje terminó
    });
  }

  alternarPapelera(estado: boolean) {
    this.viendoPapelera = estado;
    this.cargarViajes();
  }

  restaurarViaje(codigo: string): void {
    Swal.fire({
      title: '¿Restaurar Viaje?',
      text: `¿Deseas restaurar este viaje de la papelera?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, restaurar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.viajeService.restaurarViaje(codigo).subscribe({
          next: () => {
            this.cargarViajes();
            Swal.fire('Restaurado', 'El viaje fue devuelto a los registros activos.', 'success');
          },
          error: () => Swal.fire('Error', 'No se pudo restaurar.', 'error')
        });
      }
    });
  }

  // --- QUERY BUILDER CONFIG ---
  columnasFiltro: ColumnaFiltrable[] = [
    { campo: 'codigo_viaje', nombre: 'Código Viaje', tipo: 'texto' },
    { campo: 'vehiculo_placa', nombre: 'Placa Vehículo', tipo: 'texto' },
    { campo: 'conductor_nombre', nombre: 'Conductor', tipo: 'texto' },
    { campo: 'estado_nombre', nombre: 'Estado de Viaje', tipo: 'texto' },
    { campo: 'ruta_nombre', nombre: 'Ruta Asignada', tipo: 'texto' },
    { campo: 'fecha_salida', nombre: 'Fecha Salida', tipo: 'fecha' },
    { campo: 'fecha_llegada_estimada', nombre: 'Fecha Llegada', tipo: 'fecha' },
    { campo: 'costo_total_estimado', nombre: 'Costo Total Estimado', tipo: 'numero' }
  ];
  
  reglasActivas: ReglaFiltro[] = [];

  aplicarFiltros(reglas: ReglaFiltro[]) {
    this.reglasActivas = reglas;
  }

  get filtrados(): any[] {
    return this.viajes.filter(v => evaluarFiltrosDinámicos(v, this.reglasActivas));
  }

  // --- REPORTES ---
  async exportar(tipo: 'pdf' | 'excel'): Promise<void> {
    const { value: nombreArchivo } = await Swal.fire({
      title: `Exportar a ${tipo.toUpperCase()}`,
      input: 'text',
      inputLabel: 'Nombre del archivo',
      inputValue: `Reporte_Viajes_Asignados_${new Date().getTime()}`,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return '¡Necesitas escribir un nombre!';
        return null;
      }
    });

    if (nombreArchivo) {
      const columnas = [
        { header: 'Cod. Viaje', key: 'codigo_viaje' },
        { header: 'Conductor', key: 'conductor_nombre' },
        { header: 'Placa', key: 'vehiculo_placa' },
        { header: 'Estado', key: 'estado_nombre' },
        { header: 'Cargas (Reservas)', key: 'reservas_detalle.length' },
        { header: 'Fecha Salida', key: 'fecha_salida' }
      ];

      const autor = typeof window !== 'undefined' ? localStorage.getItem('usuario_nombre') || 'Administrador' : 'Administrador';

      // Pre-calcular longitud de reservas para la exportación
      const datosProcesados = this.filtrados.map(v => ({
        ...v,
        'reservas_detalle.length': v.reservas_detalle ? v.reservas_detalle.length : 0
      }));

      if (tipo === 'excel') {
        this.exportService.exportarExcel(datosProcesados, columnas, nombreArchivo, autor);
      } else {
        this.exportService.exportarPDF(datosProcesados, columnas, 'Reporte de Viajes y Despachos', nombreArchivo, autor);
      }
      this.mostrarMensaje(`Reporte ${tipo.toUpperCase()} generado.`, 'success');
    }
  }

  // --- INTELIGENCIA DE NEGOCIO ---

  filtrarEquiposDisponibles() {
    if (!this.asignacionesActivas.length || !this.viajes || !this.vehiculos || !this.conductores) return;

    const estadosOcupados = ['Programado', 'En Espera', 'En Curso'];

    this.asignacionesDisponibles = this.asignacionesActivas.filter(asig => {
      const estaOcupado = this.viajes.some(v => 
        v.asignacion === asig.id && estadosOcupados.includes(v.estado_nombre)
      );
      if (estaOcupado) return false;

      // Filtro 1: El vehículo físico debe estar "Disponible"
      const vehiculoObj = this.vehiculos.find(v => v.placa === asig.vehiculo);
      if (vehiculoObj && vehiculoObj.estado !== 'Disponible') {
        return false;
      }
      
      // Filtro 2: El conductor debe estar "Disponible"
      const conductorObj = this.conductores.find(c => c.id === asig.conductor);
      if (conductorObj && conductorObj.estado !== 'Disponible') {
        return false;
      }

      return true;
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

  abrirGuiaEstados() {
    this.mostrarGuiaEstados = true;
  }

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

    const payload = { ...this.nuevoViaje };
    // Limpiamos datos que puedan causar conflictos (aunque en viajes nuevoViaje parece ser un objeto limpio)
    delete payload.conductor_nombre;
    delete payload.vehiculo_placa;
    delete payload.estado_nombre;
    delete payload.reservas_detalle;

    if (this.esEdicion) {
      this.viajeService.actualizarViaje(payload.codigo_viaje, payload).subscribe({
        next: () => {
          this.mostrarMensaje('Viaje actualizado correctamente.', 'success');
          this.mostrarModalViaje = false;
          this.cargarViajes();
        },
        error: (err) => {
          console.error('Error al ACTUALIZAR Viaje:', err.error);
          let msg = 'Error al actualizar.';
          if (err.error && typeof err.error === 'object') msg += ' Detalles: ' + JSON.stringify(err.error);
          this.mostrarMensaje(msg, 'error');
        }
      });
    } else {
      this.viajeService.crearViaje(payload).subscribe({
        next: () => {
          this.mostrarMensaje('Viaje despachado.', 'success');
          this.mostrarModalViaje = false;
          this.cargarViajes();
          this.cargarDatosMaestros(); 
        },
        error: (err) => {
          console.error('Error al CREAR Viaje:', err.error);
          let msg = 'Error al crear el viaje.';
          if (err.error && typeof err.error === 'object') msg += ' Detalles: ' + JSON.stringify(err.error);
          this.mostrarMensaje(msg, 'error');
        }
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
    const estadoAntiguo = v.estado_viaje_id || v.estado_viaje;
    const estadoObj = this.estados.find(e => e.id == nuevoEstadoId);
    if (!estadoObj) return;

    const estadoAntiguoObj = this.estados.find(e => e.id == estadoAntiguo);

    if (estadoAntiguoObj && (estadoAntiguoObj.nombre === 'Finalizado' || estadoAntiguoObj.nombre === 'Cancelado')) {
      Swal.fire({
        title: '⚠️ ACCIÓN CRÍTICA',
        html: `Está intentando revertir un viaje <b>${estadoAntiguoObj.nombre}</b>.<br><br>
               Esto reasignará los recursos (vehículo y conductor). Si los recursos ya fueron asignados a otro viaje, el sistema bloqueará esta acción.<br><br>
               Escriba <b>REVERTIR</b> para confirmar.`,
        icon: 'error',
        input: 'text',
        inputPlaceholder: 'REVERTIR',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Forzar Reversión',
        cancelButtonText: 'Cancelar',
        preConfirm: (inputValue) => {
          if (inputValue !== 'REVERTIR') {
            Swal.showValidationMessage('Debe escribir REVERTIR exactamente');
            return false;
          }
          return true;
        }
      }).then((result) => {
        if (result.isConfirmed) {
          this.ejecutarCambioEstado(v, nuevoEstadoId, estadoAntiguo);
        } else {
          v.estado_viaje_id = estadoAntiguo;
          this.cargarViajes();
        }
      });
      return;
    }

    let titulo = '¿Actualizar estado del viaje?';
    let mensaje = `¿Seguro que deseas pasar el viaje a estado ${estadoObj.nombre}?`;
    let icono: 'question' | 'warning' = 'question';
    let botonConfirmar = '#4f46e5';

    if (estadoObj.nombre === 'Averiado en viaje') {
      titulo = '⚠️ Registrar Contingencia (Avería)';
      mensaje = 'Se marcará el vehículo como averiado y se actualizarán las reservas a contingencia. ¿Seguro?';
      icono = 'warning';
      botonConfirmar = '#ef4444';
    } else if (estadoObj.nombre === 'Finalizado') {
      mensaje = 'Esto liberará los recursos (vehículo y conductor) y finalizará las reservas. ¿Continuar?';
      botonConfirmar = '#10b981';
    }

    Swal.fire({
      title: titulo,
      text: mensaje,
      icon: icono,
      showCancelButton: true,
      confirmButtonColor: botonConfirmar,
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cambiar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.ejecutarCambioEstado(v, nuevoEstadoId, estadoAntiguo);
      } else {
        v.estado_viaje_id = estadoAntiguo;
        this.cargarViajes();
      }
    });
  }

  ejecutarCambioEstado(v: any, nuevoEstadoId: any, estadoAntiguo: any) {
    const payload = { estado_viaje: Number(nuevoEstadoId) };
    this.viajeService.actualizarEstadoViaje(v.codigo_viaje, payload).subscribe({
      next: () => {
        this.mostrarMensaje('¡Estado del viaje y recursos sincronizados! 🔄', 'success');
        this.cargarViajes();
        this.cargarDatosMaestros(); 
      },
      error: (err) => {
        console.error("Error al sincronizar:", err);
        let errorMsg = 'Error al sincronizar el estado.';
        if (err.error && err.error.error) {
          errorMsg = err.error.error;
        }
        Swal.fire('Reversión Bloqueada', errorMsg, 'error');
        v.estado_viaje_id = estadoAntiguo;
        this.cargarViajes();
      }
    }); 
  }

  // --- DETALLES Y MAPA ---

  getStepIndex(estado: string): number {
    if (!estado) return 0;
    if (estado === 'Programado' || estado === 'En Espera') return 0;
    if (estado === 'En Curso') return 1;
    if (estado === 'Averiado en viaje') return 1;
    if (estado === 'Finalizado') return 2;
    if (estado === 'Cancelado') return 2;
    return 0;
  }

  abrirDetalles(v: any) {
    this.viajeSeleccionado = v;
    this.rutaOptimizada = null;
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
      polylineOptions: { strokeColor: '#2563eb', strokeWeight: 5 },
      suppressMarkers: true // Suprimir marcadores por defecto (A, B, C...)
    });

    let originLatLng;
    let destLatLng;
    let waypoints: any[] = [];
    let allNodes: any[] = [];

    if (this.rutaOptimizada && this.rutaOptimizada.length >= 2) {
      originLatLng = { lat: Number(this.rutaOptimizada[0].lat), lng: Number(this.rutaOptimizada[0].lng) };
      destLatLng = { lat: Number(this.rutaOptimizada[this.rutaOptimizada.length - 1].lat), lng: Number(this.rutaOptimizada[this.rutaOptimizada.length - 1].lng) };
      allNodes.push(originLatLng);
      for (let i = 1; i < this.rutaOptimizada.length - 1; i++) {
        const wp = { lat: Number(this.rutaOptimizada[i].lat), lng: Number(this.rutaOptimizada[i].lng) };
        waypoints.push({ location: wp, stopover: true });
        allNodes.push(wp);
      }
      allNodes.push(destLatLng);
    } else {
      const primeraReserva = this.viajeSeleccionado.reservas_detalle[0];
      originLatLng = { lat: Number(primeraReserva.latitud_origen), lng: Number(primeraReserva.longitud_origen) };
      destLatLng = { lat: Number(primeraReserva.latitud_destino), lng: Number(primeraReserva.longitud_destino) };
      allNodes.push(originLatLng, destLatLng);
    }

    const request = {
      origin: originLatLng,
      destination: destLatLng,
      waypoints: waypoints,
      optimizeWaypoints: false,
      travelMode: g.TravelMode.DRIVING
    };

    setTimeout(() => {
      const mapaElement = document.getElementById('mapa-detalle');
      if (mapaElement) {
        this.mapaAdmin = new g.Map(mapaElement, { zoom: 12, center: request.origin });
        directionsRenderer.setMap(this.mapaAdmin);
        directionsService.route(request, (result: any, status: any) => {
          if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            // Dibujar marcadores personalizados
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            allNodes.forEach((node, index) => {
              let labelText = "";
              let bgColor = "#ea4335"; // Red by default
              if (index === 0) {
                labelText = "Inicio";
                bgColor = "#10b981"; // Green for start
              } else if (index === allNodes.length - 1) {
                labelText = "Final";
                bgColor = "#000000"; // Black for end
              } else {
                labelText = alphabet[(index - 1) % alphabet.length];
              }
              
              new g.Marker({
                position: node,
                map: this.mapaAdmin,
                label: { text: labelText, color: 'white', fontWeight: 'bold' },
                icon: {
                  path: g.SymbolPath.CIRCLE,
                  fillColor: bgColor,
                  fillOpacity: 1,
                  strokeWeight: 2,
                  strokeColor: 'white',
                  scale: index === 0 || index === allNodes.length - 1 ? 14 : 10
                }
              });
            });
          }
        });
      }
    }, 200);
  }

  animarSimulacionIAAdmin(callback: () => void) {
    if (!this.mapaAdmin || !this.rutaOptimizada || typeof window === 'undefined' || !(window as any).google) { 
      callback(); return; 
    }
    
    const g = (window as any).google.maps;
    const nodes = this.rutaOptimizada.map((n: any) => ({ lat: Number(n.lat), lng: Number(n.lng) }));
    if (nodes.length < 2) { callback(); return; }

    const polylines: any[] = [];
    let iterations = 0;
    const maxIterations = 15;
    
    const bounds = new g.LatLngBounds();
    nodes.forEach((n: any) => bounds.extend(n));
    this.mapaAdmin.fitBounds(bounds);
    
    const drawInterval = setInterval(() => {
      polylines.forEach(p => p.setMap(null));
      polylines.length = 0;

      const shuffled = [...nodes].sort(() => 0.5 - Math.random());
      const poly = new g.Polyline({ path: shuffled, geodesic: true, strokeColor: '#38bdf8', strokeOpacity: 0.8, strokeWeight: 4, map: this.mapaAdmin });
      polylines.push(poly);

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(drawInterval);
        polylines.forEach(p => p.setMap(null));
        callback();
      }
    }, 100);
  }

  optimizarRutaHormigasAdmin() {
    Swal.fire({
      title: 'Iniciando IA Logística',
      text: 'Se iniciará una competencia en los servidores entre la Colonia de Hormigas y el Algoritmo Genético...',
      icon: 'info',
      showCancelButton: true,
      confirmButtonText: 'Iniciar Cálculo'
    }).then((res) => {
      if (res.isConfirmed) this.llamarEndpointOptimizacionAdmin();
    });
  }

  llamarEndpointOptimizacionAdmin() {
    Swal.fire({ title: 'Analizando...', html: 'Permutando miles de rutas posibles.<br>Por favor espere.', allowOutsideClick: false, didOpen: () => { Swal.showLoading(); } });

    // Para efectos de demostración, capturamos el GPS del Administrador.
    // En un caso real de producción, el admin vería la última ubicación reportada por el conductor.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          this.ejecutarLlamadaBackendOptimizacionAdmin(lat, lng);
        },
        (error) => {
          console.warn('GPS Denegado o sin señal. Usando primer punto de recogida por defecto.');
          this.ejecutarLlamadaBackendOptimizacionAdmin(undefined, undefined);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      this.ejecutarLlamadaBackendOptimizacionAdmin(undefined, undefined);
    }
  }

  ejecutarLlamadaBackendOptimizacionAdmin(lat?: number, lng?: number) {
    this.viajeService.optimizarRuta(this.viajeSeleccionado.codigo_viaje, lat, lng).subscribe({
      next: (response: any) => {
        const aco = response.aco;
        const ga = response.ga;
        const tablaHtml = `
          <table style="width:100%; text-align:left; border-collapse: collapse; margin-top:10px;">
            <tr style="background:#f1f5f9; border-bottom:2px solid #cbd5e1;">
              <th style="padding:8px;">Métrica</th><th style="padding:8px; color:#4f46e5;">🐜 ACO</th><th style="padding:8px; color:#0ea5e9;">🧬 Genético</th>
            </tr>
            <tr style="border-bottom:1px solid #e2e8f0;">
              <td style="padding:8px;"><b>Distancia (Km)</b></td><td style="padding:8px; font-weight:bold;">${aco.distancia_km}</td><td style="padding:8px; font-weight:bold;">${ga.distancia_km}</td>
            </tr>
            <tr>
              <td style="padding:8px;"><b>T. Cálculo (ms)</b></td><td style="padding:8px;">${aco.tiempo_ms} ms</td><td style="padding:8px;">${ga.tiempo_ms} ms</td>
            </tr>
          </table>
        `;
        Swal.fire({
          icon: 'success', title: '¡Análisis Completado!', html: tablaHtml, showCancelButton: true, showDenyButton: true,
          confirmButtonText: '🐜 Usar Hormigas', denyButtonText: '🧬 Usar Genético', cancelButtonText: 'Cancelar',
          confirmButtonColor: '#4f46e5', denyButtonColor: '#0ea5e9'
        }).then((result) => {
          if (result.isConfirmed || result.isDenied) {
            const dataSeleccionada = result.isConfirmed ? aco : ga;
            this.rutaOptimizada = dataSeleccionada.ruta_optimizada;
            
            // 1. Calcular el tiempo total con holgura
            // Asumimos 60 km/h de promedio de conducción
            const horasConduccion = dataSeleccionada.distancia_km / 60;
            // 2 horas de holgura por cada punto de parada (reserva)
            const horasBufferCarga = (this.viajeSeleccionado.reservas_detalle ? this.viajeSeleccionado.reservas_detalle.length : 1) * 2;
            const horasTotal = horasConduccion + horasBufferCarga;
            
            const fechaSalida = new Date(this.viajeSeleccionado.fecha_salida);
            const fechaLlegada = new Date(fechaSalida.getTime() + (horasTotal * 60 * 60 * 1000));
            const nuevaLlegadaISO = fechaLlegada.toISOString().slice(0, 16);

            // 2. Guardar temporalmente en el frontend
            this.payloadRutaPendiente = {
              fecha_llegada_estimada: nuevaLlegadaISO,
              ruta_optimizada_json: dataSeleccionada.ruta_optimizada,
              distancia_optimizada_km: dataSeleccionada.distancia_km
            };

            this.animarSimulacionIAAdmin(() => { this.dibujarRutaDetalle(); });
          }
        });
      },
      error: (err) => {
        console.error(err);
        Swal.fire('Error IA', 'No se pudo procesar la optimización neuronal.', 'error');
      }
    });
  }

  payloadRutaPendiente: any = null;

  guardarRutaOficialAdmin() {
    if (!this.payloadRutaPendiente) {
      Swal.fire('Atención', 'Primero debes Analizar IA y elegir una ruta.', 'warning');
      return;
    }
    
    this.viajeService.actualizarViaje(this.viajeSeleccionado.codigo_viaje, this.payloadRutaPendiente).subscribe({
      next: () => {
        this.viajeSeleccionado.fecha_llegada_estimada = this.payloadRutaPendiente.fecha_llegada_estimada; 
        Swal.fire('Ruta Guardada', 'La ruta oficial y los tiempos estimados se guardaron con éxito en la base de datos.', 'success');
        this.payloadRutaPendiente = null;
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la ruta en la base de datos.', 'error')
    });
  }

  // --- CRUD VIÁTICOS ---

  cargandoRuta: boolean = false;

  abrirViaticos(v:any) { 
    this.viajeSeleccionado = v; 
    this.mostrarModalViaticos = true; 
    this.cargandoRuta = true;
    this.nuevoViatico = {descripcion: '', monto_total: null, viaje: v.codigo_viaje, estado: 'Pendiente'}; 

    // Simulamos un pequeño tiempo de cálculo para la UX
    setTimeout(() => {
      if (v.fecha_salida && v.fecha_llegada_estimada) {
        const fechaSalida = new Date(v.fecha_salida);
        const fechaLlegada = new Date(v.fecha_llegada_estimada);
        
        // Calcular la diferencia en milisegundos y luego en días
        const diffMilisegundos = fechaLlegada.getTime() - fechaSalida.getTime();
        let diasViaje = Math.ceil(diffMilisegundos / (1000 * 60 * 60 * 24));
        
        // Mínimo 1 día de viáticos
        if (diasViaje < 1) {
          diasViaje = 1;
        }

        // TARIFA POR DÍA: Desayuno (50), Almuerzo (50), Cena (50) = 150 Bs por día
        const tarifaPorDia = 150;
        const montoCalculado = diasViaje * tarifaPorDia;
        
        this.nuevoViatico.descripcion = `Viáticos del Conductor (${diasViaje} días: Alimentación)`;
        this.nuevoViatico.monto_total = montoCalculado;
      } else {
        // Fallback genérico si no hay fechas
        this.nuevoViatico.descripcion = 'Viáticos del Conductor (1 día)';
        this.nuevoViatico.monto_total = 150; 
      }
      this.cargandoRuta = false;
    }, 600);
  }

  prellenar(texto: string) {
    this.nuevoViatico.descripcion = texto;
    this.nuevoViatico.monto_total = null;
  }

  guardarViatico() {
    if (!this.nuevoViatico.descripcion || !this.nuevoViatico.monto_total) {
      this.mostrarMensaje('Ingresa una descripción y un monto.', 'error');
      return;
    }
    this.viajeService.crearViatico(this.nuevoViatico).subscribe({
      next: () => {
        this.mostrarMensaje('Viático guardado exitosamente.', 'success');
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

  async exportarViaticos(tipo: 'pdf' | 'excel'): Promise<void> {
    if (!this.viajeSeleccionado || !this.viajeSeleccionado.viaticos || this.viajeSeleccionado.viaticos.length === 0) {
      this.mostrarMensaje('No hay viáticos registrados para exportar.', 'error');
      return;
    }

    const { value: nombreArchivo } = await Swal.fire({
      title: `Exportar Viáticos a ${tipo.toUpperCase()}`,
      input: 'text',
      inputLabel: 'Nombre del archivo',
      inputValue: `Comprobante_Viaticos_${this.viajeSeleccionado.codigo_viaje}`,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return '¡Necesitas escribir un nombre!';
        return null;
      }
    });

    if (nombreArchivo) {
      const columnas = [
        { header: '#', key: 'nro' },
        { header: 'Descripción', key: 'descripcion' },
        { header: 'Monto (Bs)', key: 'monto_total' },
        { header: 'Estado', key: 'estado' }
      ];

      const autor = typeof window !== 'undefined' ? localStorage.getItem('usuario_nombre') || 'Administrador' : 'Administrador';

      let totalViaticos = 0;
      const datosProcesados = this.viajeSeleccionado.viaticos.map((v: any, index: number) => {
        totalViaticos += Number(v.monto_total);
        return {
          nro: index + 1,
          descripcion: v.descripcion,
          monto_total: v.monto_total,
          estado: v.estado
        };
      });

      // Añadir fila de total
      datosProcesados.push({
        nro: '',
        descripcion: 'TOTAL VIÁTICOS',
        monto_total: totalViaticos,
        estado: ''
      });

      const columnasExcel = tipo === 'excel' ? columnas.filter(c => c.key !== 'nro') : columnas;

      if (tipo === 'excel') {
        this.exportService.exportarExcel(datosProcesados, columnasExcel, nombreArchivo, autor);
      } else {
        this.exportService.exportarPDF(
          datosProcesados, 
          columnasExcel, 
          `Comprobante de Viáticos - Viaje ${this.viajeSeleccionado.codigo_viaje}`, 
          nombreArchivo, 
          autor
        );
      }
      this.mostrarMensaje(`Comprobante ${tipo.toUpperCase()} generado.`, 'success');
    }
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