import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-fatiga',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './admin-fatiga.html',
  styleUrls: ['./admin-fatiga.css']
})
export class AdminFatigaComponent implements OnInit {
  alertas: any[] = [];
  cargando = true;
  viendoDescartadas = false;

  constructor(private http: HttpClient) {}

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

  toggleVista() {
    this.viendoDescartadas = !this.viendoDescartadas;
    this.cargarAlertas();
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
}
