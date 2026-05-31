import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { ExportService } from '../../services/export.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-fatiga',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-fatiga.html',
  styleUrls: ['./admin-fatiga.css']
})
export class AdminFatigaComponent implements OnInit {
  alertas: any[] = [];
  cargando = true;
  viendoDescartadas = false;
  terminoBusqueda = '';

  constructor(
    private http: HttpClient,
    private exportService: ExportService
  ) {}

  ngOnInit() {
    this.cargarAlertas();
  }

  cargarAlertas() {
    this.cargando = true;
    const url = this.viendoDescartadas 
      ? 'http://localhost:8000/api/alertas-fatiga/descartadas/'
      : 'http://localhost:8000/api/alertas-fatiga/';
      
    this.http.get<any[]>(url).subscribe({
      next: (data) => {
        this.alertas = data;
        this.cargando = false;
      },
      error: (err) => {
        console.error('Error cargando alertas:', err);
        this.cargando = false;
        Swal.fire('Error', 'No se pudo cargar el historial de fatiga', 'error');
      }
    });
  }

  get filtrados(): any[] {
    if (!this.terminoBusqueda) return this.alertas;
    const term = this.terminoBusqueda.toLowerCase();
    return this.alertas.filter(a => {
      const searchStr = `${a.conductor_nombre} ${a.nivel_fatiga}`.toLowerCase();
      return searchStr.includes(term);
    });
  }

  toggleVista() {
    this.viendoDescartadas = !this.viendoDescartadas;
    this.cargarAlertas();
  }

  exportarListado(tipo: 'pdf' | 'excel'): void {
    const estado = this.viendoDescartadas ? 'Historial de Fatiga (Descartadas)' : 'Historial de Fatiga (Activas)';
    const columnas = [
      { header: '#', key: 'nro' },
      { header: 'ID Alerta', key: 'id' },
      { header: 'Conductor', key: 'conductor' },
      { header: 'Vehículo', key: 'vehiculo' },
      { header: 'Nivel Fatiga', key: 'nivel' },
      { header: 'Timestamp', key: 'fecha' }
    ];
    
    const datosMapeados = this.filtrados.map((a, index) => ({
      nro: index + 1,
      id: a.id,
      conductor: `${a.conductor_nombre} ${a.conductor_apellido}`,
      vehiculo: a.vehiculo_placa || 'Desconocido',
      nivel: a.nivel_severidad || a.nivel_fatiga || 'Desconocido',
      fecha: a.fecha_hora || 'Sin registro'
    }));

    const columnasExcel = columnas.filter(c => c.key !== 'nro');

    if (tipo === 'pdf') {
      this.exportService.exportarPDF(datosMapeados, columnas, estado, 'Historial_Fatiga');
    } else {
      this.exportService.exportarExcel(datosMapeados, columnasExcel, 'Historial_Fatiga');
    }
  }

  eliminarAlerta(id: number) {
    Swal.fire({
      title: '¿Descartar Alerta?',
      text: "La alerta será movida al historial de descartadas (Auditoría).",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.delete(`http://localhost:8000/api/alertas-fatiga/${id}/`).subscribe({
          next: () => {
            Swal.fire('Descartada', 'La alerta ha sido movida a la papelera.', 'success');
            this.cargarAlertas();
          },
          error: () => Swal.fire('Error', 'Hubo un problema al descartar la alerta.', 'error')
        });
      }
    });
  }

  restaurarAlerta(id: number) {
    Swal.fire({
      title: '¿Restaurar Alerta?',
      text: "¿Deseas restaurar esta alerta como válida?",
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, restaurar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        this.http.post(`http://localhost:8000/api/alertas-fatiga/${id}/restaurar/`, {}).subscribe({
          next: () => {
            Swal.fire('Restaurada', 'La alerta ha sido restaurada exitosamente.', 'success');
            this.cargarAlertas();
          },
          error: () => Swal.fire('Error', 'Hubo un problema al restaurar la alerta.', 'error')
        });
      }
    });
  }
}
