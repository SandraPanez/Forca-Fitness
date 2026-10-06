document.addEventListener('DOMContentLoaded', async () => {
    // Se abre como /comprobante.html?pago=<código del pago>
    const idPago = new URLSearchParams(window.location.search).get('pago');

    try {
        const response = await authFetch(`/api/comprobantes/${encodeURIComponent(idPago)}`);
        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo cargar el comprobante');
        }
    } catch (error) {
        // Sin pago aprobado no hay comprobante que mostrar
        document.getElementById('area-impresion').hidden = true;
        document.getElementById('btn-descargar').disabled = true;
        document.getElementById('comprobante-message').textContent = error.message;
    }
    
    const hoy = new Date();
    
    const fechaElemento = document.getElementById('fecha-comprobante');
    fechaElemento.textContent = hoy.toLocaleDateString('sv-SE'); // Formato YYYY-MM-DD

    const horaElemento = document.getElementById('hora-comprobante');
    horaElemento.textContent = hoy.toLocaleTimeString('es-PE', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
    }).replace('a. m.', 'a. m.').replace('p. m.', 'p. m.');

    document.getElementById('btn-volver').addEventListener('click', () => {
        window.location.href = 'index.html'; 
    });

    document.getElementById('btn-descargar').addEventListener('click', () => {
        window.print();
    });
});