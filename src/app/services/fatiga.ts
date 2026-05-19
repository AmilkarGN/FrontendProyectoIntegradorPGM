import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval } from 'rxjs';
import { switchMap } from 'rxjs/operators';

export interface EstadoFatiga {
  nombre:        string;
  estado_alerta: string;
  ear:           number;
  mar:           number;
  perclos:       number;
  blink_total:   number;
  angulo:        number;
  fps:           number;
  activo:        boolean;
}

@Injectable({ providedIn: 'root' })
export class FatigaService {
  private base = 'http://localhost:8000/api/fatiga';

  streamUrl  = `${this.base}/stream/`;
  estadoUrl  = `${this.base}/estado/`;
  detenerUrl = `${this.base}/detener/`;
  configurarUrl = `${this.base}/configurar/`;

  constructor(private http: HttpClient) {}

  /** Polling del estado cada N ms */
  pollingEstado(ms = 1000): Observable<EstadoFatiga> {
    return interval(ms).pipe(
      switchMap(() => this.http.get<EstadoFatiga>(this.estadoUrl))
    );
  }

  detener(): Observable<any> {
    return this.http.post(this.detenerUrl, {});
  }

  configurar(opciones: { modo_malla?: boolean, modo_puntos?: boolean }): Observable<any> {
    return this.http.post(this.configurarUrl, opciones);
  }
}
