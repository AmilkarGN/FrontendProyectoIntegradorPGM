import { Component, OnInit, ViewChild, NgZone, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps';
import { ViajeService } from '../../services/viaje';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-mapa-vivo',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './mapa-vivo.html',
  styleUrls: ['./mapa-vivo.css']
})
export class MapaVivo implements OnInit, OnDestroy {
  @ViewChild(GoogleMap, { static: false }) mapaComponente!: GoogleMap;
  
  center: any = { lat: -16.5000, lng: -68.1500 }; 
  zoom = 12;
  mapOptions: any = { mapTypeId: 'roadmap', disableDefaultUI: false };

  isBrowser: boolean;
  viajesActivos: any[] = [];
  marcadoresCamiones: { [codigo: string]: any } = {};
  intervaloActualizacion: any;

  viajeSeleccionado: any = null;
  alertaDesvio: string | null = null;
  directionsService: any;
  directionsRenderer: any;
  primeraCarga = true;

  // --- VARIABLES DEL SIMULADOR ---
  rutaPath: any[] = []; 
  simulacionInterval: any = null;
  simulacionActiva = false;
  pasoSimulacion = 0;

  constructor(private ngZone: NgZone, private viajeService: ViajeService, @Inject(PLATFORM_ID) private platformId: Object) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {
    if (this.isBrowser) {
      this.cargarFlotaEnVivo();
      // El mapa pide coordenadas nuevas cada 5 segundos
      this.intervaloActualizacion = setInterval(() => this.cargarFlotaEnVivo(), 5000);
    }
  }

  ngOnDestroy() {
    if (this.intervaloActualizacion) clearInterval(this.intervaloActualizacion);
    this.detenerSimulacion(); 
  }

  chequearGoogleServicios() {
    const mapaReal = this.mapaComponente?.googleMap;
    if (typeof window !== 'undefined' && (window as any).google && mapaReal && !this.directionsService) {
      const g = (window as any).google.maps;
      this.directionsService = new g.DirectionsService();
      this.directionsRenderer = new g.DirectionsRenderer({
        map: mapaReal,
        suppressMarkers: true, 
        polylineOptions: { strokeColor: '#10b981', strokeWeight: 6, strokeOpacity: 0.8 }
      });
    }
  }

  // 👇 AQUÍ ESTÁ LA MAGIA QUE APROBARÁ TU INGE
  cargarFlotaEnVivo() {
    // Usamos el nuevo endpoint hiper-ligero. Cero filtros en el frontend.
    this.viajeService.obtenerDatosMapaVivo().subscribe(viajesDesdeDjango => {
      this.viajesActivos = viajesDesdeDjango;
      this.actualizarMarcadoresEnMapa();

      if (this.viajeSeleccionado && !this.simulacionActiva) {
        const viajeActualizado = this.viajesActivos.find(v => v.codigo_viaje === this.viajeSeleccionado.codigo_viaje);
        if (viajeActualizado) this.validarDesvioDeRuta(viajeActualizado);
      }
    });
  }

  actualizarMarcadoresEnMapa() {
    const mapaReal = this.mapaComponente?.googleMap;
    if (!mapaReal) return;
    const g = (window as any).google.maps;
    const bounds = new g.LatLngBounds(); 

    this.viajesActivos.forEach(viaje => {
      // 🚀 Si no hay latitud actual, usamos la de origen (esperando que inicie GPS)
      const tieneGPS = viaje.latitud_actual && viaje.longitud_actual;
      const lat = tieneGPS ? parseFloat(viaje.latitud_actual) : parseFloat(viaje.latitud_origen);
      const lng = tieneGPS ? parseFloat(viaje.longitud_actual) : parseFloat(viaje.longitud_origen);

      // Si por alguna razón ni origen tiene, lo saltamos
      if (isNaN(lat) || isNaN(lng)) return;

      const coords = { lat, lng };
      bounds.extend(coords); 

      const carSvg = "M 4.671 2.929 L 5.568 0.655 C 5.759 0.17 6.326 -0.117 6.833 0.015 L 17.167 0.015 C 17.674 -0.117 18.241 0.17 18.432 0.655 L 19.329 2.929 C 19.329 2.929 21.034 4.095 21.571 4.544 C 22.108 4.992 23.498 6.554 23.834 8.283 C 24 9.176 24 10.158 24 10.158 C 24 10.871 23.518 11.439 23.018 11.439 C 22.428 11.439 22.029 11 22.029 10.519 C 22.029 9.948 21.435 9.544 20.841 9.544 C 20.355 9.544 19.865 9.948 19.865 10.519 C 19.865 11.439 19.323 12.02 18.72 12.02 L 5.28 12.02 C 4.677 12.02 4.135 11.439 4.135 10.519 C 4.135 9.948 3.645 9.544 3.159 9.544 C 2.565 9.544 1.971 9.948 1.971 10.519 C 1.971 11 1.572 11.439 0.982 11.439 C 0.482 11.439 0 10.871 0 10.158 C 0 10.158 0 9.176 0.166 8.283 C 0.502 6.554 1.892 4.992 2.429 4.544 C 2.966 4.095 4.671 2.929 4.671 2.929 Z M 5.234 3.555 L 4.417 5.626 C 4.417 5.626 5.372 6.549 6.079 6.549 L 17.921 6.549 C 18.628 6.549 19.583 5.626 19.583 5.626 L 18.766 3.555 C 18.667 3.303 18.232 3.09 17.798 3.09 L 6.202 3.09 C 5.768 3.09 5.333 3.303 5.234 3.555 Z M 4.887 8.261 C 4.113 8.261 3.486 8.888 3.486 9.663 C 3.486 10.437 4.113 11.064 4.887 11.064 C 5.662 11.064 6.289 10.437 6.289 9.663 C 6.289 8.888 5.662 8.261 4.887 8.261 Z M 19.113 8.261 C 18.338 8.261 17.711 8.888 17.711 9.663 C 17.711 10.437 18.338 11.064 19.113 11.064 C 19.887 11.064 20.514 10.437 20.514 9.663 C 20.514 8.888 19.887 8.261 19.113 8.261 Z";
      if (this.marcadoresCamiones[viaje.codigo_viaje]) {
        // 🚀 CRÍTICO: Si el simulador está corriendo para este camión, ignoramos la BD localmente para evitar tirones
        if (this.simulacionActiva && this.viajeSeleccionado?.codigo_viaje === viaje.codigo_viaje) {
           return; 
        }

        this.marcadoresCamiones[viaje.codigo_viaje].setPosition(coords);
        const icon = this.marcadoresCamiones[viaje.codigo_viaje].getIcon();
        icon.rotation = parseFloat(viaje.rumbo_actual || 0) - 90;
        icon.fillColor = tieneGPS ? '#3b82f6' : '#9ca3af';
        this.marcadoresCamiones[viaje.codigo_viaje].setIcon(icon);
      } else {
        this.marcadoresCamiones[viaje.codigo_viaje] = new g.Marker({
          position: coords,
          map: mapaReal,
          icon: {
            path: carSvg,
            scale: 1, // Auto normal más pequeño
            fillColor: tieneGPS ? '#3b82f6' : '#9ca3af', 
            fillOpacity: 1, 
            strokeWeight: 1, 
            strokeColor: '#1e293b',
            rotation: parseFloat(viaje.rumbo_actual || 0) - 90,
            anchor: new g.Point(12, 6)
          },
          title: tieneGPS ? `🚚 ${viaje.vehiculo_placa} - ${viaje.conductor_nombre}` : `🚚 ${viaje.vehiculo_placa} (Sin GPS) - ${viaje.conductor_nombre}`,
          zIndex: 999
        });
      }
    });

    // Asegurarse de que se apliquen las reglas de visibilidad al cargar nuevos datos
    this.resaltarCamionSeleccionado(this.viajeSeleccionado?.codigo_viaje);

    if (this.primeraCarga && this.viajesActivos.length > 0) {
      mapaReal.fitBounds(bounds);
      this.primeraCarga = false;
    }

    const codigosActivos = this.viajesActivos.map(v => v.codigo_viaje);
    for (const codigo in this.marcadoresCamiones) {
      if (!codigosActivos.includes(codigo)) {
        this.marcadoresCamiones[codigo].setMap(null);
        delete this.marcadoresCamiones[codigo];
      }
    }
  }

  enfocarCamion(viaje: any) {
    if (this.viajeSeleccionado?.codigo_viaje !== viaje.codigo_viaje) {
      this.detenerSimulacion(); 
    }

    this.viajeSeleccionado = viaje;
    this.alertaDesvio = null; 
    this.chequearGoogleServicios();

    const mapaReal = this.mapaComponente?.googleMap;
    if (!mapaReal) return;

    const tieneGPS = viaje.latitud_actual && viaje.longitud_actual;
    
    if (!tieneGPS) {
      Swal.fire({
        title: 'Transmisión Inactiva',
        text: 'Este vehículo aún no ha comenzado a transmitir su ubicación GPS. Se muestra temporalmente en su punto de origen.',
        icon: 'info',
        confirmButtonText: 'Entendido',
        confirmButtonColor: '#3b82f6'
      });
    }

    const lat = tieneGPS ? parseFloat(viaje.latitud_actual) : parseFloat(viaje.latitud_origen);
    const lng = tieneGPS ? parseFloat(viaje.longitud_actual) : parseFloat(viaje.longitud_origen);
    
    if (!isNaN(lat) && !isNaN(lng)) {
      const truckCoords = { lat, lng };
      mapaReal.setCenter(truckCoords);
      mapaReal.setZoom(15);
    }
    
    this.resaltarCamionSeleccionado(viaje.codigo_viaje);

    // 👇 LA RUTA AHORA ES INTELIGENTE: Usamos la ruta guardada por la IA si existe.
    if (viaje.ruta_optimizada_json && viaje.ruta_optimizada_json.length >= 2) {
      const rutaOptimizada = viaje.ruta_optimizada_json;
      const originLatLng = { lat: Number(rutaOptimizada[0].lat), lng: Number(rutaOptimizada[0].lng) };
      const destLatLng = { lat: Number(rutaOptimizada[rutaOptimizada.length - 1].lat), lng: Number(rutaOptimizada[rutaOptimizada.length - 1].lng) };
      
      const waypoints = [];
      for (let i = 1; i < rutaOptimizada.length - 1; i++) {
        waypoints.push({ location: { lat: Number(rutaOptimizada[i].lat), lng: Number(rutaOptimizada[i].lng) }, stopover: true });
      }

      const request = {
        origin: originLatLng,
        destination: destLatLng,
        waypoints: waypoints,
        optimizeWaypoints: false, // Mantener el orden estricto de la IA
        travelMode: (window as any).google.maps.TravelMode.DRIVING
      };

      this.directionsService.route(request, (response: any, status: any) => {
        this.ngZone.run(() => {
          if (status === 'OK') {
            this.directionsRenderer.setDirections(response);
            this.rutaPath = response.routes[0].overview_path;
            this.dibujarMarcadoresInicioFin(originLatLng, destLatLng, mapaReal);
            this.validarDesvioDeRuta(viaje); 
          } else {
            this.directionsRenderer.setDirections({ routes: [] });
            this.rutaPath = [];
          }
        });
      });
    } else if (viaje.latitud_origen && viaje.latitud_destino) {
      // Fallback a ruta directa si aún no ha sido optimizada
      const originLatLng = { lat: parseFloat(viaje.latitud_origen), lng: parseFloat(viaje.longitud_origen) };
      const destLatLng = { lat: parseFloat(viaje.latitud_destino), lng: parseFloat(viaje.longitud_destino) };

      const request = {
        origin: originLatLng,
        destination: destLatLng,
        travelMode: (window as any).google.maps.TravelMode.DRIVING
      };

      this.directionsService.route(request, (response: any, status: any) => {
        this.ngZone.run(() => {
          if (status === 'OK') {
            this.directionsRenderer.setDirections(response);
            this.rutaPath = response.routes[0].overview_path;
            this.dibujarMarcadoresInicioFin(originLatLng, destLatLng, mapaReal);
            this.validarDesvioDeRuta(viaje); 
          } else {
            this.directionsRenderer.setDirections({ routes: [] });
            this.rutaPath = [];
          }
        });
      });
    }
  }

  marcadoresInicioFin: any[] = [];
  dibujarMarcadoresInicioFin(origen: any, destino: any, mapa: any) {
    const g = (window as any).google.maps;
    // Limpiar anteriores
    this.marcadoresInicioFin.forEach(m => m.setMap(null));
    this.marcadoresInicioFin = [];

    // Inicio (Pin Verde Grande)
    const markerInicio = new g.Marker({
      position: origen, map: mapa,
      title: 'Inicio',
      icon: {
        url: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
        scaledSize: new g.Size(40, 40)
      },
      label: { text: 'Inicio', color: '#064e3b', fontWeight: 'bold', className: 'marker-label-top' }
    });
    this.marcadoresInicioFin.push(markerInicio);

    // Fin (Bandera a cuadros o Pin Negro)
    const markerFinal = new g.Marker({
      position: destino, map: mapa,
      title: 'Destino Final',
      icon: {
        url: 'http://maps.google.com/mapfiles/ms/icons/flag.png',
        scaledSize: new g.Size(40, 40)
      },
      label: { text: 'Final', color: '#000', fontWeight: 'bold', className: 'marker-label-bottom' }
    });
    this.marcadoresInicioFin.push(markerFinal);
  }

  validarDesvioDeRuta(viaje: any) {
    if (!this.directionsRenderer?.getDirections() || !this.directionsRenderer.getDirections().routes.length) return;
    const g = (window as any).google.maps;
    const rutaBounds = this.directionsRenderer.getDirections().routes[0].bounds;
    const tieneGPS = viaje.latitud_actual && viaje.longitud_actual;
    if (!tieneGPS) {
      this.alertaDesvio = "Esperando que inicie la transmisión GPS.";
      return;
    }

    const posActual = new g.LatLng(parseFloat(viaje.latitud_actual), parseFloat(viaje.longitud_actual));

    const toleranciaBounds = new g.LatLngBounds(
      new g.LatLng(rutaBounds.getSouthWest().lat() - 0.05, rutaBounds.getSouthWest().lng() - 0.05),
      new g.LatLng(rutaBounds.getNorthEast().lat() + 0.05, rutaBounds.getNorthEast().lng() + 0.05)
    );

    if (!toleranciaBounds.contains(posActual)) {
      this.alertaDesvio = "⚠️ ALERTA: Unidad fuera del cuadrante de la ruta asignada.";
    } else {
      this.alertaDesvio = null; 
    }
  }

  resaltarCamionSeleccionado(codigoSeleccionado: string) {
    const g = (window as any).google.maps;
    for (const codigo in this.marcadoresCamiones) {
      const marcador = this.marcadoresCamiones[codigo];
      const icon = marcador.getIcon();
      
      if (codigoSeleccionado && codigo === codigoSeleccionado) {
        // Mostrar auto seleccionado
        marcador.setVisible(true);
        icon.fillColor = '#ef4444'; 
        icon.scale = 1.3; 
        marcador.setZIndex(1000);
      } else {
        // Ocultar los autos que no son el seleccionado o si no hay selección
        marcador.setVisible(false);
      }
      marcador.setIcon(icon);
    }
  }

  // ==========================================
  // 🎮 EL SIMULADOR DE VIAJES (MODO TESTING)
  // ==========================================
  
  toggleSimulador() {
    if (this.simulacionActiva) {
      this.detenerSimulacion();
    } else {
      this.iniciarSimulacion();
    }
  }

  iniciarSimulacion() {
    if (this.rutaPath.length === 0) {
      Swal.fire('Atención', 'Traza la ruta primero seleccionando el camión.', 'warning');
      return;
    }

    this.simulacionActiva = true;
    let currentPointIndex = 0;
    let fraction = 0;
    const framesPerSegment = 20; 
    let lastBackendUpdate = Date.now();
    
    const g = (window as any).google.maps;

    this.simulacionInterval = setInterval(() => {
      if (currentPointIndex >= this.rutaPath.length - 1) {
        clearInterval(this.simulacionInterval);
        this.simulacionActiva = false;
        Swal.fire('Viaje Completado', '🏁 Simulación finalizada. El camión llegó a su destino.', 'success');
        return;
      }

      const p1 = this.rutaPath[currentPointIndex];
      const p2 = this.rutaPath[currentPointIndex + 1];
      
      const lat = p1.lat() + (p2.lat() - p1.lat()) * (fraction / framesPerSegment);
      const lng = p1.lng() + (p2.lng() - p1.lng()) * (fraction / framesPerSegment);
      const puntoInterpolado = new g.LatLng(lat, lng);

      const heading = g.geometry.spherical.computeHeading(p1, p2);

      const payload = {
        latitud_actual: lat.toFixed(7),
        longitud_actual: lng.toFixed(7),
        rumbo_actual: heading.toFixed(2),
        ultima_actualizacion_gps: new Date().toISOString()
      };

      // Animación súper fluida local (20 FPS)
      if (this.marcadoresCamiones[this.viajeSeleccionado.codigo_viaje]) {
        const icon = this.marcadoresCamiones[this.viajeSeleccionado.codigo_viaje].getIcon();
        icon.rotation = heading - 90;
        this.marcadoresCamiones[this.viajeSeleccionado.codigo_viaje].setIcon(icon);
        this.marcadoresCamiones[this.viajeSeleccionado.codigo_viaje].setPosition(puntoInterpolado);
      }

      // Actualizar a la Base de Datos solo cada 1 segundo para no saturar
      if (Date.now() - lastBackendUpdate > 1000) {
        this.viajeService.actualizarEstadoViaje(this.viajeSeleccionado.codigo_viaje, payload).subscribe();
        lastBackendUpdate = Date.now();
      }

      fraction++;
      if (fraction >= framesPerSegment) {
        currentPointIndex++;
        fraction = 0;
      }
    }, 50);
  }

  detenerSimulacion() {
    this.simulacionActiva = false;
    if (this.simulacionInterval) {
      clearInterval(this.simulacionInterval);
      this.simulacionInterval = null;
    }
  }
}