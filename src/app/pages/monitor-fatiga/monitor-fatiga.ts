import { Component, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FatigaService, EstadoFatiga } from '../../services/fatiga';

@Component({
  selector: 'app-monitor-fatiga',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './monitor-fatiga.html',
  styleUrls: ['./monitor-fatiga.css']
})
export class MonitorFatigaComponent implements OnDestroy {

  streamUrl      = 'http://localhost:8000/api/fatiga/stream/';
  estado: EstadoFatiga | null = null;
  activo         = false;
  modoMalla      = false;
  modoPuntos     = false;
  // Vacío al inicio = la imagen no se renderiza, por lo tanto NO hay polling
  streamUrlCache = '';

  private _timer: any = null;

  constructor(private fatigaService: FatigaService, private http: HttpClient) {}

  ngOnDestroy(): void {
    this._pararTimer();
  }

  // ── El usuario presiona INICIAR ────────────────────────────────
  iniciar(): void {
    this._pararTimer();
    // Forzar nueva conexión al stream con timestamp para evitar caché del navegador
    this.streamUrlCache = this.streamUrl + '?t=' + Date.now();
    // El polling arrancará en onStreamLoad() cuando la imagen se conecte
  }

  // ── El <img> cargó correctamente (stream activo) ────────────────
  onStreamLoad(): void {
    this.activo = true;
    this._pararTimer();
    // Polling con setInterval nativo: fácil de parar, sin problemas de rxjs
    this._timer = setInterval(() => this._pedirEstado(), 1000);
  }

  // ── El <img> falló (cámara no disponible) ───────────────────────
  onStreamError(): void {
    this.activo = false;
    this.streamUrlCache = '';
    this._pararTimer();
  }

  // ── El usuario presiona DETENER ────────────────────────────────
  detener(): void {
    this.fatigaService.detener().subscribe();
    this.activo = false;
    this.streamUrlCache = '';   // Oculta la imagen (la tag *ngIf queda en false)
    if (this.estado) this.estado.estado_alerta = 'INACTIVO';
    this._pararTimer();
  }

  // ── Toggles de visualización ───────────────────────────────────
  toggleMalla(): void {
    this.modoMalla = !this.modoMalla;
    this.fatigaService.configurar({ modo_malla: this.modoMalla }).subscribe();
  }

  togglePuntos(): void {
    this.modoPuntos = !this.modoPuntos;
    this.fatigaService.configurar({ modo_puntos: this.modoPuntos }).subscribe();
  }

  // ── Helpers privados ───────────────────────────────────────────
  private _pararTimer(): void {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  private _pedirEstado(): void {
    this.http.get<EstadoFatiga>('http://localhost:8000/api/fatiga/estado/').subscribe({
      next: (data) => {
        this.estado = data;
        // Si el backend nos dice que la cámara ya no corre, limpiar todo
        if (!data.activo) {
          this.activo = false;
          this.streamUrlCache = '';
          this._pararTimer();
        }
      },
      error: () => { /* Backend no responde, dejar así */ }
    });
  }

  // ── Clases de UI ───────────────────────────────────────────────
  esAlerta(): boolean {
    const a = this.estado?.estado_alerta || '';
    return ['MICROSUEÑO', 'FATIGA ACUMULADA', 'BOSTEZO', 'CABEZA INCLINADA'].some(k => a.includes(k));
  }

  claseEstado(): string {
    const a = this.estado?.estado_alerta || 'INACTIVO';
    if (a === 'INACTIVO')  return 'badge-inactivo';
    if (a === 'DESPIERTO') return 'badge-ok';
    if (a === 'MICROSUEÑO' || a.includes('FATIGA')) return 'badge-danger';
    return 'badge-warning';
  }

  progressClass(ratio: number): string {
    if (ratio < 0.5) return 'fill-green';
    if (ratio < 0.8) return 'fill-orange';
    return 'fill-red';
  }
}
