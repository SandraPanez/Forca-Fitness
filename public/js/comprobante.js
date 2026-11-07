document.addEventListener('DOMContentLoaded', async () => {
    // Se abre como /comprobante.html?pago=<codigo del pago>
    const idPago = new URLSearchParams(window.location.search).get('pago');
    const url = `/api/comprobantes/${encodeURIComponent(idPago)}`;

    let comprobante = null;

    const setText = (id, value) => {
        document.getElementById(id).textContent = value;
    };

    const btnEnviarCorreo = document.getElementById('btn-enviar-correo');
    const btnConfirmarEnvio = document.getElementById('btn-confirmar-envio');
    const btnCancelarEnvio = document.getElementById('btn-cancelar-envio');
    const emailModal = document.getElementById('email-modal');
    const comprobanteMessage = document.getElementById('comprobante-message');

    function mostrarMensaje(texto, tipo = 'error') {
        comprobanteMessage.textContent = texto;

        if (tipo === 'success') {
            comprobanteMessage.style.color = '#198754';
        } else {
            comprobanteMessage.style.color = '';
        }
    }

    try {
        const response = await authFetch(url);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || 'No se pudo cargar el comprobante'
            );
        }

        comprobante = result.data;

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
        btnEnviarCorreo.disabled = true;
        mostrarMensaje(error.message);
    }

    // Vuelve a la interfaz de pagos del tesorero
    document.getElementById('btn-volver').addEventListener('click', () => {
        window.location.href = '/tesoreria.html';
    });

    // Descarga el recibo virtual en PDF
    document.getElementById('btn-descargar').addEventListener('click', async () => {
        mostrarMensaje('');

        try {
            const response = await authFetch(`${url}/pdf`);

            if (!response.ok) {
                throw new Error();
            }

            const link = document.createElement('a');
            link.href = URL.createObjectURL(await response.blob());
            link.download = `recibo-${idPago}.pdf`;
            link.click();

            URL.revokeObjectURL(link.href);
        } catch {
            mostrarMensaje(
                'No se pudo descargar el comprobante, intente nuevamente'
            );
        }
    });

    // Abre el modal y muestra los datos antes del envio
    btnEnviarCorreo.addEventListener('click', () => {
        if (!comprobante) {
            return;
        }

        setText(
            'email-alumno',
            comprobante.correo || 'No registrado'
        );

        setText(
            'email-comprobante',
            comprobante.numero
        );

        setText('email-message', '');

        if (!comprobante.correo) {
            setText(
                'email-message',
                'El alumno no tiene un correo registrado.'
            );

            btnConfirmarEnvio.disabled = true;
        } else {
            btnConfirmarEnvio.disabled = false;
        }

        emailModal.style.display = 'flex';
    });

    function cerrarModalEnvio() {
        emailModal.style.display = 'none';
        setText('email-message', '');
    }

    btnCancelarEnvio.addEventListener('click', cerrarModalEnvio);

    // Cierra el modal al hacer clic fuera
    emailModal.addEventListener('click', (event) => {
        if (event.target === emailModal) {
            cerrarModalEnvio();
        }
    });

    // Cierra el modal con Escape
    document.addEventListener('keydown', (event) => {
        if (
            event.key === 'Escape' &&
            emailModal.style.display === 'flex'
        ) {
            cerrarModalEnvio();
        }
    });

    // Confirma y realiza el envio real mediante HU-13
    btnConfirmarEnvio.addEventListener('click', async () => {
        if (!comprobante || !comprobante.correo) {
            return;
        }

        btnConfirmarEnvio.disabled = true;
        btnCancelarEnvio.disabled = true;

        const textoOriginal = btnConfirmarEnvio.textContent;
        btnConfirmarEnvio.textContent = 'Enviando...';

        setText(
            'email-message',
            'Enviando comprobante, espere un momento...'
        );

        try {
            const response = await authFetch(
                `${url}/enviar-correo`,
                {
                    method: 'POST'
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    'No se pudo enviar el comprobante.'
                );
            }

            cerrarModalEnvio();

            mostrarMensaje(
                `Comprobante enviado correctamente a ${comprobante.correo}.`,
                'success'
            );

            // Si ya fue enviado correctamente no se permite enviarlo otra vez.
            btnEnviarCorreo.disabled = true;
            btnEnviarCorreo.textContent = 'Comprobante enviado';
        } catch (error) {
            setText('email-message', error.message);

            // Si el backend permite otro reenvio, el usuario puede intentarlo
            // nuevamente desde este mismo modal.
            btnConfirmarEnvio.disabled = false;
        } finally {
            btnCancelarEnvio.disabled = false;
            btnConfirmarEnvio.textContent = textoOriginal;
        }
    });
});