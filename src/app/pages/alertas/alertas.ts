import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AlertasService, AlertaItem } from '../../services/alertas.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './alertas.html',
  styleUrls: ['./alertas.css']
})
export class AlertasComponent implements OnInit {
  
  alertas: AlertaItem[] = [];
  cargando: boolean = true;

  constructor(
    private alertasService: AlertasService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Escuchamos las alertas dinámicamente
    this.alertasService.alertas$.subscribe(data => {
      this.alertas = data;
      this.cargando = false;
    });
    
    // Forzamos un recálculo fresco al entrar a la página
    this.refrescar();
  }

  refrescar(): void {
    this.cargando = true;
    this.alertasService.calcularAlertasGlobales();
  }

  mostrarDetalleCritico(alerta: AlertaItem): void {
    Swal.fire({
      title: `<span style="color: #ef4444">${alerta.titulo}</span>`,
      html: `
        <div style="text-align: left; margin-top: 15px;">
          <p><strong>Detalle:</strong> ${alerta.mensaje}</p>
          <p><strong>Fecha Referencia:</strong> ${new Date(alerta.fechaRef).toLocaleString()}</p>
          <hr style="margin: 15px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="font-size: 0.9rem; color: #6b7280;">Este evento requiere atención inmediata para evitar multas, demoras operativas o insatisfacción del cliente.</p>
        </div>
      `,
      icon: 'warning',
      confirmButtonText: 'Ir a Solucionar',
      confirmButtonColor: '#3b82f6',
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
      cancelButtonColor: '#64748b'
    }).then((result) => {
      if (result.isConfirmed) {
        this.irASeccion(alerta.enlace, alerta.registroId);
      }
    });
  }

  irASeccion(enlace: string, id: string | number): void {
    this.router.navigate([enlace], { queryParams: { alerta: id } });
  }
}
