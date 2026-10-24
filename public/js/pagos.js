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
  const verifyButton = document.getElementById('verify-payment');
  const checkoutLink = document.getElementById('checkout-link');
  const submitButton = form.querySelector('button[type="submit"]');
  let mercadoPendiente = false;
  let pagoConfirmado = false;
  let verificando = false;
  let registrando = false;

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
  // Conserva el formulario al volver del checkout en una pestaña de la misma app.
  if (idMatriculaActual) {
    const campos = ['student-name', 'email', 'concept', 'amount'];
    try {
      const anterior = JSON.parse(sessionStorage.getItem(`pago:${idMatriculaActual}`) || 'null');
      if (!params.get('correo') && anterior) {
        campos.forEach(id => { document.getElementById(id).value = anterior[id]; });
        document.getElementById('summary-student').textContent = anterior['student-name'];
      }
      if (document.getElementById('email').value) {
        sessionStorage.setItem(`pago:${idMatriculaActual}`, JSON.stringify(Object.fromEntries(
          campos.map(id => [id, document.getElementById(id).value])
        )));
      }
    } catch { /* El pago también funciona con el almacenamiento del navegador deshabilitado. */ }
  }

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

  const steps = document.querySelectorAll('.payment-step');
  const bloquearMetodos = (medio) => {
    methodInputs.forEach(input => {
      input.checked = input.value === medio;
      input.disabled = true;
      input.closest('.method-option')?.classList.add('method-locked');
    });
    updateSummary();
  };

  const mostrarEstado = (pago) => {
    if (pago.estado_pago === 'APROBADO') {
      if (pagoConfirmado) return;
      pagoConfirmado = true;
      mercadoPendiente = false;
      verifyButton.hidden = true;
      checkoutLink.hidden = true;
      methodInputs.forEach(input => { input.disabled = true; });
      const reserva = pago.estado_matricula === 'Reservada';
      const token = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
      const destino = token ? `/mis-matriculas.html${reserva ? '?reserva=exitosa' : ''}`
        : '/login.html?registro=exitoso';
      showMessage(`${reserva ? '¡Pago aprobado! Tu cupo está reservado.' : '¡Pago aprobado! Tu matrícula está confirmada.'} ${token ? 'Abriendo Mis matrículas...' : 'Tu cuenta está habilitada. Inicia sesión para entrar al portal.'}`, 'success');
      steps[1]?.classList.remove('active');
      steps[1]?.classList.add('completed');
      if (steps[1]) steps[1].querySelector('span').textContent = '✓';
      steps[2]?.classList.add('active');
      document.querySelectorAll('.payment-step-line')[1]?.classList.add('active');
      document.querySelector('.status-pill').textContent = reserva ? 'Reservada' : 'Activa';
      submitButton.type = 'button';
      submitButton.textContent = token ? 'Ir a Mis matrículas' : 'Iniciar sesión';
      submitButton.disabled = false;
      submitButton.onclick = () => { window.location.href = destino; };
      setTimeout(() => { window.location.href = destino; }, 3000);
    } else if (pago.medio_pago === 'EFECTIVO' && pago.estado_pago === 'PENDIENTE') {
      bloquearMetodos('efectivo');
      showMessage('Ya tienes una solicitud de pago en efectivo pendiente de confirmación por el tesorero.', 'info');
      submitButton.disabled = true;
      submitButton.textContent = 'Pendiente de aprobación';
    } else if (pago.medio_pago === 'MERCADO_PAGO' || mercadoPendiente) {
      mercadoPendiente = true;
      bloquearMetodos('mercado');
      verifyButton.hidden = false;
      const rechazado = ['RECHAZADO', 'ANULADO'].includes(pago.estado_pago);
      showMessage(rechazado
        ? 'Mercado Pago no aprobó este intento. Puedes volver al checkout e intentarlo nuevamente.'
        : 'El pago todavía no está aprobado. Si ya pagaste en Mercado Pago, pulsa «Verificar pago» en unos momentos.', rechazado ? 'error' : 'info');
      submitButton.textContent = 'Volver a Mercado Pago';
    }
  };

  const verificarPago = async () => {
    if (verificando || registrando || pagoConfirmado) return;
    verificando = true;
    verifyButton.disabled = true;
    submitButton.disabled = true;
    verifyButton.textContent = 'Verificando...';
    showMessage('Consultando tu pago en Mercado Pago...', 'info');
    try {
      const matricula = document.getElementById('id-matricula').value;
      const response = await fetch(`/api/pagos/sincronizar/${encodeURIComponent(matricula)}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || 'No se pudo verificar el pago.');
      mostrarEstado(data.data);
    } catch (error) {
      showMessage(error.message, 'error');
    } finally {
      verificando = false;
      verifyButton.disabled = false;
      submitButton.disabled = false;
      verifyButton.textContent = 'Verificar pago';
    }
  };
  verifyButton.addEventListener('click', verificarPago);
  window.addEventListener('focus', () => { if (mercadoPendiente) verificarPago(); });

  // El resultado de la URL nunca es una prueba de pago; se consulta lo guardado.
  if (idMatriculaActual) {
    fetch(`/api/pagos/verificar/${encodeURIComponent(idMatriculaActual)}`)
      .then(res => res.json())
      .then(async data => {
        if (!data.success) throw new Error('No se pudo consultar el estado de la matrícula.');
        mostrarEstado(data.data);
        if (mercadoPendiente) await verificarPago();
      })
      .catch(error => showMessage(error.message, 'error'));
  } else if (result) {
    showMessage('No pudimos identificar la matrícula para verificar el pago. Vuelve a abrir su pantalla de pago.', 'info');
  }

  // ── Escucha de cambios de método ─────────────────────────────────
  methodInputs.forEach(input => input.addEventListener('change', updateSummary));
  updateSummary();

  // ── Envío del formulario ─────────────────────────────────────────
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (pagoConfirmado || registrando || verificando) return;
    registrando = true;
    const button = submitButton;
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
    // Abrir durante el clic evita que el navegador bloquee la pestaña tras esperar la API.
    const checkoutTab = cash ? null : window.open('about:blank', '_blank');
    if (checkoutTab) checkoutTab.opener = null;

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
        // Forca permanece abierta para consultar el pago incluso sin webhooks.
        const checkoutUrl = resultData.init_point;
        if (!checkoutUrl) throw new Error('No se recibió la URL de pago de Mercado Pago.');
        checkoutLink.href = checkoutUrl;
        checkoutLink.hidden = false;
        mercadoPendiente = true;
        verifyButton.hidden = false;
        button.disabled = false;
        button.textContent = 'Volver a Mercado Pago';
        showMessage('Completa el pago en Mercado Pago. Después vuelve aquí y pulsa «Verificar pago».', 'info');
        if (checkoutTab) checkoutTab.location.href = checkoutUrl;
      }
    } catch (error) {
      if (checkoutTab) checkoutTab.close();
      showMessage(error.message, 'error');
      button.disabled    = false;
      button.textContent = 'Continuar';
      if (!metodoPredefinido && !mercadoPendiente) {
        methodInputs.forEach(i => {
          i.disabled = false;
          i.closest('.method-option')?.classList.remove('method-locked');
        });
      }
    } finally {
      registrando = false;
    }
  });
});
