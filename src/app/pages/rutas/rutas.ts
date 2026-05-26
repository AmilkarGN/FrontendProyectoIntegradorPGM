import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RutaService, Ruta } from '../../services/ruta';
import { CiudadService, Ciudad } from '../../services/ciudad';
import Swal from 'sweetalert2';

import { QueryBuilderComponent, ColumnaFiltrable, ReglaFiltro, evaluarFiltrosDinámicos } from '../../shared/query-builder/query-builder';

declare const google: any; // Para usar la API de Google Maps

@Component({
  selector: 'app-rutas',
  standalone: true,
  imports: [CommonModule, FormsModule, QueryBuilderComponent],
  templateUrl: './rutas.html',
  styleUrls: ['../usuarios/usuarios.css']
})
export class RutasComponent implements OnInit {
  rutas: Ruta[] = [];
  ciudades: Ciudad[] = [];
  mostrarModal = false;
  mostrarModalMapa = false;
  rutaActual: any = {};
  rutaVer: any = {};


  constructor(
    private rutaService: RutaService,
    private ciudadService: CiudadService
  ) {}

  ngOnInit(): void {
    this.cargarDatos();
  }

  cargarDatos(): void {
    this.rutaService.obtenerRutas().subscribe(data => this.rutas = data);
    this.ciudadService.obtenerCiudades().subscribe(data => this.ciudades = data);
  }

  // --- QUERY BUILDER CONFIG ---
  columnasFiltro: ColumnaFiltrable[] = [
    { campo: 'nombre_ruta', nombre: 'Nombre de Ruta', tipo: 'texto' },
    { campo: 'origen_detalles.nombre', nombre: 'Ciudad Origen', tipo: 'texto' },
    { campo: 'destino_detalles.nombre', nombre: 'Ciudad Destino', tipo: 'texto' },
    { campo: 'distancia_km', nombre: 'Distancia (Km)', tipo: 'numero' }
  ];
  
  reglasActivas: ReglaFiltro[] = [];

  aplicarFiltros(reglas: ReglaFiltro[]) {
    this.reglasActivas = reglas;
  }

  get filtrados(): Ruta[] {
    return this.rutas.filter(r => evaluarFiltrosDinámicos(r, this.reglasActivas));
  }

  abrirModal(ruta?: Ruta): void {
    this.rutaActual = ruta ? { ...ruta } : { nombre_ruta: '', origen: null, destino: null, distancia_km: 0 };
    this.mostrarModal = true;
  }

  editarRuta(ruta: Ruta): void {
    Swal.fire({
      icon: 'info',
      title: 'Ruta Automática',
      text: 'Esta ruta fue trazada automáticamente a partir del punto de origen y destino por Google Maps. Para modificarla, elimine esta ruta y cree una nueva.',
      confirmButtonColor: '#3b82f6'
    });
  }

  verRuta(ruta: any): void {
    this.rutaVer = ruta;
    this.mostrarModalMapa = true;
    setTimeout(() => {
      this.iniciarMapaRuta(ruta);
    }, 500);
  }

  iniciarMapaRuta(ruta: any): void {
    const mapElement = document.getElementById('mapRuta');
    if (!mapElement) return;

    const map = new google.maps.Map(mapElement, {
      zoom: 6, center: { lat: -16.500, lng: -68.150 }, disableDefaultUI: true
    });
    
    const directionsService = new google.maps.DirectionsService();
    const directionsRenderer = new google.maps.DirectionsRenderer({ map: map });

    const ciudadOrigen = this.ciudades.find(c => c.id == ruta.origen);
    const ciudadDestino = this.ciudades.find(c => c.id == ruta.destino);

    if (ciudadOrigen && ciudadDestino) {
      directionsService.route({
        origin: `${ciudadOrigen.nombre}, ${ciudadOrigen.pais}`,
        destination: `${ciudadDestino.nombre}, ${ciudadDestino.pais}`,
        travelMode: google.maps.TravelMode.DRIVING
      }, (result: any, status: string) => {
        if (status === 'OK') {
          directionsRenderer.setDirections(result);
        }
      });
    }
  }

  // LÓGICA DE GOOGLE MAPS PARA CALCULAR DISTANCIA AUTOMÁTICAMENTE
  calcularDistancia(): void {
    if (!this.rutaActual.origen || !this.rutaActual.destino) return;

    const ciudadOrigen = this.ciudades.find(c => c.id == this.rutaActual.origen);
    const ciudadDestino = this.ciudades.find(c => c.id == this.rutaActual.destino);

    if (ciudadOrigen && ciudadDestino) {
      const service = new google.maps.DistanceMatrixService();
      service.getDistanceMatrix({
        origins: [`${ciudadOrigen.nombre}, ${ciudadOrigen.pais}`],
        destinations: [`${ciudadDestino.nombre}, ${ciudadDestino.pais}`],
        travelMode: google.maps.TravelMode.DRIVING,
      }, (response: any, status: string) => {
        if (status === 'OK' && response.rows[0].elements[0].status === 'OK') {
          const distanciaMetros = response.rows[0].elements[0].distance.value;
          this.rutaActual.distancia_km = (distanciaMetros / 1000).toFixed(2);
          
          // Sugerir nombre de ruta automático si está vacío
          if (!this.rutaActual.nombre_ruta) {
            this.rutaActual.nombre_ruta = `${ciudadOrigen.nombre} - ${ciudadDestino.nombre}`;
          }
        }
      });
    }
  }

  guardar(): void {
    const request = this.rutaActual.id ? 
      this.rutaService.actualizarRuta(this.rutaActual.id, this.rutaActual) : 
      this.rutaService.crearRuta(this.rutaActual);

    request.subscribe({
      next: () => {
        this.cargarDatos();
        this.mostrarModal = false;
        Swal.fire('¡Éxito!', 'Ruta guardada correctamente', 'success');
      },
      error: (err) => Swal.fire('Error', 'Hubo un problema al guardar la ruta.', 'error')
    });
  }

  eliminar(id: number | undefined): void {
    if (id) {
      Swal.fire({
        title: '¿Eliminar Ruta?',
        text: 'Si eliminas esta ruta, podrías afectar los viajes asignados a ella.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          this.rutaService.eliminarRuta(id).subscribe({
            next: () => {
              this.rutas = this.rutas.filter(r => r.id !== id);
              Swal.fire('¡Eliminada!', 'La ruta ha sido eliminada.', 'success');
            },
            error: (err) => Swal.fire('Error', 'No se pudo eliminar la ruta. Es probable que tenga viajes activos.', 'error')
          });
        }
      });
    }
  }
}