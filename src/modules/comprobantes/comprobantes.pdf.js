const path = require('path');
const PDFDocument = require('pdfkit');

const IMAGENES = path.join(__dirname, '..', '..', '..', 'public', 'images');
const ANCHO = 595; // ancho A4 en puntos
const ALTO = 600;
const AZUL = '#1a4a7a';

// Dibuja el "Recibo virtual" de la academia y devuelve el PDF como stream.
// Recibe los textos ya formateados: { pagador, cantidad, concepto, fecha }
function generarReciboPdf(recibo) {
  const doc = new PDFDocument({
    size: [ANCHO, ALTO],
    margin: 0,
    info: { Title: 'Recibo virtual - Academia Forca & Fitness' }
  });

  // Fondo y cabecera
  doc.rect(0, 0, ANCHO, ALTO).fill('#f4f6f6');
  doc.rect(0, 0, ANCHO, 119).fill('#000000');
  doc.image(path.join(IMAGENES, 'logo_recibo.png'), 33, 13, { width: 93 });
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(27)
    .text('RECIBO VIRTUAL', 164, 40);
  doc.fillColor('#cccccc').font('Helvetica').fontSize(12)
    .text('ACADEMIA FORCA & FITNESS', 164, 73);

  // Tarjeta blanca
  doc.lineWidth(1).rect(30, 149, 535, 431).fillAndStroke('#ffffff', '#dddddd');

  const campos = [
    ['PAGADOR', recibo.pagador],
    ['CANTIDAD', recibo.cantidad],
    ['CONCEPTO', recibo.concepto],
    ['FECHA', recibo.fecha]
  ];

  let y = 181;
  for (const [etiqueta, valor] of campos) {
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12.5).text(etiqueta, 60, y);
    // Si el texto no entra en una línea baja a la siguiente y empuja lo demás
    doc.fillColor('#333333').font('Helvetica').fontSize(15.5)
      .text(String(valor), 60, y + 21, { width: 475 });
    y = doc.y + 13;
    doc.moveTo(60, y).lineTo(535, y).lineWidth(1).strokeColor('#eeeeee').stroke();
    y += 14;
  }

  // Conformidad: firma del tesorero sobre la línea
  doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(12.5).text('CONFORMIDAD', 60, y + 22);
  doc.image(path.join(IMAGENES, 'firma_tesorero.png'), 276, y - 20, { width: 147 });
  doc.moveTo(223, y + 49).lineTo(484, y + 49).lineWidth(1.2).strokeColor('#333333').stroke();
  doc.fillColor('#888888').font('Helvetica').fontSize(11)
    .text('Firma del Tesorero', 223, y + 58, { width: 261, align: 'center' });

  doc.end();
  return doc;
}

module.exports = {
  generarReciboPdf
};
