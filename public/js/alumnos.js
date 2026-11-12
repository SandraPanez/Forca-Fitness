document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('alumnos-tbody');
    const overlay = document.getElementById('side-panel-overlay');
    const sidePanel = document.getElementById('side-panel');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const searchInput = document.getElementById('search-input') || document.querySelector('.search-input');
    const btnBuscarAlumnos = document.getElementById('btn-buscar-alumnos');
    const filterSelect = document.getElementById('filter-select') || document.querySelector('.filter-select');
    const disciplinaSelect = document.getElementById('disciplina-select');
    const btnPorVencer = document.getElementById('btn-por-vencer');
    const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');

    // KPI Cards
    const kpiCardTotal = document.getElementById('kpi-card-total');
    const kpiCardActivas = document.getElementById('kpi-card-activas');
    const kpiCardPorVencer = document.getElementById('kpi-card-por-vencer');
    const kpiCardVencidas = document.getElementById('kpi-card-vencidas');
    const kpiTotalVal = document.getElementById('kpi-total-val');
    const kpiActivasVal = document.getElementById('kpi-activas-val');
    const kpiPorVencerVal = document.getElementById('kpi-por-vencer-val');
    const kpiVencidasVal = document.getElementById('kpi-vencidas-val');

    let alumnosCache = [];    // El historial de matrículas solo lo consulta el Director
    const esDirector = obtenerRolesUsuario().includes('DIRECTOR');

    // Solo el Director puede seleccionar alumnos inhabilitados.
    if (!esDirector && filterSelect) {
        const opcionInhabilitados = filterSelect.querySelector(
            'option[value="Inhabilitado"]'
        );
        opcionInhabilitados?.remove();
    }

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

    const formatearFecha = (fechaStr) => {
        if (!fechaStr) return 'No registrada';
        const parts = fechaStr.slice(0, 10).split('-');
        if (parts.length === 3) {
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
        }
        return fechaStr;
    };

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
            case 'Sin matr\u00edcula':
            case 'Sin fecha de vencimiento':
                return 'badge-sin-vigencia';
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

    const updateKpis = () => {
        const alumnosListado = alumnosCache.filter(alumno =>
            ['ACTIVO', 'INACTIVO'].includes(
                String(alumno.estado_alumno_registrado || '').trim().toUpperCase()
            )
        );
        const total = alumnosListado.length;
        const activas = alumnosListado.filter(a => a.estado_matricula === 'Activa').length;
        const porVencer = alumnosListado.filter(a => a.estado_matricula === 'Próxima a vencer' || a.por_vencer).length;
        const vencidas = alumnosListado.filter(a => a.estado_matricula === 'Vencida').length;

        if (kpiTotalVal) kpiTotalVal.textContent = total;
        if (kpiActivasVal) kpiActivasVal.textContent = activas;
        if (kpiPorVencerVal) kpiPorVencerVal.textContent = porVencer;
        if (kpiVencidasVal) kpiVencidasVal.textContent = vencidas;

        const optPorVencer = filterSelect?.querySelector('option[value="Por vencer"]');
        if (optPorVencer) {
            optPorVencer.textContent = `⚠️ Matrículas por vencer (${porVencer})`;
        }
    };

    const cargarDisciplinas = () => {
        if (!disciplinaSelect) return;

        const disciplinas = [...new Set(alumnosCache.flatMap(alumno =>
            Array.isArray(alumno.disciplinas) ? alumno.disciplinas : []
        ).map(d => String(d).trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b, 'es'));

        disciplinaSelect.innerHTML = '<option value="Todas">Todas las disciplinas</option>';

        for (const nombre of disciplinas) {
            const opcion = document.createElement('option');
            opcion.value = nombre;
            opcion.textContent = nombre;
            disciplinaSelect.appendChild(opcion);
        }
    };

    const setActiveKpiCard = (status) => {
        document.querySelectorAll('.kpi-card').forEach(card => card.classList.remove('active'));
        if (status === 'Todos') kpiCardTotal?.classList.add('active');
        else if (status === 'Activa') kpiCardActivas?.classList.add('active');
        else if (status === 'Por vencer') kpiCardPorVencer?.classList.add('active');
        else if (status === 'Vencida') kpiCardVencidas?.classList.add('active');
    };

    const renderTable = (alumnos) => {
        tbody.innerHTML = '';
        if (!alumnos.length) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted" style="padding: 2.5rem 1rem;">No se encontraron alumnos con el criterio seleccionado.</td></tr>';
            return;
        }

        alumnos.forEach((alumno) => {
            const badgeClass = getBadgeClass(alumno.estado_matricula);
            const diasTexto = getDiasText(alumno);
            const fechaVenc = formatearFecha(alumno.fecha_vencimiento);
            const disciplinasArr = Array.isArray(alumno.disciplinas) && alumno.disciplinas.length
                ? alumno.disciplinas
                : ['General'];

            const disciplinasHtml = disciplinasArr
                .map(d => `<span class="badge-disciplina-pill">${escapeHtml(d)}</span>`)
                .join('');

            const esVencida = alumno.estado_matricula === 'Vencida';
            const esPorVencer = alumno.estado_matricula === 'Próxima a vencer' || alumno.por_vencer;
            const fechaClase = esVencida ? 'vencida' : (esPorVencer ? 'alerta' : '');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="alumno-row">
                        <div class="avatar-circle">${escapeHtml(alumno.iniciales || 'AL')}</div>
                        <span class="font-medium" style="color: #0f172a; font-weight: 600;">
                            ${escapeHtml(alumno.nombres)} ${escapeHtml(alumno.apellido_paterno)} ${escapeHtml(alumno.apellido_materno)}
                        </span>
                    </div>
                </td>
                <td>
                    <div style="display: flex; flex-wrap: wrap;">
                        ${disciplinasHtml}
                    </div>
                </td>
                <td>
                    <span class="fecha-vencimiento-text ${fechaClase}">${escapeHtml(fechaVenc)}</span>
                </td>
                <td>
                    <span class="badge-status ${badgeClass}">${escapeHtml(alumno.estado_matricula)}</span>
                    ${diasTexto ? `<span class="dias-text" style="display: block; margin-top: 0.2rem;">${escapeHtml(diasTexto)}</span>` : ''}
                </td>
                <td class="text-right">
                    <button class="btn-link" data-id="${escapeHtml(alumno.id)}" title="Ver vigencia de matrícula y detalles">Ver detalle</button>
                    ${esDirector ? `<a class="btn-link btn-historial" href="/historial-matriculas.html?alumno=${encodeURIComponent(alumno.id)}" title="Ver historial de matrículas">Ver historial de matrículas</a>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('button.btn-link').forEach((button) => {
            button.addEventListener('click', () => loadStudentDetails(button.dataset.id));
        });
    };

    const normalizarTexto = valor => String(valor ?? '')
        .toLocaleLowerCase('es')
        .normalize('NFD')
        .replace(/n\u0303/g, '\u00f1')
        .replace(/[\u0300-\u036f]/g, '');

    const filterAlumnos = () => {
        const search = normalizarTexto(searchInput?.value).trim();
        const status = filterSelect?.value || 'Todos';
        const disciplina = disciplinaSelect?.value || 'Todas';

        setActiveKpiCard(status);

        const filtered = alumnosCache.filter((alumno) => {
            const fullName = normalizarTexto(`${alumno.nombres || ''} ${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''}`);
            const matchesSearch = !search
                || fullName.includes(search)
                || String(alumno.dni ?? '').includes(search)
                || (alumno.disciplinas || []).some(d => normalizarTexto(d).includes(search));

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

            const estadoAlumno = String(alumno.estado_alumno_registrado || '').trim().toUpperCase();
            const estadosPermitidos =
                status === 'Inhabilitado' ? ['INHABILITADO']
                : status === 'Activo' ? ['ACTIVO']
                : status === 'Inactivo' ? ['INACTIVO']
                : ['ACTIVO', 'INACTIVO'];
            const matchesHabilitacion = estadosPermitidos.includes(estadoAlumno);

            const matchesDisciplina = disciplina === 'Todas' || (
                Array.isArray(alumno.disciplinas) &&
                alumno.disciplinas.some(d => String(d).trim() === disciplina)
            );

            return matchesSearch && matchesStatus && matchesHabilitacion && matchesDisciplina;
        });

        // Los alumnos inactivos aparecen al final del listado.
        filtered.sort((a, b) => {
            const estadoA = String(a.estado_alumno_registrado || '').trim().toUpperCase();
            const estadoB = String(b.estado_alumno_registrado || '').trim().toUpperCase();
            return Number(estadoA === 'INACTIVO') - Number(estadoB === 'INACTIVO');
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
            cargarDisciplinas();
            updateKpis();
            filterAlumnos();
        } catch (error) {
            console.error('Error cargando alumnos:', error);
            const message = error instanceof Error ? error.message : 'Error desconocido al cargar alumnos.';
            tbody.innerHTML = `<tr><td colspan="5"><div role="alert" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(message)}</div></td></tr>`;
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

    // Eventos de los KPI Cards
    if (kpiCardTotal) {
        kpiCardTotal.addEventListener('click', () => {
            if (filterSelect) filterSelect.value = 'Todos';
            filterAlumnos();
        });
    }

    if (kpiCardActivas) {
        kpiCardActivas.addEventListener('click', () => {
            if (filterSelect) filterSelect.value = 'Activa';
            filterAlumnos();
        });
    }

    if (kpiCardPorVencer) {
        kpiCardPorVencer.addEventListener('click', () => {
            if (filterSelect) filterSelect.value = 'Por vencer';
            filterAlumnos();
        });
    }

    if (kpiCardVencidas) {
        kpiCardVencidas.addEventListener('click', () => {
            if (filterSelect) filterSelect.value = 'Vencida';
            filterAlumnos();
        });
    }

    if (btnLimpiarFiltro) {
        btnLimpiarFiltro.addEventListener('click', () => {
            if (searchInput) searchInput.value = '';
            if (filterSelect) filterSelect.value = 'Todos';
            if (disciplinaSelect) disciplinaSelect.value = 'Todas';
            filterAlumnos();
        });
    }

    btnClosePanel.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    if (searchInput) searchInput.addEventListener('input', filterAlumnos);
    if (btnBuscarAlumnos) btnBuscarAlumnos.addEventListener('click', filterAlumnos);
    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                filterAlumnos();
            }
        });
    }
    if (filterSelect) filterSelect.addEventListener('change', filterAlumnos);
    if (disciplinaSelect) disciplinaSelect.addEventListener('change', filterAlumnos);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closePanel();
    });

    loadAlumnos();
});
