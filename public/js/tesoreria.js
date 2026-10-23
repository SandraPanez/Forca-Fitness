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
  });
  status.addEventListener('change', cargarCobros);
  method.addEventListener('change', cargarCobros);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') cargarCobros();
  });

  // Carga inicial de ambas secciones
  cargarPendientes();
  cargarCobros();
});
