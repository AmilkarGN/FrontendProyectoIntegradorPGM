import { Component, OnInit, ElementRef, ViewChild, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReservaService, Reserva } from '../../services/reserva';
import { ClienteService, Cliente } from '../../services/cliente';
import { RutaService, Ruta } from '../../services/ruta';
import { ExportService } from '../../services/export.service';
import { ConfiguracionService, ConfiguracionSistema } from '../../services/configuracion.service';
import { ViajeService } from '../../services/viaje';
import { AuthService } from '../../services/auth.service';
import Swal from 'sweetalert2';

declare const google: any;

import { QueryBuilderComponent, ColumnaFiltrable, ReglaFiltro, evaluarFiltrosDinámicos } from '../../shared/query-builder/query-builder';

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule, QueryBuilderComponent],
  templateUrl: './reservas.html',
  styleUrls: ['../../app.css']
})
export class ReservasComponent implements OnInit {
  @ViewChild('mapContainer') mapElement!: ElementRef;
  
  modoModal: 'crear' | 'ver' = 'crear';
  reservas: Reserva[] = [];
  clientes: Cliente[] = [];
  viajesProgramados: any[] = [];
  configuracionGlobal: ConfiguracionSistema | null = null;
  mostrarModal = false;
  reservaActual: any = {};
  viendoPapelera: boolean = false;
  
  // Lógica de Lotes (Cargas Múltiples)
  cargasEnLote: any[] = [];

  unidadPeso: 'kg' | 'qq' = 'kg';
  inputPesoLocal: number = 0;
  
  fechaMinima: string = ''; 
  marcadorOrigen: any = null; 
  tiempoConduccionPura: number = 0;
  
  map: any;
  directionsService: any;
  directionsRenderer: any;
  geocoder: any;

  // Declaramos isBrowser para evitar el error de Google Maps en la terminal
  isBrowser: boolean;

  constructor(
    private reservaService: ReservaService,
    private clienteService: ClienteService,
    private rutaService: RutaService,
    private exportService: ExportService,
    private configuracionService: ConfiguracionService,
    private viajeService: ViajeService,
    private route: ActivatedRoute, 
    private ngZone: NgZone,
    public authService: AuthService,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.fechaMinima = new Date().toISOString().split('T')[0];
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  alertaDestacada: string | null = null;
  mostrarGuiaEstados: boolean = false;

  abrirGuiaEstados(): void {
    this.mostrarGuiaEstados = true;
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      if (params['alerta']) this.alertaDestacada = String(params['alerta']);
    });
    this.cargarDatos(); // Tu función normal de carga

    // 👈 3. EL ESCUCHADOR INTELIGENTE
    this.route.queryParams.subscribe(params => {
      // Si la URL dice 'abrir_modal=true', disparamos la lógica
      if (params['abrir_modal'] === 'true') {
        
        // Usamos un pequeño delay para que Angular termine de renderizar la vista
        setTimeout(() => {
          this.abrirModal(); // Llamamos a tu función que limpia y abre el modal de reserva

          // Si el calendario nos mandó una fecha específica, la pre-llenamos
          if (params['fecha_nueva']) {
            this.reservaActual.fecha_tentativa_viaje = params['fecha_nueva'];
            console.log('📅 Fecha pre-cargada desde el calendario:', params['fecha_nueva']);
          }
        }, 400); 
      }
    });
  }

  cargarDatosYRevisarURL(): void {
    // 1. Primero traemos las Reservas
    this.reservaService.obtenerReservas(this.viendoPapelera).subscribe(dataReservas => {
      this.reservas = dataReservas;
      
      // 2. Traemos los clientes
      this.clienteService.obtenerClientes().subscribe(dataClientes => {
        this.clientes = dataClientes;

        // 3. Revisamos la URL
        this.route.queryParams.subscribe(params => {
          if (params['fecha']) {
            setTimeout(() => this.abrirModalConFecha(params['fecha']), 500);
          } else if (params['ver_reserva']) {
            const reservaEncontrada = this.reservas.find(r => r.codigo_reserva === params['ver_reserva']);
            if (reservaEncontrada) {
              setTimeout(() => this.verReserva(reservaEncontrada), 500);
            }
          }
        });
      });
    });
  }

  cargarDatos(): void {
    this.reservaService.obtenerReservas(this.viendoPapelera).subscribe(data => this.reservas = data);
    this.clienteService.obtenerClientes().subscribe(data => this.clientes = data);
    this.configuracionService.obtenerConfiguracion().subscribe(data => {
      if (data && data.length > 0) {
        this.configuracionGlobal = data[0];
      }
    });
    this.viajeService.obtenerViajes().subscribe(data => this.viajesProgramados = data);
  }

  alternarPapelera(estado: boolean): void {
    this.viendoPapelera = estado;
    this.cargarDatosYRevisarURL();
  }

  restaurarReserva(codigo: string): void {
    Swal.fire({
      title: '¿Restaurar Reserva?',
      text: `¿Deseas restaurar esta reserva de la papelera?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, restaurar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.reservaService.restaurarReserva(codigo).subscribe({
          next: () => {
            this.cargarDatosYRevisarURL();
            Swal.fire('Restaurado', 'La reserva fue devuelta al catálogo.', 'success');
          },
          error: () => Swal.fire('Error', 'No se pudo restaurar la reserva.', 'error')
        });
      }
    });
  }

  // --- CONFIGURACIÓN GLOBAL DE TARIFA ---
  async ajustarTarifaGlobal() {
    const tarifaActual = this.configuracionGlobal ? this.configuracionGlobal.tarifa_base_qq : 20.00;
    const { value: nuevaTarifa } = await Swal.fire({
      title: 'Ajustar Tarifa Global',
      text: 'Este precio base se aplicará a todas las reservas futuras.',
      input: 'number',
      inputValue: tarifaActual,
      inputAttributes: { step: '0.50', min: '1' },
      showCancelButton: true,
      confirmButtonText: 'Guardar',
      cancelButtonText: 'Cancelar'
    });

    if (nuevaTarifa && parseFloat(nuevaTarifa) > 0) {
      const configId = this.configuracionGlobal?.id || 1;
      this.configuracionService.actualizarConfiguracion(configId, { tarifa_base_qq: parseFloat(nuevaTarifa) }).subscribe({
        next: (res) => {
          this.configuracionGlobal = res;
          Swal.fire('Actualizado', `La nueva tarifa base es Bs. ${res.tarifa_base_qq}`, 'success');
        },
        error: () => Swal.fire('Error', 'No se pudo actualizar la tarifa.', 'error')
      });
    }
  }

  // --- ALERTA INTELIGENTE DE DISPONIBILIDAD ---
  alertaDisponibilidad: string | null = null;
  
  verificarDisponibilidadFecha() {
    if (!this.reservaActual.fecha_tentativa_viaje) {
      this.alertaDisponibilidad = null;
      return;
    }
    
    const fechaElegida = this.reservaActual.fecha_tentativa_viaje;
    
    // Contar reservas en esa misma fecha
    const reservasMismoDia = this.reservas.filter(r => r.fecha_tentativa_viaje === fechaElegida).length;
    // Contar viajes programados en esa misma fecha (aprox por string)
    const viajesMismoDia = this.viajesProgramados.filter(v => v.fecha_salida && v.fecha_salida.includes(fechaElegida)).length;
    
    const cargaTotal = reservasMismoDia + viajesMismoDia;
    
    // Si ya hay 3 o más, y estamos intentando meter una nueva, lanzamos la advertencia.
    if (cargaTotal >= 3) {
      this.alertaDisponibilidad = `⚠️ ALTA DEMANDA: Ya existen ${cargaTotal} compromisos (reservas/viajes) para el ${fechaElegida}. Te sugerimos confirmar disponibilidad de camiones antes de garantizar el servicio.`;
    } else {
      this.alertaDisponibilidad = null;
    }
  }

  // --- ALERTA DE EDICIÓN DE RESERVAS EN CURSO ---
  alertaEdicionPeligrosa: string | null = null;

  // --- QUERY BUILDER CONFIG ---
  columnasFiltro: ColumnaFiltrable[] = [
    { campo: 'codigo_reserva', nombre: 'Código de Reserva', tipo: 'texto' },
    { campo: 'cliente_detalles.razon_social', nombre: 'Cliente (Razón Social)', tipo: 'texto' },
    { campo: 'cliente_detalles.usuario_detalles.nombre', nombre: 'Nombre Contacto', tipo: 'texto' },
    { campo: 'direccion_origen', nombre: 'Origen', tipo: 'texto' },
    { campo: 'direccion_destino', nombre: 'Destino', tipo: 'texto' },
    { campo: 'peso_estimado_kg', nombre: 'Peso (Kg)', tipo: 'numero' },
    { campo: 'distancia_real_km', nombre: 'Distancia (Km)', tipo: 'numero' },
    { campo: 'es_fragil', nombre: 'Es Carga Frágil', tipo: 'booleano' },
    { campo: 'estado_nombre', nombre: 'Estado', tipo: 'texto' },
    { campo: 'fecha_tentativa_viaje', nombre: 'Fecha Solicitada', tipo: 'fecha' }
  ];
  
  reglasActivas: ReglaFiltro[] = [];

  aplicarFiltros(reglas: ReglaFiltro[]) {
    this.reglasActivas = reglas;
  }

  get filtrados(): Reserva[] {
    return this.reservas.filter(r => evaluarFiltrosDinámicos(r, this.reglasActivas));
  }

  // --- LOGICA DE PESOS Y CONVERSIONES ---
  get pesoEnKg(): number {
    return this.unidadPeso === 'kg' ? this.inputPesoLocal : this.inputPesoLocal * 45;
  }

  cambiarUnidadPeso(unidad: 'kg' | 'qq') {
    if (this.unidadPeso === unidad) return;
    if (unidad === 'qq') {
      this.inputPesoLocal = parseFloat((this.inputPesoLocal / 45).toFixed(2)) || 0;
    } else {
      this.inputPesoLocal = parseFloat((this.inputPesoLocal * 45).toFixed(2)) || 0;
    }
    this.unidadPeso = unidad;
  }

  obtenerQuintales(pesoKg: number): number {
    return pesoKg ? parseFloat((pesoKg / 45).toFixed(2)) : 0;
  }

  // --- REPORTES Y FACTURACIÓN ---
  async exportar(tipo: 'pdf' | 'excel'): Promise<void> {
    const { value: nombreArchivo } = await Swal.fire({
      title: `Exportar a ${tipo.toUpperCase()}`,
      input: 'text',
      inputLabel: 'Nombre del archivo',
      inputValue: `Reporte_de_Reservas_${new Date().getTime()}`,
      showCancelButton: true,
      inputValidator: (value) => {
        if (!value) return '¡Necesitas escribir un nombre!';
        return null;
      }
    });

    if (nombreArchivo) {
      const columnas = [
        { header: '#', key: 'nro' },
        { header: 'Código', key: 'codigo_reserva' },
        { header: 'Cliente', key: 'cliente_detalles.razon_social' },
        { header: 'Origen', key: 'direccion_origen' },
        { header: 'Destino', key: 'direccion_destino' },
        { header: 'Peso Carga', key: 'peso_export' },
        { header: 'Estado', key: 'estado_nombre' },
        { header: 'Fecha Solicitada', key: 'fecha_tentativa_viaje' }
      ];

      const autor = typeof window !== 'undefined' ? localStorage.getItem('usuario_nombre') || 'Administrador' : 'Administrador';

      const datosProcesados = this.filtrados.map((r, index) => ({
        ...r,
        nro: index + 1,
        peso_export: `${r.peso_estimado_kg} Kg (${this.obtenerQuintales(r.peso_estimado_kg)} qq)`
      }));

      const columnasExcel = columnas.filter(c => c.key !== 'nro');

      if (tipo === 'excel') {
        this.exportService.exportarExcel(datosProcesados, columnasExcel, nombreArchivo, autor);
      } else {
        this.exportService.exportarPDF(datosProcesados, columnas, 'Reporte de Reservas y Cargas', nombreArchivo, autor);
      }
      Swal.fire('Éxito', `Reporte ${tipo.toUpperCase()} generado.`, 'success');
    }
  }

  generarFactura(reserva: Reserva): void {
    const autor = typeof window !== 'undefined' ? localStorage.getItem('usuario_nombre') || 'Administrador' : 'Administrador';
    this.exportService.generarFactura(reserva, autor);
    Swal.fire('Éxito', 'Factura descargada con éxito.', 'success');
  }

  abrirModalConFecha(fecha: string): void {
    this.abrirModal();
    this.reservaActual.fecha_tentativa_viaje = fecha;
  }

  abrirModal(): void {
    this.modoModal = 'crear';
    this.mostrarModal = true;
    this.reservaActual = {
      cliente: null,
      direccion_origen: '', latitud_origen: null, longitud_origen: null,
      direccion_destino: '', latitud_destino: null, longitud_destino: null,
      fecha_tentativa_viaje: this.fechaMinima, 
      es_fragil: false, peso_estimado_kg: null,
      contacto_destino: 'A confirmar', 
      telefono_destino: '00000000',
      terminos_pago: 'Contado',
      estado_reserva: 1,
      tarifa_qq_aplicada: this.configuracionGlobal ? this.configuracionGlobal.tarifa_base_qq : 20.00,
      tipo_descuento: 'ninguno',
      valor_descuento: 0,
      motivo_descuento: ''
    };
    this.cargasEnLote = [];
    this.tiempoConduccionPura = 0;
    this.unidadPeso = 'kg';
    this.inputPesoLocal = 0;
    this.alertaDisponibilidad = null; // Reiniciamos alerta
    this.alertaEdicionPeligrosa = null; // Reiniciamos alerta edición

    // Limpiar visualmente el mapa
    if (this.directionsRenderer) {
      this.directionsRenderer.setDirections({routes: []});
    }
    if (this.marcadorOrigen) {
      this.marcadorOrigen.setMap(null);
    }

    // Candado SSR: Solo iniciar Google Maps si estamos en el navegador
    if (this.isBrowser) {
      setTimeout(() => this.iniciarMapaYEventos(), 500);
    }
  }

  verReserva(reserva: Reserva): void {
    this.modoModal = 'ver';
    this.reservaActual = { ...reserva };
    this.mostrarModal = true;
    
    // Candado SSR
    if (this.isBrowser) {
      setTimeout(() => {
        this.iniciarMapaYEventos();
        this.trazarRuta();
      }, 500);
    }
  }

  // --- BOTÓN AZUL DE GEOLOCALIZACIÓN ---
  ubicarUsuario(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = { lat: position.coords.latitude, lng: position.coords.longitude };
          this.map.setCenter(pos);
          this.map.setZoom(16);

          new google.maps.Marker({
            position: pos,
            map: this.map,
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 8,
              fillColor: '#4285F4',
              fillOpacity: 1,
              strokeWeight: 2,
              strokeColor: 'white',
            },
            title: 'Tu ubicación actual'
          });
        },
        () => { Swal.fire('Error', 'No se pudo obtener la ubicación exacta.', 'error'); },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      Swal.fire('Error', 'Tu navegador no soporta geolocalización.', 'error');
    }
  }

  limpiarMapa(): void {
    this.reservaActual.direccion_origen = '';
    this.reservaActual.latitud_origen = null;
    this.reservaActual.longitud_origen = null;
    
    this.reservaActual.direccion_destino = '';
    this.reservaActual.latitud_destino = null;
    this.reservaActual.longitud_destino = null;
    
    this.reservaActual.distancia_real_km = null;
    this.reservaActual.tiempo_estimado_horas = null;

    if (this.directionsRenderer) {
      this.directionsRenderer.setDirections({routes: []});
    }
    if (this.marcadorOrigen) {
      this.marcadorOrigen.setMap(null);
    }
    // Centrar mapa de vuelta
    if (this.map) {
      this.map.setCenter({ lat: -16.500, lng: -68.150 });
      this.map.setZoom(6);
    }
  }

  iniciarMapaYEventos(): void {
    this.directionsService = new google.maps.DirectionsService();
    this.directionsRenderer = new google.maps.DirectionsRenderer();
    this.geocoder = new google.maps.Geocoder();

    const boliviaCoord = { lat: -16.500, lng: -68.150 };
    this.map = new google.maps.Map(this.mapElement.nativeElement, {
      zoom: 6, center: boliviaCoord, disableDefaultUI: true
    });
    this.directionsRenderer.setMap(this.map);

    this.map.addListener('click', (event: any) => {
      this.procesarClicMapa(event.latLng);
    });

    this.configurarAutocompletado('origenInput', 'origen');
    this.configurarAutocompletado('destinoInput', 'destino');
  }

  configurarAutocompletado(idInput: string, tipo: 'origen' | 'destino'): void {
    const input = document.getElementById(idInput) as HTMLInputElement;
    if (!input) return;
    const autocomplete = new google.maps.places.Autocomplete(input);
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      this.ngZone.run(() => {
        if (tipo === 'origen') {
          this.reservaActual.direccion_origen = place.formatted_address;
          this.reservaActual.latitud_origen = place.geometry.location.lat();
          this.reservaActual.longitud_origen = place.geometry.location.lng();
        } else {
          this.reservaActual.direccion_destino = place.formatted_address;
          this.reservaActual.latitud_destino = place.geometry.location.lat();
          this.reservaActual.longitud_destino = place.geometry.location.lng();
        }
        this.trazarRuta();
      });
    });
  }

  procesarClicMapa(latLng: any): void {
    this.geocoder.geocode({ location: latLng }, (results: any, status: string) => {
      if (status === 'OK' && results[0]) {
        this.ngZone.run(() => { 
          const direccion = results[0].formatted_address;

          if (!this.reservaActual.latitud_origen || (this.reservaActual.latitud_origen && this.reservaActual.latitud_destino)) {
            // PRIMER CLIC: ORIGEN
            this.reservaActual.direccion_origen = direccion;
            this.reservaActual.latitud_origen = latLng.lat();
            this.reservaActual.longitud_origen = latLng.lng();
            
            this.reservaActual.direccion_destino = '';
            this.reservaActual.latitud_destino = null;
            this.reservaActual.longitud_destino = null;
            
            this.directionsRenderer.setDirections({routes: []}); 
            if (this.marcadorOrigen) this.marcadorOrigen.setMap(null);
            
            this.marcadorOrigen = new google.maps.Marker({
              position: latLng,
              map: this.map,
              label: { text: 'A', color: 'white', fontWeight: 'bold' },
              title: 'Punto de Recojo'
            });

          } else {
            // SEGUNDO CLIC: DESTINO
            this.reservaActual.direccion_destino = direccion;
            this.reservaActual.latitud_destino = latLng.lat();
            this.reservaActual.longitud_destino = latLng.lng();
            
            if (this.marcadorOrigen) this.marcadorOrigen.setMap(null); 
            this.trazarRuta();
          }
        });
      }
    });
  }

  trazarRuta(): void {
    if (this.reservaActual.latitud_origen && this.reservaActual.latitud_destino) {
      const request = {
        origin: { lat: this.reservaActual.latitud_origen, lng: this.reservaActual.longitud_origen },
        destination: { lat: this.reservaActual.latitud_destino, lng: this.reservaActual.longitud_destino },
        travelMode: google.maps.TravelMode.DRIVING
      };

      this.directionsService.route(request, (result: any, status: string) => {
        if (status === 'OK') {
          this.directionsRenderer.setDirections(result);
          
          this.ngZone.run(() => {
            const route = result.routes[0].legs[0];
            this.reservaActual.distancia_real_km = (route.distance.value / 1000).toFixed(2);
            const horasGoogle = route.duration.value / 3600; 
            this.calcularTiempoCamion(horasGoogle);
          });
        }
      });
    }
  }

  calcularTiempoCamion(horasAuto: number): void {
    const horasConduccionCamion = horasAuto * 1.25;
    this.tiempoConduccionPura = parseFloat(horasConduccionCamion.toFixed(2));

    const turnosCompletos = Math.floor(horasConduccionCamion / 10);
    const horasDeDescansoTotal = turnosCompletos * 14; 

    const tiempoTotalReal = horasConduccionCamion + horasDeDescansoTotal;
    this.reservaActual.tiempo_estimado_horas = parseFloat(tiempoTotalReal.toFixed(2));
  }

  // --- LÓGICA DE LOTES ---
  agregarAlLote() {
    if (!this.reservaActual.direccion_origen || !this.reservaActual.direccion_destino) {
      Swal.fire('Atención', 'Debe seleccionar un origen y destino primero.', 'warning');
      return;
    }
    
    const carga = {
      direccion_origen: this.reservaActual.direccion_origen,
      latitud_origen: this.reservaActual.latitud_origen,
      longitud_origen: this.reservaActual.longitud_origen,
      direccion_destino: this.reservaActual.direccion_destino,
      latitud_destino: this.reservaActual.latitud_destino,
      longitud_destino: this.reservaActual.longitud_destino,
      distancia_real_km: this.reservaActual.distancia_real_km,
      tiempo_estimado_horas: this.reservaActual.tiempo_estimado_horas,
      peso_estimado_kg: this.pesoEnKg,
      descripcion_carga: this.reservaActual.descripcion_carga,
      es_fragil: this.reservaActual.es_fragil,
      contacto_destino: this.reservaActual.contacto_destino,
      telefono_destino: this.reservaActual.telefono_destino
    };

    this.cargasEnLote.push(carga);

    // UX: Limpiar origen y destino para la siguiente entrada
    this.reservaActual.direccion_origen = '';
    this.reservaActual.latitud_origen = null;
    this.reservaActual.longitud_origen = null;
    
    this.reservaActual.direccion_destino = '';
    this.reservaActual.latitud_destino = null;
    this.reservaActual.longitud_destino = null;

    this.reservaActual.distancia_real_km = null;
    this.reservaActual.tiempo_estimado_horas = null;
    this.reservaActual.descripcion_carga = '';
    this.reservaActual.es_fragil = false;
    this.inputPesoLocal = 0;
    
    if (this.marcadorOrigen) {
      this.marcadorOrigen.setMap(null);
      this.marcadorOrigen = null;
    }
    if (this.directionsRenderer) {
      this.directionsRenderer.setDirections({routes: []});
    }

    Swal.fire('Agregada', 'Carga guardada en la lista. Puedes ingresar el siguiente recojo.', 'success');
  }

  reutilizarOrigenAnterior() {
    if (this.cargasEnLote.length === 0) return;
    const ultimaCarga = this.cargasEnLote[this.cargasEnLote.length - 1];
    
    this.reservaActual.direccion_origen = ultimaCarga.direccion_origen;
    this.reservaActual.latitud_origen = ultimaCarga.latitud_origen;
    this.reservaActual.longitud_origen = ultimaCarga.longitud_origen;
    
    if (this.marcadorOrigen) this.marcadorOrigen.setMap(null);
    if (this.reservaActual.latitud_origen && this.reservaActual.longitud_origen) {
      const latLng = new google.maps.LatLng(this.reservaActual.latitud_origen, this.reservaActual.longitud_origen);
      this.marcadorOrigen = new google.maps.Marker({
        position: latLng,
        map: this.map,
        label: { text: 'A', color: 'white', fontWeight: 'bold' },
        title: 'Punto de Recojo'
      });
      this.map.setCenter(latLng);
    }
    this.trazarRuta();
  }

  reutilizarDestinoAnterior() {
    if (this.cargasEnLote.length === 0) return;
    const ultimaCarga = this.cargasEnLote[this.cargasEnLote.length - 1];
    
    this.reservaActual.direccion_destino = ultimaCarga.direccion_destino;
    this.reservaActual.latitud_destino = ultimaCarga.latitud_destino;
    this.reservaActual.longitud_destino = ultimaCarga.longitud_destino;
    
    this.reservaActual.contacto_destino = ultimaCarga.contacto_destino;
    this.reservaActual.telefono_destino = ultimaCarga.telefono_destino;

    this.trazarRuta();
  }

  eliminarDelLote(index: number) {
    this.cargasEnLote.splice(index, 1);
  }

  calcularPesoTotalLote() {
    let total = this.cargasEnLote.reduce((acc, curr) => acc + (parseFloat(curr.peso_estimado_kg) || 0), 0);
    total += parseFloat(this.pesoEnKg.toString()) || 0; 
    return total;
  }

  // --- GUARDAR O ACTUALIZAR RESERVA ---
  guardar(): void {
    // Si estamos editando una sola reserva (no un lote)
    if (this.reservaActual.codigo_reserva) {
      this.reservaActual.peso_estimado_kg = this.pesoEnKg;
      
      const payload = { ...this.reservaActual };
      delete payload.cliente_detalles;
      delete payload.ruta_macro_detalles;
      delete payload.estado_nombre;
      delete payload.fecha_creacion;
      delete payload.peso_export;
      if (typeof payload.cliente === 'object' && payload.cliente !== null) {
        payload.cliente = payload.cliente.id;
      }

      this.reservaService.actualizarReserva(this.reservaActual.codigo_reserva, payload).subscribe({
        next: () => {
          this.cargarDatos();
          this.mostrarModal = false;
          Swal.fire('¡Éxito!', 'Reserva actualizada con éxito', 'success');
        },
        error: (err) => {
          console.error('Error al actualizar:', err);
          Swal.fire('Error', 'No se pudo actualizar la reserva.', 'error');
        }
      });
      return;
    }

    // SI ES CREACIÓN MÚLTIPLE O SIMPLE (Lote)
    
    // 1. Añadimos lo que esté en el input actualmente al array si es válido
    if (this.reservaActual.direccion_origen && this.reservaActual.direccion_destino && this.pesoEnKg > 0) {
      const cargaActual = {
        direccion_origen: this.reservaActual.direccion_origen,
        latitud_origen: this.reservaActual.latitud_origen,
        longitud_origen: this.reservaActual.longitud_origen,
        direccion_destino: this.reservaActual.direccion_destino,
        latitud_destino: this.reservaActual.latitud_destino,
        longitud_destino: this.reservaActual.longitud_destino,
        distancia_real_km: this.reservaActual.distancia_real_km,
        tiempo_estimado_horas: this.reservaActual.tiempo_estimado_horas,
        peso_estimado_kg: this.pesoEnKg,
        descripcion_carga: this.reservaActual.descripcion_carga,
        es_fragil: this.reservaActual.es_fragil,
        contacto_destino: this.reservaActual.contacto_destino,
        telefono_destino: this.reservaActual.telefono_destino
      };
      this.cargasEnLote.push(cargaActual);
      // Limpiar inputs
      this.reservaActual.direccion_origen = '';
      this.inputPesoLocal = 0;
    }

    if (this.cargasEnLote.length === 0) {
      Swal.fire('Atención', 'Debe rellenar al menos una carga (origen, destino y peso) para guardar la reserva.', 'warning');
      return;
    }

    // Generar un ID de lote si hay más de 1 carga
    const esLote = this.cargasEnLote.length > 1;
    const grupoLote = esLote ? `LOTE-${Math.random().toString(36).substr(2, 6).toUpperCase()}` : null;

    // Crear promesas para cada carga
    const promesasGuardado = this.cargasEnLote.map(carga => {
      // Combinar los campos base con los específicos
      const payload = {
        codigo_reserva: 'RES-' + Math.floor(Math.random() * 1000000),
        cliente: typeof this.reservaActual.cliente === 'object' && this.reservaActual.cliente !== null ? this.reservaActual.cliente.id : this.reservaActual.cliente,
        fecha_tentativa_viaje: this.reservaActual.fecha_tentativa_viaje,
        tarifa_qq_aplicada: this.reservaActual.tarifa_qq_aplicada,
        tipo_descuento: this.reservaActual.tipo_descuento,
        valor_descuento: this.reservaActual.valor_descuento,
        motivo_descuento: this.reservaActual.motivo_descuento,
        terminos_pago: this.reservaActual.terminos_pago,
        estado_reserva: 1, // Pendiente
        grupo_lote: grupoLote, 
        ...carga
      };
      return this.reservaService.crearReserva(payload).toPromise();
    });

    // Ejecutar todas las creaciones
    Promise.all(promesasGuardado)
      .then(() => {
        this.cargarDatos();
        this.mostrarModal = false;
        if (esLote) {
          Swal.fire('Lote Guardado', `Se han generado ${this.cargasEnLote.length} reservas bajo el identificador ${grupoLote}`, 'success');
        } else {
          Swal.fire('¡Éxito!', 'Reserva creada con éxito', 'success');
        }
        this.cargasEnLote = [];
      })
      .catch((err) => {
        console.error('Error guardando lote de reservas:', err);
        Swal.fire('Error', 'Ocurrió un problema al guardar las reservas. Por favor, verifica los datos e intenta de nuevo.', 'error');
      });
  }

  // --- ELIMINAR RESERVA ---
  // --- EDITAR RESERVA ---
  editarReserva(reserva: Reserva): void {
    this.modoModal = 'crear'; // Usamos el modo 'crear' para que el formulario sea editable
    
    // Hacemos una copia profunda (clone) para que si cancelas, no se modifique la tabla original
    this.reservaActual = JSON.parse(JSON.stringify(reserva)); 
    
    // Asegurarnos de que el cliente sea solo el ID para el select del formulario
    if (this.reservaActual.cliente && typeof this.reservaActual.cliente === 'object') {
      this.reservaActual.cliente = this.reservaActual.cliente.id;
    }

    this.unidadPeso = 'kg';
    this.inputPesoLocal = this.reservaActual.peso_estimado_kg || 0;
    this.mostrarModal = true;
    
    if (this.reservaActual.viaje_asignado || (this.reservaActual.estado_reserva && this.reservaActual.estado_reserva > 1)) {
      this.alertaEdicionPeligrosa = '⚠️ ATENCIÓN: Esta reserva ya está asignada a un viaje en curso o ha sido confirmada. Modificar datos como el peso o las fechas podría causar conflictos en la logística o reportes de la flota.';
    } else {
      this.alertaEdicionPeligrosa = null;
    }
    
    if (this.isBrowser) {
      setTimeout(() => {
        this.iniciarMapaYEventos();
        this.trazarRuta(); // Dibujamos la ruta actual para que pueda modificarla si quiere
      }, 500);
    }
  }

  // --- ELIMINAR RESERVA ---
  // Ahora recibe el objeto completo (Reserva) tal como se lo manda el HTML
  eliminarReserva(reserva: Reserva): void {
    const codigo = reserva.codigo_reserva; 

    if (!codigo) {
      Swal.fire('Error', 'No se encontró el código de la reserva.', 'error');
      return;
    }

    Swal.fire({
      title: '¿Eliminar Reserva?',
      text: `⚠️ ¿Estás seguro de que deseas eliminar la reserva ${codigo}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.reservaService.eliminarReserva(codigo).subscribe({
          next: () => {
            this.cargarDatos(); // Recargamos la tabla
            Swal.fire('Eliminada', 'Reserva eliminada exitosamente.', 'success');
          },
          error: (err) => {
            console.error(err);
            Swal.fire('Error', 'No se puede eliminar. Es posible que esté atada a un Viaje o Carga física en el sistema.', 'error');
          }
        });
      }
    });
  }
  
}