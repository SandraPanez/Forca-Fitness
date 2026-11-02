document.addEventListener('DOMContentLoaded', async () => {
    const lista = document.getElementById('reservas-lista');
    const aviso = document.getElementById('reservas-aviso');
    const plantilla = document.getElementById('reserva-plantilla');

    function formatearFecha(fecha) {
        const [anio, mes, dia] = fecha.substring(0, 10).split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function crearTarjeta(reserva) {
        const tarjeta = plantilla.content.cloneNode(true);
        const horario = [reserva.dias, `${reserva.hora_inicio.slice(0, 5)} a ${reserva.hora_fin.slice(0, 5)}`]
            .filter(Boolean)
            .join(' · ');

        tarjeta.querySelector('.reserva-disciplina').textContent = reserva.disciplina;
        tarjeta.querySelector('[data-campo="horario"]').textContent = horario;
        tarjeta.querySelector('[data-campo="periodo"]').textContent =
            `${formatearFecha(reserva.fecha_inicio)} al ${formatearFecha(reserva.fecha_fin)}`;
        tarjeta.querySelector('[data-campo="tarifa"]').textContent =
            reserva.tarifa_congelada === null ? '—' : `S/ ${Number(reserva.tarifa_congelada).toFixed(2)}`;

        return tarjeta;
    }

    try {
        const response = await authFetch('/api/matriculas/mis-reservas');
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || 'No se pudieron obtener las reservas.');
        }

        const reservas = result.data || [];

        aviso.hidden = true;
        lista.append(...reservas.map(crearTarjeta));
    } catch (error) {
        aviso.textContent = error.message;
    }
});
