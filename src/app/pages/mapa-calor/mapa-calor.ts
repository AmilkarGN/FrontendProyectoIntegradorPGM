import { Component, OnInit, ViewChild, AfterViewInit, Inject, PLATFORM_ID, NgZone } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { GoogleMapsModule, GoogleMap } from '@angular/google-maps';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-mapa-calor',
  standalone: true,
  imports: [CommonModule, GoogleMapsModule],
  templateUrl: './mapa-calor.html',
  styleUrls: ['./mapa-calor.css']
})
export class MapaCalor implements OnInit, AfterViewInit {
  
  @ViewChild(GoogleMap, { static: false }) mapaComponente!: GoogleMap;

  // Empezamos con la "Vista Nacional" (Bolivia entera)
  center: any = { lat: -16.2901, lng: -63.5886 }; 
  zoom = 6;
  mapOptions: any = {
    mapTypeId: 'hybrid',
    disableDefaultUI: false
  };

  heatmapLayer: any = null;
  filtroActivo: string = 'todos';
  regionActiva: string = 'nacional'; // Para saber qué zona estamos mirando
  isBrowser: boolean;

  constructor(
    private ngZone: NgZone,
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  ngOnInit() {}

  ngAfterViewInit() {
    if (this.isBrowser) {
      setTimeout(() => {
        this.inicializarMapaCalor();
      }, 800);
    }
  }

  // --- ZONAS DE VUELO RÁPIDO ---
  volarARegion(region: string) {
    const mapaReal = this.mapaComponente?.googleMap;
    if (!mapaReal) return;

    this.regionActiva = region;

    // Ajustamos la cámara del mapa
    switch(region) {
      case 'nacional':
        mapaReal.panTo({ lat: -16.2901, lng: -63.5886 });
        mapaReal.setZoom(6);
        break;
      case 'eje-troncal': // La Paz - Cbba - SCZ
        mapaReal.panTo({ lat: -17.3895, lng: -66.1568 }); // Cbba al centro
        mapaReal.setZoom(7);
        break;
      case 'el-alto':
        mapaReal.panTo({ lat: -16.5050, lng: -68.1600 });
        mapaReal.setZoom(13);
        break;
      case 'frontera': // Desaguadero
        mapaReal.panTo({ lat: -16.5654, lng: -69.0402 });
        mapaReal.setZoom(14);
        break;
    }

    // Actualizamos los datos para la nueva zona
    this.actualizarCapaCalor();
  }

  // --- LÓGICA DEL MAPA DE CALOR ---
  inicializarMapaCalor() {
    if (typeof window !== 'undefined' && (window as any).google) {
      const g = (window as any).google.maps;
      
      if (!g.visualization) {
        console.error("🚨 FALTA LIBRERÍA: visualization en index.html");
        return;
      }

      this.heatmapLayer = new g.visualization.HeatmapLayer({
        data: [], // Iniciamos vacío, se llena en actualizarCapaCalor
        radius: 40,
        opacity: 0.9,
        gradient: [
          'rgba(0, 0, 0, 0)', 'rgba(0, 255, 255, 1)', 'rgba(89, 255, 0, 1)',
          'rgba(255, 255, 0, 1)', 'rgba(255, 102, 0, 1)', 'rgba(255, 0, 0, 1)'
        ]
      });

      const mapaReal = this.mapaComponente?.googleMap;
      if (mapaReal) {
        this.heatmapLayer.setMap(mapaReal);
        this.actualizarCapaCalor(); // Llenamos por primera vez
      }
    }
  }

  cambiarFiltro(tipo: string) {
    this.filtroActivo = tipo;
    this.actualizarCapaCalor();
  }

  actualizarCapaCalor() {
    if (this.heatmapLayer && typeof window !== 'undefined' && (window as any).google) {
      const g = (window as any).google.maps;
      
      // Datos estáticos
      const mockDatos = this.obtenerDatosDeBaseDeDatosFalsa(this.regionActiva, this.filtroActivo);
      let puntosLatLng = mockDatos.map((p: any) => new g.LatLng(p.lat, p.lng));
      
      // Si el filtro incluye fatiga, consultamos la API real
      if (this.filtroActivo === 'todos' || this.filtroActivo === 'fatiga') {
        this.http.get<any[]>('http://localhost:8000/api/alertas-fatiga/').subscribe({
          next: (alertas) => {
            const puntosFatiga = alertas
              .filter(a => a.latitud && a.longitud) // Solo válidos
              .map(a => new g.LatLng(parseFloat(a.latitud), parseFloat(a.longitud)));
            
            puntosLatLng = [...puntosLatLng, ...puntosFatiga];
            this.heatmapLayer.setData(puntosLatLng);
          },
          error: () => this.heatmapLayer.setData(puntosLatLng) // fallback
        });
      } else {
        // Solo datos estáticos
        this.heatmapLayer.setData(puntosLatLng);
      }
    }
  }

  // --- "BACKEND" FALSO: Simulador de llamadas a BD por región ---
  obtenerDatosDeBaseDeDatosFalsa(region: string, filtro: string) {
    if (filtro === 'fatiga') return []; // Fatiga no tiene datos falsos, solo reales
    // 1. EL ALTO (Datos de detalle, muchos puntos muy juntos)
    const elAltoBloqueos = [
      {lat: -16.503, lng: -68.160}, {lat: -16.504, lng: -68.161}, {lat: -16.505, lng: -68.162},
      {lat: -16.515, lng: -68.175}, {lat: -16.516, lng: -68.176}
    ];
    const elAltoAccidentes = [
      {lat: -16.480, lng: -68.140}, {lat: -16.481, lng: -68.141},
      {lat: -16.490, lng: -68.180}, {lat: -16.491, lng: -68.181}
    ];

    // 2. FRONTERA DESAGUADERO (Concentrado en el puente)
    const fronteraBloqueos = [
      {lat: -16.565, lng: -69.040}, {lat: -16.566, lng: -69.041}, {lat: -16.567, lng: -69.042}
    ];
    const fronteraAccidentes = [
      {lat: -16.560, lng: -69.030}, {lat: -16.562, lng: -69.035}
    ];

    // 3. EJE TRONCAL Y NACIONAL (Datos más dispersos para evitar colapso)
    const nacionalBloqueos = [
      ...elAltoBloqueos, ...fronteraBloqueos,
      {lat: -17.3895, lng: -66.1568}, {lat: -17.390, lng: -66.160}, // Cochabamba
      {lat: -17.784, lng: -63.180}, {lat: -17.785, lng: -63.181}   // Santa Cruz
    ];
    const nacionalAccidentes = [
      ...elAltoAccidentes, ...fronteraAccidentes,
      {lat: -17.400, lng: -66.150}, // Sipe Sipe
      {lat: -18.000, lng: -63.500}  // Ruta a Samaipata
    ];

    let bloqueos: any[] = [];
    let accidentes: any[] = [];

    // Filtramos por región primero
    if (region === 'el-alto') {
      bloqueos = elAltoBloqueos; accidentes = elAltoAccidentes;
    } else if (region === 'frontera') {
      bloqueos = fronteraBloqueos; accidentes = fronteraAccidentes;
    } else {
      // Para 'nacional' y 'eje-troncal'
      bloqueos = nacionalBloqueos; accidentes = nacionalAccidentes;
    }

    // Luego aplicamos el filtro de tipo (bloqueo, accidente o todos)
    if (filtro === 'bloqueos') return bloqueos;
    if (filtro === 'accidentes') return accidentes;
    return [...bloqueos, ...accidentes]; 
  }
}