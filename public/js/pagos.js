document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('payment-form');
  const amount = document.getElementById('amount');
  const methodInputs = document.querySelectorAll('input[name="method"]');
  const message = document.getElementById('payment-message');
  const params = new URLSearchParams(window.location.search);
  if (params.get('matricula')) document.getElementById('id-matricula').value = params.get('matricula');
  if (params.get('concepto')) document.getElementById('concept').value = params.get('concepto');
  if (params.get('nombre')) {
    document.getElementById('student-name').value = params.get('nombre');
    document.getElementById('summary-student').textContent = params.get('nombre');
  }
  if (params.get('correo')) document.getElementById('email').value = params.get('correo');
  if (params.get('monto')) document.getElementById('amount').value = params.get('monto');

  const showMessage = (text, type = 'info') => {
    message.textContent = text;
    message.className = `payment-message ${type}`;
  };
  const updateSummary = () => {
    const value = Number(amount.value || 0).toFixed(2);
    document.getElementById('summary-total').textContent = `S/ ${value}`;
    document.getElementById('summary-concept').textContent = document.getElementById('concept').value || 'Mensualidad';
    const matricula = document.getElementById('id-matricula').value;
    document.getElementById('summary-matricula').textContent = matricula
      ? `Código: ${matricula}`
      : 'Código de matrícula pendiente';
    const cash = document.querySelector('input[name="method"]:checked').value === 'efectivo';
    document.getElementById('summary-method').textContent = cash ? 'Efectivo' : 'Mercado Pago';
    document.getElementById('cash-notice').hidden = !cash;
  };
  methodInputs.forEach(input => input.addEventListener('change', updateSummary));

  const result = params.get('resultado');
  const steps = document.querySelectorAll('.payment-step');
  if (result === 'exitoso') {
    showMessage('Pago aprobado. Tu matrícula está confirmada.', 'success');
    steps[1]?.classList.remove('active');
    steps[1]?.classList.add('completed');
    steps[1].querySelector('span').textContent = '✓';
    steps[2]?.classList.add('active');
    document.querySelectorAll('.payment-step-line')[1]?.classList.add('active');
  }
  if (result === 'pendiente') {
    showMessage('Estamos pendientes de confirmar tu pago. Conserva tu código de matrícula.', 'info');
  }
  if (result === 'fallido') showMessage('El pago no pudo procesarse. Tu matrícula sigue pendiente y puedes intentarlo nuevamente.', 'error');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Procesando...';
    const data = {
      id_matricula: document.getElementById('id-matricula').value.trim(),
      monto: Number(amount.value),
      correo: document.getElementById('email').value.trim(),
      nombres: document.getElementById('student-name').value,
      disciplinas: document.getElementById('concept').value
    };
    const cash = document.querySelector('input[name="method"]:checked').value === 'efectivo';
    try {
      const response = await authFetch(`/api/pagos/${cash ? 'efectivo' : 'crear-preferencia'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      const resultData = await response.json();
      if (!response.ok || !resultData.success) throw new Error(resultData.message || 'No se pudo registrar el pago.');
      if (cash) {
        showMessage('Solicitud creada. Acércate a la academia antes de 48 horas para confirmar el pago.', 'success');
        button.textContent = 'Solicitud registrada';
      } else {
        window.location.href = resultData.init_point;
      }
    } catch (error) {
      showMessage(error.message, 'error');
      button.disabled = false;
      button.textContent = 'Continuar';
    }
  });
  updateSummary();
});
