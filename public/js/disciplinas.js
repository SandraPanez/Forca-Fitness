document.addEventListener('DOMContentLoaded', () => {
    const selectDisciplina = document.getElementById('disciplina-select');
    const selectPeriodo = document.getElementById('periodo-select');
    const horariosGrid = document.getElementById('horarios-grid');
    const resumenContainer = document.getElementById('resumen-disciplina-container');
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
                selectDisciplina.innerHTML = '<option value="">Seleccione...</option>';
                
                result.data.forEach(disc => {
                    const option = document.createElement('option');
                    option.value = disc.id;
                    option.textContent = disc.nombre;
                    selectDisciplina.appendChild(option);
                });

                if (disciplinaInicial) {
                    selectDisciplina.value = disciplinaInicial;
                    if (selectDisciplina.value === disciplinaInicial) {
                        await loadHorarios(disciplinaInicial);
                    }
                } else if (result.data.length > 0) {
                    const defaultDisc = result.data.find(d => d.nombre === 'MMA') || result.data[0];
                    selectDisciplina.value = defaultDisc.id;
                    await loadHorarios(defaultDisc.id);
                }
            }
        } catch (error) {
            console.error('Error cargando disciplinas:', error);
            selectDisciplina.innerHTML = '<option value="">Error al cargar disciplinas</option>';
        }
    }

    // 3. Cargar los horarios cuando el usuario elige una disciplina o periodo
    async function loadHorarios(idDisciplina) {
        if (!idDisciplina) {
            horariosGrid.innerHTML = '';
            if (resumenContainer) resumenContainer.innerHTML = '';
            return;
        }

        const periodo = selectPeriodo ? selectPeriodo.value : '';
        horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">Cargando horarios...</div>';

        try {
            const url = `/api/matriculas/disciplinas/${idDisciplina}/horarios${periodo ? `?periodo=${encodeURIComponent(periodo)}` : ''}`;
            const response = await fetch(url);
            const result = await response.json();

            if (result.success && result.data) {
                const data = result.data;
                const horarios = Array.isArray(data) ? data : (data.horarios || []);
                renderResumenDisciplina(data);
                renderHorarios(horarios, data);
            } else {
                if (resumenContainer) resumenContainer.innerHTML = '';
                horariosGrid.innerHTML = `<div class="error-message">${escapeHtml(result.message || 'Error cargando horarios.')}</div>`;
            }
        } catch (error) {
            console.error('Error obteniendo horarios:', error);
            if (resumenContainer) resumenContainer.innerHTML = '';
            horariosGrid.innerHTML = '<div class="error-message">Hubo un problema de conexión.</div>';
        }
    }

    // 4. Renderizar banner resumen de disciplina y periodo de reserva
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

    // 5. Renderizar las tarjetas de horarios en el HTML
    function renderHorarios(horarios, dataCompleta) {
        if (!horarios || horarios.length === 0) {
            horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">No se encontraron horarios disponibles para la disciplina seleccionada</div>';
            return;
        }

        horariosGrid.innerHTML = '';
        const esFuturo = Boolean(dataCompleta?.es_periodo_futuro);

        horarios.forEach(horario => {
            const card = document.createElement('div');
            card.className = 'horario-card';

            const cuposDisponiblesHorario = horario.cupos_disponibles !== undefined ? horario.cupos_disponibles : horario.capacidad_max;
            const capacidad = horario.capacidad_max || 0;

            if (esFuturo) {
                // Periodo de reserva anticipada (HU-09)
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
            } else {
                // Periodo corriente (sprint anterior)
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

            horariosGrid.appendChild(card);
        });
    }

    // 6. Escuchar eventos de cambio en disciplina y periodo
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
