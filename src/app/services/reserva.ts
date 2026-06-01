import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Reserva {
  codigo_reserva?: string;
  cliente: number;
  cliente_detalles?: any;
  ruta_macro?: number;
  ruta_macro_detalles?: any;
  
  direccion_origen: string;
  latitud_origen?: number;
  longitud_origen?: number;
  
  direccion_destino: string;
  latitud_destino?: number;
  longitud_destino?: number;
  
  distancia_real_km?: number;
  tiempo_estimado_horas?: number;
  
  fecha_tentativa_viaje: string;
  es_fragil: boolean;
  peso_estimado_kg: number;
  
  contacto_destino: string;
  telefono_destino: string;
  terminos_pago: string;
  
  // Facturación
  tarifa_qq_aplicada?: number;
  tipo_descuento?: 'ninguno' | 'porcentaje' | 'monto_fijo';
  valor_descuento?: number;
  motivo_descuento?: string;
  
  estado_reserva: number;
  estado_nombre?: string;
  fecha_creacion?: string;
  grupo_lote?: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ReservaService {
  private apiUrl = 'http://localhost:8000/api/reservas/';

  constructor(private http: HttpClient) { }

  obtenerReservas(eliminados: boolean = false): Observable<Reserva[]> {
    const url = eliminados ? `${this.apiUrl}?eliminados=true` : this.apiUrl;
    return this.http.get<Reserva[]>(url);
  }

  restaurarReserva(codigo: string): Observable<any> {
    return this.http.post(`${this.apiUrl}${codigo}/restaurar/`, {});
  }

  crearReserva(reserva: Reserva): Observable<Reserva> {
    return this.http.post<Reserva>(this.apiUrl, reserva);
  }

  actualizarReserva(codigo: string, reserva: Reserva): Observable<Reserva> {
    return this.http.put<Reserva>(`${this.apiUrl}${codigo}/`, reserva);
  }

  eliminarReserva(codigo: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}${codigo}/`);
  }
}