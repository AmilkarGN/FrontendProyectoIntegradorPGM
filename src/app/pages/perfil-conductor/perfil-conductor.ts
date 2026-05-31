import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-perfil-conductor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './perfil-conductor.html',
  styleUrls: ['./perfil-conductor.css']
})
export class PerfilConductor implements OnInit {
  perfil: any = null;
  cargando: boolean = true;
  error: string = '';
  tabActivo: 'perfil' | 'vehiculo' = 'perfil';

  constructor(private http: HttpClient, public authService: AuthService) {}

  ngOnInit() {
    this.cargarPerfil();
  }

  cargarPerfil() {
    this.http.get('http://localhost:8000/api/conductores/mi-perfil/').subscribe({
      next: (res: any) => {
        this.perfil = res;
        this.cargando = false;
      },
      error: (err) => {
        console.error(err);
        this.error = 'No se pudo cargar la información del perfil.';
        this.cargando = false;
      }
    });
  }
}
