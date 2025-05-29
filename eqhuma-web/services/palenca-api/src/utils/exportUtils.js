// src/utils/exportUtils.js
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { formatDate } from './formatUtils';

/**
 * Export employment history data to PDF
 * @param {Object} data - Employment history data
 */
export const exportToPdf = async (data) => {
  try {
    // Create new PDF document
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    
    // Add header
    doc.setFontSize(16);
    doc.setTextColor(0, 51, 153);
    doc.text('SEMANAS COTIZADAS', pageWidth / 2, 15, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Reporte de Historial Laboral', pageWidth / 2, 25, { align: 'center' });
    
    // Add user information
    doc.setFontSize(12);
    doc.text(`Nombre: ${data.user_info.name}`, 20, 40);
    doc.text(`NSS: ${data.user_info.nss}`, 20, 48);
    doc.text(`CURP: ${data.user_info.curp}`, 20, 56);
    
    // Add date of report
    const currentDate = new Date().toLocaleDateString();
    doc.text(`Fecha del reporte: ${currentDate}`, pageWidth - 20, 40, { align: 'right' });
    
    // Create table
    const tableHeaders = [
      { header: 'Empresa', dataKey: 'employer' },
      { header: 'Fecha Inicio', dataKey: 'start_date' },
      { header: 'Fecha Fin', dataKey: 'end_date' },
      { header: 'Puesto', dataKey: 'position' },
      { header: 'Semanas', dataKey: 'weeks_contributed' }
    ];
    
    // Format the data for the table
    const tableData = data.employment_records.map(record => {
      return {
        employer: record.employer,
        start_date: formatDate(record.start_date),
        end_date: formatDate(record.end_date),
        position: record.position,
        weeks_contributed: record.weeks_contributed
      };
    });
    
    // Add the table to the PDF
    doc.autoTable({
      startY: 70,
      head: [['Empresa', 'Fecha Inicio', 'Fecha Fin', 'Puesto', 'Semanas']],
      body: tableData.map(row => [
        row.employer,
        row.start_date,
        row.end_date,
        row.position,
        row.weeks_contributed
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [0, 51, 153],
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      styles: {
        overflow: 'linebreak',
        cellWidth: 'wrap'
      },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 40 },
        4: { cellWidth: 20 }
      }
    });
    
    // Add summary information
    const finalY = doc.previousAutoTable.finalY + 10;
    doc.text('Resumen:', 20, finalY);
    doc.text(`Total de Registros: ${data.summary.total_records}`, 20, finalY + 8);
    doc.text(`Total de Semanas Cotizadas: ${data.summary.total_weeks_contributed}`, 20, finalY + 16);
    doc.text(`Total de Años: ${data.summary.total_years}`, 20, finalY + 24);
    
    // Add footer with disclaimer
    const footerText = 'Este documento es informativo y no sustituye el documento oficial.';
    doc.setFontSize(10);
    doc.text(footerText, pageWidth / 2, doc.internal.pageSize.height - 10, { align: 'center' });
    
    // Save the PDF
    doc.save(`Semanas_Cotizadas_${data.user_info.curp}.pdf`);
    
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};

/**
 * Export employment history data to Excel
 * @param {Object} data - Employment history data
 */
export const exportToExcel = async (data) => {
  try {
    // Create a new workbook and worksheet
    const wb = XLSX.utils.book_new();
    
    // Format the data for Excel
    const employmentRecords = data.employment_records.map((record, index) => ({
      'No.': index + 1,
      'Empresa': record.employer,
      'Fecha Inicio': formatDate(record.start_date),
      'Fecha Fin': formatDate(record.end_date),
      'Puesto': record.position,
      'Semanas Cotizadas': record.weeks_contributed
    }));
    
    // Create the main data worksheet
    const ws = XLSX.utils.json_to_sheet(employmentRecords);
    
    // Add the worksheet to the workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Historial Laboral');
    
    // Create a summary worksheet
    const summaryData = [
      { 'Resumen': 'Nombre', 'Valor': data.user_info.name },
      { 'Resumen': 'NSS', 'Valor': data.user_info.nss },
      { 'Resumen': 'CURP', 'Valor': data.user_info.curp },
      { 'Resumen': 'Total de Registros', 'Valor': data.summary.total_records },
      { 'Resumen': 'Total de Semanas Cotizadas', 'Valor': data.summary.total_weeks_contributed },
      { 'Resumen': 'Total de Años', 'Valor': data.summary.total_years }
    ];
    
    const summaryWs = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');
    
    // Generate Excel file
    XLSX.writeFile(wb, `Semanas_Cotizadas_${data.user_info.curp}.xlsx`);
    
    return true;
  } catch (error) {
    console.error('Error generating Excel file:', error);
    throw error;
  }
};