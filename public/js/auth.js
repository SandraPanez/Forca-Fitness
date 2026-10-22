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

function obtenerRolesUsuario(usuario = obtenerUsuario()) {
    if (!usuario) {
        return [];
    }

    if (Array.isArray(usuario.roles) && usuario.roles.length > 0) {
        return usuario.roles;
    }

    if (usuario.rol) {
        return [usuario.rol];
    }

    return [];
}

function limpiarSesion() {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
}

function verificarSesion() {
    const token = obtenerToken();

    if (!token) {
        const previewEnabled =
            document.body?.dataset.previewAuth === 'true' &&
            new URLSearchParams(window.location.search).get('preview') === '1';

        if (previewEnabled || document.body?.dataset.allowGuest === 'true') {
            return true;
        }

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

    const topNav = document.getElementById('top-nav');
    const userInfo = document.getElementById('user-info');
    const guestNav = document.getElementById('guest-nav');

    if (usuario) {
        if (topNav) topNav.style.display = 'flex';
        if (userInfo) userInfo.style.display = 'flex';
        if (guestNav) guestNav.style.display = 'none';

        const roles = obtenerRolesUsuario(usuario);

        document.querySelectorAll('.user-role').forEach(element => {
            element.textContent = roles.length > 0
                ? roles.join(' / ')
                : 'SIN ROL';
        });

        document.querySelectorAll('.user-name').forEach(element => {
            element.textContent = usuario.nombre || usuario.correo;
        });
    } else {
        if (topNav) topNav.style.display = 'none';
        if (userInfo) userInfo.style.display = 'none';
        if (guestNav) guestNav.style.display = 'block';
    }

    document.querySelectorAll('.logout-btn:not([data-no-logout])').forEach(button => {
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

    // Mostrar/ocultar elementos según rol
    const roles = usuario ? obtenerRolesUsuario(usuario) : [];
    document.querySelectorAll('[data-rol]').forEach(el => {
        const rolesPermitidos = el.dataset.rol.split(',').map(r => r.trim());
        const tieneRol = roles.some(r => rolesPermitidos.includes(r));
        el.style.display = tieneRol ? '' : 'none';
    });
});