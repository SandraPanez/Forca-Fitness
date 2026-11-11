// HU-20 T1 - Plantilla del correo de recordatorio de vencimiento.
// HTML/texto simples (el proyecto no usa motor de plantillas).

const ASUNTO_RECORDATORIO = 'Recordatorio de vencimiento - Forca & Fitness';

function escaparHtml(valor) {
  return String(valor ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 'YYYY-MM-DD' -> '14 de noviembre de 2026' sin desfase por zona horaria.
function formatearFecha(fechaIso) {
  const [anio, mes, dia] = String(fechaIso).split('-').map(Number);
  if (!anio || !mes || !dia) return String(fechaIso ?? '');
  return new Intl.DateTimeFormat('es-PE', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date(Date.UTC(anio, mes - 1, dia)));
}

function construirCorreoRecordatorio({ nombreAlumno, disciplina, fechaFin, diasRestantes }) {
  const dias = Number(diasRestantes);
  const titulo = dias === 1
    ? 'Tu matrícula vence mañana'
    : 'Tu matrícula está próxima a vencer';
  const textoDias = dias === 1 ? '1 día' : `${dias} días`;
  const nombre = String(nombreAlumno || '').trim() || 'alumno(a)';
  const fecha = formatearFecha(fechaFin);

  const text = [
    `Hola ${nombre},`,
    '',
    `${titulo}.`,
    '',
    `Disciplina: ${disciplina}`,
    `Fecha de vencimiento: ${fecha}`,
    `Días restantes: ${textoDias}`,
    '',
    'Recuerda renovar tu matrícula para seguir asistiendo a tus clases sin interrupciones.',
    'Puedes hacerlo desde "Mis matrículas" en el portal o en la recepción de la academia.',
    '',
    'Si ya realizaste tu renovación, puedes ignorar este mensaje.',
    '',
    'Forca & Fitness'
  ].join('\n');

  const html = `
<div style="font-family: Arial, Helvetica, sans-serif; color: #222; max-width: 560px; margin: 0 auto;">
  <div style="background: #111; color: #fff; padding: 16px 24px;">
    <h1 style="margin: 0; font-size: 20px;">Forca &amp; Fitness</h1>
  </div>
  <div style="padding: 24px; border: 1px solid #e5e5e5; border-top: none;">
    <p style="margin-top: 0;">Hola <strong>${escaparHtml(nombre)}</strong>,</p>
    <h2 style="font-size: 18px; color: #c62828;">${escaparHtml(titulo)}</h2>
    <table style="border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 4px 12px 4px 0; color: #555;">Disciplina</td><td style="padding: 4px 0;"><strong>${escaparHtml(disciplina)}</strong></td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #555;">Fecha de vencimiento</td><td style="padding: 4px 0;"><strong>${escaparHtml(fecha)}</strong></td></tr>
      <tr><td style="padding: 4px 12px 4px 0; color: #555;">Días restantes</td><td style="padding: 4px 0;"><strong>${escaparHtml(textoDias)}</strong></td></tr>
    </table>
    <p>Recuerda renovar tu matrícula para seguir asistiendo a tus clases sin interrupciones.
      Puedes hacerlo desde <strong>"Mis matrículas"</strong> en el portal o en la recepción de la academia.</p>
    <p style="color: #777; font-size: 13px;">Si ya realizaste tu renovación, puedes ignorar este mensaje.</p>
  </div>
  <p style="color: #999; font-size: 12px; text-align: center;">Forca &amp; Fitness · Mensaje automático, por favor no respondas a este correo.</p>
</div>`.trim();

  return { subject: ASUNTO_RECORDATORIO, text, html };
}

module.exports = {
  ASUNTO_RECORDATORIO,
  construirCorreoRecordatorio,
  formatearFecha,
  escaparHtml
};
