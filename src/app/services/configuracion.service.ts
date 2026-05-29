import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ConfiguracionSistema {
  id?: number;
  tarifa_base_qq: number;
}

@Injectable({
  providedIn: 'root'
})
export class ConfiguracionService {
  private apiUrl = 'http://localhost:8000/api/configuracion/';

  constructor(private http: HttpClient) { }

  obtenerConfiguracion(): Observable<ConfiguracionSistema[]> {
    return this.http.get<ConfiguracionSistema[]>(this.apiUrl);
  }

  actualizarConfiguracion(id: number, config: Partial<ConfiguracionSistema>): Observable<ConfiguracionSistema> {
    return this.http.patch<ConfiguracionSistema>(`${this.apiUrl}${id}/`, config);
  }
}
