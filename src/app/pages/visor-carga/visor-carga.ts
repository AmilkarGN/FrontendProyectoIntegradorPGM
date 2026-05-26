import { Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, NgZone, Inject, PLATFORM_ID, OnInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// No query builder imports

@Component({
  selector: 'app-visor-carga',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './visor-carga.html',
  styleUrls: ['./visor-carga.css']
})
export class VisorCarga implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvas3D') private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  
  private modeloActual: THREE.Group | null = null;
  // 👇 NUEVA VARIABLE PARA GUARDAR LAS CAJAS
  private grupoCajas: THREE.Group | null = null; 
  
  private frameId: number | null = null;
  private isBrowser: boolean;

  cargandoModelo: boolean = false;
  vehiculoSeleccionado: any = null;
  modoCargaInterna: boolean = false;

  listaFlota: any[] = [];
  cargandoDatosBD: boolean = true;

  constructor(
    private ngZone: NgZone, 
    @Inject(PLATFORM_ID) platformId: Object,
    private http: HttpClient
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  terminoBusqueda: string = '';

  get flotaFiltrada(): any[] {
    if (!this.terminoBusqueda) return this.listaFlota;
    const term = this.terminoBusqueda.toLowerCase();
    return this.listaFlota.filter(v => 
      `${v.placa} ${v.conductor} ${v.estado} ${v.tipo}`.toLowerCase().includes(term)
    );
  }

  ngOnInit(): void {
    if (this.isBrowser) {
      this.obtenerFlotaDesdeDjango();
    }
  }

  ngAfterViewInit(): void {
    if (this.isBrowser) {
      setTimeout(() => this.iniciarMotor3D(), 100);
    }
  }

  ngOnDestroy(): void {
    if (this.isBrowser) {
      if (this.frameId !== null) cancelAnimationFrame(this.frameId);
      if (this.controls) this.controls.dispose();
      if (this.renderer) this.renderer.dispose();
      window.removeEventListener('resize', this.onWindowResize.bind(this));
    }
  }

  obtenerFlotaDesdeDjango() {
    this.http.get<any[]>('http://localhost:8000/api/flota-visor3d/').subscribe({
      next: (datos) => {
        this.listaFlota = datos;
        this.cargandoDatosBD = false;
      },
      error: (err) => {
        console.error('Error obteniendo la flota de la BD:', err);
        this.cargandoDatosBD = false;
      }
    });
  }

  private iniciarMotor3D(): void {
    const canvas = this.canvasRef.nativeElement;
    this.scene = new THREE.Scene();
    
    this.camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight, 0.1, 2000);
    this.camera.position.set(10, 6, 12); 

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
    this.renderer.setClearColor(0x000000, 0); 

    const luzAmbiente = new THREE.AmbientLight(0xffffff, 1.2); 
    this.scene.add(luzAmbiente);

    const luzDireccional = new THREE.DirectionalLight(0xffffff, 2.5); 
    luzDireccional.position.set(10, 20, 15);
    this.scene.add(luzDireccional);

    const gridHelper = new THREE.GridHelper(30, 30, 0x3b82f6, 0x334155);
    this.scene.add(gridHelper);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; 
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; 

    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.animar();
  }

  seleccionarUnidad(vehiculo: any) {
    this.vehiculoSeleccionado = vehiculo;
    this.modoCargaInterna = false;

    // 👇 Limpiamos las cajas si venimos de la vista interna
    if (this.grupoCajas) {
      this.scene.remove(this.grupoCajas);
      this.grupoCajas = null;
    }

    this.cargarModelo3D(`assets/modelos/${vehiculo.modelo}`, false);
  }

  activarCargaInterna() {
    this.modoCargaInterna = true;
    this.cargarModelo3D('assets/modelos/contenedor.glb', true);

    // 👇 LLAMAMOS A LA MAGIA DESPUÉS DE MEDIO SEGUNDO (Para que el contenedor se cargue primero)
    setTimeout(() => {
      this.dibujarCarga3D(this.vehiculoSeleccionado.carga, this.vehiculoSeleccionado.cap);
    }, 500);
  }

  // --- 📦 LA FÁBRICA DE CAJAS (Algoritmo de Estiba Inteligente) ---
  private dibujarCarga3D(cargaActual: number, capacidadMaxima: number) {
    if (!this.modeloActual) return;

    const porcentaje = Math.min(cargaActual / capacidadMaxima, 1);
    if (porcentaje <= 0) return;

    // 1. ESCÁNER DEL CONTENEDOR 
    // Medimos el modelo 3D para saber cómo está construido
    const cajaContenedor = new THREE.Box3().setFromObject(this.modeloActual);
    const tamañoContenedor = cajaContenedor.getSize(new THREE.Vector3());
    const centroContenedor = cajaContenedor.getCenter(new THREE.Vector3());

    // ¿Hacia dónde apunta la parte larga del camión?
    const esLargoEnX = tamañoContenedor.x > tamañoContenedor.z;

    // 2. CÁLCULO DEL ESPACIO ÚTIL (Dejamos margen para no atravesar el metal)
    const largoUtil = (esLargoEnX ? tamañoContenedor.x : tamañoContenedor.z) * 0.85;
    const anchoUtil = (esLargoEnX ? tamañoContenedor.z : tamañoContenedor.x) * 0.70;
    const altoUtil = tamañoContenedor.y * 0.60; // Usamos el 60% de la altura total

    const tamCaja = 0.65;
    const espaciado = 0.68;

    // Calculamos cuántas cajas entran exactamente en ESTE modelo
    const maxFilas = Math.floor(largoUtil / espaciado);
    const maxCols = Math.floor(anchoUtil / espaciado);
    const maxPisos = Math.floor(altoUtil / espaciado);

    // Cantidad de cajas a dibujar según el porcentaje real de la Base de Datos
    const totalCajasVisuales = Math.floor(porcentaje * (maxFilas * maxCols * maxPisos));

    this.grupoCajas = new THREE.Group();
    const geometriaCaja = new THREE.BoxGeometry(tamCaja, tamCaja, tamCaja);
    const materialCarton = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.9 }); 
    const materialFragil = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }); 

    let cajasCreadas = 0;
    const offsetFila = (maxFilas - 1) / 2;
    const offsetCol = (maxCols - 1) / 2;

    // 3. GENERACIÓN DEL TETRIS LOGÍSTICO
    for (let piso = 0; piso < maxPisos; piso++) {
      for (let f = 0; f < maxFilas; f++) {
        for (let c = 0; c < maxCols; c++) {
          if (cajasCreadas >= totalCajasVisuales) break;

          const caja = new THREE.Mesh(geometriaCaja, Math.random() > 0.85 ? materialFragil : materialCarton);

          const posLargo = (f - offsetFila) * espaciado;
          const posAncho = (c - offsetCol) * espaciado;
          const posAlto = (piso * espaciado) + (tamCaja / 2);

          // Acomodamos mágicamente los ejes dependiendo de la rotación del modelo
          if (esLargoEnX) {
            caja.position.set(posLargo, posAlto, posAncho);
          } else {
            caja.position.set(posAncho, posAlto, posLargo);
          }

          // Rotación sutil humana
          caja.rotation.y = (Math.random() - 0.5) * 0.05;
          this.grupoCajas.add(caja);
          cajasCreadas++;
        }
      }
    }

    // 4. CENTRADO MILIMÉTRICO AL INTERIOR DEL CAMIÓN
    const cajaCarga = new THREE.Box3().setFromObject(this.grupoCajas);
    const centroCarga = cajaCarga.getCenter(new THREE.Vector3());

    this.grupoCajas.position.x = centroContenedor.x - centroCarga.x;
    this.grupoCajas.position.z = centroContenedor.z - centroCarga.z;
    
    // Altura del piso: Calculamos dónde terminan las llantas (aprox 28% de la altura total)
    const alturaPisoTrailer = cajaContenedor.min.y + (tamañoContenedor.y * 0.28);
    this.grupoCajas.position.y = alturaPisoTrailer;

    this.scene.add(this.grupoCajas);
  }
  private cargarModelo3D(ruta: string, hacerTransparente: boolean): void {
    this.cargandoModelo = true;

    if (this.modeloActual) {
      this.scene.remove(this.modeloActual);
    }

    const loader = new GLTFLoader();
    loader.load(ruta, (gltf) => {
        this.modeloActual = gltf.scene;

        const caja = new THREE.Box3().setFromObject(this.modeloActual);
        const tamaño = new THREE.Vector3();
        caja.getSize(tamaño);
        
        const escalaIdeal = 4.5 / tamaño.y;
        this.modeloActual.scale.setScalar(escalaIdeal);

        caja.setFromObject(this.modeloActual);
        const centro = caja.getCenter(new THREE.Vector3());
        
        this.modeloActual.position.x = -centro.x;
        this.modeloActual.position.y = (caja.max.y - caja.min.y) / 2 - centro.y;
        this.modeloActual.position.z = -centro.z;

        if (hacerTransparente) {
          this.modeloActual.traverse((nodo: any) => {
            if (nodo.isMesh && nodo.material) {
              nodo.material.transparent = true;
              nodo.material.opacity = 0.25; 
              nodo.material.color.setHex(0x3b82f6); 
              nodo.material.depthWrite = false; 
            }
          });
        }

        this.scene.add(this.modeloActual);
        
        this.camera.position.set(10, 6, 12);
        this.controls.target.set(0, 1, 0);

        this.ngZone.run(() => { this.cargandoModelo = false; });
      }, undefined, (error) => {
        console.error('Error cargando:', error);
        this.ngZone.run(() => { this.cargandoModelo = false; });
      }
    );
  }

  private animar = (): void => {
    this.frameId = requestAnimationFrame(this.animar);
    if (this.controls) this.controls.update();
    this.renderer.render(this.scene, this.camera);
  };

  private onWindowResize(): void {
    if (!this.isBrowser) return;
    const canvas = this.canvasRef.nativeElement;
    
    if(canvas.clientWidth > 0 && canvas.clientHeight > 0) {
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
  }
}