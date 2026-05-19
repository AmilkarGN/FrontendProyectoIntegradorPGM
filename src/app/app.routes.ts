import { Routes } from '@angular/router';
// 1. Importamos la Landing (Página de la empresa) y Auth
import { Landing } from './pages/landing/landing'; 
import { Login } from './auth/login/login'; 
import { Register } from './auth/register/register';
import { authGuard } from './guards/auth-guard';
// 2. Dashboard
import { Dashboard } from './pages/dashboard/dashboard'; 

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
import { CategoriasLicenciaComponent } from './pages/categorias-licencia/categorias-licencia'; // <-- NUEVA PÁGINA
import { VehiculosComponent } from './pages/vehiculos/vehiculos'; 
import { ConfigFlotaComponent } from './pages/config-flota/config-flota'; 
import { ClientesComponent } from './pages/clientes/clientes'; 
import { RutasComponent } from './pages/rutas/rutas';
import { ReservasComponent } from './pages/reservas/reservas';
import { ViajesComponent } from './pages/viajes/viajes';
import { MonitorFatigaComponent } from './pages/monitor-fatiga/monitor-fatiga'; 

export const routes: Routes = [
  // 🚀 CAMBIO PRINCIPAL: La ruta vacía ahora muestra la Landing
  { path: '', component: Landing, pathMatch: 'full' }, 

  { path: 'login', component: Login },
  { path: 'register', component: Register },

  { 
    path: 'dashboard', 
    component: Dashboard,
    canActivate: [authGuard],
    children: [
      { path: 'inicio', component: Inicio },
      { path: 'mapa', component: MapaVivo },
      { path: 'calor', component: MapaCalor },
      { path: 'visor-carga', component: VisorCarga },
      { path: 'calendario', component: CalendarioLogistico },
      { path: 'ciudades', component: CiudadesComponent },
      
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
      { path: 'usuarios', component: UsuariosComponent },
      { path: 'roles', component: RolesComponent },
      { path: 'conductores', component: ConductoresComponent },
      { path: 'categorias-licencia', component: CategoriasLicenciaComponent },
      { path: 'vehiculos', component: VehiculosComponent },
      {path: 'config-flota', component: ConfigFlotaComponent},
      {path: 'clientes', component: ClientesComponent},
      {path: 'rutas', component: RutasComponent},
      {path: 'reservas', component: ReservasComponent},
      {path: 'viajes', component: ViajesComponent},
      {path: 'monitor-fatiga', component: MonitorFatigaComponent}
    ]
  },
  // Si alguien escribe una URL que no existe, lo mandamos al inicio (Landing)
  { path: '**', redirectTo: '/login' }
];