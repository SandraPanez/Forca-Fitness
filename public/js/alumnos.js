document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('alumnos-tbody');
    const overlay = document.getElementById('side-panel-overlay');
    const sidePanel = document.getElementById('side-panel');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const sidePanelContent = document.getElementById('side-panel-content');
    const searchInput = document.getElementById('search-input') || document.querySelector('.search-input');
    const filterSelect = document.getElementById('filter-select') || document.querySelector('.filter-select');
    const btnPorVencer = document.getElementById('btn-por-vencer');
    const btnLimpiarFiltro = document.getElementById('btn-limpiar-filtro');
    const feedbackBanner = document.getElementById('inhabilitar-feedback');

    // KPI Cards
    const kpiCardTotal = document.getElementById('kpi-card-total');
    const kpiCardActivas = document.getElementById('kpi-card-activas');
    const kpiCardPorVencer = document.getElementById('kpi-card-por-vencer');
    const kpiCardVencidas = document.getElementById('kpi-card-vencidas');
    const kpiTotalVal = document.getElementById('kpi-total-val');
    const kpiActivasVal = document.getElementById('kpi-activas-val');
    const kpiPorVencerVal = document.getElementById('kpi-por-vencer-val');
    const kpiVencidasVal = document.getElementById('kpi-vencidas-val');

    // Elementos del Modal de Inhabilitación Temporal (HU-03)
    const inhabilitarModal = document.getElementById('inhabilitarModal');
    const inhabilitarForm = document.getElementById('inhabilitarForm');
    const inputAlumnoId = document.getElementById('inhabilitar-alumno-id');
    const spanAlumnoNombre = document.getElementById('inhabilitar-alumno-nombre');
    const selectDuracionPreset = document.getElementById('inhabilitar-duracion-preset');
    const inputFechaInicio = document.getElementById('inhabilitar-fecha-inicio');
    const inputFechaFin = document.getElementById('inhabilitar-fecha-fin');
    const inputMotivo = document.getElementById('inhabilitar-motivo');
    const motivoCounter = document.getElementById('inhabilitar-motivo-counter');
    const inhabilitarError = document.getElementById('inhabilitar-error');
    const btnCloseInhabilitarModal = document.getElementById('btn-close-inhabilitar-modal');
    const btnCancelInhabilitar = document.getElementById('btn-cancel-inhabilitar');
    const btnConfirmInhabilitar = document.getElementById('btn-confirm-inhabilitar');

    let alumnosCache = [];
    let alumnoDetalleActualId = null;

    // El historial de matrículas solo lo consulta el Director
    const esDirector = typeof obtenerRolesUsuario === 'function' && obtenerRolesUsuario().includes('DIRECTOR');

    const puedeInhabilitar = () => {
        if (typeof obtenerRolesUsuario !== 'function') return true;
        const roles = obtenerRolesUsuario().map(r => String(r).toUpperCase());
        if (roles.length === 0) return true;
        return roles.includes('DIRECTOR') || roles.includes('PROFESOR');
    };

    const toIsoDateString = (dateObj) => {
        const year = dateObj.getFullYear();
        const month = String(dateObj.getMonth() + 1).padStart(2, '0');
        const day = String(dateObj.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const showFeedback = (message, type = 'success') => {
        if (!feedbackBanner) return;
        feedbackBanner.textContent = message;
        feedbackBanner.className = `feedback-banner ${type}`;
        feedbackBanner.hidden = false;
        setTimeout(() => {
            feedbackBanner.hidden = true;
        }, 6000);
    };

    const closePanel = () => {
        overlay.classList.remove('active');
        sidePanel.classList.remove('active');
        alumnoDetalleActualId = null;
    };

    const aplicarPresetDuracion = () => {
        if (!selectDuracionPreset || !inputFechaInicio || !inputFechaFin) return;
        const presetVal = selectDuracionPreset.value;
        if (presetVal === 'custom') return;

        const dias = parseInt(presetVal, 10);
        if (Number.isNaN(dias)) return;

        const baseStr = inputFechaInicio.value || toIsoDateString(new Date());
        inputFechaInicio.value = baseStr;
        const fechaFinObj = new Date(`${baseStr}T00:00:00`);
        fechaFinObj.setDate(fechaFinObj.getDate() + dias);
        inputFechaFin.value = toIsoDateString(fechaFinObj);
    };

    const openInhabilitarModal = (id, nombreCompleto) => {
        if (!inhabilitarModal) return;
        inputAlumnoId.value = id;
        spanAlumnoNombre.textContent = nombreCompleto;

        const hoyStr = toIsoDateString(new Date());
        inputFechaInicio.value = hoyStr;
        selectDuracionPreset.value = '15';
        aplicarPresetDuracion();

        inputMotivo.value = '';
        if (motivoCounter) motivoCounter.textContent = '0 / 90 caracteres';
        if (inhabilitarError) {
            inhabilitarError.style.display = 'none';
            inhabilitarError.textContent = '';
        }
        inhabilitarForm.classList.remove('was-validated');

        inhabilitarModal.classList.add('active');
        inhabilitarModal.setAttribute('aria-hidden', 'false');
        inputMotivo.focus();
    };

    const closeInhabilitarModal = () => {
        if (!inhabilitarModal) return;
        inhabilitarModal.classList.remove('active');
        inhabilitarModal.setAttribute('aria-hidden', 'true');
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
            case 'Inhabilitada':
            case 'Inhabilitado':
                return 'badge-inhabilitada';
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
        const inhabilitado = Boolean(alumno.inhabilitado) || alumno.estado_matricula === 'Inhabilitada' || alumno.estado_alumno === 'Inhabilitado';
        if (inhabilitado) {
            return alumno.periodo_inhabilitacion?.fecha_fin
                ? `Hasta ${formatearFecha(alumno.periodo_inhabilitacion.fecha_fin)} (Matrícula conservada)`
                : 'Inhabilitado temporalmente';
        }

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
        const total = alumnosCache.length;
        const activas = alumnosCache.filter(a => a.estado_matricula === 'Activa').length;
        const porVencer = alumnosCache.filter(a => a.estado_matricula === 'Próxima a vencer' || a.por_vencer).length;
        const vencidas = alumnosCache.filter(a => a.estado_matricula === 'Vencida').length;

        if (kpiTotalVal) kpiTotalVal.textContent = total;
        if (kpiActivasVal) kpiActivasVal.textContent = activas;
        if (kpiPorVencerVal) kpiPorVencerVal.textContent = porVencer;
        if (kpiVencidasVal) kpiVencidasVal.textContent = vencidas;

        const optPorVencer = filterSelect?.querySelector('option[value="Por vencer"]');
        if (optPorVencer) {
            optPorVencer.textContent = `⚠️ Matrículas por vencer (${porVencer})`;
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

        const mostrarBotonInhabilitar = puedeInhabilitar();

        alumnos.forEach((alumno) => {
            const inhabilitado = Boolean(alumno.inhabilitado) || alumno.estado_matricula === 'Inhabilitada' || alumno.estado_alumno === 'Inhabilitado';
            const estadoMostrar = inhabilitado ? 'Inhabilitada' : alumno.estado_matricula;
            const badgeClass = getBadgeClass(estadoMostrar);
            const diasTexto = getDiasText(alumno);
            const fechaVenc = formatearFecha(alumno.fecha_vencimiento);
            const nombreCompleto = [alumno.nombres, alumno.apellido_paterno, alumno.apellido_materno].filter(Boolean).join(' ');

            const disciplinasArr = Array.isArray(alumno.disciplinas) && alumno.disciplinas.length
                ? alumno.disciplinas
                : ['General'];

            const disciplinasHtml = disciplinasArr
                .map(d => `<span class="badge-disciplina-pill">${escapeHtml(d)}</span>`)
                .join('');

            const esVencida = estadoMostrar === 'Vencida';
            const esPorVencer = !inhabilitado && (estadoMostrar === 'Próxima a vencer' || alumno.por_vencer);
            const fechaClase = esVencida ? 'vencida' : (esPorVencer ? 'alerta' : '');

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div class="alumno-row">
                        <div class="avatar-circle">${escapeHtml(alumno.iniciales || 'AL')}</div>
                        <span class="font-medium" style="color: #0f172a; font-weight: 600;">
                            ${escapeHtml(nombreCompleto)}
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
                    <span class="badge-status ${badgeClass}">${escapeHtml(estadoMostrar)}</span>
                    ${diasTexto ? `<span class="dias-text" style="display: block; margin-top: 0.2rem;">${escapeHtml(diasTexto)}</span>` : ''}
                </td>
                <td class="text-right">
                    <div class="acciones-cell">
                        <button class="btn-link btn-ver-detalle" data-id="${escapeHtml(alumno.id)}" title="Ver vigencia de matrícula y detalles">Ver detalle</button>
                        ${esDirector ? `<a class="btn-link btn-historial" href="/historial-matriculas.html?alumno=${encodeURIComponent(alumno.id)}" title="Ver historial de matrículas">Ver historial de matrículas</a>` : ''}
                        ${mostrarBotonInhabilitar ? `
                            <button
                                type="button"
                                class="btn-inhabilitar-row"
                                data-id="${escapeHtml(alumno.id)}"
                                data-nombre="${escapeHtml(nombreCompleto)}"
                                ${inhabilitado ? 'disabled title="El alumno ya se encuentra inhabilitado"' : ''}
                            >
                                ${inhabilitado ? 'Inhabilitado' : 'Inhabilitar'}
                            </button>
                        ` : ''}
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        tbody.querySelectorAll('.btn-ver-detalle').forEach((button) => {
            button.addEventListener('click', () => loadStudentDetails(button.dataset.id));
        });

        tbody.querySelectorAll('.btn-inhabilitar-row').forEach((button) => {
            button.addEventListener('click', () => {
                if (!button.disabled) {
                    openInhabilitarModal(button.dataset.id, button.dataset.nombre);
                }
            });
        });
    };

    const filterAlumnos = () => {
        const search = (searchInput?.value || '').trim().toLowerCase();
        const status = filterSelect?.value || 'Todos';

        setActiveKpiCard(status);

        const filtered = alumnosCache.filter((alumno) => {
            const fullName = `${alumno.nombres || ''} ${alumno.apellido_paterno || ''} ${alumno.apellido_materno || ''}`.toLowerCase();
            const matchesSearch = !search
                || fullName.includes(search)
                || (alumno.disciplinas || []).some(d => String(d).toLowerCase().includes(search));

            const inhabilitado = Boolean(alumno.inhabilitado) || alumno.estado_matricula === 'Inhabilitada' || alumno.estado_alumno === 'Inhabilitado';

            let matchesStatus = true;
            if (status === 'Por vencer') {
                matchesStatus = !inhabilitado && (alumno.estado_matricula === 'Próxima a vencer' || alumno.por_vencer === true);
            } else if (status === 'Activa' || status === 'Activo') {
                matchesStatus = !inhabilitado && alumno.estado_matricula === 'Activa';
            } else if (status === 'Vencida' || status === 'Inactivo') {
                matchesStatus = !inhabilitado && alumno.estado_matricula === 'Vencida';
            } else if (status === 'Reservada') {
                matchesStatus = !inhabilitado && alumno.estado_matricula === 'Reservada';
            } else if (status === 'Inhabilitada' || status === 'Inhabilitado') {
                matchesStatus = inhabilitado;
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
            updateKpis();
            filterAlumnos();
        } catch (error) {
            console.error('Error cargando alumnos:', error);
            const message = error instanceof Error ? error.message : 'Error desconocido al cargar alumnos.';
            tbody.innerHTML = `<tr><td colspan="5"><div role="alert" class="text-center text-danger" style="padding: 2rem;">${escapeHtml(message)}</div></td></tr>`;
        }
    };

    const loadStudentDetails = async (id) => {
        alumnoDetalleActualId = id;
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
            const inhabilitado = Boolean(detalle.inhabilitado) || detalle.estado_alumno === 'Inhabilitado' || detalle.estado === 'Inhabilitada';
            const badgeClass = getBadgeClass(detalle.estado);
            const esPorVencer = detalle.estado === 'Próxima a vencer';
            const mostrarBotonInhabilitar = puedeInhabilitar();

            const bloquePeriodoInhabilitacion = detalle.inhabilitacion ? `
                <hr class="panel-divider">
                <h4 class="panel-section-title">Registro de inhabilitación temporal</h4>
                <div class="inhabilitacion-info-box">
                    <div class="info-grid" style="gap: 0.85rem;">
                        <div class="info-item">
                            <span class="info-label">Inicio del periodo</span>
                            <span class="info-value font-medium">${escapeHtml(detalle.inhabilitacion.fecha_inicio_formato)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Fin del periodo</span>
                            <span class="info-value font-medium">${escapeHtml(detalle.inhabilitacion.fecha_fin_formato)}</span>
                        </div>
                        <div class="info-item" style="grid-column: span 2;">
                            <span class="info-label">Motivo registrado</span>
                            <span class="info-value">${escapeHtml(detalle.inhabilitacion.motivo)}</span>
                        </div>
                    </div>
                </div>
            ` : '';

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
                <h4 class="panel-section-title">Información personal (Conservada)</h4>
                <div class="info-grid">
                    <div class="info-item"><span class="info-label">DNI</span><span class="info-value">${escapeHtml(detalle.dni)}</span></div>
                    <div class="info-item"><span class="info-label">Correo</span><span class="info-value">${escapeHtml(detalle.correo || 'No registrado')}</span></div>
                    <div class="info-item"><span class="info-label">Celular</span><span class="info-value">${escapeHtml(detalle.celular)}</span></div>
                    <div class="info-item"><span class="info-label">Fecha de nacimiento</span><span class="info-value">${escapeHtml(detalle.fecha_nacimiento)}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Dirección</span><span class="info-value">${escapeHtml(detalle.direccion)}</span></div>
                </div>
                <hr class="panel-divider">
                <h4 class="panel-section-title">Información de vigencia de matrícula (Conservada)</h4>
                <div class="info-grid">
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Disciplina(s)</span><span class="info-value">${escapeHtml(detalle.disciplinas)}</span></div>
                    <div class="info-item"><span class="info-label">Fecha de inscripción</span><span class="info-value">${escapeHtml(detalle.fecha_inscripcion)}</span></div>
                    <div class="info-item"><span class="info-label">Fecha de vencimiento</span><span class="info-value font-medium" style="color: ${esPorVencer ? '#e65100' : 'inherit'};">${escapeHtml(detalle.fecha_vencimiento || 'No registrada')}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Vigencia / Días restantes</span><span class="info-value font-medium" style="color: ${esPorVencer ? '#e65100' : 'inherit'};">${escapeHtml(detalle.dias_restantes_texto)}</span></div>
                    <div class="info-item" style="grid-column: span 2;"><span class="info-label">Estado del alumno</span><span class="info-value font-medium">${escapeHtml(detalle.estado_alumno)}</span></div>
                </div>
                ${bloquePeriodoInhabilitacion}
                <hr class="panel-divider">
                <h4 class="panel-section-title">Observaciones médicas</h4>
                <div class="info-grid"><div class="info-item" style="grid-column: span 2;"><span class="info-value text-muted">${escapeHtml(detalle.observaciones_medicas || 'Sin observaciones.')}</span></div></div>
                ${mostrarBotonInhabilitar ? `
                    <div class="panel-actions-footer">
                        <button
                            type="button"
                            class="btn-inhabilitar-panel"
                            id="btn-panel-inhabilitar"
                            data-id="${escapeHtml(detalle.id || id)}"
                            data-nombre="${escapeHtml(detalle.nombre_completo)}"
                            ${inhabilitado ? 'disabled' : ''}
                        >
                            ${inhabilitado ? 'Alumno actualmente inhabilitado' : 'Inhabilitar temporalmente al alumno'}
                        </button>
                    </div>
                ` : ''}
            `;

            const btnPanelInhabilitar = document.getElementById('btn-panel-inhabilitar');
            if (btnPanelInhabilitar && !btnPanelInhabilitar.disabled) {
                btnPanelInhabilitar.addEventListener('click', () => {
                    openInhabilitarModal(btnPanelInhabilitar.dataset.id, btnPanelInhabilitar.dataset.nombre);
                });
            }
        } catch (error) {
            console.error('Error cargando detalle:', error);
            sidePanelContent.innerHTML = `<div class="text-danger mt-4 text-center">${escapeHtml(error.message)}</div>`;
        }
    };

    if (selectDuracionPreset) {
        selectDuracionPreset.addEventListener('change', aplicarPresetDuracion);
    }

    if (inputFechaInicio) {
        inputFechaInicio.addEventListener('change', () => {
            if (selectDuracionPreset && selectDuracionPreset.value !== 'custom') {
                aplicarPresetDuracion();
            }
        });
    }

    if (inputFechaFin) {
        inputFechaFin.addEventListener('change', () => {
            if (selectDuracionPreset) {
                selectDuracionPreset.value = 'custom';
            }
        });
    }

    if (inputMotivo && motivoCounter) {
        inputMotivo.addEventListener('input', () => {
            motivoCounter.textContent = `${inputMotivo.value.length} / 90 caracteres`;
        });
    }

    if (btnCloseInhabilitarModal) {
        btnCloseInhabilitarModal.addEventListener('click', closeInhabilitarModal);
    }

    if (btnCancelInhabilitar) {
        btnCancelInhabilitar.addEventListener('click', closeInhabilitarModal);
    }

    if (inhabilitarModal) {
        inhabilitarModal.addEventListener('click', (event) => {
            if (event.target === inhabilitarModal) {
                closeInhabilitarModal();
            }
        });
    }

    if (inhabilitarForm) {
        inhabilitarForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            inhabilitarForm.classList.add('was-validated');

            const idAlumno = inputAlumnoId.value;
            const fechaInicio = inputFechaInicio.value;
            const fechaFin = inputFechaFin.value;
            const motivo = inputMotivo.value.trim();

            if (!fechaInicio || !fechaFin || !motivo) {
                inhabilitarError.textContent = 'Por favor, completa las fechas del periodo de inhabilitación y el motivo.';
                inhabilitarError.style.display = 'block';
                return;
            }

            if (new Date(`${fechaFin}T00:00:00`) < new Date(`${fechaInicio}T00:00:00`)) {
                inhabilitarError.textContent = 'La fecha de fin debe ser igual o posterior a la fecha de inicio.';
                inhabilitarError.style.display = 'block';
                return;
            }

            inhabilitarError.style.display = 'none';
            btnConfirmInhabilitar.disabled = true;
            const textoOriginal = btnConfirmInhabilitar.textContent;
            btnConfirmInhabilitar.textContent = 'Procesando...';

            try {
                const response = await authFetch(`/api/alumnos/${encodeURIComponent(idAlumno)}/inhabilitar`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fecha_inicio: fechaInicio,
                        fecha_fin: fechaFin,
                        motivo: motivo
                    })
                });

                const result = await response.json();
                if (!response.ok || !result.success) {
                    throw new Error(result.message || 'No se pudo inhabilitar temporalmente al alumno.');
                }

                closeInhabilitarModal();
                showFeedback(result.message || 'Alumno inhabilitado temporalmente con éxito.', 'success');
                await loadAlumnos();

                if (alumnoDetalleActualId === idAlumno && sidePanel.classList.contains('active')) {
                    await loadStudentDetails(idAlumno);
                }
            } catch (error) {
                console.error('Error al inhabilitar alumno:', error);
                inhabilitarError.textContent = error.message || 'Ocurrió un error al procesar la inhabilitación.';
                inhabilitarError.style.display = 'block';
            } finally {
                btnConfirmInhabilitar.disabled = false;
                btnConfirmInhabilitar.textContent = textoOriginal;
            }
        });
    }

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
            filterAlumnos();
        });
    }

    btnClosePanel.addEventListener('click', closePanel);
    overlay.addEventListener('click', closePanel);
    if (searchInput) searchInput.addEventListener('input', filterAlumnos);
    if (filterSelect) filterSelect.addEventListener('change', filterAlumnos);
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            if (inhabilitarModal && inhabilitarModal.classList.contains('active')) {
                closeInhabilitarModal();
            } else {
                closePanel();
            }
        }
    });

    loadAlumnos();
});
