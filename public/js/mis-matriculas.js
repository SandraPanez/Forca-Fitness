document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('mis-matriculas-tbody');
    const panel = document.getElementById('renovar');
    const mensaje = document.getElementById('renovacion-mensaje');
    const continuar = document.getElementById('renovacion-continuar');
    let seleccionada = null;
    let renovables = [];

    function mostrarRenovacion(matricula) {
        seleccionada = matricula;
        mensaje.textContent = '';
        document.getElementById('renovacion-disciplina').value = matricula.disciplina;
        document.getElementById('renovacion-horario').value = `${matricula.dias || 'Horario actual'} ${matricula.hora_inicio?.slice(0, 5) || ''} - ${matricula.hora_fin?.slice(0, 5) || ''}`;
        const hoy = new Date().toLocaleDateString('en-CA');
        const despuesDelVencimiento = new Date(`${matricula.fecha_fin.slice(0, 10)}T00:00:00Z`).getTime() + 86400000;
        const inicio = new Date(Math.max(new Date(`${hoy}T00:00:00Z`).getTime(), despuesDelVencimiento));
        const fin = new Date(inicio.getTime() + 29 * 86400000);
        document.getElementById('renovacion-periodo').value = `${formatearFecha(inicio.toISOString())} - ${formatearFecha(fin.toISOString())}`;
        panel.hidden = false;
        continuar.focus();
        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    function abrirDesdeMenu() {
        if (window.location.hash !== '#renovar') return;
        if (renovables.length) mostrarRenovacion(renovables[0]);
        else mensaje.textContent = 'No tienes matrículas vencidas o próximas a vencer disponibles para renovar.';
    }

    document.getElementById('renovacion-cancelar').addEventListener('click', () => {
        panel.hidden = true;
        seleccionada = null;
        window.history.replaceState(null, '', window.location.pathname);
        pintarEncabezado();
    });

    document.getElementById('renovacion-form').addEventListener('submit', async event => {
        event.preventDefault();
        if (!seleccionada || continuar.disabled) return;
        continuar.disabled = true;
        mensaje.textContent = 'Comprobando disponibilidad...';
        try {
            const response = await authFetch(`/api/matriculas/mis-matriculas/${encodeURIComponent(seleccionada.id_detalle)}/renovar`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo preparar la renovación.');
            const data = result.data;
            const params = new URLSearchParams({ matricula: data.matriculaId, nombre: data.nombre,
                correo: data.correo, concepto: `Renovación - ${data.disciplinas}`, monto: String(data.monto), renovacion: '1' });
            window.location.href = `/pagos.html?${params.toString()}`;
        } catch (error) {
            mensaje.textContent = error.message;
            mensaje.focus();
            continuar.disabled = false;
        }
    });
    window.addEventListener('hashchange', abrirDesdeMenu);

    async function cargarMatriculas() {
        try {
            const response = await authFetch('/api/matriculas/mis-matriculas');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(
                    result.message || 'No se pudieron obtener las matrículas.'
                );
            }

            const matriculas = result.data || [];
            renovables = [];

            if (matriculas.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="4" class="text-center text-muted">
                            No tienes matrículas registradas.
                        </td>
                    </tr>
                `;
                abrirDesdeMenu();
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
                            <button type="button" class="btn-link btn-renovar">Renovar</button>
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
                if (renovacion) {
                    renovables.push(matricula);
                    fila.querySelector('.btn-renovar').addEventListener('click', () => mostrarRenovacion(matricula));
                }
            });
            abrirDesdeMenu();

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
    }
    await cargarMatriculas();
    window.addEventListener('focus', () => { if (!seleccionada) cargarMatriculas(); });
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

    if (estado === 'Pendiente de pago') return 'badge-proxima';

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
