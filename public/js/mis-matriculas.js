document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('mis-matriculas-tbody');

    if (new URLSearchParams(window.location.search).get('pago') === 'pendiente') {
        document.getElementById('pago-pendiente-banner').style.display = 'block';
    }

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

            const renovacion = matricula.puede_renovar && matricula.id_detalle
                ? `
                    <div style="margin-top: 0.5rem;">
                        <button type="button" class="btn-link btn-renovar" data-detalle="${escapeHtml(matricula.id_detalle)}" data-disciplina="${escapeHtml(disciplina)}" data-fin="${escapeHtml(matricula.fecha_fin || '')}">Renovar</button>
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

        activarRenovacion(tbody);

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


// HU-08: confirmar la renovación y pasar al pago
function activarRenovacion(tbody) {
    const modal = document.getElementById('modal-renovar');
    const detalle = document.getElementById('modal-renovar-detalle');
    const error = document.getElementById('modal-renovar-error');
    const continuar = document.getElementById('modal-renovar-continuar');
    let idDetalle = null;
    const cerrar = () => { modal.style.display = 'none'; };

    tbody.addEventListener('click', event => {
        const boton = event.target.closest('.btn-renovar');
        if (!boton) return;
        idDetalle = boton.dataset.detalle;
        // Si aún está vigente, el nuevo periodo empieza al día siguiente del vencimiento
        const fin = new Date(`${boton.dataset.fin.substring(0, 10)}T00:00:00`);
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const inicio = new Date(Math.max(hoy, fin.getTime() + 86400000));
        const termino = new Date(inicio.getTime() + 30 * 86400000);
        const fmt = d => d.toLocaleDateString('es-PE');
        detalle.textContent = `${boton.dataset.disciplina}: nuevo periodo del ${fmt(inicio)} al ${fmt(termino)}. Mantienes tu mismo horario si hay cupo.`;
        error.style.display = 'none';
        continuar.disabled = false;
        modal.style.display = 'flex';
    });
    document.getElementById('modal-renovar-cancelar').addEventListener('click', cerrar);

    continuar.addEventListener('click', async () => {
        continuar.disabled = true;
        try {
            const response = await authFetch(`/api/matriculas/mis-matriculas/${encodeURIComponent(idDetalle)}/renovar`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo preparar la renovación.');
            const data = result.data;
            window.location.href = '/pagos.html?' + new URLSearchParams({
                matricula: data.matriculaId,
                nombre: data.nombre,
                correo: data.correo,
                concepto: `Renovación - ${data.disciplinas}`,
                monto: String(data.monto)
            });
        } catch (err) {
            error.textContent = err.message;
            error.style.display = 'block';
            continuar.disabled = false;
        }
    });
}


function formatearFecha(fecha) {
    const [anio, mes, dia] = fecha.substring(0, 10).split('-');

    return `${dia}/${mes}/${anio}`;
}


function obtenerClaseEstado(estado) {
    if (estado === 'Activa') {
        return 'badge-activa';
    }

    if (estado === 'Próxima a vencer' || estado === 'Pendiente de pago') {
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