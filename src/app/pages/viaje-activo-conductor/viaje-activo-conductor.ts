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

  rutaOptimizada: any[] | null = null;

  dibujarRutaGoogleMaps() {
    if (!this.isBrowser || !this.viajeActivo || !this.viajeActivo.reservas_detalle?.length) return;
    
    const mapaReal = this.mapaComponente?.googleMap;
    if (typeof window !== 'undefined' && (window as any).google && mapaReal) {
      const g = (window as any).google.maps;
      
      if (!this.directionsService) {
        this.directionsService = new g.DirectionsService();
        this.directionsRenderer = new g.DirectionsRenderer({
          map: mapaReal,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#4f46e5', strokeWeight: 6, strokeOpacity: 0.8 }
        });
      }

      let originLatLng;
      let destLatLng;
      let waypoints: any[] = [];
      let allNodes: any[] = [];

      if (this.rutaOptimizada && this.rutaOptimizada.length >= 2) {
        // Asegurar que son números
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
        // Fallback: solo la primera reserva
        const primeraReserva = this.viajeActivo.reservas_detalle[0];
        if (primeraReserva.latitud_origen && primeraReserva.latitud_destino) {
          originLatLng = { lat: Number(primeraReserva.latitud_origen), lng: Number(primeraReserva.longitud_origen) };
          destLatLng = { lat: Number(primeraReserva.latitud_destino), lng: Number(primeraReserva.longitud_destino) };
          allNodes.push(originLatLng, destLatLng);
        } else {
          return;
        }
      }

      const request = {
        origin: originLatLng,
        destination: destLatLng,
        waypoints: waypoints,
        optimizeWaypoints: false, // ¡Crucial! No dejar que Google desordene la decisión de las Hormigas
        travelMode: g.TravelMode.DRIVING
      };

      this.directionsService.route(request, (response: any, status: any) => {
        this.ngZone.run(() => {
          if (status === 'OK') {
            this.directionsRenderer.setDirections(response);
            
            // Dibujar marcadores personalizados
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            allNodes.forEach((node, index) => {
              let labelText = "";
              let bgColor = "#ea4335"; // Red
              if (index === 0) {
                labelText = "Inicio";
                bgColor = "#10b981"; // Green
              } else if (index === allNodes.length - 1) {
                labelText = "Final";
                bgColor = "#000000"; // Black
              } else {
                labelText = alphabet[(index - 1) % alphabet.length];
              }
              
              new g.Marker({
                position: node,
                map: mapaReal,
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

          } else {
            console.warn('No se pudo trazar la ruta de Google Maps', status);
            Swal.fire('Atención', 'Google Maps no encontró ruta válida por calles para estos puntos.', 'warning');
          }
        });
      });
    }
  }

  animarSimulacionIA(callback: () => void) {
    const mapaReal = this.mapaComponente?.googleMap;
    if (!mapaReal || !this.rutaOptimizada || typeof window === 'undefined' || !(window as any).google) { 
      callback(); 
      return; 
    }
    
    const g = (window as any).google.maps;
    const nodes = this.rutaOptimizada.map((n: any) => ({ lat: Number(n.lat), lng: Number(n.lng) }));
    if (nodes.length < 2) { callback(); return; }

    const polylines: any[] = [];
    let iterations = 0;
    const maxIterations = 15; // 1.5 segundos de simulación
    
    // Enfocar el mapa al centro de los nodos
    const bounds = new g.LatLngBounds();
    nodes.forEach((n: any) => bounds.extend(n));
    mapaReal.fitBounds(bounds);
    
    const drawInterval = setInterval(() => {
      polylines.forEach(p => p.setMap(null));
      polylines.length = 0;

      // Crear permutación aleatoria "buscando ruta"
      const shuffled = [...nodes].sort(() => 0.5 - Math.random());
      
      const poly = new g.Polyline({
        path: shuffled,
        geodesic: true,
        strokeColor: '#38bdf8', // Azul celeste
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map: mapaReal
      });
      polylines.push(poly);

      iterations++;
      if (iterations >= maxIterations) {
        clearInterval(drawInterval);
        polylines.forEach(p => p.setMap(null));
        callback();
      }
    }, 100);
  }

  optimizarRutaHormigas() {
    if (!this.viajeActivo) return;

    Swal.fire({
      title: 'Buscando GPS...',
      text: 'Obteniendo tu ubicación actual para usarla como punto de partida.',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.llamarEndpointOptimizacion(pos.coords.latitude, pos.coords.longitude);
        },
        (err) => {
          console.warn('GPS no disponible, se usará el primer recojo como punto de partida.');
          this.llamarEndpointOptimizacion();
        },
        { timeout: 5000 }
      );
    } else {
      this.llamarEndpointOptimizacion();
    }
  }

  private llamarEndpointOptimizacion(lat?: number, lng?: number) {
    Swal.fire({
      title: 'IA Calculando...',
      text: 'Compitiendo: Colonia de Hormigas vs Algoritmo Genético (VRPPD).',
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading()
    });

    this.viajeService.optimizarRuta(this.viajeActivo.codigo_viaje, lat, lng).subscribe({
      next: (res: any) => {
        const aco = res.aco;
        const ga = res.ga;
        
        // Formateo de la tabla comparativa
        const tablaHtml = `
          <div style="text-align: left; margin-bottom: 15px; background: #f8fafc; padding: 10px; border-radius: 8px;">
            <p style="margin: 5px 0;">🐜 <strong>Hormigas (ACO):</strong> ${aco.distancia_km} km en ${aco.tiempo_ms} ms</p>
            <p style="margin: 5px 0;">🧬 <strong>Genéticos (GA):</strong> ${ga.distancia_km} km en ${ga.tiempo_ms} ms</p>
          </div>
          <p style="font-size: 0.9rem;">Elige qué ruta trazar en el mapa:</p>
        `;

        Swal.fire({
          icon: 'success',
          title: '¡Análisis Completado!',
          html: tablaHtml,
          showCancelButton: true,
          showDenyButton: true,
          confirmButtonText: '🐜 Usar Hormigas',
          denyButtonText: '🧬 Usar Genético',
          cancelButtonText: 'Cancelar',
          confirmButtonColor: '#4f46e5',
          denyButtonColor: '#0ea5e9'
        }).then((result) => {
          if (result.isConfirmed || result.isDenied) {
            const dataSeleccionada = result.isConfirmed ? aco : ga;
            this.rutaOptimizada = dataSeleccionada.ruta_optimizada;
            
            // 1. Calcular el tiempo total con holgura
            // Asumimos 60 km/h de promedio de conducción
            const horasConduccion = dataSeleccionada.distancia_km / 60;
            // 2 horas de holgura por cada punto de parada (reserva)
            const horasBufferCarga = (this.viajeActivo.reservas_detalle ? this.viajeActivo.reservas_detalle.length : 1) * 2;
            const horasTotal = horasConduccion + horasBufferCarga;
            
            const fechaSalida = new Date(this.viajeActivo.fecha_salida || new Date());
            const fechaLlegada = new Date(fechaSalida.getTime() + (horasTotal * 60 * 60 * 1000));
            const nuevaLlegadaISO = fechaLlegada.toISOString().slice(0, 16);

            // 2. Guardar temporalmente en el frontend
            this.payloadRutaPendiente = {
              fecha_llegada_estimada: nuevaLlegadaISO,
              ruta_optimizada_json: dataSeleccionada.ruta_optimizada,
              distancia_optimizada_km: dataSeleccionada.distancia_km
            };

            this.animarSimulacionIA(() => { this.dibujarRutaGoogleMaps(); });
          }
        });
      },
      error: (err: any) => {
        console.error('Error optimizando:', err);
        Swal.fire('Error', 'No se pudo optimizar la ruta. Inténtalo más tarde.', 'error');
      }
    });
  }

  payloadRutaPendiente: any = null;

  guardarRutaOficialConductor() {
    if (!this.payloadRutaPendiente) {
      Swal.fire('Atención', 'Primero debes trazar la ruta con IA.', 'warning');
      return;
    }
    
    this.viajeService.actualizarViaje(this.viajeActivo.codigo_viaje, this.payloadRutaPendiente).subscribe({
      next: () => {
        this.viajeActivo.fecha_llegada_estimada = this.payloadRutaPendiente.fecha_llegada_estimada; 
        Swal.fire('Ruta Confirmada', 'Tu ruta oficial se ha registrado en el sistema. ¡Buen viaje!', 'success');
        this.payloadRutaPendiente = null;
      },
      error: () => Swal.fire('Error', 'No se pudo guardar la ruta en la base de datos.', 'error')
    });
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
