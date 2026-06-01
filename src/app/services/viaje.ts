import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ViajeService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  // --- MAESTROS ---
  obtenerAsignacionesActivas(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/asignaciones/?activas=true`); }
  obtenerEstadosViaje(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/estados-viaje/`); }
  obtenerRutas(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/rutas/`); }
  obtenerReservasPendientes(): Observable<any[]> { return this.http.get<any[]>(`${this.apiUrl}/reservas/`); }

  // --- MAPA VIVO Y RUTAS (¡Aquí está el que faltaba!) ---
  crearRuta(datosRuta: any): Observable<any> { 
    return this.http.post(`${this.apiUrl}/rutas/`, datosRuta); 
  }
  obtenerDatosMapaVivo(): Observable<any[]> { 
    return this.http.get<any[]>(`${this.apiUrl}/mapa-vivo-feed/`); 
  }

  // --- VIAJES ---
  obtenerViajes(eliminados: boolean = false): Observable<any[]> { 
    const url = eliminados ? `${this.apiUrl}/viajes/?eliminados=true` : `${this.apiUrl}/viajes/`;
    return this.http.get<any[]>(url); 
  }
  restaurarViaje(codigo: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/viajes/${codigo}/restaurar/`, {});
  }
  obtenerMisViajes(): Observable<any> { return this.http.get<any>(`${this.apiUrl}/viajes/mis-viajes/`); }
  crearViaje(datos: any): Observable<any> { return this.http.post(`${this.apiUrl}/viajes/`, datos); }
  actualizarEstadoViaje(codigo: string, datos: any): Observable<any> { return this.http.patch(`${this.apiUrl}/viajes/${codigo}/`, datos); }

  // --- VIÁTICOS ---
  crearViatico(datos: any): Observable<any> { return this.http.post(`${this.apiUrl}/viaticos/`, datos); }
  pagarViatico(id: number, datos: any): Observable<any> { return this.http.patch(`${this.apiUrl}/viaticos/${id}/`, datos); }
  // Actualizar un viaje entero (PUT o PATCH)
  actualizarViaje(codigo: string, datos: any): Observable<any> { 
    return this.http.patch(`${this.apiUrl}/viajes/${codigo}/`, datos); 
  }

  // Eliminar un viaje (DELETE)
  eliminarViaje(codigo: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/viajes/${codigo}/`);
  }

  // --- OPTIMIZACIÓN IA ---
  optimizarRuta(codigo: string, latActual?: number, lngActual?: number): Observable<any> {
    let url = `${this.apiUrl}/viajes/${codigo}/optimizar_ruta/`;
    if (latActual && lngActual) {
      url += `?lat_actual=${latActual}&lng_actual=${lngActual}`;
    }
    return this.http.get<any>(url);
  }
  // ==========================================
  // 📡 MOTOR GLOBAL DE RASTREO GPS
  // ==========================================
  
  viajeEnRastreoActual: string | null = null;
  private watchId: number | null = null;

  iniciarRastreoGlobal(codigoViaje: string, cbExito: Function, cbError: Function) {
    if (!navigator.geolocation) {
      cbError('Tu navegador no soporta GPS');
      return;
    }

    this.viajeEnRastreoActual = codigoViaje;

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const payload = {
          latitud_actual: position.coords.latitude.toFixed(7),
          longitud_actual: position.coords.longitude.toFixed(7),
          rumbo_actual: position.coords.heading ? position.coords.heading.toFixed(2) : 0,
          ultima_actualizacion_gps: new Date().toISOString()
        };

        this.actualizarEstadoViaje(codigoViaje, payload).subscribe({
          next: () => cbExito(payload),
          error: (err) => console.error('Error enviando GPS al backend', err)
        });
      },
      (error) => {
        console.error('Error GPS:', error);
        this.detenerRastreoGlobal();
        cbError(error.message);
      },
      // 🔥 LA SOLUCIÓN AL ERROR 3: Le damos 30 segundos (30000ms) para ubicarte
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 } 
    );
  }

  detenerRastreoGlobal() {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.viajeEnRastreoActual = null;
  }
  
}
