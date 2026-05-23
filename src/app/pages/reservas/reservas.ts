import { Component, OnInit, ElementRef, ViewChild, NgZone, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ReservaService, Reserva } from '../../services/reserva';
import { ClienteService, Cliente } from '../../services/cliente';
import { RutaService, Ruta } from '../../services/ruta';
import Swal from 'sweetalert2';

declare const google: any;

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reservas.html',
  styleUrls: ['./reservas.css']
})
export class ReservasComponent implements OnInit {
  @ViewChild('mapContainer') mapElement!: ElementRef;
  
  modoModal: 'crear' | 'ver' = 'crear';
  reservas: Reserva[] = [];
  clientes: Cliente[] = [];
  mostrarModal = false;
  reservaActual: any = {};
  
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
    private route: ActivatedRoute, 
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object // <-- ¡Coma arreglada aquí!
  ) {
    this.fechaMinima = new Date().toISOString().split('T')[0];
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit(): void {
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
    this.reservaService.obtenerReservas().subscribe(dataReservas => {
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
    this.reservaService.obtenerReservas().subscribe(data => this.reservas = data);
    this.clienteService.obtenerClientes().subscribe(data => this.clientes = data);
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
      estado_reserva: 1
    };
    this.tiempoConduccionPura = 0;

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

  // --- GUARDAR O ACTUALIZAR RESERVA ---
  guardar(): void {
    // Si la reserva NO tiene código, significa que es NUEVA
    if (!this.reservaActual.codigo_reserva) {
      this.reservaActual.codigo_reserva = 'RES-' + Math.floor(Math.random() * 1000000);
      this.reservaActual.estado_reserva = 1; // 1 = Pendiente
      
      this.reservaService.crearReserva(this.reservaActual).subscribe({
        next: () => {
          this.cargarDatos();
          this.mostrarModal = false;
          Swal.fire('¡Éxito!', 'Reserva creada con éxito', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al crear la reserva', 'error')
      });
      
    } else {
      // Si la reserva YA TIENE código, significa que la estamos EDITANDO
      this.reservaService.actualizarReserva(this.reservaActual.codigo_reserva, this.reservaActual).subscribe({
        next: () => {
          this.cargarDatos();
          this.mostrarModal = false;
          Swal.fire('¡Éxito!', 'Reserva actualizada con éxito', 'success');
        },
        error: (err) => Swal.fire('Error', 'Error al actualizar la reserva', 'error')
      });
    }
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

    this.mostrarModal = true;
    
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