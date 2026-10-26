document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('alumnos-tbody');
    const overlay = document.getElementById('side-panel-overlay');
    const sidePanel = document.getElementById('side-panel');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const searchInput = document.getElementById('search-input') || document.querySelector('.search-input');
    const filterSelect = document.getElementById('filter-select') || document.querySelector('.filter-select');
    const btnPorVencer = document.getElementById('btn-por-vencer');
    let alumnosCache = [];

    const closePanel = () => {
        overlay.classList.remove('active');
        sidePanel.classList.remove('active');
    };

    const escapeHtml = (value) => String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

    const getBadgeClass = (estado) => {
        switch (estado) {
            case 'Próxima a vencer':
                return 'badge-proxima';
            case 'Activa':
                return 'badge-activa';
            case 'Vencida':
                return 'badge-vencida';
            case 'Reservada':
                return 'badge-reservada';
            default:
                return 'badge-activa';
        }
    };

    const getDiasText = (alumno) => {
        const dias = Number(alumno.dias_restantes) || 0;
        if (alumno.estado_matricula === 'Próxima a vencer') {
            if (dias === 0) return 'Vence hoy';
            if (dias === 1) return 'Vence mañana';
            return `Vence en ${dias} días`;
        }
        if (alumno.estado_matricula === 'Activa') {
            return `${dias} días restantes`;
        }
        if (alumno.estado_matricula === 'Vencida') {
            return `Venció hace ${Math.abs(dias)} días`;
        }
        if (alumno.estado_matricula === 'Reservada') {
            return 'Inicia próximo periodo';
        }
        return '';
    };

    const renderTable = (alumnos) => {
        tbody.innerHTML = '';
        if (!alumnos.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted" style="padding: 2.5rem 1rem;">No se encontraron alumnos con el criterio seleccionado.</td></tr>';
            return;
        }

        alumnos.forEach((alumno) => {
            const badgeClass = getBadgeClass(alumno.estado_matricula);
            const diasTexto = getDiasText(alumno);
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="alumno-row">
                        <div class="avatar-circle">${escapeHtml(alumno.iniciales || 'AL')}</div>
                        <span class="font-medium">${escapeHtml(alumno.nombres)} ${escapeHtml(alumno.apellido_paterno)} ${escapeHtml(alumno.apellido_materno)}</span>
                    </div>
                </td>
                <td>
                    <span class="badge-status ${badgeClass}">${escapeHtml(alumno.estado_matricula)}</span>
                    ${diasTexto ? `<span class="dias-text">${escapeHtml(diasTexto)}</span>` : ''}
                </td>
                <td class="text-right">
                    <button class="btn-link" data-id="${escapeHtml(alumno.id)}" title="Ver vigencia de matrícula y detalles">Ver detalle</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-link').forEach((button) => {
            button.addEventListener('click', () => loadStudentDetails(button.dataset.id));
        });
    };

    const filterAlumnos = () => {
        const search = (searchInput?.value || '').trim().toLowerCase();
        const status = filterSelect?.value || 'Todos';

        if (status === 'Por vencer') {
            btnPorVencer?.classList.add('active');
        } else {
            btnPorVencer?.classList.remove('active');
        }

        const filtered = alumnosCache.filter((alumno) => {
            const fullName = `${alumno.nombres || ''} ${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''}`.toLowerCase();
            const matchesSearch = !search || fullName.includes(search);

            let matchesStatus = true;
            if (status === 'Por vencer') {
                matchesStatus = alumno.estado_matricula === 'Próxima a vencer' || alumno.por_vencer === true;
            } else if (status === 'Activa') {
                matchesStatus = alumno.estado_matricula === 'Activa';
            } else if (status === 'Vencida') {
                matchesStatus = alumno.estado_matricula === 'Vencida';
            } else if (status === 'Reservada') {
                matchesStatus = alumno.estado_matricula === 'Reservada';
            } else {
                matchesStatus = true; // 'Todos'
            }

            return matchesSearch && matchesStatus;
        });

        renderTable(filtered);
    };

    const loadAlumnos = async () => {
        try {
            console.log('Obteniendo alumnos desde API...');
            const response = await authFetch('/api/alumnos');

            if (!response.ok) {
                const statusMessage = response.status === 401
                    ? 'La sesión no es válida o ha vencido.'
                    : response.status === 403
                        ? 'No tienes permisos para consultar los alumnos.'
                        : 'No se pudieron cargar los alumnos.';
                throw new Error(`Error ${response.status}: ${statusMessage}`);
            }

            const result = await response.json();
            if (!result.success) {
                throw new Error(result.message || 'No se pudieron cargar los alumnos.');
            }
            if (!Array.isArray(result.data)) {
                throw new Error('La API devolvió un formato de alumnos no válido.');
            }

            console.log('Alumnos recibidos:', result.data);
            alumnosCache = result.data;
            filterAlumnos();
        } catch (error) {
            console.error('Error cargando alumnos:', error);
            const message = error instanceof Error ? error.message : 'Error desconocido al cargar alumnos.';
            tbody.innerHTML = `<tr><td colspan="3"><div role="alert" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(message)}</div></td></tr>`;
        }
    };

    const loadStudentDetails = async (id) => {
        overlay.classList.add('active');
        sidePanel.classList.add('active');
        sidePanelContent.innerHTML = '<div class="text-center text-muted mt-4">Cargando información...</div>';
        try {
            const response = await authFetch(`/api/alumnos/${encodeURIComponent(id)}`);
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'No se pudo cargar el detalle.');
            }
            const detalle = result.data;
            const badgeClass = getBadgeClass(detalle.estado);
            const esPorVencer = detalle.estado === 'Próxima a vencer';

            sidePanelContent.innerHTML = `
                ${esPorVencer ? `
                <div class="reserva-alert" style="background: #fff8e1; border: 1px solid #ffe082; border-left: 5px solid #f57f17; color: #b78103; margin-bottom: 1.5rem; padding: 0.85rem 1rem; border-radius: 6px;">
                    <strong>⚠️ Matrícula por vencer</strong>
                    <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: #795548;">Este alumno requiere seguimiento prioritario para la renovación de su matrícula.</p>
                </div>
                ` : ''}
                <div class="side-panel-header-info">
                    <div class="avatar-large">${escapeHtml((detalle.nombre_completo || 'AL').substring(0, 2).toUpperCase())}</div>
                    <div>
                        <h2 class="student-name-large">${escapeHtml(detalle.nombre_completo)}</h2>
                        <span class="badge-status ${badgeClass}">${escapeHtml(detalle.estado)}</span>
                    </div>
                </div>
                <hr class="panel-divider">
                <h4 class="panel-section-title">Información personal</h4>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">DNI</span><span class="info-value">${escapeHtml(detalle.dni)}</span></div>
                    <div class="info-item"><span class="info-label">Correo</span><span class="info-value">${escapeHtml(detalle.correo || 'No registrado')}</span></div>
                    <div class="info-item"><span class="info-label">Celular</span><span class="info-value">${escapeHtml(detalle.celular)}</span></div>
                    <div class="info-item"><span class="info-label">Fecha de nacimiento</span><span class="info-value">${escapeHtml(detalle.fecha_nacimiento)}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Dirección</span><span class="info-value">${escapeHtml(detalle.direccion)}</span></div>
                </div>
                <hr class="panel-divider">
                <h4 class="panel-section-title">Información de vigencia de matrícula</h4>
                <div class="info-grid">
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Disciplina(s)</span><span class="info-value">${escapeHtml(detalle.disciplinas)}</span></div>
                    <div class="info-item"><span class="info-label">Fecha de inscripción</span><span class="info-value">${escapeHtml(detalle.fecha_inscripcion)}</span></div>
                    <div class="info-item"><span class="info-label">Fecha de vencimiento</span><span class="info-value font-medium" style="color: ${esPorVencer ? '#e65100' : 'inherit'};">${escapeHtml(detalle.fecha_vencimiento || 'No registrada')}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Vigencia / Días restantes</span><span class="info-value font-medium" style="color: ${esPorVencer ? '#e65100' : 'inherit'};">${escapeHtml(detalle.dias_restantes_texto)}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Estado del alumno</span><span class="info-value">${escapeHtml(detalle.estado_alumno)}</span></div>
                </div>
                <hr class="panel-divider">
                <h4 class="panel-section-title">Observaciones médicas</h4>
                <div class="info-grid"><div class="info-item" style="grid-column: span 2;"><span class="info-value text-muted">${escapeHtml(detalle.observaciones_medicas || 'Sin observaciones.')}</span></div></div>
            `;
        } catch (error) {
            console.error('Error cargando detalle:', error);
            sidePanelContent.innerHTML = `<div class="text-danger mt-4 text-center">${escapeHtml(error.message)}</div>`;
        }
    };

    if (btnPorVencer) {
        btnPorVencer.addEventListener('click', () => {
            filterSelect.value = 'Por vencer';
            filterAlumnos();
        });
    }

    btnClosePanel.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    if (searchInput) searchInput.addEventListener('input', filterAlumnos);
    if (filterSelect) filterSelect.addEventListener('change', filterAlumnos);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePanel();
    });
    loadAlumnos();
});
