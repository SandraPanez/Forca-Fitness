document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('alumnos-tbody');
    const overlay = document.getElementById('side-panel-overlay');
    const sidePanel = document.getElementById('side-panel');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const searchInput = document.querySelector('.search-input');
    const filterSelect = document.querySelector('.filter-select');
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

    const renderTable = (alumnos) => {
        tbody.innerHTML = '';
        if (!alumnos.length) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay alumnos registrados.</td></tr>';
            return;
        }

        alumnos.forEach((alumno) => {
            const activa = alumno.estado_matricula === 'Activa';
            const estado = activa ? 'Activa' : 'Vencida';
            const dias = Number(alumno.dias_restantes) || 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="alumno-row">
                        <div class="avatar-circle">${escapeHtml(alumno.iniciales)}</div>
                        <span class="font-medium">${escapeHtml(alumno.nombres)} ${escapeHtml(alumno.apellido_paterno)} ${escapeHtml(alumno.apellido_materno)}</span>
                    </div>
                </td>
                <td><span class="badge-status ${activa ? 'badge-activa' : 'badge-vencida'}">${estado}</span>
                    <span class="dias-text">${activa ? `${dias} días restantes` : `Venció hace ${Math.abs(dias)} días`}</span>
                </td>
                <td class="text-right"><button class="btn-link" data-id="${escapeHtml(alumno.id)}">Ver detalle</button></td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-link').forEach((button) => {
            button.addEventListener('click', () => loadStudentDetails(button.dataset.id));
        });
    };

    const filterAlumnos = () => {
        const search = searchInput.value.trim().toLowerCase();
        const status = filterSelect.value.toLowerCase();
        renderTable(alumnosCache.filter((alumno) => {
            const name = `${alumno.nombres} ${alumno.apellido_paterno} ${alumno.apellido_materno}`.toLowerCase();
            const matchesSearch = !search || name.includes(search);
            const matchesStatus = status === 'todos' || (status === 'activo' && alumno.estado_matricula === 'Activa') ||
                (status === 'inactivo' && alumno.estado_matricula !== 'Activa');
            return matchesSearch && matchesStatus;
        }));
    };

    const loadAlumnos = async () => {
        try {
            const response = await authFetch('/api/alumnos');
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'No se pudieron cargar los alumnos.');
            }
            alumnosCache = result.data;
            filterAlumnos();
        } catch (error) {
            console.error('Error cargando alumnos:', error);
            tbody.innerHTML = `<tr><td colspan="3" class="text-center text-danger">${escapeHtml(error.message)}</td></tr>`;
        }
    };

    const loadStudentDetails = async (id) => {
        overlay.classList.add('active');
        sidePanel.classList.add('active');
        sidePanelContent.innerHTML = '<div class="text-center text-muted mt-4">Cargando información...</div>';
        try {
            const response = await authFetch(
                `/api/alumnos/${encodeURIComponent(id)}`
            );
            const result = await response.json();
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'No se pudo cargar el detalle.');
            }
            const detalle = result.data;
            const activa = detalle.estado === 'Activa';
            sidePanelContent.innerHTML = `
                <div class="side-panel-header-info">
                    <div class="avatar-large">${escapeHtml(detalle.nombre_completo.substring(0, 2).toUpperCase())}</div>
                    <div><h2 class="student-name-large">${escapeHtml(detalle.nombre_completo)}</h2>
                    <span class="badge-status ${activa ? 'badge-activa' : 'badge-vencida'}">${escapeHtml(detalle.estado)}</span></div>
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
                <h4 class="panel-section-title">Información de matrícula</h4>
                <div class="info-grid">
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Disciplina(s)</span><span class="info-value">${escapeHtml(detalle.disciplinas)}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Fecha de inscripción</span><span class="info-value">${escapeHtml(detalle.fecha_inscripcion)}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Estado de matrícula</span><span class="info-value font-medium">${escapeHtml(detalle.dias_restantes_texto)}</span></div>
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

    btnClosePanel.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    searchInput.addEventListener('input', filterAlumnos);
    filterSelect.addEventListener('change', filterAlumnos);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePanel();
    });
    loadAlumnos();
});
