document.addEventListener('DOMContentLoaded', async () => {
    // Se abre como /comprobante.html?pago=<código del pago>
    const idPago = new URLSearchParams(window.location.search).get('pago');
    const url = `/api/comprobantes/${encodeURIComponent(idPago)}`;
    const setText = (id, value) => {
        document.getElementById(id).textContent = value;
    };

    try {
        const response = await authFetch(url);
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo cargar el comprobante');
        }

        const comprobante = result.data;
        setText('numero-comprobante', comprobante.numero);
        setText('fecha-comprobante', comprobante.fecha);
        setText('hora-comprobante', comprobante.hora);
        setText('nombre-alumno', comprobante.alumno);
        setText('doc-alumno', comprobante.documento);
        setText('disciplina-alumno', comprobante.disciplinas);
        setText('concepto-pago', comprobante.concepto);
        setText('metodo-pago', comprobante.metodo_pago);
        setText('ref-pago', comprobante.referencia);
        setText('total-numero', comprobante.total);
        setText('total-letras', comprobante.total_letras);
    } catch (error) {
        // Sin pago aprobado no hay comprobante que mostrar
        document.getElementById('area-impresion').hidden = true;
        document.getElementById('btn-descargar').disabled = true;
        setText('comprobante-message', error.message);
    }

    // Vuelve a la interfaz de pagos del tesorero (Gestión de cobros)
    document.getElementById('btn-volver').addEventListener('click', () => {
        window.location.href = '/tesoreria.html';
    });

    // Descarga el recibo virtual en PDF
    document.getElementById('btn-descargar').addEventListener('click', async () => {
        setText('comprobante-message', '');
        try {
            const response = await authFetch(`${url}/pdf`);
            if (!response.ok) throw new Error();

            const link = document.createElement('a');
            link.href = URL.createObjectURL(await response.blob());
            link.download = `recibo-${idPago}.pdf`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch {
            setText('comprobante-message', 'No se pudo descargar el comprobante, intente nuevamente');
        }
    });
});
