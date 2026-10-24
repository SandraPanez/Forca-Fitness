document.addEventListener('DOMContentLoaded', async () => {
    // Tarjetas interactivas de selección
    const cardTipoRenovar = document.getElementById('card-tipo-renovar');
    const cardTipoReservar = document.getElementById('card-tipo-reservar');
    const panelRenovarActual = document.getElementById('panel-renovar-actual');
    const panelReservarCupo = document.getElementById('panel-reservar-cupo');
    const btnIrAReservar = document.getElementById('btn-ir-a-reservar');

    // Elementos de Renovación
    const formRenovacion = document.getElementById('renovacion-form');
    const sinRenovacionBox = document.getElementById('sin-renovacion-box');
    const selectorMatriculaGroup = document.getElementById('selector-matricula-group');
    const selectMatriculaRenovar = document.getElementById('select-matricula-renovar');
    const inputDisciplina = document.getElementById('renovacion-disciplina');
    const inputHorario = document.getElementById('renovacion-horario');
    const inputPeriodo = document.getElementById('renovacion-periodo');
    const btnContinuarRenovacion = document.getElementById('renovacion-continuar');
    const mensajeRenovacion = document.getElementById('renovacion-mensaje');

    // Elementos de Reserva (HU-09)
    const selectReservaDisciplina = document.getElementById('reserva-disciplina-select');
    const selectReservaPeriodo = document.getElementById('reserva-periodo-select');
    const horariosReservaGrid = document.getElementById('reserva-horarios-grid');
    const resumenReservaContainer = document.getElementById('resumen-disciplina-container');

    // Modal Confirmar Reserva (PSW-201 / CA 1)
    const modalConfirmar = document.getElementById('modal-confirmar-reserva');
    const btnCancelarReserva = document.getElementById('btn-cancelar-reserva');
    const btnContinuarPago = document.getElementById('btn-continuar-pago');
    const modalReservaDisciplina = document.getElementById('modal-reserva-disciplina');
    const modalReservaHorario = document.getElementById('modal-reserva-horario');
    const modalReservaPeriodo = document.getElementById('modal-reserva-periodo');
    const modalReservaTarifa = document.getElementById('modal-reserva-tarifa');

    let renovables = [];
    let matriculaSeleccionada = null;
    let reservaData = null;
    let selectedReservation = null;
    let reservaInicializada = false;

    const urlParams = new URLSearchParams(window.location.search);
    const detalleParam = urlParams.get('detalle');
    const tabInicial = urlParams.get('tab') || (window.location.hash === '#reservar' ? 'reservar' : 'renovar');

    // --- Formato de Horas y Días ---
    function formatHora12(horaStr) {
        if (!horaStr) return '';
        const parts = horaStr.split(':');
        let h = parseInt(parts[0], 10);
        const m = parts[1] || '00';
        const ampm = h >= 12 ? 'p. m.' : 'a. m.';
        h = h % 12;
        if (h === 0) h = 12;
        return `${h}:${m} ${ampm}`;
    }

    function formatDias(diasStr) {
        if (!diasStr) return '';
        const d = diasStr.trim();
        if (d === 'L-M-V') return 'Lunes / Miércoles / Viernes';
        if (d === 'M-J') return 'Martes / Jueves';
        if (d === 'S-D') return 'Sábados / Domingos';
        if (d === 'L-M-M-J-V') return 'Lunes a Viernes';
        return d;
    }

    function formatearFecha(fecha) {
        if (!fecha) return '';
        const [anio, mes, dia] = fecha.substring(0, 10).split('-');
        return `${dia}/${mes}/${anio}`;
    }

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Alternar Selección: Renovar vs Reservar ---
    function activarTab(tab) {
        if (tab === 'renovar') {
            if (cardTipoRenovar) cardTipoRenovar.classList.add('active');
            if (cardTipoReservar) cardTipoReservar.classList.remove('active');
            if (panelRenovarActual) panelRenovarActual.style.display = 'block';
            if (panelReservarCupo) panelReservarCupo.style.display = 'none';
        } else {
            if (cardTipoReservar) cardTipoReservar.classList.add('active');
            if (cardTipoRenovar) cardTipoRenovar.classList.remove('active');
            if (panelRenovarActual) panelRenovarActual.style.display = 'none';
            if (panelReservarCupo) panelReservarCupo.style.display = 'block';

            if (!reservaInicializada) {
                initReservaFlow();
            }
        }
    }

    if (cardTipoRenovar) {
        cardTipoRenovar.addEventListener('click', () => activarTab('renovar'));
        cardTipoRenovar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activarTab('renovar');
            }
        });
    }
    if (cardTipoReservar) {
        cardTipoReservar.addEventListener('click', () => activarTab('reservar'));
        cardTipoReservar.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activarTab('reservar');
            }
        });
    }
    if (btnIrAReservar) btnIrAReservar.addEventListener('click', () => activarTab('reservar'));

    // --- Cargar Renovaciones (HU-08) ---
    function mostrarDatosRenovacion(matricula) {
        if (!matricula) return;
        matriculaSeleccionada = matricula;
        if (mensajeRenovacion) mensajeRenovacion.textContent = '';
        if (inputDisciplina) inputDisciplina.value = matricula.disciplina || '';
        if (inputHorario) {
            inputHorario.value = `${matricula.dias || 'Horario actual'} ${matricula.hora_inicio?.slice(0, 5) || ''} - ${matricula.hora_fin?.slice(0, 5) || ''}`;
        }

        const hoy = new Date().toLocaleDateString('en-CA');
        const despuesDelVencimiento = new Date(`${matricula.fecha_fin.slice(0, 10)}T00:00:00Z`).getTime() + 86400000;
        const inicio = new Date(Math.max(new Date(`${hoy}T00:00:00Z`).getTime(), despuesDelVencimiento));
        const fin = new Date(inicio.getTime() + 29 * 86400000);
        if (inputPeriodo) {
            inputPeriodo.value = `${formatearFecha(inicio.toISOString())} - ${formatearFecha(fin.toISOString())}`;
        }
    }

    async function cargarDatosUsuario() {
        try {
            const response = await authFetch('/api/matriculas/mis-matriculas');
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Error obteniendo matrículas.');
            }

            const matriculas = result.data || [];
            renovables = matriculas.filter(m => m.puede_renovar && m.id_detalle);

            if (renovables.length === 0) {
                if (formRenovacion) formRenovacion.style.display = 'none';
                if (sinRenovacionBox) sinRenovacionBox.style.display = 'block';

                // Si no hay renovaciones pendientes, o vino directo, activar la pestaña de reservar
                if (tabInicial === 'reservar' || !detalleParam) {
                    activarTab('reservar');
                }
                return;
            }

            if (sinRenovacionBox) sinRenovacionBox.style.display = 'none';
            if (formRenovacion) formRenovacion.style.display = 'block';

            if (renovables.length > 1) {
                if (selectorMatriculaGroup) selectorMatriculaGroup.style.display = 'block';
                if (selectMatriculaRenovar) {
                    selectMatriculaRenovar.innerHTML = '';
                    renovables.forEach(m => {
                        const opt = document.createElement('option');
                        opt.value = m.id_detalle;
                        opt.textContent = `${m.disciplina} (${m.estado_vigencia})`;
                        selectMatriculaRenovar.appendChild(opt);
                    });

                    selectMatriculaRenovar.addEventListener('change', (e) => {
                        const m = renovables.find(item => String(item.id_detalle) === e.target.value);
                        mostrarDatosRenovacion(m);
                    });
                }
            }

            let elegida = null;
            if (detalleParam) {
                elegida = renovables.find(m => String(m.id_detalle) === detalleParam);
            }
            if (!elegida) elegida = renovables[0];

            if (selectMatriculaRenovar && elegida) {
                selectMatriculaRenovar.value = elegida.id_detalle;
            }
            mostrarDatosRenovacion(elegida);

            if (tabInicial === 'reservar') {
                activarTab('reservar');
            } else {
                activarTab('renovar');
            }

        } catch (error) {
            console.error('Error cargando datos de usuario:', error);
            if (sinRenovacionBox) {
                sinRenovacionBox.style.display = 'block';
                sinRenovacionBox.querySelector('p').textContent = 'Inicia sesión para consultar tus renovaciones.';
            }
            if (formRenovacion) formRenovacion.style.display = 'none';
            activarTab('reservar');
        }
    }

    if (formRenovacion) {
        formRenovacion.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!matriculaSeleccionada || btnContinuarRenovacion.disabled) return;

            btnContinuarRenovacion.disabled = true;
            if (mensajeRenovacion) mensajeRenovacion.textContent = 'Comprobando disponibilidad...';

            try {
                const response = await authFetch(`/api/matriculas/mis-matriculas/${encodeURIComponent(matriculaSeleccionada.id_detalle)}/renovar`, {
                    method: 'POST'
                });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'No se pudo preparar la renovación.');
                }
                const data = result.data;
                const params = new URLSearchParams({
                    matricula: data.matriculaId,
                    nombre: data.nombre,
                    correo: data.correo,
                    concepto: `Renovación - ${data.disciplinas}`,
                    monto: String(data.monto),
                    renovacion: '1'
                });
                window.location.href = `/pagos.html?${params.toString()}`;
            } catch (error) {
                if (mensajeRenovacion) {
                    mensajeRenovacion.textContent = error.message;
                    mensajeRenovacion.focus();
                }
                btnContinuarRenovacion.disabled = false;
            }
        });
    }

    // --- Flujo de Reserva de Cupo (HU-09) ---
    function initReservaFlow() {
        reservaInicializada = true;
        initPeriodosReserva();
        loadDisciplinasReserva();
    }

    function initPeriodosReserva() {
        if (!selectReservaPeriodo) return;
        selectReservaPeriodo.innerHTML = '';

        const hoy = new Date();
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        // Próximos 2 meses
        for (let i = 1; i <= 2; i++) {
            const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
            const yyyy = fecha.getFullYear();
            const mm = fecha.getMonth() + 1;
            const val = `${yyyy}-${String(mm).padStart(2, '0')}`;
            const nombreMes = meses[fecha.getMonth()];
            const etiqueta = i === 1 ? '(Próximo mes)' : '(En 2 meses)';

            const option = document.createElement('option');
            option.value = val;
            option.textContent = `${nombreMes} ${yyyy} ${etiqueta}`;
            selectReservaPeriodo.appendChild(option);
        }
    }

    async function loadDisciplinasReserva() {
        if (!selectReservaDisciplina) return;
        try {
            const response = await fetch('/api/matriculas/disciplinas');
            const result = await response.json();
            
            if (result.success && result.data) {
                selectReservaDisciplina.innerHTML = '<option value="">Seleccione...</option>';
                result.data.forEach(disc => {
                    const option = document.createElement('option');
                    option.value = disc.id;
                    option.textContent = disc.nombre;
                    selectReservaDisciplina.appendChild(option);
                });

                if (result.data.length > 0) {
                    const defaultDisc = result.data.find(d => d.nombre === 'MMA') || result.data[0];
                    selectReservaDisciplina.value = defaultDisc.id;
                    await loadHorariosReserva(defaultDisc.id);
                }
            }
        } catch (error) {
            console.error('Error cargando disciplinas para reserva:', error);
            selectReservaDisciplina.innerHTML = '<option value="">Error al cargar disciplinas</option>';
        }
    }

    async function loadHorariosReserva(idDisciplina) {
        if (!horariosReservaGrid) return;
        if (!idDisciplina) {
            horariosReservaGrid.innerHTML = '';
            if (resumenReservaContainer) resumenReservaContainer.innerHTML = '';
            reservaData = null;
            return;
        }

        const periodo = selectReservaPeriodo ? selectReservaPeriodo.value : '';
        horariosReservaGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">Cargando horarios para reserva...</div>';

        try {
            const url = `/api/matriculas/disciplinas/${idDisciplina}/horarios?periodo=${encodeURIComponent(periodo)}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data) {
                reservaData = result.data;
                const horarios = Array.isArray(reservaData) ? reservaData : (reservaData.horarios || []);
                renderResumenReserva(reservaData);
                renderHorariosReserva(horarios, reservaData);
            } else {
                reservaData = null;
                if (resumenReservaContainer) resumenReservaContainer.innerHTML = '';
                horariosReservaGrid.innerHTML = `<div class="error-message">${escapeHtml(result.message || 'Error cargando horarios.')}</div>`;
            }
        } catch (error) {
            reservaData = null;
            console.error('Error obteniendo horarios:', error);
            if (resumenReservaContainer) resumenReservaContainer.innerHTML = '';
            horariosReservaGrid.innerHTML = '<div class="error-message">Hubo un problema de conexión.</div>';
        }
    }

    function renderResumenReserva(data) {
        if (!resumenReservaContainer) return;
        if (!data || !data.disciplina) {
            resumenReservaContainer.innerHTML = '';
            return;
        }

        const disc = data.disciplina;
        const cuposRestantes = data.cupos_reserva_disciplina_restantes !== undefined
            ? data.cupos_reserva_disciplina_restantes
            : (data.max_cupos_reserva || 4);
        const maxCupos = data.max_cupos_reserva || 4;

        const badgeStyle = cuposRestantes > 0
            ? 'background-color: #ede7f6; color: #4527a0;'
            : 'background-color: #ffebee; color: #c62828;';
        const badgeTexto = cuposRestantes > 0
            ? `${cuposRestantes} de ${maxCupos} cupos de reserva disponibles`
            : `0 de ${maxCupos} cupos disponibles (Agotado para este periodo)`;

        resumenReservaContainer.innerHTML = `
            <div class="disciplina-resumen-banner">
                <div class="disciplina-resumen-info">
                    <h4>
                        ${escapeHtml(disc.nombre)}
                        <span class="reserva-cupos-badge" style="${badgeStyle}">
                            ${badgeTexto}
                        </span>
                    </h4>
                    <p>Reserva anticipada para <strong>${escapeHtml(data.mes_nombre || '')} ${data.anio || ''}</strong>. Al reservar por adelantado se asegura el cupo y se congela la tarifa vigente.</p>
                </div>
                <div class="disciplina-resumen-metrics">
                    <div class="tarifa-box">
                        <span class="tarifa-label">Tarifa mensual</span>
                        <span class="tarifa-valor">S/ ${Number(disc.tarifa || 0).toFixed(2)}</span>
                        <span class="tarifa-congelada-tag">Tarifa congelada</span>
                    </div>
                </div>
            </div>
        `;
    }

    function renderHorariosReserva(horarios, dataCompleta) {
        if (!horariosReservaGrid) return;
        if (!horarios || horarios.length === 0) {
            horariosReservaGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">No se encontraron horarios para la disciplina seleccionada</div>';
            return;
        }

        horariosReservaGrid.innerHTML = '';

        horarios.forEach(horario => {
            const card = document.createElement('div');
            card.className = 'horario-card';

            const cuposDisponiblesHorario = horario.cupos_disponibles !== undefined ? horario.cupos_disponibles : horario.capacidad_max;
            const capacidad = horario.capacidad_max || 0;

            const puedeReservar = Boolean(horario.puede_reservar);
            const cuposReserva = horario.cupos_reserva_disponibles !== undefined
                ? horario.cupos_reserva_disponibles
                : 0;

            let badgeClass = 'badge-disponible';
            let badgeText = 'Disponible';

            if (!puedeReservar) {
                card.classList.add('agotado');
                badgeClass = 'badge-agotado';
                badgeText = 'Agotado';
            }

            card.innerHTML = `
                <div class="horario-info">
                    <span class="horario-dias">${formatDias(horario.dias)}</span>
                    <span class="horario-horas">${formatHora12(horario.hora_inicio)} - ${formatHora12(horario.hora_fin)}</span>
                </div>
                
                <div class="horario-capacidad">
                    <span class="cupos-text" style="${puedeReservar ? '' : 'color: var(--danger-color);'}">
                        ${puedeReservar ? `${cuposReserva} cupo${cuposReserva > 1 ? 's' : ''} para reserva` : '0 cupos para reserva'}
                    </span>
                    <span class="capacidad-text">Aforo horario: ${cuposDisponiblesHorario}/${capacidad}</span>
                </div>
                
                <div class="horario-estado">
                    <span class="${badgeClass}">${badgeText}</span>
                </div>

                <div class="horario-accion">
                    ${puedeReservar
                        ? `<button type="button" class="btn-reservar" data-horario="${horario.id_disc_horario}">Reservar cupo</button>`
                        : `<button type="button" class="btn-reservar btn-disabled" disabled title="No hay cupos disponibles para reserva">Reservar cupo</button>
                           <span class="msg-sin-cupos">No hay cupos disponibles para reserva</span>`
                    }
                </div>
            `;

            if (puedeReservar) {
                const btnRes = card.querySelector('.btn-reservar:not(:disabled)');
                if (btnRes) {
                    btnRes.addEventListener('click', () => abrirModalConfirmacion(horario));
                }
            }

            horariosReservaGrid.appendChild(card);
        });
    }

    function abrirModalConfirmacion(horario) {
        if (!modalConfirmar) return;

        const disc = reservaData?.disciplina || {};
        const discNombre = disc.nombre || 'Disciplina';
        const horarioTexto = `${formatDias(horario.dias)} — ${formatHora12(horario.hora_inicio)} a ${formatHora12(horario.hora_fin)}`;
        const periodoTexto = `${reservaData?.mes_nombre || ''} ${reservaData?.anio || ''}`;
        const tarifa = Number(horario.tarifa || disc.tarifa || 0);

        if (modalReservaDisciplina) modalReservaDisciplina.textContent = discNombre;
        if (modalReservaHorario) modalReservaHorario.textContent = horarioTexto;
        if (modalReservaPeriodo) modalReservaPeriodo.textContent = periodoTexto;
        if (modalReservaTarifa) modalReservaTarifa.textContent = `S/ ${tarifa.toFixed(2)}`;

        selectedReservation = {
            horario,
            disciplina: disc,
            periodo: reservaData?.periodo,
            tarifa
        };

        modalConfirmar.style.display = 'flex';
    }

    function cerrarModalConfirmacion() {
        if (modalConfirmar) {
            modalConfirmar.style.display = 'none';
        }
    }

    if (btnContinuarPago) {
        btnContinuarPago.addEventListener('click', async () => {
            if (!selectedReservation) return;

            const token = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
            if (!token) {
                const targetUrl = `/renovar.html?tab=reservar`;
                window.location.href = `/login.html?redirect=${encodeURIComponent(targetUrl)}`;
                return;
            }

            const textoOriginal = btnContinuarPago.textContent;
            btnContinuarPago.disabled = true;
            btnContinuarPago.textContent = 'Generando cobro...';

            try {
                const response = await authFetch('/api/matriculas/reservar', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id_disciplina: selectedReservation.disciplina.id,
                        id_disc_horario: selectedReservation.horario.id_disc_horario,
                        periodo: selectedReservation.periodo
                    })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'No se pudo generar la reserva para pago.');
                }

                const data = result.data;
                const queryParams = new URLSearchParams({
                    preview: '1',
                    matricula: data.matriculaId,
                    nombre: data.nombre,
                    correo: data.correo,
                    concepto: data.concepto,
                    monto: String(data.monto),
                    tipo: 'reserva'
                });

                window.location.href = `/pagos.html?${queryParams.toString()}`;
            } catch (error) {
                console.error('Error al continuar al pago:', error);
                alert(error.message || 'Error al conectar con la interfaz de cobro.');
                btnContinuarPago.disabled = false;
                btnContinuarPago.textContent = textoOriginal;
            }
        });
    }

    if (btnCancelarReserva) {
        btnCancelarReserva.addEventListener('click', cerrarModalConfirmacion);
    }

    if (modalConfirmar) {
        modalConfirmar.addEventListener('click', (e) => {
            if (e.target === modalConfirmar) {
                cerrarModalConfirmacion();
            }
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalConfirmar && modalConfirmar.style.display === 'flex') {
            cerrarModalConfirmacion();
        }
    });

    if (selectReservaDisciplina) {
        selectReservaDisciplina.addEventListener('change', (e) => {
            loadHorariosReserva(e.target.value);
        });
    }

    if (selectReservaPeriodo) {
        selectReservaPeriodo.addEventListener('change', () => {
            if (selectReservaDisciplina && selectReservaDisciplina.value) {
                loadHorariosReserva(selectReservaDisciplina.value);
            }
        });
    }

    // Inicializar carga de datos
    await cargarDatosUsuario();
});
