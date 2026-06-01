import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Ruta {
  id?: number;
  nombre_ruta: string;
  origen: number;
  origen_detalles?: any;
  destino: number;
  destino_detalles?: any;
  distancia_km: number;
}

@Injectable({
  providedIn: 'root'
})
export class RutaService {
  private apiUrl = 'http://localhost:8000/api/rutas/';

  constructor(private http: HttpClient) { }

  obtenerRutas(eliminados: boolean = false): Observable<Ruta[]> {
    const url = eliminados ? `${this.apiUrl}?eliminados=true` : this.apiUrl;
    return this.http.get<Ruta[]>(url);
  }

  restaurarRuta(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${id}/restaurar/`, {});
  }

  crearRuta(ruta: Ruta): Observable<Ruta> {
    return this.http.post<Ruta>(this.apiUrl, ruta);
  }

  actualizarRuta(id: number, ruta: Ruta): Observable<Ruta> {
    return this.http.put<Ruta>(`${this.apiUrl}${id}/`, ruta);
  }

  eliminarRuta(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}${id}/`);
  }
}