import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface ColumnaFiltrable {
  campo: string; // El nombre del campo en el objeto (ej. 'peso_estimado_kg' o 'cliente_detalles.razon_social')
  nombre: string; // Nombre visible (ej. 'Peso', 'Cliente')
  tipo: 'texto' | 'numero' | 'fecha' | 'booleano'; // Determina los operadores
}

export interface ReglaFiltro {
  campo: string;
  operador: string;
  valor: any;
  tipo: string;
}

@Component({
  selector: 'app-query-builder',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './query-builder.html',
  styleUrls: ['./query-builder.css']
})
export class QueryBuilderComponent {
  @Input() columnas: ColumnaFiltrable[] = [];
  @Output() filtrosCambiados = new EventEmitter<ReglaFiltro[]>();
  @Output() togglePapelera = new EventEmitter<boolean>();

  busquedaGlobal: string = '';
  filtrosValor: { [campo: string]: any } = {};
  mostrarFiltros: boolean = false;
  viendoPapelera: boolean = false;

  toggleFiltros() {
    this.mostrarFiltros = !this.mostrarFiltros;
  }

  alternarPapelera() {
    this.viendoPapelera = !this.viendoPapelera;
    this.togglePapelera.emit(this.viendoPapelera);
  }

  emitirFiltros() {
    const reglas: ReglaFiltro[] = [];
    
    // Regla de búsqueda global
    if (this.busquedaGlobal && this.busquedaGlobal.trim() !== '') {
      reglas.push({
        campo: '*',
        operador: 'contiene',
        valor: this.busquedaGlobal.trim(),
        tipo: 'global'
      });
    }

    // Reglas específicas por columna
    for (let col of this.columnas) {
      const val = this.filtrosValor[col.campo];
      if (val !== undefined && val !== null && val !== '') {
        let operadorElegido = 'igual a';
        if (col.tipo === 'texto') operadorElegido = 'contiene';
        if (col.tipo === 'fecha') operadorElegido = 'exactamente el';
        if (col.tipo === 'booleano') operadorElegido = 'es';
        
        reglas.push({
          campo: col.campo,
          operador: operadorElegido,
          valor: val,
          tipo: col.tipo
        });
      }
    }

    this.filtrosCambiados.emit(reglas);
  }

  limpiarFiltros() {
    this.busquedaGlobal = '';
    this.filtrosValor = {};
    this.emitirFiltros();
  }
}

// Utility publico para evaluar las reglas en cualquier array
export function evaluarFiltrosDinámicos(item: any, reglas: ReglaFiltro[]): boolean {
  if (!reglas || reglas.length === 0) return true;

  for (let regla of reglas) {
    if (regla.valor === '' || regla.valor === null || regla.valor === undefined) continue;

    // Evaluador Global: busca el texto en cualquier parte del objeto (como un JSON)
    if (regla.tipo === 'global') {
      const itemString = JSON.stringify(item).toLowerCase();
      const searchStr = String(regla.valor).toLowerCase();
      if (!itemString.includes(searchStr)) return false;
      continue;
    }

    // Obtener el valor del campo dinámicamente, soporta anidación (ej: 'cliente.nombre')
    const propiedades = regla.campo.split('.');
    let valorItem = item;
    for (let prop of propiedades) {
      if (valorItem === null || valorItem === undefined) break;
      valorItem = valorItem[prop];
    }

    if (valorItem === null || valorItem === undefined) {
      // Permitimos falsy en booleanos (si el booleano es false y lo busca como false, debe pasar)
      if (regla.tipo === 'booleano' && String(regla.valor) === 'false') {
        valorItem = false;
      } else {
        return false;
      }
    }

    if (regla.tipo === 'texto') {
      const vItemStr = String(valorItem).toLowerCase();
      const vFiltroStr = String(regla.valor).toLowerCase();
      
      if (regla.operador === 'contiene' && !vItemStr.includes(vFiltroStr)) return false;
    }
    else if (regla.tipo === 'numero') {
      const vItemNum = Number(valorItem);
      const vFiltroNum = Number(regla.valor);

      if (regla.operador === 'igual a' && vItemNum !== vFiltroNum) return false;
      // Por si en el futuro se extiende el HTML para permitir > o <, mantengo la lógica:
      if (regla.operador === 'mayor que' && vItemNum <= vFiltroNum) return false;
      if (regla.operador === 'menor que' && vItemNum >= vFiltroNum) return false;
    }
    else if (regla.tipo === 'fecha') {
      if (regla.operador === 'exactamente el') {
        const iD = new Date(valorItem).toISOString().split('T')[0];
        const fD = new Date(regla.valor).toISOString().split('T')[0];
        if (iD !== fD) return false;
      }
    }
    else if (regla.tipo === 'booleano') {
      const vFiltroBool = String(regla.valor) === 'true';
      if (Boolean(valorItem) !== vFiltroBool) return false;
    }
  }

  return true; // Si pasó TODAS las reglas (AND)
}
