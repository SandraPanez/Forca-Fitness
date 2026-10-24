document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('payment-form');
  const amount = document.getElementById('amount');
  const methodInputs = document.querySelectorAll('input[name="method"]');
  const messageEl = document.getElementById('payment-message');
  const params = new URLSearchParams(window.location.search);
  // ── Parámetros de URL ────────────────────────────────────────────
  const result          = params.get('resultado');
  const tipo            = params.get('tipo');
  const metodoPredefinido = (params.get('metodo') || '').toLowerCase();
  const idMatriculaActual = params.get('matricula');

  // ── Helpers ──────────────────────────────────────────────────────
  const showMessage = (text, type = 'info') => {
    messageEl.textContent = text;
    messageEl.className = `payment-message ${type}`;
  };

  const updateSummary = () => {
    const value = Number(amount.value || 0).toFixed(2);
    document.getElementById('summary-total').textContent = `S/ ${value}`;
    document.getElementById('summary-concept').textContent =
      document.getElementById('concept').value || 'Mensualidad';
    const matricula = document.getElementById('id-matricula').value;
    document.getElementById('summary-matricula').textContent = matricula
      ? `Código: ${matricula}`
      : 'Código de matrícula pendiente';
    const cash = document.querySelector('input[name="method"]:checked')?.value === 'efectivo';
    document.getElementById('summary-method').textContent = cash ? 'Efectivo' : 'Mercado Pago';
    document.getElementById('cash-notice').hidden = !cash;
    if (cash && tipo === 'reserva') {
      document.getElementById('cash-notice').innerHTML =
        'Al elegir efectivo, la reserva quedará <strong>Pendiente de confirmación</strong> hasta que el tesorero registre el pago en recepción. Recuerda que el cupo se asegura tras la confirmación.';
    }
  };

  // ── Inicialización de campos desde URL ───────────────────────────
  if (params.get('renovacion') === '1') form.querySelector('.btn-cancel').href = '/renovar.html';
  if (params.get('matricula'))  document.getElementById('id-matricula').value    = params.get('matricula');
  if (params.get('concepto'))   document.getElementById('concept').value         = params.get('concepto');
  if (params.get('nombre')) {
    document.getElementById('student-name').value  = params.get('nombre');
    document.getElementById('summary-student').textContent = params.get('nombre');
  }
  if (params.get('correo')) document.getElementById('email').value  = params.get('correo');
  if (params.get('monto'))  document.getElementById('amount').value = params.get('monto');

  // ── Método predefinido (bloqueado) ───────────────────────────────
  if (metodoPredefinido === 'efectivo' || metodoPredefinido === 'mercado' || metodoPredefinido === 'mercado_pago') {
    const valorMetodo = metodoPredefinido.startsWith('mercado') ? 'mercado' : 'efectivo';
    methodInputs.forEach(input => {
      if (input.value === valorMetodo) input.checked = true;
      input.disabled = true;
      input.closest('.method-option')?.classList.add('method-locked');
    });
  }

  // ── Tipo reserva: personalizar encabezado ────────────────────────
  if (tipo === 'reserva') {
    const pageSubtitle = document.querySelector('.page-header .subtitle');
    const pageTitle    = document.querySelector('.page-header .title');
    const pageDesc     = document.querySelector('.page-header .description');
    const btnCancel    = document.querySelector('.form-actions .btn-cancel');
    if (pageSubtitle) pageSubtitle.textContent = 'PAGO DE RESERVA';
    if (pageTitle)    pageTitle.textContent    = 'Pago de reserva de cupo';
    if (pageDesc)     pageDesc.textContent     = 'Asegura tu cupo con tarifa congelada procesando el pago de tu reserva.';
    if (btnCancel)    btnCancel.href           = '/renovar.html';
  }

  // ── Verificar pago duplicado (solo si no estamos en resultado) ───
  if (idMatriculaActual && !result) {
    fetch(`/api/pagos/verificar/${encodeURIComponent(idMatriculaActual)}`)
      .then(res => res.json())
      .then(resData => {
        if (resData.success && resData.data && resData.data.tienePago) {
          const pagoActivo = resData.data;
          const submitBtn  = form.querySelector('button[type="submit"]');
          if (pagoActivo.estado_pago === 'APROBADO') {
            showMessage('Esta matrícula ya se encuentra pagada y confirmada. No es necesario realizar otro pago.', 'info');
            if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Matrícula pagada'; }
          } else if (pagoActivo.estado_pago === 'PENDIENTE') {
            const esEfectivo = (pagoActivo.medio_pago || '').toUpperCase().includes('EFECTIVO');
            if (esEfectivo) {
              showMessage('Ya tienes una solicitud de pago en efectivo registrada y pendiente de confirmación por el tesorero.', 'info');
              if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Pendiente de aprobación'; }
            }
          }
        }
      })
      .catch(() => {});
  }

  // ── Estado de resultado (retorno de MP / efectivo) ───────────────
  const steps = document.querySelectorAll('.payment-step');

  if (result === 'exitoso') {
    const successMsg = tipo === 'reserva'
      ? '¡Pago aprobado! Cupo reservado correctamente. Redirigiendo a Mis matrículas en 3 segundos...'
      : '¡Pago aprobado! Tu matrícula está confirmada. Redirigiendo a Mis matrículas en 3 segundos...';
    showMessage(successMsg, 'success');
    steps[1]?.classList.remove('active');
    steps[1]?.classList.add('completed');
    if (steps[1]) steps[1].querySelector('span').textContent = '✓';
    steps[2]?.classList.add('active');
    document.querySelectorAll('.payment-step-line')[1]?.classList.add('active');

    const isReserva  = tipo === 'reserva';
    const redirectUrl = isReserva ? '/mis-matriculas.html?reserva=exitosa' : '/mis-matriculas.html';
    const submitBtn   = form.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.textContent = 'Ir a Mis matrículas';
      submitBtn.disabled    = false;
      submitBtn.onclick = (e) => { e.preventDefault(); window.location.href = redirectUrl; };
    }
    setTimeout(() => { window.location.href = redirectUrl; }, 3000);
  }
  if (result === 'pendiente') showMessage('Estamos pendientes de confirmar tu pago. Conserva tu código de matrícula.', 'info');
  if (result === 'fallido')   showMessage('El pago no pudo procesarse. Tu matrícula sigue pendiente y puedes intentarlo nuevamente.', 'error');

  // ── Escucha de cambios de método ─────────────────────────────────
  methodInputs.forEach(input => input.addEventListener('change', updateSummary));
  updateSummary();

  // ── Envío del formulario ─────────────────────────────────────────
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled    = true;
    button.textContent = 'Procesando...';

    const data = {
      id_matricula: document.getElementById('id-matricula').value.trim(),
      monto:        Number(amount.value),
      correo:       document.getElementById('email').value.trim(),
      nombres:      document.getElementById('student-name').value,
      disciplinas:  document.getElementById('concept').value
    };

    const cash = document.querySelector('input[name="method"]:checked')?.value === 'efectivo';

    methodInputs.forEach(i => {
      i.disabled = true;
      i.closest('.method-option')?.classList.add('method-locked');
    });

    try {
      const token   = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const endpoint = cash ? '/api/pagos/efectivo' : '/api/pagos/crear-preferencia';
      const response  = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(data) });
      const resultData = await response.json();

      if (!response.ok || !resultData.success) {
        throw new Error(resultData.message || 'No se pudo registrar el pago.');
      }

      if (cash) {
        const cashMsg = tipo === 'reserva'
          ? 'Solicitud de reserva en efectivo registrada. Acércate a recepción en las próximas 48 horas para asegurar tu cupo.'
          : 'Solicitud registrada correctamente. Acércate a la academia en las próximas 48 horas para confirmar el pago en efectivo.';
        showMessage(cashMsg, 'success');
        button.textContent = 'Solicitud registrada';
        setTimeout(() => {
          const tk = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
          window.location.href = tk
            ? '/mis-matriculas.html?pago=pendiente'
            : '/login.html?registro=exitoso';
        }, 2500);
      } else {
        // Redirigir al checkout de Mercado Pago
        const checkoutUrl = resultData.init_point;
        if (!checkoutUrl) throw new Error('No se recibió la URL de pago de Mercado Pago.');
        window.location.href = checkoutUrl;
      }
    } catch (error) {
      showMessage(error.message, 'error');
      button.disabled    = false;
      button.textContent = 'Continuar';
      if (!metodoPredefinido) {
        methodInputs.forEach(i => {
          i.disabled = false;
          i.closest('.method-option')?.classList.remove('method-locked');
        });
      }
    }
  });
});
