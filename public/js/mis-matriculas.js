document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('mis-matriculas-tbody');

    try {
        const response = await authFetch('/api/matriculas/mis-matriculas');
        const result = await response.json();

        if (!response.ok) {
            throw new Error(
                result.message || 'No se pudieron obtener las matrículas.'
            );
        }

        const matriculas = result.data || [];

        if (matriculas.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        No tienes matrículas registradas.
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = '';

        matriculas.forEach(matricula => {
            const fila = document.createElement('tr');

            const disciplina = matricula.disciplina || 'Sin disciplina';

            const fechaInicio = matricula.fecha_inicio
                ? formatearFecha(matricula.fecha_inicio)
                : 'No registrada';

            const fechaFin = matricula.fecha_fin
                ? formatearFecha(matricula.fecha_fin)
                : 'No registrada';

            const estado = matricula.estado_vigencia || 'Sin vigencia';

            const claseEstado = obtenerClaseEstado(estado);

            const diasTexto = obtenerTextoDias(
                estado,
                matricula.dias_restantes
            );

            const renovacion = estado === 'Próxima a vencer' && matricula.id_disciplina
                ? `
                    <div style="margin-top: 0.5rem;">
                        <a
                            class="btn-link"
                            href="/disciplinas.html?disciplina=${encodeURIComponent(matricula.id_disciplina)}&matricula=${encodeURIComponent(matricula.id_matricula)}"
                        >
                            Renovar
                        </a>
                    </div>
                `
                : '';

            fila.innerHTML = `
                <td>${escapeHtml(disciplina)}</td>
                <td>${escapeHtml(fechaInicio)}</td>
                <td>${escapeHtml(fechaFin)}</td>
                <td>
                    <span class="badge-status ${claseEstado}">
                        ${escapeHtml(estado)}
                    </span>
                    ${diasTexto}
                    ${renovacion}
                </td>
            `;

            tbody.appendChild(fila);
        });

    } catch (error) {
        console.error('Error cargando matrículas:', error);

        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="text-center text-muted">
                    No se pudo cargar la información de tus matrículas.
                </td>
            </tr>
        `;
    }
});


function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.substring(0, 10).split('-');

    return `${dia}/${mes}/${anio}`;
}


function obtenerClaseEstado(estado) {
    if (estado === 'Activa') {
        return 'badge-activa';
    }

    if (estado === 'Próxima a vencer') {
        return 'badge-proxima';
    }

    if (estado === 'Vencida') {
        return 'badge-vencida-hu17';
    }

    if (estado === 'Inhabilitada') {
        return 'badge-inhabilitada';
    }

    return '';
}


function obtenerTextoDias(estado, diasRestantes) {
    if (diasRestantes === null || diasRestantes === undefined) {
        return '';
    }

    if (estado === 'Vencida') {
        const diasVencida = Math.abs(diasRestantes);

        return `
            <span class="dias-text">
                Vencida hace ${diasVencida} día${diasVencida === 1 ? '' : 's'}
            </span>
        `;
    }

    if (diasRestantes === 0) {
        return `
            <span class="dias-text">
                Vence hoy
            </span>
        `;
    }

    return `
        <span class="dias-text">
            ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} restante${diasRestantes === 1 ? '' : 's'}
        </span>
    `;
}


function escapeHtml(valor) {
    return String(valor)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}