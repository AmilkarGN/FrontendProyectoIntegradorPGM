import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Rol } from './rol';

export interface Usuario {
  id?: number;
  username: string;
  email: string;
  password?: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  ci: string;
  celular: string;
  foto_perfil?: string; 
  rol_id?: number;       
  rol_detalles?: Rol; // <-- 2. AHORA USA LA INTERFAZ OFICIAL (que ya tiene nombre_rol)
  is_active?: boolean;
  fecha_eliminacion?: string;
  eliminado_por_nombre?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UsuarioService {
  private apiUrl = 'http://localhost:8000/api/usuarios/';

  constructor(private http: HttpClient) { }

  obtenerUsuarios(eliminados: boolean = false): Observable<Usuario[]> {
    const url = eliminados ? `${this.apiUrl}?eliminados=true` : this.apiUrl;
    return this.http.get<Usuario[]>(url);
  }

  crearUsuario(usuarioData: any): Observable<any> {
    return this.http.post(this.apiUrl, usuarioData);
  }

  actualizarUsuario(id: number, usuarioData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}${id}/`, usuarioData);
  }

  eliminarUsuario(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}${id}/`);
  }

  restaurarUsuario(id: number): Observable<any> {
    return this.http.post(`${this.apiUrl}${id}/restaurar/`, {});
  }
}