import { Routes } from '@angular/router';
// 1. Importamos la Landing (Página de la empresa) y Auth
import { Landing } from './pages/landing/landing'; 
import { Login } from './auth/login/login'; 
import { Register } from './auth/register/register';
import { authGuard } from './guards/auth-guard';
// 2. Dashboard
import { Dashboard } from './pages/dashboard/dashboard'; 

import { permisoGuard } from './guards/permiso.guard';

// 3. Páginas Hijas 
import { Inicio } from './pages/inicio/inicio';
import { MapaVivo } from './pages/mapa-vivo/mapa-vivo';
import { MapaCalor } from './pages/mapa-calor/mapa-calor';
import { VisorCarga } from './pages/visor-carga/visor-carga';
import { CalendarioLogistico } from './pages/calendario-logistico/calendario-logistico';
import { CiudadesComponent } from './pages/ciudades/ciudades';    
import { UsuariosComponent } from './pages/usuarios/usuarios'; 
import { RolesComponent } from './pages/roles/roles'; 
import { ConductoresComponent } from './pages/conductores/conductores';
import { AsignacionesComponent } from './pages/asignaciones/asignaciones'; // <-- NUEVA PÁGINA
import { VehiculosComponent } from './pages/vehiculos/vehiculos'; 
import { ConfigFlotaComponent } from './pages/config-flota/config-flota'; 
import { ClientesComponent } from './pages/clientes/clientes'; 
import { RutasComponent } from './pages/rutas/rutas';
import { ReservasComponent } from './pages/reservas/reservas';
import { ViajesComponent } from './pages/viajes/viajes';
import { MonitorFatigaComponent } from './pages/monitor-fatiga/monitor-fatiga'; 
import { AdminFatigaComponent } from './pages/admin-fatiga/admin-fatiga';
import { AlertasComponent } from './pages/alertas/alertas'; // <-- NUEVO MÓDULO DE ALERTAS
import { PerfilConductor } from './pages/perfil-conductor/perfil-conductor';
import { ViajeActivoConductorComponent } from './pages/viaje-activo-conductor/viaje-activo-conductor';
import { DashboardConductor } from './pages/dashboard-conductor/dashboard-conductor';

export const routes: Routes = [
  // 🚀 CAMBIO PRINCIPAL: La ruta vacía ahora muestra la Landing
  { path: '', component: Landing, pathMatch: 'full' }, 

  { path: 'login', component: Login },
  { path: 'registro', component: Register },

  { 
    path: 'dashboard', 
    component: Dashboard,
    canActivate: [authGuard],
    children: [
      { path: 'inicio', component: Inicio },
      { path: 'mapa', component: MapaVivo, canActivate: [permisoGuard], data: { permiso: 'gestionar_rutas' } },
      { path: 'calor', component: MapaCalor, canActivate: [permisoGuard], data: { permiso: 'gestionar_rutas' } },
      { path: 'visor-carga', component: VisorCarga, canActivate: [permisoGuard], data: { permiso: 'gestionar_rutas' } },
      { path: 'calendario', component: CalendarioLogistico },
      { path: 'ciudades', component: CiudadesComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_rutas' } },
      
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'usuarios', component: UsuariosComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_usuarios' } },
      { path: 'roles', component: RolesComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_roles' } },
      { path: 'conductores', component: ConductoresComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_conductores' } },
      { path: 'asignaciones', component: AsignacionesComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_vehiculos' } },
      { path: 'vehiculos', component: VehiculosComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_vehiculos' } },
      { path: 'config-flota', component: ConfigFlotaComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_vehiculos' } },
      { path: 'clientes', component: ClientesComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_clientes' } },
      { path: 'rutas', component: RutasComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_rutas' } },
      { path: 'perfil', component: PerfilConductor },
      
      // Reservas y Viajes tienen permisos híbridos (los clientes pueden ver su parte, los admins todo)
      // Por eso NO les ponemos un guard restrictivo a nivel de ruta para que el cliente pueda entrar,
      // la seguridad se maneja a nivel de componente y API.
      { path: 'reservas', component: ReservasComponent },
      { path: 'viajes', component: ViajesComponent },
      
      { path: 'monitor-fatiga', component: MonitorFatigaComponent },
      { path: 'admin-fatiga', component: AdminFatigaComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_alertas' } },
      { path: 'alertas', component: AlertasComponent, canActivate: [permisoGuard], data: { permiso: 'gestionar_alertas' } },
      { path: 'dashboard-conductor', component: DashboardConductor },
      { path: 'viaje-activo', component: ViajeActivoConductorComponent }
    ]
  },
  // Si alguien escribe una URL que no existe, lo mandamos al inicio (Landing)
  { path: '**', redirectTo: '/login' }
];