import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// Definimos la estructura exacta que espera y envía tu Django
export interface Ciudad {
  id?: number; // Es opcional porque al crear una ciudad nueva, aún no tiene ID
  nombre: string;
  region_estado: string;
  pais: string;
  fecha_eliminacion?: string;
  eliminado_por_nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CiudadService {
  // La URL exacta que probaste en tu navegador
  private apiUrl = 'http://localhost:8000/api/ciudades/';

  constructor(private http: HttpClient) { }

  // C (Create) - POST
  crearCiudad(ciudad: Ciudad): Observable<Ciudad> {
    return this.http.post<Ciudad>(this.apiUrl, ciudad);
  }

  // R (Read All) - GET
  obtenerCiudades(eliminados: boolean = false): Observable<Ciudad[]> {
    const url = eliminados ? `${this.apiUrl}?eliminados=true` : this.apiUrl;
    return this.http.get<Ciudad[]>(url);
  }

  // R (Read One) - GET
  obtenerCiudad(id: number): Observable<Ciudad> {
    return this.http.get<Ciudad>(`${this.apiUrl}${id}/`);
  }

  // U (Update) - PUT
  actualizarCiudad(id: number, ciudad: Ciudad): Observable<Ciudad> {
    return this.http.put<Ciudad>(`${this.apiUrl}${id}/`, ciudad);
  }

  // D (Delete) - DELETE
  eliminarCiudad(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}${id}/`);
  }

  restaurarCiudad(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${id}/restaurar/`, {});
  }
}