import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps';
import { Component, OnInit, ViewChild, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { ViajeService } from '../../services/viaje';
import Swal from 'sweetalert2';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-viaje-activo-conductor',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './viaje-activo-conductor.html',
  styleUrls: ['./viaje-activo-conductor.css']
})
export class ViajeActivoConductorComponent implements OnInit {
  @ViewChild(GoogleMap, { static: false }) mapaComponente!: GoogleMap;
  mapOptions: any = { mapTypeId: 'roadmap', disableDefaultUI: true, zoomControl: true };
  directionsService: any;
  directionsRenderer: any;
  isBrowser: boolean = false;

  viajesActivos: any[] = [];
  viajeSeleccionado: any = null;
  viajeActivo: any = null;
  cargando: boolean = true;

  constructor(
    private viajeService: ViajeService, 
    private http: HttpClient,
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    this.cargarViajes();
  }

  cargarViajes() {
    this.cargando = true;
    this.viajeService.obtenerMisViajes().subscribe({
      next: (res: any) => {
        this.viajesActivos = res.activos || [];
        if (this.viajeSeleccionado) {
          // Refrescar el viaje seleccionado
          this.viajeSeleccionado = this.viajesActivos.find(v => v.codigo_viaje === this.viajeSeleccionado.codigo_viaje) || null;
        } else if (this.viajesActivos.length === 1) {
          // Si solo hay uno, seleccionarlo automáticamente
          this.seleccionarViaje(this.viajesActivos[0]);
        }
        this.cargando = false;
      },
      error: (err: any) => {
        console.error('Error cargando los viajes del conductor:', err);
        this.cargando = false;
        Swal.fire('Error', 'No se pudieron cargar tus viajes asignados.', 'error');
      }
    });
  }

  seleccionarViaje(viaje: any) {
    this.viajeSeleccionado = viaje;
    this.viajeActivo = viaje; // Mantenemos la variable viajeActivo para compatibilidad con el resto del código
    setTimeout(() => this.dibujarRutaGoogleMaps(), 500);
  }

  volverListaViajes() {
    this.viajeSeleccionado = null;
    this.viajeActivo = null;
  }

  todasCargasRecogidas(): boolean {
    if (!this.viajeActivo || !this.viajeActivo.reservas_detalle) return true;
    return this.viajeActivo.reservas_detalle.every((r: any) => 
      r.estado_nombre === 'En Tránsito' || r.estado_nombre === 'Entregada'
    );
  }

  enfocarEnMapa(lat: any, lng: any) {
    if (!lat || !lng) {
      Swal.fire('Atención', 'No hay coordenadas exactas para esta ubicación.', 'info');
      return;
    }
    const mapaReal = this.mapaComponente?.googleMap;
    if (mapaReal) {
      mapaReal.panTo({ lat: parseFloat(lat), lng: parseFloat(lng) });
      mapaReal.setZoom(16);
    }
  }

  dibujarRutaGoogleMaps() {
    if (!this.isBrowser || !this.viajeActivo || !this.viajeActivo.reservas_detalle?.length) return;
    
    const mapaReal = this.mapaComponente?.googleMap;
    if (typeof window !== 'undefined' && (window as any).google && mapaReal) {
      const g = (window as any).google.maps;
      
      if (!this.directionsService) {
        this.directionsService = new g.DirectionsService();
        this.directionsRenderer = new g.DirectionsRenderer({
          map: mapaReal,
          suppressMarkers: false,
          polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 6, strokeOpacity: 0.8 }
        });
      }

      // Tomamos la primera reserva como referencia principal
      const primeraReserva = this.viajeActivo.reservas_detalle[0];
      
      if (primeraReserva.latitud_origen && primeraReserva.latitud_destino) {
        const originLatLng = { lat: parseFloat(primeraReserva.latitud_origen), lng: parseFloat(primeraReserva.longitud_origen) };
        const destLatLng = { lat: parseFloat(primeraReserva.latitud_destino), lng: parseFloat(primeraReserva.longitud_destino) };

        const request = {
          origin: originLatLng,
          destination: destLatLng,
          travelMode: g.TravelMode.DRIVING
        };

        this.directionsService.route(request, (response: any, status: any) => {
          this.ngZone.run(() => {
            if (status === 'OK') {
              this.directionsRenderer.setDirections(response);
            } else {
              console.warn('No se pudo trazar la ruta de Google Maps', status);
            }
          });
        });
      }
    }
  }

  cambiarEstado(nuevoEstado: string) {
    if (!this.viajeActivo) return;

    Swal.fire({
      title: '¿Estás seguro?',
      text: `¿Quieres marcar este viaje como "${nuevoEstado}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, continuar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.post(`http://localhost:8000/api/viajes/${this.viajeActivo.codigo_viaje}/actualizar-estado/`, { estado: nuevoEstado })
          .subscribe({
            next: () => {
              Swal.fire('Éxito', `Viaje marcado como ${nuevoEstado}`, 'success');
              this.cargarViajes(); 
            },
            error: (err: any) => {
              console.error(err);
              Swal.fire('Error', err.error?.error || 'Ocurrió un error al actualizar el estado.', 'error');
            }
          });
      }
    });
  }

  cambiarEstadoReserva(res: any, nuevoEstado: string) {
    Swal.fire({
      title: '¿Confirmar Acción?',
      text: `¿Quieres marcar la carga ${res.codigo_reserva} como "${nuevoEstado}"?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, confirmar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#4f46e5'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.post(`http://localhost:8000/api/reservas/${res.codigo_reserva}/actualizar-estado/`, { estado: nuevoEstado })
          .subscribe({
            next: () => {
              Swal.fire('Éxito', `Carga marcada como ${nuevoEstado}`, 'success');
              res.estado_nombre = nuevoEstado; // Actualización optimista en la UI
            },
            error: (err: any) => {
              console.error(err);
              Swal.fire('Error', 'Ocurrió un error al actualizar el estado de la carga.', 'error');
            }
          });
      }
    });
  }

  actualizarGPS() {
    if (!this.viajeActivo) return;

    // Simulación simple del GPS
    const latSimulada = -17.3941 + (Math.random() * 0.05);
    const lngSimulada = -66.1772 + (Math.random() * 0.05);

    this.http.post(`http://localhost:8000/api/viajes/${this.viajeActivo.codigo_viaje}/actualizar-gps/`, { 
      latitud: latSimulada, 
      longitud: lngSimulada 
    }).subscribe({
      next: () => {
        Swal.fire({
          title: 'GPS Actualizado',
          text: 'Tu posición se ha reportado a la central exitosamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      },
      error: (err: any) => {
        Swal.fire('Error GPS', 'No se pudo reportar la ubicación.', 'error');
      }
    });
  }
}
