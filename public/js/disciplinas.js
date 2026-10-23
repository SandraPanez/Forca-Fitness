document.addEventListener('DOMContentLoaded', () => {
    const selectDisciplina = document.getElementById('disciplina-select');
    const horariosGrid = document.getElementById('horarios-grid');
    const params = new URLSearchParams(window.location.search);
    const disciplinaInicial = params.get('disciplina');

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

    // 1. Cargar las disciplinas al iniciar la página
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

    // 2. Cargar los horarios cuando el usuario elige una disciplina
    async function loadHorarios(idDisciplina) {
        if (!idDisciplina) {
            horariosGrid.innerHTML = '';
            return;
        }

        horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">Cargando horarios...</div>';

        try {
            const response = await fetch(`/api/matriculas/disciplinas/${idDisciplina}/horarios`);
            const result = await response.json();

            if (result.success && result.data) {
                const horarios = Array.isArray(result.data) ? result.data : (result.data.horarios || []);
                renderHorarios(horarios);
            } else {
                horariosGrid.innerHTML = '<div class="error-message">Error cargando horarios.</div>';
            }
        } catch (error) {
            console.error('Error obteniendo horarios:', error);
            horariosGrid.innerHTML = '<div class="error-message">Hubo un problema de conexión.</div>';
        }
    }

    // 3. Renderizar las tarjetas en el HTML
    function renderHorarios(horarios) {
        if (!horarios || horarios.length === 0) {
            horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">No se encontraron horarios disponibles para la disciplina seleccionada</div>';
            return;
        }

        horariosGrid.innerHTML = '';

        horarios.forEach(horario => {
            const card = document.createElement('div');
            card.className = 'horario-card';

            let badgeClass = 'badge-disponible';
            let badgeText = 'Disponible';
            let cuposStyle = '';

            const cupos = horario.cupos_disponibles !== undefined ? horario.cupos_disponibles : horario.capacidad_max;
            const capacidad = horario.capacidad_max || 0;

            if (cupos <= 0) { 
                badgeClass = 'badge-agotado';
                badgeText = 'Agotado';
                card.classList.add('agotado');
            } else if (cupos <= 2) {
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
                    <span class="cupos-text" style="${cuposStyle}">${cupos} cupos disponibles</span>
                    <span class="capacidad-text">Capacidad total: ${capacidad}</span>
                </div>
                
                <div class="horario-estado">
                    <span class="${badgeClass}">${badgeText}</span>
                </div>
            `;

            horariosGrid.appendChild(card);
        });
    }

    // 4. Escuchar el evento de cambio en el selector
    selectDisciplina.addEventListener('change', (e) => {
        loadHorarios(e.target.value);
    });

    // Iniciar script
    loadDisciplinas();
});
