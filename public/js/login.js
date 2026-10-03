document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const errorElement = document.getElementById('login-error');

    form.addEventListener('submit', async event => {
        event.preventDefault();

        const correo = document.getElementById('correo').value.trim();
        const password = document.getElementById('password').value;

        errorElement.style.display = 'none';

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