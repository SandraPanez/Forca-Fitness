function obtenerToken() {
    return localStorage.getItem('token');
}

function obtenerUsuario() {
    const usuario = localStorage.getItem('usuario');

    if (!usuario) {
        return null;
    }

    try {
        return JSON.parse(usuario);
    } catch {
        return null;
    }
}

function limpiarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
}

function verificarSesion() {
    const token = obtenerToken();

    if (!token) {
        window.location.href = '/login.html';
        return false;
    }

    return true;
}

async function authFetch(url, options = {}) {
    const token = obtenerToken();

    const headers = {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        limpiarSesion();
        window.location.href = '/login.html';
    }

    return response;
}

document.addEventListener('DOMContentLoaded', () => {
    if (!verificarSesion()) {
        return;
    }

    const usuario = obtenerUsuario();

    if (usuario) {
        document.querySelectorAll('.user-role').forEach(element => {
            element.textContent = usuario.rol;
        });

        document.querySelectorAll('.user-name').forEach(element => {
            element.textContent = usuario.correo;
        });
    }

    document.querySelectorAll('.logout-btn').forEach(button => {
        button.addEventListener('click', async event => {
            event.preventDefault();

            const token = obtenerToken();

            try {
                if (token) {
                    await fetch('/api/auth/logout', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    });
                }
            } catch (error) {
                console.error('Error al cerrar sesión:', error);
            } finally {
                limpiarSesion();
                window.location.href = '/login.html';
            }
        });
    });
});