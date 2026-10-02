document.addEventListener('DOMContentLoaded', () => {
    
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