import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FatigaService, EstadoFatiga } from '../../services/fatiga';
import { ViajeService } from '../../services/viaje';

@Component({
  selector: 'app-monitor-fatiga',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './monitor-fatiga.html',
  styleUrls: ['./monitor-fatiga.css']
})
export class MonitorFatigaComponent implements OnInit, OnDestroy {

  streamUrl      = 'http://localhost:8000/api/fatiga/stream/';
  estado: EstadoFatiga | null = null;
  activo         = false;
  modoMalla      = false;
  modoPuntos     = false;
  // Vacío al inicio = la imagen no se renderiza, por lo tanto NO hay polling
  streamUrlCache = '';

  private _timer: any = null;
  private ultimaAlertaEnviada = 0; // Para no spammar el backend

  // Alarma sonora (se inicializa en OnInit para evitar problemas de SSR)
  alarmaAudio: any = null;
  estaSonandoAlarma = false;

  constructor(
    private fatigaService: FatigaService, 
    private viajeService: ViajeService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
      // Usamos una alarma de reloj mecánico, que es mucho más escandalosa
      this.alarmaAudio = new Audio('https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg');
      this.alarmaAudio.loop = true; // Para que suene continuamente hasta que despierte
      this.alarmaAudio.volume = 1.0; // Forzamos volumen al máximo en JS
    }
  }

  ngOnDestroy(): void {
    this._pararTimer();
    this.detenerAlarma();
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
    this.detenerAlarma();
  }

  // ── El usuario presiona DETENER ────────────────────────────────
  detener(): void {
    this.fatigaService.detener().subscribe();
    this.activo = false;
    this.streamUrlCache = '';   // Oculta la imagen (la tag *ngIf queda en false)
    if (this.estado) this.estado.estado_alerta = 'INACTIVO';
    this._pararTimer();
    this.detenerAlarma();
  }
  
  private detenerAlarma(): void {
    if (this.estaSonandoAlarma && this.alarmaAudio) {
      this.alarmaAudio.pause();
      this.alarmaAudio.currentTime = 0;
      this.estaSonandoAlarma = false;
    }
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
        
        // DISPARADOR VISUAL Y SONORO
        if (data.estado_alerta === 'MICROSUEÑO' || data.estado_alerta === 'FATIGA ACUMULADA' || data.estado_alerta === 'MICROSUEÑO DETECTADO') {
          if (!this.estaSonandoAlarma) {
            this.estaSonandoAlarma = true;
            if (this.alarmaAudio) this.alarmaAudio.play().catch((e: any) => console.log('Autoplay bloqueado', e));
          }
        } else {
          if (this.estaSonandoAlarma) {
            if (this.alarmaAudio) {
              this.alarmaAudio.pause();
              this.alarmaAudio.currentTime = 0;
            }
            this.estaSonandoAlarma = false;
          }
        }
        
        // REGISTRO EN BASE DE DATOS
        if ((data.estado_alerta === 'MICROSUEÑO' || data.estado_alerta === 'FATIGA ACUMULADA' || data.estado_alerta === 'MICROSUEÑO DETECTADO')) {
          // Evitamos spam: solo 1 registro cada 10 segundos como máximo
          const ahora = Date.now();
          if (ahora - this.ultimaAlertaEnviada > 10000) {
            this.ultimaAlertaEnviada = ahora;
            this.registrarAlerta(data.estado_alerta);
          }
        }

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

  private registrarAlerta(tipo: string): void {
    // 1. Obtenemos el viaje "En Curso"
    this.viajeService.obtenerDatosMapaVivo().subscribe(viajes => {
      if (viajes && viajes.length > 0) {
        const viajeActivo = viajes[0];
        
        // 2. Intentar obtener la ubicación real GPS del navegador actual (ej. laptop o celular en la cabina)
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              // Éxito: Tenemos la ubicación exacta y actual
              this._enviarPayload(viajeActivo.codigo_viaje, pos.coords.latitude, pos.coords.longitude);
            },
            (err) => {
              // Fallo: Usuario denegó permisos o falló el GPS, usamos la última ubicación conocida del backend
              console.warn('⚠️ No se pudo obtener GPS del navegador, usando última ubicación conocida.', err);
              this._enviarPayload(viajeActivo.codigo_viaje, viajeActivo.latitud_actual || viajeActivo.latitud_origen, viajeActivo.longitud_actual || viajeActivo.longitud_origen);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        } else {
          // Navegador no soporta geolocalización
          this._enviarPayload(viajeActivo.codigo_viaje, viajeActivo.latitud_actual || viajeActivo.latitud_origen, viajeActivo.longitud_actual || viajeActivo.longitud_origen);
        }
      } else {
        console.warn('⚠️ Alerta detectada pero no hay ningún Viaje "En Curso" para asignarle la alerta.');
      }
    });
  }

  private _enviarPayload(codigoViaje: string, lat: number, lng: number): void {
    const payload = {
      viaje: codigoViaje,
      nivel_severidad: 'Crítico', // Microsueño o Fatiga = Crítico
      latitud: Number(lat.toFixed(7)),
      longitud: Number(lng.toFixed(7))
    };
    this.http.post('http://localhost:8000/api/alertas-fatiga/', payload).subscribe({
      next: () => console.log('✅ Alerta de fatiga registrada con éxito en nueva ubicación', payload),
      error: (err) => console.error('❌ Error registrando alerta', err)
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
