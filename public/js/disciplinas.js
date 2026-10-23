document.addEventListener('DOMContentLoaded', () => {
    const selectDisciplina = document.getElementById('disciplina-select');
    const selectPeriodo = document.getElementById('periodo-select');
    const horariosGrid = document.getElementById('horarios-grid');
    const resumenContainer = document.getElementById('resumen-disciplina-container');

    // Elementos del Modal Confirmar Reserva (PSW-201)
    const modalConfirmar = document.getElementById('modal-confirmar-reserva');
    const btnCancelarReserva = document.getElementById('btn-cancelar-reserva');
    const btnContinuarPago = document.getElementById('btn-continuar-pago');
    const modalReservaDisciplina = document.getElementById('modal-reserva-disciplina');
    const modalReservaHorario = document.getElementById('modal-reserva-horario');
    const modalReservaPeriodo = document.getElementById('modal-reserva-periodo');
    const modalReservaTarifa = document.getElementById('modal-reserva-tarifa');

    let currentData = null;
    let selectedReservation = null;

    const params = new URLSearchParams(window.location.search);
    const disciplinaInicial = params.get('disciplina');
    const periodoInicial = params.get('periodo');

    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Formatear horas a 12 horas con a. m. / p. m.
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

    // Formatear días completos
    function formatDias(diasStr) {
        if (!diasStr) return '';
        const d = diasStr.trim();
        if (d === 'L-M-V') return 'Lunes / Miércoles / Viernes';
        if (d === 'M-J') return 'Martes / Jueves';
        if (d === 'S-D') return 'Sábados / Domingos';
        if (d === 'L-M-M-J-V') return 'Lunes a Viernes';
        return d;
    }

    // 1. Inicializar selector de periodos (Mes actual y hasta 2 meses futuros)
    function initPeriodos() {
        if (!selectPeriodo) return;
        selectPeriodo.innerHTML = '';

        const hoy = new Date();
        const meses = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];

        for (let i = 0; i <= 2; i++) {
            const fecha = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
            const yyyy = fecha.getFullYear();
            const mm = fecha.getMonth() + 1;
            const val = `${yyyy}-${String(mm).padStart(2, '0')}`;
            const nombreMes = meses[fecha.getMonth()];
            const sufijo = i === 0 ? '(Periodo actual)' : '(Reserva anticipada)';

            const option = document.createElement('option');
            option.value = val;
            option.textContent = `${nombreMes} ${yyyy} ${sufijo}`;
            selectPeriodo.appendChild(option);
        }

        if (periodoInicial && selectPeriodo.querySelector(`option[value="${periodoInicial}"]`)) {
            selectPeriodo.value = periodoInicial;
        }
    }

    // 2. Cargar las disciplinas al iniciar la página
    async function loadDisciplinas() {
        try {
            const response = await fetch('/api/matriculas/disciplinas');
            const result = await response.json();
            
            if (result.success && result.data) {
                // Opción por defecto: Todas las disciplinas (muestra todos los horarios)
                selectDisciplina.innerHTML = '<option value="todas">Todas las disciplinas</option>';
                
                // Ordenar alfabéticamente por nombre
                const disciplinasOrdenadas = [...result.data].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

                disciplinasOrdenadas.forEach(disc => {
                    const option = document.createElement('option');
                    option.value = disc.id;
                    option.textContent = disc.nombre;
                    selectDisciplina.appendChild(option);
                });

                if (disciplinaInicial && selectDisciplina.querySelector(`option[value="${disciplinaInicial}"]`)) {
                    selectDisciplina.value = disciplinaInicial;
                    await loadHorarios(disciplinaInicial);
                } else {
                    selectDisciplina.value = 'todas';
                    await loadHorarios('todas');
                }
            }
        } catch (error) {
            console.error('Error cargando disciplinas:', error);
            selectDisciplina.innerHTML = '<option value="todas">Todas las disciplinas</option>';
        }
    }

    // 3. Cargar los horarios cuando el usuario elige una disciplina o periodo
    async function loadHorarios(idDisciplina = selectDisciplina.value) {
        if (!idDisciplina) {
            idDisciplina = 'todas';
        }

        const periodo = selectPeriodo ? selectPeriodo.value : '';
        horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">Cargando horarios...</div>';

        try {
            const endpointId = (idDisciplina === 'todas' || idDisciplina === 'todos') ? 'todas' : idDisciplina;
            const url = `/api/matriculas/disciplinas/${endpointId}/horarios${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data) {
                currentData = result.data;
                if (currentData.todas) {
                    renderTodasLasDisciplinas(currentData);
                } else {
                    const horarios = Array.isArray(currentData) ? currentData : (currentData.horarios || []);
                    renderResumenDisciplina(currentData);
                    renderHorarios(horarios, currentData);
                }
            } else {
                currentData = null;
                if (resumenContainer) resumenContainer.innerHTML = '';
                horariosGrid.innerHTML = `<div class="error-message">${escapeHtml(result.message || 'Error cargando horarios.')}</div>`;
            }
        } catch (error) {
            currentData = null;
            console.error('Error obteniendo horarios:', error);
            if (resumenContainer) resumenContainer.innerHTML = '';
            horariosGrid.innerHTML = '<div class="error-message">Hubo un problema de conexión.</div>';
        }
    }

    // 4. Renderizar banner resumen de disciplina y periodo de reserva para una sola disciplina
    function renderResumenDisciplina(data) {
        if (!resumenContainer) return;

        if (!data || !data.es_periodo_futuro || !data.disciplina) {
            resumenContainer.innerHTML = '';
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

        resumenContainer.innerHTML = `
            <div class="disciplina-resumen-banner">
                <div class="disciplina-resumen-info">
                    <h4>
                        ${escapeHtml(disc.nombre)}
                        <span class="reserva-cupos-badge" style="${badgeStyle}">
                            ${badgeTexto}
                        </span>
                    </h4>
                    <p>Reserva anticipada para <strong>${escapeHtml(data.mes_nombre || '')} ${data.anio || ''}</strong>. Al reservar por adelantado se congela la tarifa vigente.</p>
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

    // 5. Modal Confirmar Reserva (PSW-201)
    function abrirModalConfirmacion(horario, discParam, metaParam) {
        if (!modalConfirmar) return;

        const disc = discParam || currentData?.disciplina || {};
        const meta = metaParam || currentData || {};
        const discNombre = disc.nombre || 'Disciplina';
        const horarioTexto = `${formatDias(horario.dias)} — ${formatHora12(horario.hora_inicio)} a ${formatHora12(horario.hora_fin)}`;
        const periodoTexto = `${meta.mes_nombre || ''} ${meta.anio || ''}`;
        const tarifa = Number(horario.tarifa || disc.tarifa || 0);

        if (modalReservaDisciplina) modalReservaDisciplina.textContent = discNombre;
        if (modalReservaHorario) modalReservaHorario.textContent = horarioTexto;
        if (modalReservaPeriodo) modalReservaPeriodo.textContent = periodoTexto;
        if (modalReservaTarifa) modalReservaTarifa.textContent = `S/ ${tarifa.toFixed(2)}`;

        selectedReservation = {
            horario,
            disciplina: disc,
            periodo: meta.periodo,
            tarifa
        };

        modalConfirmar.style.display = 'flex';
    }

    function cerrarModalConfirmacion() {
        if (modalConfirmar) {
            modalConfirmar.style.display = 'none';
        }
    }

    // Crear elemento tarjeta de horario reutilizable
    function crearTarjetaHorario(horario, disc, dataCompleta) {
        const card = document.createElement('div');
        card.className = 'horario-card';

        const cuposDisponiblesHorario = horario.cupos_disponibles !== undefined ? horario.cupos_disponibles : horario.capacidad_max;
        const capacidad = horario.capacidad_max || 0;
        const esFuturo = Boolean(dataCompleta?.es_periodo_futuro);

        if (esFuturo) {
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
                    btnRes.addEventListener('click', () => abrirModalConfirmacion(horario, disc, dataCompleta));
                }
            }
        } else {
            let badgeClass = 'badge-disponible';
            let badgeText = 'Disponible';
            let cuposStyle = '';

            if (cuposDisponiblesHorario <= 0) { 
                badgeClass = 'badge-agotado';
                badgeText = 'Agotado';
                card.classList.add('agotado');
            } else if (cuposDisponiblesHorario <= 2) {
                badgeClass = 'badge-ultimos';
                badgeText = 'Últimos cupos';
                cuposStyle = 'color: var(--danger-color)';
            }

            card.innerHTML = `
                <div class="horario-info">
                    <span class="horario-dias">${formatDias(horario.dias)}</span>
                    <span class="horario-horas">${formatHora12(horario.hora_inicio)} - ${formatHora12(horario.hora_fin)}</span>
                </div>
                
                <div class="horario-capacidad">
                    <span class="cupos-text" style="${cuposStyle}">${cuposDisponiblesHorario} cupos disponibles</span>
                    <span class="capacidad-text">Capacidad total: ${capacidad}</span>
                </div>
                
                <div class="horario-estado">
                    <span class="${badgeClass}">${badgeText}</span>
                </div>
            `;
        }

        return card;
    }

    // 6. Renderizar todas las disciplinas ordenadas con sus horarios
    function renderTodasLasDisciplinas(dataCompleta) {
        if (resumenContainer) resumenContainer.innerHTML = '';
        horariosGrid.innerHTML = '';

        const lista = dataCompleta.disciplinas || [];
        if (lista.length === 0) {
            horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">No se encontraron disciplinas disponibles.</div>';
            return;
        }

        const esFuturo = Boolean(dataCompleta.es_periodo_futuro);

        lista.forEach(item => {
            const disc = item.disciplina;
            const horarios = item.horarios || [];
            const cuposRestantes = item.cupos_reserva_disciplina_restantes !== undefined
                ? item.cupos_reserva_disciplina_restantes
                : (dataCompleta.max_cupos_reserva || 4);
            const maxCupos = dataCompleta.max_cupos_reserva || 4;

            const badgeStyle = cuposRestantes > 0
                ? 'background-color: #ede7f6; color: #4527a0;'
                : 'background-color: #ffebee; color: #c62828;';
            const badgeTexto = cuposRestantes > 0
                ? `${cuposRestantes} de ${maxCupos} cupos de reserva disponibles`
                : `0 de ${maxCupos} cupos disponibles (Agotado para este periodo)`;

            const bloque = document.createElement('div');
            bloque.className = 'disciplina-bloque';

            bloque.innerHTML = `
                <div class="disciplina-bloque-header">
                    <div class="disciplina-bloque-info">
                        <h3>
                            ${escapeHtml(disc.nombre)}
                            ${esFuturo ? `<span class="reserva-cupos-badge" style="${badgeStyle}">${badgeTexto}</span>` : ''}
                        </h3>
                        <p>${escapeHtml(disc.descripcion || 'Entrenamiento especializado')}</p>
                    </div>
                    <div class="disciplina-bloque-meta">
                        <div class="tarifa-box">
                            <span class="tarifa-label">Tarifa mensual</span>
                            <span class="tarifa-valor">S/ ${Number(disc.tarifa || 0).toFixed(2)}</span>
                            ${esFuturo ? '<span class="tarifa-congelada-tag">Tarifa congelada</span>' : ''}
                        </div>
                    </div>
                </div>
                <div class="horarios-grid lista-horarios-disciplina"></div>
            `;

            const listaHorariosEl = bloque.querySelector('.lista-horarios-disciplina');

            if (horarios.length === 0) {
                listaHorariosEl.innerHTML = '<div class="text-muted" style="padding: 0.75rem 0.25rem;">No hay horarios registrados para esta disciplina.</div>';
            } else {
                horarios.forEach(horario => {
                    const card = crearTarjetaHorario(horario, disc, dataCompleta);
                    listaHorariosEl.appendChild(card);
                });
            }

            horariosGrid.appendChild(bloque);
        });
    }

    // 7. Renderizar una sola disciplina seleccionada
    function renderHorarios(horarios, dataCompleta) {
        if (!horarios || horarios.length === 0) {
            horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">No se encontraron horarios disponibles para la disciplina seleccionada</div>';
            return;
        }

        horariosGrid.innerHTML = '';
        const disc = dataCompleta.disciplina || {};

        horarios.forEach(horario => {
            const card = crearTarjetaHorario(horario, disc, dataCompleta);
            horariosGrid.appendChild(card);
        });
    }

    // 7. Event listeners de modal de confirmación y botón Continuar al pago (PSW-202)
    if (btnContinuarPago) {
        btnContinuarPago.addEventListener('click', async () => {
            if (!selectedReservation) return;

            const token = obtenerToken();
            if (!token) {
                const targetUrl = `/disciplinas.html?disciplina=${encodeURIComponent(selectedReservation.disciplina.id)}&periodo=${encodeURIComponent(selectedReservation.periodo)}`;
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
                const params = new URLSearchParams({
                    preview: '1',
                    matricula: data.matriculaId,
                    nombre: data.nombre,
                    correo: data.correo,
                    concepto: data.concepto,
                    monto: String(data.monto),
                    tipo: 'reserva'
                });

                window.location.href = `/pagos.html?${params.toString()}`;
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

    // 8. Escuchar eventos de cambio en disciplina y periodo
    selectDisciplina.addEventListener('change', (e) => {
        loadHorarios(e.target.value);
    });

    if (selectPeriodo) {
        selectPeriodo.addEventListener('change', () => {
            if (selectDisciplina.value) {
                loadHorarios(selectDisciplina.value);
            }
        });
    }

    // Iniciar scripts
    initPeriodos();
    loadDisciplinas();
});
