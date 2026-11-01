document.addEventListener('DOMContentLoaded', () => {
  const usuario = obtenerUsuario();
  const rolesUsuario = obtenerRolesUsuario(usuario);
  const rolesPermitidos = ['DIRECTOR', 'TESORERO'];

  const tieneAcceso = rolesUsuario.some((rol) =>
    rolesPermitidos.includes(rol)
  );

  if (!usuario || !tieneAcceso) {
    window.location.href = '/login.html';
    return;
  }

  // Elementos del historial de cobros
  const tbody = document.getElementById('treasury-tbody');
  const message = document.getElementById('treasury-message');
  const search = document.getElementById('treasury-search');
  const status = document.getElementById('treasury-status');
  const method = document.getElementById('treasury-method');

  // Elementos de la sección "Pagos por aprobar"
  const pendingTbody = document.getElementById('pending-tbody');
  const pendingMessage = document.getElementById('pending-message');
  const pendingCountBadge = document.getElementById('pending-count-badge');

  // Modal de confirmación
  const confirmModal = document.getElementById('confirm-modal');
  const modalAlumnoName = document.getElementById('modal-alumno-name');
  const modalReferencia = document.getElementById('modal-referencia');
  const modalCancel = document.getElementById('modal-cancel');
  const modalConfirmBtn = document.getElementById('modal-confirm');

  let pendingMatriculaToConfirm = null;
  let pendingButtonToDisable = null;

  // Toast flotante (esquina inferior derecha)
  const showToast = (text, type = 'success', duration = 4500) => {
    const existing = document.querySelector('.confirm-toast');
    if (existing) existing.remove();
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    const toast = document.createElement('div');
    toast.className = `confirm-toast${type !== 'success' ? ' ' + type : ''}`;
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${text}</span>`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(() => toast.remove(), 400); }, duration);
  };

  const showMessage = (text, type = 'info', el = message) => {
    el.textContent = text;
    el.className = `payment-message ${type}`;
  };

  const formatDate = value =>
    value
      ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
      : '—';

  const escapeHtml = value =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  // ────────────────────────────────────────────────────────────
  // Sección "Pagos por aprobar" (efectivo pendiente)
  // ────────────────────────────────────────────────────────────
  async function cargarPendientes() {
    pendingTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">Cargando solicitudes...</td></tr>';
    try {
      const response = await authFetch('/api/pagos/efectivo/pendientes');
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'No se pudieron cargar las solicitudes pendientes.');
      renderPendientes(result.data);
    } catch (error) {
      pendingTbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted">${escapeHtml(error.message)}</td></tr>`;
      showMessage(error.message, 'error', pendingMessage);
    }
  }

  function renderPendientes(pendientes) {
    // Badge con conteo
    if (pendientes.length > 0) {
      pendingCountBadge.textContent = pendientes.length;
      pendingCountBadge.hidden = false;
    } else {
      pendingCountBadge.hidden = true;
    }

    if (!pendientes.length) {
      pendingTbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted" style="padding: 1.5rem;">✅ No hay pagos en efectivo pendientes de confirmación.</td></tr>';
      return;
    }

    pendingTbody.innerHTML = pendientes.map(p => `
      <tr class="pending-approval-row">
        <td>
          <strong>${escapeHtml(p.alumno)}</strong>
          <small class="treasury-muted">${escapeHtml(p.id_matricula)}</small>
        </td>
        <td>${escapeHtml(p.disciplinas || 'Mensualidad')}</td>
        <td><strong>S/ ${Number(p.monto).toFixed(2)}</strong></td>
        <td>${formatDate(p.fecha_pago)}</td>
        <td>
          <span class="vence-countdown" data-vence="${escapeHtml(p.fecha_vencimiento)}">
            ${formatDate(p.fecha_vencimiento)}
          </span>
        </td>
        <td>
          <button
            class="btn-approve-cash"
            data-matricula="${escapeHtml(p.id_matricula)}"
            data-alumno="${escapeHtml(p.alumno)}"
            type="button"
          >
            ✓ Confirmar pago
          </button>
        </td>
      </tr>
    `).join('');

    pendingTbody.querySelectorAll('.btn-approve-cash').forEach(btn => {
      btn.addEventListener('click', () => abrirModalConfirmacion(btn));
    });
  }

  function abrirModalConfirmacion(btn) {
    pendingMatriculaToConfirm = btn.dataset.matricula;
    pendingButtonToDisable = btn;
    modalAlumnoName.textContent = btn.dataset.alumno || 'este alumno';
    modalReferencia.value = '';
    confirmModal.removeAttribute('hidden');
    confirmModal.style.display = 'flex';
  }

  function cerrarModal() {
    confirmModal.setAttribute('hidden', '');
    confirmModal.style.display = 'none';
    pendingMatriculaToConfirm = null;
    pendingButtonToDisable = null;
  }

  modalCancel.addEventListener('click', cerrarModal);
  confirmModal.addEventListener('click', e => {
    if (e.target === confirmModal) cerrarModal();
  });

  modalConfirmBtn.addEventListener('click', async () => {
    if (!pendingMatriculaToConfirm) return;
    modalConfirmBtn.disabled = true;
    modalConfirmBtn.textContent = 'Confirmando...';
    try {
      const response = await authFetch('/api/pagos/efectivo/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_matricula: pendingMatriculaToConfirm,
          referencia_operacion: modalReferencia.value.trim() || null
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo confirmar el pago.');
      cerrarModal();
      // Recargar ambas secciones
      await Promise.all([cargarPendientes(), cargarCobros()]);
      showToast('Pago confirmado correctamente. La matrícula del alumno ha sido activada.', 'success');
      // Redirigir al comprobante si está disponible
      if (result.data?.Id_Pago) {
        setTimeout(() => {
          window.location.href = `/comprobante.html?pago=${encodeURIComponent(result.data.Id_Pago)}`;
        }, 2000);
      }
    } catch (error) {
      showToast(error.message, 'error');
      modalConfirmBtn.disabled = false;
      modalConfirmBtn.textContent = 'Sí, confirmar pago';
    }
  });

  // ────────────────────────────────────────────────────────────
  // Historial de cobros
  // ────────────────────────────────────────────────────────────
  async function cargarCobros() {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Cargando cobros...</td></tr>';
    const params = new URLSearchParams({
      estado: status.value,
      medio: method.value,
      busqueda: search.value.trim()
    });
    try {
      const response = await authFetch(`/api/pagos/gestion?${params}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'No se pudieron cargar los cobros.');
      renderCobros(result.data);
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${escapeHtml(error.message)}</td></tr>`;
      showMessage(error.message, 'error');
    }
  }

  // Efectivo pendiente: se confirma. Pago aprobado: se puede ver su comprobante (HU-12).
  function accionDeCobro(cobro) {
    if (cobro.estado_pago === 'PENDIENTE' && cobro.medio_pago === 'EFECTIVO') {
      return `<button class="btn-confirm-cash" data-matricula="${escapeHtml(cobro.id_matricula)}" data-alumno="${escapeHtml(cobro.alumno)}">Confirmar</button>`;
    }
    if (cobro.estado_pago === 'APROBADO') {
      return `<a class="btn-link" href="/comprobante.html?pago=${encodeURIComponent(cobro.id_pago)}">Ver comprobante</a>`;
    }
    return '<span class="treasury-muted">Sin acción</span>';
  }

  function renderCobros(cobros) {
    if (!cobros.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay cobros para los filtros seleccionados.</td></tr>';
      return;
    }
    tbody.innerHTML = cobros.map(cobro => `
      <tr>
        <td>
          <strong>${escapeHtml(cobro.alumno)}</strong>
          <small class="treasury-muted">${escapeHtml(cobro.id_matricula)}</small>
          ${cobro.estado_matricula === 'Reservada' ? '<span class="badge-status badge-reservada" style="margin-left: 0.35rem; font-size: 0.7rem; padding: 2px 6px;">Reservada</span>' : ''}
        </td>
        <td>${escapeHtml(cobro.disciplinas || 'Mensualidad')}</td>
        <td>S/ ${Number(cobro.monto).toFixed(2)}</td>
        <td>${escapeHtml(cobro.medio_pago)}</td>
        <td><span class="status-pill">${escapeHtml(cobro.estado_pago)}</span></td>
        <td>${formatDate(cobro.fecha_vencimiento)}</td>
        <td>${accionDeCobro(cobro)}</td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-confirm-cash').forEach(button => {
      button.addEventListener('click', () => abrirModalConfirmacion(button));
    });
  }

  document.getElementById('treasury-refresh').addEventListener('click', () => {
    cargarPendientes();
    cargarCobros();
    if (tabPorAlumno && tabPorAlumno.classList.contains('active')) {
      cargarAlumnosConPagos();
    }
  });
  status.addEventListener('change', cargarCobros);
  method.addEventListener('change', cargarCobros);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') cargarCobros();
  });

  // ────────────────────────────────────────────────────────────
  // HU: Vista "Por alumno" (Exclusiva para rol TESORERO)
  // ────────────────────────────────────────────────────────────
  const esTesorero = rolesUsuario.includes('TESORERO');
  const tabTodos = document.getElementById('tab-todos');
  const tabPorAlumno = document.getElementById('tab-por-alumno');
  const vistaTodosCobros = document.getElementById('vista-todos-cobros');
  const vistaPorAlumno = document.getElementById('vista-por-alumno');

  let todosLosAlumnos = [];
  let alumnoSeleccionadoActual = null;
  let pagoSeleccionadoActual = null;

  if (esTesorero && tabPorAlumno) {
    tabPorAlumno.style.display = 'inline-block';

    tabTodos.addEventListener('click', () => {
      tabTodos.classList.add('active');
      tabTodos.setAttribute('aria-selected', 'true');
      tabPorAlumno.classList.remove('active');
      tabPorAlumno.setAttribute('aria-selected', 'false');
      vistaTodosCobros.style.display = 'block';
      vistaPorAlumno.style.display = 'none';
    });

    tabPorAlumno.addEventListener('click', () => {
      tabPorAlumno.classList.add('active');
      tabPorAlumno.setAttribute('aria-selected', 'true');
      tabTodos.classList.remove('active');
      tabTodos.setAttribute('aria-selected', 'false');
      vistaTodosCobros.style.display = 'none';
      vistaPorAlumno.style.display = 'block';
      if (!todosLosAlumnos.length) {
        cargarAlumnosConPagos();
      }
    });
  }

  // Elementos de la sección "Por alumno"
  const studentsTbody = document.getElementById('students-tbody');
  const studentsMessage = document.getElementById('students-message');
  const studentsCountLabel = document.getElementById('students-count-label');
  const btnLimpiarFiltros = document.getElementById('btn-limpiar-filtros');

  // Checkboxes de activar filtros
  const chkFiltroNombre = document.getElementById('chk-filtro-nombre');
  const chkFiltroDni = document.getElementById('chk-filtro-dni');
  const chkFiltroDisciplina = document.getElementById('chk-filtro-disciplina');
  const chkFiltroProfesor = document.getElementById('chk-filtro-profesor');
  const chkFiltroMes = document.getElementById('chk-filtro-mes');
  const chkFiltroMetodo = document.getElementById('chk-filtro-metodo');

  // Cajas desplegables de filtros
  const boxFiltroNombre = document.getElementById('box-filtro-nombre');
  const boxFiltroDni = document.getElementById('box-filtro-dni');
  const boxFiltroDisciplina = document.getElementById('box-filtro-disciplina');
  const boxFiltroProfesor = document.getElementById('box-filtro-profesor');
  const boxFiltroMes = document.getElementById('box-filtro-mes');
  const boxFiltroMetodo = document.getElementById('box-filtro-metodo');

  // Inputs y chips
  const inputFiltroNombre = document.getElementById('input-filtro-nombre');
  const inputFiltroDni = document.getElementById('input-filtro-dni');
  const chipsDisciplinas = document.getElementById('chips-disciplinas');
  const chipsProfesores = document.getElementById('chips-profesores');
  const chipsMeses = document.getElementById('chips-meses');
  const chipsMetodos = document.getElementById('chips-metodos');

  // Modales
  const modalHistorial = document.getElementById('modal-historial-alumno');
  const historyAvatar = document.getElementById('history-avatar');
  const historyStudentName = document.getElementById('history-student-name');
  const historyStudentDni = document.getElementById('history-student-dni');
  const historyStudentEmail = document.getElementById('history-student-email');
  const historyCountBadge = document.getElementById('history-count-badge');
  const historyTbody = document.getElementById('history-tbody');
  const closeModalHistorial = document.getElementById('close-modal-historial');
  const btnCerrarHistorial = document.getElementById('btn-cerrar-historial');

  const modalRecibo = document.getElementById('modal-recibo');
  const closeModalRecibo = document.getElementById('close-modal-recibo');
  const btnVolverHistorial = document.getElementById('btn-volver-historial');
  const btnDescargarRecibo = document.getElementById('btn-descargar-recibo');
  const btnReenviarRecibo = document.getElementById('btn-reenviar-recibo');

  // Campos de recibo
  const receiptNumber = document.getElementById('receipt-number');
  const receiptDate = document.getElementById('receipt-date');
  const receiptPayer = document.getElementById('receipt-payer');
  const receiptDni = document.getElementById('receipt-dni');
  const receiptEmail = document.getElementById('receipt-email');
  const receiptConcept = document.getElementById('receipt-concept');
  const receiptMethod = document.getElementById('receipt-method');
  const receiptRef = document.getElementById('receipt-ref');
  const receiptTotal = document.getElementById('receipt-total');
  const receiptTotalLetters = document.getElementById('receipt-total-letters');

  // Configurar apertura/cierre dinámico de cada filtro
  function toggleFilterBox(checkbox, box) {
    checkbox.addEventListener('change', () => {
      box.style.display = checkbox.checked ? 'block' : 'none';
      if (!checkbox.checked) {
        // Limpiar contenido de ese filtro si se desmarca
        if (box === boxFiltroNombre) inputFiltroNombre.value = '';
        if (box === boxFiltroDni) inputFiltroDni.value = '';
        if (box === boxFiltroDisciplina) chipsDisciplinas.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
        if (box === boxFiltroProfesor) chipsProfesores.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
        if (box === boxFiltroMes) chipsMeses.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
        if (box === boxFiltroMetodo) chipsMetodos.querySelectorAll('.option-pill').forEach(p => p.classList.remove('selected'));
      }
      aplicarFiltrosAlumnos();
    });
  }

  if (chkFiltroNombre && boxFiltroNombre) toggleFilterBox(chkFiltroNombre, boxFiltroNombre);
  if (chkFiltroDni && boxFiltroDni) toggleFilterBox(chkFiltroDni, boxFiltroDni);
  if (chkFiltroDisciplina && boxFiltroDisciplina) toggleFilterBox(chkFiltroDisciplina, boxFiltroDisciplina);
  if (chkFiltroProfesor && boxFiltroProfesor) toggleFilterBox(chkFiltroProfesor, boxFiltroProfesor);
  if (chkFiltroMes && boxFiltroMes) toggleFilterBox(chkFiltroMes, boxFiltroMes);
  if (chkFiltroMetodo && boxFiltroMetodo) toggleFilterBox(chkFiltroMetodo, boxFiltroMetodo);

  // Pills interactivos
  function setupPillGroup(container) {
    if (!container) return;
    container.querySelectorAll('.option-pill').forEach(pill => {
      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        aplicarFiltrosAlumnos();
      });
    });
  }

  setupPillGroup(chipsDisciplinas);
  setupPillGroup(chipsProfesores);
  setupPillGroup(chipsMeses);
  setupPillGroup(chipsMetodos);

  if (inputFiltroNombre) inputFiltroNombre.addEventListener('input', aplicarFiltrosAlumnos);
  if (inputFiltroDni) inputFiltroDni.addEventListener('input', aplicarFiltrosAlumnos);

  if (btnLimpiarFiltros) {
    btnLimpiarFiltros.addEventListener('click', () => {
      [chkFiltroNombre, chkFiltroDni, chkFiltroDisciplina, chkFiltroProfesor, chkFiltroMes, chkFiltroMetodo].forEach(chk => {
        if (chk) chk.checked = false;
      });
      [boxFiltroNombre, boxFiltroDni, boxFiltroDisciplina, boxFiltroProfesor, boxFiltroMes, boxFiltroMetodo].forEach(box => {
        if (box) box.style.display = 'none';
      });
      if (inputFiltroNombre) inputFiltroNombre.value = '';
      if (inputFiltroDni) inputFiltroDni.value = '';
      document.querySelectorAll('.chips-options-group .option-pill').forEach(pill => pill.classList.remove('selected'));
      aplicarFiltrosAlumnos();
      showToast('Filtros restablecidos', 'info', 2000);
    });
  }

  // Cargar lista de alumnos con pagos desde la API
  async function cargarAlumnosConPagos() {
    studentsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">Cargando lista de alumnos con pagos...</td></tr>';
    studentsCountLabel.textContent = 'Consultando...';
    try {
      const response = await authFetch('/api/pagos/por-alumno');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'No se pudieron cargar los cobros por alumno.');
      }
      todosLosAlumnos = result.data || [];
      aplicarFiltrosAlumnos();
    } catch (error) {
      studentsTbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${escapeHtml(error.message)}</td></tr>`;
      showMessage(error.message, 'error', studentsMessage);
      studentsCountLabel.textContent = 'Error al cargar alumnos';
    }
  }

  // Lógica de filtrado en tiempo real
  function aplicarFiltrosAlumnos() {
    if (!todosLosAlumnos.length) {
      studentsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay alumnos con pagos registrados.</td></tr>';
      studentsCountLabel.textContent = '0 alumnos encontrados';
      return;
    }

    const filtroNombreActivo = chkFiltroNombre?.checked && inputFiltroNombre?.value.trim().length > 0;
    const queryNombre = filtroNombreActivo ? inputFiltroNombre.value.trim().toLowerCase() : '';

    const filtroDniActivo = chkFiltroDni?.checked && inputFiltroDni?.value.trim().length > 0;
    const queryDni = filtroDniActivo ? inputFiltroDni.value.trim().toLowerCase() : '';

    const disciplinasSeleccionadas = chkFiltroDisciplina?.checked
      ? Array.from(chipsDisciplinas.querySelectorAll('.option-pill.selected')).map(p => p.dataset.value)
      : [];

    const profesoresSeleccionados = chkFiltroProfesor?.checked
      ? Array.from(chipsProfesores.querySelectorAll('.option-pill.selected')).map(p => p.dataset.value)
      : [];

    const mesesSeleccionados = chkFiltroMes?.checked
      ? Array.from(chipsMeses.querySelectorAll('.option-pill.selected')).map(p => p.dataset.value)
      : [];

    const metodosSeleccionados = chkFiltroMetodo?.checked
      ? Array.from(chipsMetodos.querySelectorAll('.option-pill.selected')).map(p => p.dataset.value.toUpperCase())
      : [];

    const filtrados = todosLosAlumnos.filter(alumno => {
      // Filtro por Nombre
      if (filtroNombreActivo && !alumno.nombre_completo.toLowerCase().includes(queryNombre)) {
        return false;
      }

      // Filtro por DNI
      if (filtroDniActivo && !alumno.dni.toLowerCase().includes(queryDni)) {
        return false;
      }

      // Filtro por Disciplina (el alumno debe tener al menos una de las disciplinas seleccionadas)
      if (disciplinasSeleccionadas.length > 0) {
        const alumnoDisciplinas = (alumno.disciplinas || []).map(d => d.toLowerCase());
        const tieneDisciplina = disciplinasSeleccionadas.some(d => alumnoDisciplinas.includes(d.toLowerCase()));
        if (!tieneDisciplina) return false;
      }

      // Filtro por Profesor encargado
      if (profesoresSeleccionados.length > 0) {
        const alumnoProfesores = (alumno.profesores || []).map(p => p.toLowerCase());
        const tieneProfesor = profesoresSeleccionados.some(p => alumnoProfesores.some(ap => ap.includes(p.toLowerCase())));
        if (!tieneProfesor) return false;
      }

      // Filtro por Mes (el alumno debe tener al menos un pago en uno de los meses seleccionados)
      if (mesesSeleccionados.length > 0) {
        const tienePagoEnMes = (alumno.pagos || []).some(p => {
          if (p.mes && mesesSeleccionados.includes(p.mes)) return true;
          if (p.fecha_pago) {
            const m = new Date(p.fecha_pago).getMonth();
            const nombres = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'];
            return mesesSeleccionados.includes(nombres[m]);
          }
          return false;
        });
        if (!tienePagoEnMes) return false;
      }

      // Filtro por Método de Pago
      if (metodosSeleccionados.length > 0) {
        const tieneMetodo = (alumno.pagos || []).some(p =>
          p.medio_pago && metodosSeleccionados.includes(String(p.medio_pago).toUpperCase())
        );
        if (!tieneMetodo) return false;
      }

      return true;
    });

    renderAlumnosConPagos(filtrados);
  }

  function renderAlumnosConPagos(alumnos) {
    studentsCountLabel.textContent = `${alumnos.length} ${alumnos.length === 1 ? 'alumno encontrado' : 'alumnos encontrados'}`;

    if (!alumnos.length) {
      studentsTbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted" style="padding: 2rem;">No se encontraron alumnos para los filtros seleccionados.</td></tr>';
      return;
    }

    studentsTbody.innerHTML = alumnos.map(alu => {
      const iniciales = alu.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AL';
      const disciplinasHtml = (alu.disciplinas || []).length
        ? alu.disciplinas.map(d => `<span class="discipline-badge">${escapeHtml(d)}</span>`).join('')
        : '<span class="text-muted">—</span>';
      const profesoresHtml = (alu.profesores || []).length
        ? alu.profesores.map(p => `<span class="professor-tag">${escapeHtml(p)}</span>`).join(', ')
        : '<span class="text-muted">—</span>';
      const paymentsCount = alu.total_pagos || (alu.pagos ? alu.pagos.length : 0);
      const countPill = paymentsCount > 0
        ? `<span class="payments-count-pill">💳 ${paymentsCount}</span>`
        : `<span class="payments-count-pill" style="background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1;">0 pagos</span>`;
      const fechaUltimoPago = alu.ultimo_pago ? formatDate(alu.ultimo_pago) : 'Sin pagos';

      return `
        <tr>
          <td>
            <div class="student-identity">
              <div class="student-avatar-circle">${iniciales}</div>
              <div>
                <div class="student-meta-name">${escapeHtml(alu.nombre_completo)}</div>
                <div class="student-meta-email">${escapeHtml(alu.correo || '—')}</div>
              </div>
            </div>
          </td>
          <td><strong>${escapeHtml(alu.dni || '—')}</strong></td>
          <td>${disciplinasHtml}</td>
          <td>${profesoresHtml}</td>
          <td>${countPill}</td>
          <td>${fechaUltimoPago}</td>
          <td style="text-align: center;">
            <button class="btn-view-history" data-alumno-id="${escapeHtml(alu.id_alumno)}" type="button">
              🔍 Ver historial
            </button>
          </td>
        </tr>
      `;
    }).join('');

    studentsTbody.querySelectorAll('.btn-view-history').forEach(btn => {
      btn.addEventListener('click', () => {
        const idAlumno = btn.dataset.alumnoId;
        const alu = todosLosAlumnos.find(a => a.id_alumno === idAlumno);
        if (alu) abrirModalHistorial(alu);
      });
    });
  }

  // ────────────────────────────────────────────────────────────
  // Función para Descargar Comprobante en PDF
  // ────────────────────────────────────────────────────────────
  async function descargarComprobantePdf(idPago, buttonElement = null) {
    if (!idPago) return;
    const originalContent = buttonElement ? buttonElement.innerHTML : '';
    if (buttonElement) {
      buttonElement.disabled = true;
      buttonElement.innerHTML = '⏳ Descargando...';
    }

    try {
      const token = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
      const response = await fetch(`/api/comprobantes/${encodeURIComponent(idPago)}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        let errMsg = 'No se pudo descargar el comprobante en este momento.';
        try {
          const errData = await response.json();
          if (errData && errData.message) errMsg = errData.message;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprobante-${idPago}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showToast('Comprobante descargado correctamente en PDF', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalContent;
      }
    }
  }

  // ────────────────────────────────────────────────────────────
  // Modal de Historial de Pagos del Alumno
  // ────────────────────────────────────────────────────────────
  function abrirModalHistorial(alumno) {
    alumnoSeleccionadoActual = alumno;
    const iniciales = alumno.nombre_completo.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || 'AL';
    historyAvatar.textContent = iniciales;
    historyStudentName.textContent = alumno.nombre_completo;
    historyStudentDni.textContent = alumno.dni || '—';
    historyStudentEmail.textContent = alumno.correo || '—';

    // Ordenar del más reciente al más antiguo
    const pagosOrdenados = [...(alumno.pagos || [])].sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago));
    historyCountBadge.textContent = `${pagosOrdenados.length} ${pagosOrdenados.length === 1 ? 'pago' : 'pagos'}`;

    if (!pagosOrdenados.length) {
      historyTbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted" style="padding: 1.5rem;">Este alumno aún no tiene pagos registrados.</td></tr>';
    } else {
      historyTbody.innerHTML = pagosOrdenados.map(pago => {
        const metodoLabel = String(pago.medio_pago).toUpperCase() === 'EFECTIVO' ? '💵 Efectivo' : '💳 Mercado Pago';
        const estadoUpper = String(pago.estado_pago || 'APROBADO').toUpperCase();
        let estadoBadgeClass = 'status-approved';
        if (estadoUpper === 'PENDIENTE') estadoBadgeClass = 'status-pending';
        else if (estadoUpper === 'RECHAZADO' || estadoUpper === 'ANULADO') estadoBadgeClass = 'status-rejected';

        const estadoBadge = `<span class="status-pill ${estadoBadgeClass}">${escapeHtml(pago.estado_pago || 'APROBADO')}</span>`;
        return `
          <tr>
            <td>${formatDate(pago.fecha_pago)}</td>
            <td><strong>${escapeHtml(pago.id_matricula || pago.id_pago)}</strong></td>
            <td>${escapeHtml(pago.disciplinas || 'Mensualidad')}</td>
            <td>${escapeHtml(pago.profesor || '—')}</td>
            <td>${metodoLabel}</td>
            <td><strong>S/ ${Number(pago.monto).toFixed(2)}</strong></td>
            <td>${estadoBadge}</td>
            <td style="text-align: center;">
              <div style="display: inline-flex; gap: 0.4rem; justify-content: center; align-items: center;">
                <button class="btn-download-pdf-direct" data-pago-id="${escapeHtml(pago.id_pago)}" type="button" title="Descargar comprobante en formato PDF" style="background: #0284c7; color: white; border: none; padding: 0.35rem 0.65rem; border-radius: 5px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem;">
                  📥 Descargar PDF
                </button>
                <button class="btn-view-receipt" data-pago-id="${escapeHtml(pago.id_pago)}" type="button" title="Ver detalle del recibo" style="background: #f8fafc; color: #334155; border: 1px solid #cbd5e1; padding: 0.35rem 0.65rem; border-radius: 5px; font-size: 0.8rem; cursor: pointer;">
                  📄 Ver
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      historyTbody.querySelectorAll('.btn-download-pdf-direct').forEach(btn => {
        btn.addEventListener('click', async () => {
          const idPago = btn.dataset.pagoId;
          await descargarComprobantePdf(idPago, btn);
        });
      });

      historyTbody.querySelectorAll('.btn-view-receipt').forEach(btn => {
        btn.addEventListener('click', () => {
          const idPago = btn.dataset.pagoId;
          const pago = alumno.pagos.find(p => p.id_pago === idPago);
          abrirModalRecibo(pago, alumno);
        });
      });
    }

    modalHistorial.style.display = 'flex';
    modalHistorial.hidden = false;
  }

  function cerrarModalHistorialFunc() {
    modalHistorial.style.display = 'none';
    modalHistorial.hidden = true;
  }

  if (closeModalHistorial) closeModalHistorial.addEventListener('click', cerrarModalHistorialFunc);
  if (btnCerrarHistorial) btnCerrarHistorial.addEventListener('click', cerrarModalHistorialFunc);

  // ────────────────────────────────────────────────────────────
  // Modal de Recibo Oficial
  // ────────────────────────────────────────────────────────────
  async function abrirModalRecibo(pago, alumno) {
    pagoSeleccionadoActual = pago;
    alumnoSeleccionadoActual = alumno;

    // Obtener detalles del comprobante desde la API o usar datos del objeto
    receiptNumber.textContent = pago.numero_recibo || `CP-${new Date().getFullYear()}-${pago.id_pago.slice(-4)}`;
    receiptDate.textContent = formatDate(pago.fecha_pago);
    receiptPayer.textContent = alumno.nombre_completo;
    receiptDni.textContent = alumno.dni || '—';
    receiptEmail.textContent = alumno.correo || '—';
    receiptConcept.textContent = `Mensualidad - ${pago.disciplinas || 'Disciplinas'}`;
    receiptMethod.textContent = String(pago.medio_pago).toUpperCase() === 'EFECTIVO' ? 'Efectivo' : 'Mercado Pago';
    receiptRef.textContent = pago.referencia || '—';
    receiptTotal.textContent = `S/ ${Number(pago.monto).toFixed(2)}`;
    receiptTotalLetters.textContent = pago.monto_letras || `${Number(pago.monto).toFixed(2)} SOLES`;

    // Intentar consultar endpoint oficial para sincronizar correlativo si existe
    try {
      const resp = await authFetch(`/api/comprobantes/${pago.id_pago}`);
      if (resp.ok) {
        const comp = await resp.json();
        if (comp.data) {
          receiptNumber.textContent = comp.data.numero;
          receiptTotalLetters.textContent = comp.data.total_letras;
        }
      }
    } catch (err) {
      // Ignorar, ya tenemos los datos cargados
    }

    modalHistorial.style.display = 'none';
    modalHistorial.hidden = true;
    modalRecibo.style.display = 'flex';
    modalRecibo.hidden = false;
  }

  function cerrarModalReciboFunc() {
    modalRecibo.style.display = 'none';
    modalRecibo.hidden = true;
  }

  if (closeModalRecibo) closeModalRecibo.addEventListener('click', cerrarModalReciboFunc);

  if (btnVolverHistorial) {
    btnVolverHistorial.addEventListener('click', () => {
      cerrarModalReciboFunc();
      if (alumnoSeleccionadoActual) {
        abrirModalHistorial(alumnoSeleccionadoActual);
      }
    });
  }

  // Acción: Descargar Recibo en PDF
  if (btnDescargarRecibo) {
    btnDescargarRecibo.addEventListener('click', async () => {
      if (!pagoSeleccionadoActual) return;
      await descargarComprobantePdf(pagoSeleccionadoActual.id_pago, btnDescargarRecibo);
    });
  }

  // Acción: Reenviar Recibo al correo registrado
  if (btnReenviarRecibo) {
    btnReenviarRecibo.addEventListener('click', async () => {
      if (!pagoSeleccionadoActual || !alumnoSeleccionadoActual) return;
      const correoDestino = alumnoSeleccionadoActual.correo || 'el alumno';
      btnReenviarRecibo.disabled = true;
      btnReenviarRecibo.textContent = '⏳ Enviando correo...';

      try {
        const response = await authFetch(`/api/comprobantes/${pagoSeleccionadoActual.id_pago}/enviar-correo`, {
          method: 'POST'
        });
        const resJson = await response.json();

        if (!response.ok && response.status !== 409) {
          throw new Error(resJson.message || 'No se pudo enviar el correo.');
        }

        showToast(`✅ Recibo reenviado con éxito al correo: ${correoDestino}`, 'success', 5000);
      } catch (error) {
        showToast(error.message, 'error', 4500);
      } finally {
        btnReenviarRecibo.disabled = false;
        btnReenviarRecibo.innerHTML = '✉️ Reenviar al correo';
      }
    });
  }

  // Carga inicial de secciones
  cargarPendientes();
  cargarCobros();
});
