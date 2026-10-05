document.addEventListener('DOMContentLoaded', () => {
  const usuario = obtenerUsuario();
  const rolesPermitidos = ['DIRECTOR', 'TESORERO'];
  if (!usuario || !rolesPermitidos.includes(usuario.rol)) {
    window.location.href = '/login.html';
    return;
  }

  const tbody = document.getElementById('treasury-tbody');
  const message = document.getElementById('treasury-message');
  const search = document.getElementById('treasury-search');
  const status = document.getElementById('treasury-status');
  const method = document.getElementById('treasury-method');

  const showMessage = (text, type = 'info') => {
    message.textContent = text;
    message.className = `payment-message ${type}`;
  };

  const formatDate = value => value
    ? new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
    : '—';

  const escapeHtml = value => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

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

  function renderCobros(cobros) {
    if (!cobros.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No hay cobros para los filtros seleccionados.</td></tr>';
      return;
    }
    tbody.innerHTML = cobros.map(cobro => `
      <tr>
        <td><strong>${escapeHtml(cobro.alumno)}</strong><small class="treasury-muted">${escapeHtml(cobro.id_matricula)}</small></td>
        <td>${escapeHtml(cobro.disciplinas || 'Mensualidad')}</td>
        <td>S/ ${Number(cobro.monto).toFixed(2)}</td>
        <td>${escapeHtml(cobro.medio_pago)}</td>
        <td><span class="status-pill">${escapeHtml(cobro.estado_pago)}</span></td>
        <td>${formatDate(cobro.fecha_vencimiento)}</td>
        <td>${cobro.estado_pago === 'PENDIENTE' && cobro.medio_pago === 'EFECTIVO'
          ? `<button class="btn-confirm-cash" data-matricula="${escapeHtml(cobro.id_matricula)}">Confirmar</button>`
          : '<span class="treasury-muted">Sin acción</span>'}</td>
      </tr>
    `).join('');
    tbody.querySelectorAll('.btn-confirm-cash').forEach(button => {
      button.addEventListener('click', () => confirmarEfectivo(button));
    });
  }

  async function confirmarEfectivo(button) {
    const referencia = window.prompt('Referencia de operación (opcional):', '');
    if (referencia === null) return;
    button.disabled = true;
    try {
      const response = await authFetch('/api/pagos/efectivo/confirmar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id_matricula: button.dataset.matricula,
          referencia_operacion: referencia.trim() || null
        })
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || 'No se pudo confirmar el pago.');
      showMessage('Pago en efectivo confirmado correctamente.', 'success');
      await cargarCobros();
    } catch (error) {
      showMessage(error.message, 'error');
      button.disabled = false;
    }
  }

  document.getElementById('treasury-refresh').addEventListener('click', cargarCobros);
  status.addEventListener('change', cargarCobros);
  method.addEventListener('change', cargarCobros);
  search.addEventListener('keydown', event => {
    if (event.key === 'Enter') cargarCobros();
  });
  cargarCobros();
});
