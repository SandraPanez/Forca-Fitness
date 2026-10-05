document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const errorElement = document.getElementById('login-error');
    const successElement = document.getElementById('login-success');

    const params = new URLSearchParams(window.location.search);
    const estadoPago = params.get('pago');

    if (estadoPago === 'exitoso') {
        successElement.textContent =
            'Pago confirmado. Tu cuenta ya fue habilitada. Ya puedes iniciar sesión.';
        successElement.style.display = 'block';

        // Limpiar ?pago=exitoso de la URL sin recargar la página
        window.history.replaceState({}, document.title, '/');
    }

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const correo = document.getElementById('correo').value.trim();
        const password = document.getElementById('password').value;

        errorElement.style.display = 'none';
        document.getElementById('pending-payment-link')?.remove();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    correo,
                    password
                })
            });

            const result = await response.json();

            if (!response.ok) {
                if (result.pagoPendiente) {
                    mostrarPagoPendiente(result.pagoPendiente);
                }
                throw new Error(result.message || 'No se pudo iniciar sesión');
            }

            localStorage.setItem('token', result.token);
            localStorage.setItem('usuario', JSON.stringify(result.usuario));

            if (
                result.usuario.rol === 'DIRECTOR' ||
                result.usuario.rol === 'TESORERO'
            ) {
                window.location.href = '/alumnos.html';
                return;
            }

            window.location.href = '/index.html';

        } catch (error) {
            errorElement.textContent = error.message;
            errorElement.style.display = 'block';
        }
    });

    function mostrarPagoPendiente(pago) {
        const existente = document.getElementById('pending-payment-link');
        if (existente) existente.remove();

        const params = new URLSearchParams({
            preview: '1',
            resultado: 'pendiente',
            matricula: pago.matricula,
            nombre: pago.nombre,
            correo: pago.correo,
            concepto: `Mensualidad - ${pago.disciplinas || 'Disciplinas seleccionadas'}`,
            monto: String(pago.monto)
        });
        const link = document.createElement('a');
        link.id = 'pending-payment-link';
        link.className = 'pending-payment-link';
        link.href = `/pagos.html?${params.toString()}`;
        link.textContent = 'Pagar matrícula con Mercado Pago';
        errorElement.insertAdjacentElement('afterend', link);
    }
});

const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');

togglePassword.addEventListener('click', () => {
    const mostrar = passwordInput.type === 'password';

    passwordInput.type = mostrar ? 'text' : 'password';

    togglePassword.setAttribute(
        'aria-label',
        mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );
});