import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

@Injectable({
  providedIn: 'root'
})
export class ExportService {

  constructor() { }

  exportarExcel(datos: any[], columnas: { header: string, key: string }[], nombreArchivo: string, autor: string = 'Administrador') {
    // Transformar los datos para que tengan los encabezados correctos
    const datosFormateados = datos.map(item => {
      const fila: any = {};
      columnas.forEach(col => {
        // Manejar sub-propiedades si es necesario (ej: item['cliente_detalles']?.['razon_social'])
        let valor = item;
        const llaves = col.key.split('.');
        for(let k of llaves) {
          if (valor !== undefined && valor !== null) {
            valor = valor[k];
          } else {
            valor = '';
            break;
          }
        }
        fila[col.header] = valor;
      });
      return fila;
    });

    const worksheet: XLSX.WorkSheet = XLSX.utils.json_to_sheet(datosFormateados);
    const workbook: XLSX.WorkBook = { Sheets: { 'Reporte': worksheet }, SheetNames: ['Reporte'] };
    
    // Generar archivo Excel
    XLSX.writeFile(workbook, `${nombreArchivo}.xlsx`);
  }

  exportarPDF(datos: any[], columnas: { header: string, key: string }[], titulo: string, nombreArchivo: string, autor: string = 'Administrador') {
    const doc = new jsPDF('landscape');
    
    const fechaActual = new Date().toLocaleString();

    // Título Principal
    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235); // Color primario
    doc.text(titulo, 14, 22);

    // Subtítulo con metadata
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generado por: ${autor}`, 14, 30);
    doc.text(`Fecha y Hora: ${fechaActual}`, 14, 35);
    doc.text(`Total Registros: ${datos.length}`, 14, 40);

    // Preparar columnas y filas
    const cabeceras = columnas.map(col => col.header);
    const filas = datos.map(item => {
      return columnas.map(col => {
        let valor = item;
        const llaves = col.key.split('.');
        for(let k of llaves) {
          if (valor !== undefined && valor !== null) {
            valor = valor[k];
          } else {
            valor = '';
            break;
          }
        }
        return valor ? valor.toString() : '';
      });
    });

    autoTable(doc, {
      head: [cabeceras],
      body: filas,
      startY: 45,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
    });

    doc.save(`${nombreArchivo}.pdf`);
  }

  generarFactura(reserva: any, autor: string = 'Administrador') {
    const doc = new jsPDF('portrait');
    const fechaActual = new Date().toLocaleString();

    // Encabezado Factura
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text('FACTURA COMERCIAL DE TRANSPORTE', 105, 20, { align: 'center' });

    doc.setFontSize(14);
    doc.setTextColor(37, 99, 235);
    doc.text('Transkelion S.R.L.', 105, 30, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text('NIT: 1029384756', 105, 36, { align: 'center' });
    doc.text('Av. Principal, La Paz - Bolivia', 105, 41, { align: 'center' });

    // Línea separadora
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, 46, 196, 46);

    // Datos de la Reserva y Cliente
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text('Detalles del Cliente:', 14, 55);
    doc.text('Detalles del Servicio:', 110, 55);

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const clienteNombre = reserva.cliente_detalles?.razon_social || reserva.cliente_detalles?.usuario_detalles?.nombre || 'Particular';
    const ciNit = reserva.cliente_detalles?.nit || reserva.cliente_detalles?.usuario_detalles?.ci || 'S/N';
    
    doc.text(`Señor(es): ${clienteNombre}`, 14, 63);
    doc.text(`NIT/CI: ${ciNit}`, 14, 69);
    
    doc.text(`Cód. Reserva: ${reserva.codigo_reserva}`, 110, 63);
    doc.text(`Fecha Solicitud: ${new Date(reserva.fecha_tentativa_viaje).toLocaleDateString()}`, 110, 69);
    doc.text(`Emitido por: ${autor}`, 110, 75);

    // Detalles del Trayecto y Logística
    doc.setFillColor(241, 245, 249);
    doc.rect(14, 85, 182, 45, 'F');
    
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(11);
    doc.text('Ruta y Logística', 18, 93);
    
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Origen: ${reserva.direccion_origen}`, 18, 102);
    doc.text(`Destino: ${reserva.direccion_destino}`, 18, 110);
    doc.text(`Distancia Real: ${reserva.distancia_real_km || '0'} Km`, 18, 118);

    if (reserva.viaje_detalles) {
      doc.text(`Transporte: ${reserva.viaje_detalles.vehiculo_placa || 'S/N'}`, 110, 102);
      doc.text(`Conductor: ${reserva.viaje_detalles.conductor_nombre || 'S/N'}`, 110, 110);
      doc.text(`Estado Viaje: ${reserva.viaje_detalles.estado_nombre || 'S/N'}`, 110, 118);
      if (reserva.estado_nombre === 'Entregado' && reserva.viaje_detalles.fecha_llegada_estimada) {
        doc.text(`Fecha Entrega: ${new Date(reserva.viaje_detalles.fecha_llegada_estimada).toLocaleDateString()}`, 110, 126);
      }
    } else {
      doc.text(`Transporte: Pendiente de asignación`, 110, 102);
    }

    // Cálculo de Quintales (1 qq = 45 kg)
    const pesoKg = parseFloat(reserva.peso_estimado_kg) || 0;
    const pesoQq = pesoKg / 45;
    const precioPorQq = parseFloat(reserva.tarifa_qq_aplicada) || 20.00;
    const subtotal = pesoQq * precioPorQq;

    // Tabla de Items (Carga)
    autoTable(doc, {
      startY: 140,
      head: [['Descripción del Servicio', 'Peso', 'Tipo', 'Precio Unit.', 'Subtotal']],
      body: [
        [
          `Servicio de Transporte Terrestre (Reserva: ${reserva.codigo_reserva})`, 
          `${pesoKg.toFixed(2)} kg\n(${pesoQq.toFixed(2)} qq)`, 
          reserva.es_fragil ? 'Carga Frágil' : 'Carga Normal', 
          `Bs. ${precioPorQq.toFixed(2)} / qq`, 
          `Bs. ${subtotal.toFixed(2)}`
        ]
      ],
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
    });

    // Totales y Descuentos
    let finalY = (doc as any).lastAutoTable.finalY + 10;
    
    let descuentoTotal = 0;
    const valDesc = parseFloat(reserva.valor_descuento) || 0;
    if (reserva.tipo_descuento === 'porcentaje') {
      descuentoTotal = subtotal * (valDesc / 100);
    } else if (reserva.tipo_descuento === 'monto_fijo') {
      descuentoTotal = valDesc;
    }
    
    const totalPagar = subtotal - descuentoTotal;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Subtotal: Bs. ${subtotal.toFixed(2)}`, 140, finalY);
    
    if (descuentoTotal > 0) {
      finalY += 6;
      doc.setTextColor(220, 38, 38);
      let textoMotivo = reserva.motivo_descuento ? ` (${reserva.motivo_descuento})` : '';
      doc.text(`Descuento${textoMotivo}: - Bs. ${descuentoTotal.toFixed(2)}`, 140, finalY);
    }
    
    finalY += 8;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`TOTAL A PAGAR: Bs. ${totalPagar.toFixed(2)}`, 140, finalY);

    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text('Esta es una representación impresa de un documento electrónico.', 105, 280, { align: 'center' });
    doc.text(`Generado el ${fechaActual}`, 105, 285, { align: 'center' });

    doc.save(`Factura_${reserva.codigo_reserva}.pdf`);
  }

}
