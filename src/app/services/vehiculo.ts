import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// --- INTERFACES ---
export interface ModeloVehiculo { id?: number; marca: string; nombre_modelo: string; anio: number; }
export interface TipoVehiculo { 
  id?: number; 
  nombre: string; 
  capacidad_carga_kg: number; 
  largo_m?: number; 
  ancho_m?: number; 
  alto_m?: number; 
  categoria_licencia_requerida?: number;
  categoria_licencia_detalles?: any;
}

export interface Vehiculo {
  placa: string; // ¡Esta es nuestra Primary Key!
  modelo: number;
  modelo_detalles?: ModeloVehiculo;
  tipo: number;
  tipo_detalles?: TipoVehiculo;
  estado: string;
  estado_detalles?: any;
  chasis?: string;
  color?: string;
  vencimiento_soat?: string;
  vencimiento_inspeccion_tecnica?: string;
  foto?: string;
  fecha_eliminacion?: string;
  eliminado_por_nombre?: string;
}
@Injectable({
  providedIn: 'root'
})

export class VehiculoService {
  private apiUrl = 'http://localhost:8000/api/vehiculos/';
  private modelosUrl = 'http://localhost:8000/api/vehiculos-modelos/';
  private tiposUrl = 'http://localhost:8000/api/vehiculos-tipos/';
  private estadosUrl = 'http://localhost:8000/api/vehiculos-estados/';


  constructor(private http: HttpClient) { }

  obtenerModelos(): Observable<ModeloVehiculo[]> { return this.http.get<ModeloVehiculo[]>(this.modelosUrl); }
  obtenerTipos(): Observable<TipoVehiculo[]> { return this.http.get<TipoVehiculo[]>(this.tiposUrl); }

  // --- CRUD VEHÍCULOS (Usamos FormData para poder enviar la foto) ---
  obtenerVehiculos(eliminados: boolean = false): Observable<Vehiculo[]> { 
    const url = eliminados ? `${this.apiUrl}?eliminados=true` : this.apiUrl;
    return this.http.get<Vehiculo[]>(url); 
  }
  
  crearVehiculo(datos: FormData): Observable<Vehiculo> { 
    return this.http.post<Vehiculo>(this.apiUrl, datos); 
  }
  
  // OJO: El ID aquí es un string (la placa)
  actualizarVehiculo(placa: string, datos: FormData | any): Observable<Vehiculo> { 
    return this.http.patch<Vehiculo>(`${this.apiUrl}${placa}/`, datos); 
  }
  
  eliminarVehiculo(placa: string): Observable<any> { 
    return this.http.delete(`${this.apiUrl}${placa}/`); 
  }

  restaurarVehiculo(placa: string): Observable<any> {
    return this.http.post(`${this.apiUrl}${placa}/restaurar/`, {});
  }
  // En src/app/services/vehiculo.service.ts

// ... (tus funciones de obtener que ya tenemos) ...

// --- CRUD MODELOS ---
crearModelo(modelo: ModeloVehiculo): Observable<ModeloVehiculo> {
  return this.http.post<ModeloVehiculo>(this.modelosUrl, modelo);
}
actualizarModelo(id: number, modelo: ModeloVehiculo): Observable<ModeloVehiculo> {
  return this.http.put<ModeloVehiculo>(`${this.modelosUrl}${id}/`, modelo);
}
eliminarModelo(id: number): Observable<any> {
  return this.http.delete(`${this.modelosUrl}${id}/`);
}

// --- CRUD TIPOS ---
crearTipo(tipo: TipoVehiculo): Observable<TipoVehiculo> {
  return this.http.post<TipoVehiculo>(this.tiposUrl, tipo);
}
actualizarTipo(id: number, tipo: TipoVehiculo): Observable<TipoVehiculo> {
  return this.http.put<TipoVehiculo>(`${this.tiposUrl}${id}/`, tipo);
}
eliminarTipo(id: number): Observable<any> {
  return this.http.delete(`${this.tiposUrl}${id}/`);
}

}