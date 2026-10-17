document.addEventListener('DOMContentLoaded', () => {
    const selectDisciplina = document.getElementById('disciplina-select');
    const horariosGrid = document.getElementById('horarios-grid');
    const params = new URLSearchParams(window.location.search);
    const disciplinaInicial = params.get('disciplina');

    // 1. Cargar las disciplinas al iniciar la página
    async function loadDisciplinas() {
        try {
            const response = await fetch('/api/matriculas/disciplinas');
            const result = await response.json();
            
            if (result.success && result.data) {
                // Limpiar opciones por defecto
                selectDisciplina.innerHTML = '<option value="">Seleccione...</option>';
                
                result.data.forEach(disc => {
                    const option = document.createElement('option');
                    option.value = disc.id; // Puede ser id_disciplina o id, dependiendo de cómo responde el backend
                    option.textContent = disc.nombre;
                    selectDisciplina.appendChild(option);
                });
                if (disciplinaInicial) {
                    selectDisciplina.value = disciplinaInicial;

                    if (selectDisciplina.value === disciplinaInicial) {
                        await loadHorarios(disciplinaInicial);
                    }
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
                renderHorarios(result.data);
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
        if (horarios.length === 0) {
            horariosGrid.innerHTML = '<div class="text-muted" style="text-align: center; padding: 2rem;">No se encontraron horarios disponibles para la disciplina seleccionada</div>';
            return;
        }

        horariosGrid.innerHTML = ''; // Limpiar grilla

        horarios.forEach(horario => {
            const card = document.createElement('div');
            card.className = 'horario-card';

            // Formatear horas (ej. 17:00:00 -> 17:00)
            const formatHora = (horaFull) => horaFull ? horaFull.substring(0,5) : '';

            // Lógica de indicadores visuales (T_08)
            let badgeClass = 'badge-disponible';
            let badgeText = 'Disponible';
            let cuposStyle = '';

            if (horario.cupos_disponibles <= 0) { 
                badgeClass = 'badge-agotado';
                badgeText = 'Sin cupos disponibles para este horario';
                // T_09: Deshabilitar tarjeta visualmente
                card.classList.add('agotado');
                card.style.opacity = '0.6';
                card.style.pointerEvents = 'none';
            } else if (horario.cupos_disponibles <= 5) {
                badgeClass = 'badge-ultimos';
                badgeText = 'Últimos cupos';
                cuposStyle = 'color: var(--danger-color)';
            }

            // Renderizado base con lógica de estados (T_08)
            card.innerHTML = `
                <div class="horario-info">
                    <span class="horario-dias">${horario.dias}</span>
                    <span class="horario-horas">${formatHora(horario.hora_inicio)} - ${formatHora(horario.hora_fin)}</span>
                    <span class="horario-profesor" style="display: block; font-size: 0.85rem; color: var(--text-muted); margin-top: 0.25rem;">Prof. ${horario.profesor_nombre || 'No asignado'}</span>
                </div>
                
                <div class="horario-capacidad">
                    <span class="cupos-text" style="${cuposStyle}">${horario.cupos_disponibles} cupos disponibles</span>
                    <span class="capacidad-text">Capacidad total: ${horario.capacidad_max}</span>
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
    // Limpiar grilla de inicio para que no salgan los falsos del HTML mockup
    horariosGrid.innerHTML = '';
});
