import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router'; 
import { CommonModule } from '@angular/common';
import Swal from 'sweetalert2'; 
import { FormsModule } from '@angular/forms';
import { RolService } from '../../services/rol';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrls: ['./register.css'] // (Asumiendo que así se llama tu CSS)
})
export class Register implements OnInit {
  
  verContrasena = false;
  verConfirmarContrasena = false;
  cargando = false;
  errorMsg = '';

  // El objeto donde guardaremos lo que el usuario escriba
  registroData = {
    nombre: '',
    apellido_paterno: '',
    ci: '',
    celular: '',
    email: '',
    username: '',
    password: '',
    confirmarPassword: ''
  };

  // Aquí guardaremos el ID secreto del rol "Cliente"
  rolClienteId: number | undefined;

  constructor(
    private authService: AuthService,
    private rolService: RolService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Cuando carga la pantalla, buscamos el ID del rol "Cliente"
    this.rolService.obtenerRoles().subscribe({
      next: (roles) => {
        const rolCliente = roles.find(r => r.nombre_rol === 'Cliente');
        if (rolCliente) {
          this.rolClienteId = rolCliente.id;
        } else {
          console.error('ALERTA: No existe el rol "Cliente" en la base de datos.');
        }
      }
    });
  }

  toggleContrasena() { this.verContrasena = !this.verContrasena; }
  toggleConfirmarContrasena() { this.verConfirmarContrasena = !this.verConfirmarContrasena; }

  registrarCuenta() {
    this.errorMsg = '';

    // Validaciones básicas
    if (this.registroData.password !== this.registroData.confirmarPassword) {
      this.errorMsg = 'Las contraseñas no coinciden.';
      return;
    }
    if (this.registroData.password.length < 6) {
      this.errorMsg = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }
    if (!this.rolClienteId) {
      this.errorMsg = 'Error del servidor: Rol de cliente no configurado. Contacte soporte.';
      return;
    }

    this.cargando = true;

    // Armamos el paquete para Django en formato JSON
    const payload = {
      username: this.registroData.username,
      email: this.registroData.email,
      nombre: this.registroData.nombre,
      apellido_paterno: this.registroData.apellido_paterno,
      ci: this.registroData.ci,
      celular: this.registroData.celular,
      password: this.registroData.password,
      rol_id: this.rolClienteId, // INYECCIÓN AUTOMÁTICA DEL ROL CLIENTE
      is_active: true
    };

    // Enviamos a guardar a través del endpoint público de registro
    this.authService.registro(payload).subscribe({
      next: () => {
        Swal.fire({
          title: '¡Registro Exitoso!',
          text: '¡Bienvenido a TransKelion! Tu cuenta ha sido creada con éxito. Ya puedes iniciar sesión.',
          icon: 'success',
          confirmButtonColor: '#4f46e5'
        }).then(() => {
          this.router.navigate(['/login']);
        });
      },
      error: (err) => {
        this.cargando = false;
        this.errorMsg = 'No se pudo crear la cuenta. Verifica que los datos sean correctos o que el usuario no exista.';
        console.error('Error de registro:', err);
      }
    });
  }
}