document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('historial-tbody');
    const nombre = document.getElementById('alumno-nombre');
    const permanencia = document.getElementById('permanencia');

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const formatearFecha = (fechaStr) => {
        if (!fechaStr) return 'No registrada';
        const [anio, mes, dia] = fechaStr.slice(0, 10).split('-');
        return `${dia}/${mes}/${anio}`;
    };

    const claseEstado = (estado) => {
        if (estado === 'Vencida') return 'badge-vencida';
        if (estado === 'Reservada') return 'badge-reservada';
        return 'badge-activa';
    };

    const mostrarError = (mensaje) => {
        nombre.textContent = '';
        tbody.innerHTML = `<tr><td colspan="6"><div role="alert" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(mensaje)}</div></td></tr>`;
    };

    const idAlumno = new URLSearchParams(window.location.search).get('alumno');
    if (!idAlumno) {
        mostrarError('No se indicó el alumno cuyo historial se quiere consultar.');
        return;
    }

    try {
        const response = await authFetch(`/api/alumnos/${encodeURIComponent(idAlumno)}/historial-matriculas`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            const mensaje = response.status === 403
                ? 'No tienes permisos para consultar el historial de matrículas.'
                : (result.message || 'No se pudo cargar el historial de matrículas.');
            throw new Error(mensaje);
        }

        const { alumno, permanencia: resumen, matriculas } = result.data;
        nombre.textContent = alumno.nombre_completo;

        if (resumen) {
            permanencia.textContent = `Permanencia: ${resumen.texto}`;
            permanencia.style.display = 'inline-block';
        }

        if (!matriculas.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">El alumno no tiene matrículas registradas.</td></tr>';
            return;
        }

        tbody.innerHTML = matriculas.map(m => `
            <tr>
                <td><span class="badge-disciplina-pill">${escapeHtml(m.disciplina)}</span></td>
                <td>${escapeHtml(m.horario)}</td>
                <td>${escapeHtml(formatearFecha(m.fecha_inicio))}</td>
                <td>${escapeHtml(formatearFecha(m.fecha_fin))}</td>
                <td><span class="badge-tipo ${m.tipo === 'Reserva anticipada' ? 'reserva' : ''}">${escapeHtml(m.tipo)}</span></td>
                <td><span class="badge-status ${claseEstado(m.estado)}">${escapeHtml(m.estado)}</span></td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Error cargando historial:', error);
        mostrarError(error instanceof Error ? error.message : 'Error desconocido al cargar el historial.');
    }
});