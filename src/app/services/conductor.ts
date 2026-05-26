import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Usuario } from './usuario'; // Asegúrate de que la ruta sea correcta

// Reemplaza tus interfaces actuales con estas:

export interface CategoriaLicencia {
  id: number;
  nombre: string;
  permite_maquinaria_pesada: boolean;
  edad_minima?: number;
  tonelaje_maximo?: number;
  pasajeros_maximo?: number;
  antiguedad_requerida_anios?: number;
  fecha_eliminacion?: string;
  eliminado_por_nombre?: string;
}

export interface Conductor {
  id?: number;
  usuario: number; 
  usuario_detalles?: any; 
  nro_licencia: string;
  categoria_licencia: number; 
  categoria_detalles?: CategoriaLicencia; 
  fecha_emision_licencia: string; // NUEVO
  vencimiento_licencia: string; 
  
  // NUEVOS DATOS PERSONALES Y SEGURIDAD
  fecha_nacimiento: string;
  direccion: string;
  grupo_sanguineo?: string;
  contacto_emergencia_nombre: string;
  contacto_emergencia_telefono: string;
  disponible?: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class ConductorService {
  private apiUrl = 'http://localhost:8000/api/conductores/';
  private categoriasUrl = 'http://localhost:8000/api/categorias-licencia/';

  constructor(private http: HttpClient) { }

  // --- CRUD CONDUCTORES ---
  obtenerConductores(): Observable<Conductor[]> { return this.http.get<Conductor[]>(this.apiUrl); }
  crearConductor(conductor: Conductor): Observable<Conductor> { return this.http.post<Conductor>(this.apiUrl, conductor); }
  actualizarConductor(id: number, conductor: Conductor): Observable<Conductor> { return this.http.put<Conductor>(`${this.apiUrl}${id}/`, conductor); }
  eliminarConductor(id: number): Observable<any> { return this.http.delete(`${this.apiUrl}${id}/`); }

  // --- OBTENER CATEGORÍAS PARA EL SELECT ---
  obtenerCategorias(eliminados: boolean = false): Observable<CategoriaLicencia[]> {
    const url = eliminados ? `${this.categoriasUrl}?eliminados=true` : this.categoriasUrl;
    return this.http.get<CategoriaLicencia[]>(url);
  }
  
  // --- CRUD CATEGORÍAS DE LICENCIA ---
  crearCategoria(categoria: CategoriaLicencia): Observable<CategoriaLicencia> {
    return this.http.post<CategoriaLicencia>(this.categoriasUrl, categoria);
  }

  actualizarCategoria(id: number, categoria: CategoriaLicencia): Observable<CategoriaLicencia> {
    return this.http.put<CategoriaLicencia>(`${this.categoriasUrl}${id}/`, categoria);
  }

  eliminarCategoria(id: number): Observable<any> {
    return this.http.delete(`${this.categoriasUrl}${id}/`);
  }

  restaurarCategoria(id: number): Observable<any> {
    return this.http.post(`${this.categoriasUrl}${id}/restaurar/`, {});
  }
}

