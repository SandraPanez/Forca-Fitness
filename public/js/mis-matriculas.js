
document.addEventListener('DOMContentLoaded', async () => {
    const tbody = document.getElementById('mis-matriculas-tbody');

    if (!tbody) return;

    // Redirigir a la pantalla de renovación o reserva.
    if (window.location.hash === '#renovar') {
        window.location.replace('/renovar.html');
        return;
    }

    if (window.location.hash === '#reservar') {
        window.location.replace('/renovar.html?tab=reservar');
        return;
    }

    const urlParams = new URLSearchParams(window.location.search);

    // Mostrar aviso de reserva exitosa.
    if (
        urlParams.get('reserva') === 'exitosa' ||
        urlParams.get('reserva') === '1'
    ) {
        const banner = document.getElementById('reserva-banner');

        if (banner) {
            banner.style.display = 'flex';
        }
    }

    // Mostrar aviso de pago pendiente.
    if (urlParams.get('pago') === 'pendiente') {
        const banner = document.getElementById('pago-pendiente-banner');

        if (banner) {
            banner.style.display = 'flex';
        }
    }

    // Comprobar si está disponible el modal de renovación
    // de main. Si no existe, usar la página renovar.html.
    const elementosModal = [
        'modal-renovar',
        'modal-renovar-detalle',
        'modal-renovar-error',
        'modal-renovar-continuar',
        'modal-renovar-cancelar'
    ];

    const usarModalRenovacion = elementosModal.every(
        id => document.getElementById(id) !== null
    );

    if (usarModalRenovacion) {
        activarRenovacion(tbody);
    }

    // Obtener matrículas del alumno autenticado.
    async function cargarMatriculas() {
        try {
            const response = await authFetch(
                '/api/matriculas/mis-matriculas'
            );

            const result = await response.json();

            if (!response.ok || result.success === false) {
                throw new Error(
                    result.message ||
                    'No se pudieron obtener las matrículas.'
                );
            }

            const matriculas = Array.isArray(result.data)
                ? result.data
                : [];

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

                const disciplina =
                    matricula.disciplina || 'Sin disciplina';

                const fechaInicio = matricula.fecha_inicio
                    ? formatearFecha(matricula.fecha_inicio)
                    : 'No registrada';

                const fechaFin = matricula.fecha_fin
                    ? formatearFecha(matricula.fecha_fin)
                    : 'No registrada';

                const estado =
                    matricula.estado_vigencia || 'Sin vigencia';

                const claseEstado = obtenerClaseEstado(estado);

                const diasTexto = obtenerTextoDias(
                    estado,
                    matricula.dias_restantes,
                    matricula
                );

                let renovacion = '';

                if (
                    matricula.puede_renovar &&
                    matricula.id_detalle
                ) {
                    if (usarModalRenovacion) {
                        // Mantener el modal de renovación de main.
                        renovacion = `
                            <div style="margin-top: 0.5rem;">
                                <button
                                    type="button"
                                    class="btn-link btn-renovar"
                                    data-detalle="${escapeHtml(matricula.id_detalle)}"
                                    data-disciplina="${escapeHtml(disciplina)}"
                                    data-fin="${escapeHtml(matricula.fecha_fin || '')}"
                                >
                                    Renovar
                                </button>
                            </div>
                        `;
                    } else {
                        // Mantener la página de renovación de develop.
                        renovacion = `
                            <div style="margin-top: 0.5rem;">
                                <a
                                    href="/renovar.html?detalle=${encodeURIComponent(matricula.id_detalle)}"
                                    class="btn-link btn-renovar"
                                    style="text-decoration: none;"
                                >
                                    Renovar
                                </a>
                            </div>
                        `;
                    }
                }

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
            console.error(
                'Error cargando matrículas:',
                error
            );

            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        No se pudo cargar la información
                        de tus matrículas.
                    </td>
                </tr>
            `;
        }
    }

    // Cargar matrículas al abrir la página.
    await cargarMatriculas();

    // Actualizar cuando el usuario vuelve a la pestaña.
    window.addEventListener('focus', cargarMatriculas);
});


// HU-08: confirmar la renovación y pasar al pago.
// Se utiliza únicamente si existen los elementos del modal.
function activarRenovacion(tbody) {
    const modal = document.getElementById('modal-renovar');

    const detalle = document.getElementById(
        'modal-renovar-detalle'
    );

    const error = document.getElementById(
        'modal-renovar-error'
    );

    const continuar = document.getElementById(
        'modal-renovar-continuar'
    );

    const cancelar = document.getElementById(
        'modal-renovar-cancelar'
    );

    if (
        !modal ||
        !detalle ||
        !error ||
        !continuar ||
        !cancelar
    ) {
        return;
    }

    let idDetalle = null;

    const cerrar = () => {
        modal.style.display = 'none';
    };

    tbody.addEventListener('click', event => {
        const boton = event.target.closest(
            'button.btn-renovar[data-detalle]'
        );

        if (!boton) return;

        idDetalle = boton.dataset.detalle;

        const fechaFin = String(
            boton.dataset.fin || ''
        ).substring(0, 10);

        const fin = new Date(`${fechaFin}T00:00:00`);

        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);

        // Si la fecha no es válida, usar la fecha actual.
        const inicio = Number.isNaN(fin.getTime())
            ? new Date(hoy)
            : new Date(
                Math.max(
                    hoy.getTime(),
                    fin.getTime() + 86400000
                )
            );

        const termino = new Date(
            inicio.getTime() + 30 * 86400000
        );

        const fmt = fecha => fecha.toLocaleDateString('es-PE');

        detalle.textContent =
            `${boton.dataset.disciplina}: nuevo periodo ` +
            `del ${fmt(inicio)} al ${fmt(termino)}. ` +
            'Mantienes tu mismo horario si hay cupo.';

        error.style.display = 'none';
        continuar.disabled = false;
        modal.style.display = 'flex';
    });

    cancelar.addEventListener('click', cerrar);

    continuar.addEventListener('click', async () => {
        if (!idDetalle) return;

        continuar.disabled = true;

        try {
            const response = await authFetch(
                `/api/matriculas/mis-matriculas/${encodeURIComponent(idDetalle)}/renovar`,
                {
                    method: 'POST'
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message ||
                    'No se pudo preparar la renovación.'
                );
            }

            const data = result.data;

            const params = new URLSearchParams({
                matricula: data.matriculaId,
                nombre: data.nombre,
                correo: data.correo,
                concepto: `Renovación - ${data.disciplinas}`,
                monto: String(data.monto)
            });

            window.location.href =
                `/pagos.html?${params.toString()}`;

        } catch (err) {
            error.textContent = err.message;
            error.style.display = 'block';
            continuar.disabled = false;
        }
    });
}


// Dar formato a las fechas.
function formatearFecha(fecha) {
    const valor = String(fecha || '').substring(0, 10);

    const [anio, mes, dia] = valor.split('-');

    if (!anio || !mes || !dia) {
        return 'No registrada';
    }

    return `${dia}/${mes}/${anio}`;
}


// Obtener clase CSS según estado de matrícula.
function obtenerClaseEstado(estado) {
    if (estado === 'Reservada') {
        return 'badge-reservada';
    }

    if (estado === 'Activa') {
        return 'badge-activa';
    }

    if (
        estado === 'Próxima a vencer' ||
        estado === 'Pendiente de pago'
    ) {
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


// Mostrar información de los días restantes.
function obtenerTextoDias(estado, diasRestantes, matricula) {
    if (estado === 'Reservada') {
        let tarifa = '';

        if (
            matricula?.tarifa_congelada !== null &&
            matricula?.tarifa_congelada !== undefined
        ) {
            const valor = Number(matricula.tarifa_congelada);

            if (Number.isFinite(valor)) {
                tarifa = ` • Tarifa congelada: S/ ${valor.toFixed(2)}`;
            }
        }

        return `
            <div class="dias-reserva">
                <span class="dias-reserva-check">
                    ✓ Cupo reservado correctamente
                </span>

                <span class="dias-reserva-sub">
                    Inicio próximo periodo${tarifa}
                </span>
            </div>
        `;
    }

    if (
        diasRestantes === null ||
        diasRestantes === undefined
    ) {
        return '';
    }

    const dias = Number(diasRestantes);

    if (!Number.isFinite(dias)) {
        return '';
    }

    if (estado === 'Vencida') {
        const diasVencida = Math.abs(dias);

        return `
            <span class="dias-text">
                Vencida hace ${diasVencida}
                día${diasVencida === 1 ? '' : 's'}
            </span>
        `;
    }

    if (dias === 0) {
        return `
            <span class="dias-text">
                Vence hoy
            </span>
        `;
    }

    return `
        <span class="dias-text">
            ${dias}
            día${dias === 1 ? '' : 's'}
            restante${dias === 1 ? '' : 's'}
        </span>
    `;
}


// Evitar inyección de contenido HTML.
function escapeHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
