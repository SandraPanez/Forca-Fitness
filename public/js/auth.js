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

function renderNavbar() {
    const usuario = obtenerUsuario();
    const roles = usuario ? obtenerRolesUsuario(usuario) : [];

    const nav = document.getElementById('top-nav') || document.querySelector('.top-nav');
    const userInfo = document.getElementById('user-info') || document.querySelector('.user-info');
    let guestNav = document.getElementById('guest-nav');

    const header = document.querySelector('.header');
    if (!header && !nav) return;

    let headerRight = document.querySelector('.header-right');
    if (!headerRight && header) {
        headerRight = document.createElement('div');
        headerRight.className = 'header-right';
        headerRight.style.cssText = 'display: flex; align-items: center; gap: 2.5rem;';
        if (nav) headerRight.appendChild(nav);
        if (userInfo) headerRight.appendChild(userInfo);
        header.appendChild(headerRight);
    }

    if (headerRight && !guestNav) {
        guestNav = document.createElement('div');
        guestNav.id = 'guest-nav';
        guestNav.style.display = 'none';
        guestNav.innerHTML = '<a href="/login.html" class="logout-btn" data-no-logout="true" style="border-left: none; padding-left: 0;">Iniciar sesión</a>';
        headerRight.appendChild(guestNav);
    }

    const path = window.location.pathname.toLowerCase();

    const esTesoreroOAdmin = roles.includes('TESORERO') || roles.includes('ADMIN');
    const esProfesor = roles.includes('PROFESOR');
    const esAlumno = roles.includes('ALUMNO') || (!esTesoreroOAdmin && !esProfesor && Boolean(usuario));

    let items = [];

    if (usuario) {
        if (esTesoreroOAdmin) {
            items = [
                { href: '/alumnos.html', label: 'Alumnos', match: ['/alumnos.html'] },
                { href: '/index.html', label: 'Matrículas', match: ['/index.html', '/'] },
                { href: '/tesoreria.html', label: 'Tesorería', match: ['/tesoreria.html'] },
                { href: '/pagos.html', label: 'Pagos', match: ['/pagos.html'] }
            ];
        } else if (esProfesor) {
            items = [
                { href: '/control_acceso.html', label: 'Control de acceso', match: ['/control_acceso.html'] },
                { href: '/alumnos.html', label: 'Alumnos', match: ['/alumnos.html'] }
            ];
        } else {
            // Cliente / Alumno
            items = [
                { href: '/mis-matriculas.html', label: 'Mis matrículas', match: ['/mis-matriculas.html'] },
                { href: '/disciplinas.html', label: 'Reservar cupo', match: ['/disciplinas.html'] },
                { href: '/perfil.html', label: 'Mi Perfil', match: ['/perfil.html', '/editar-perfil.html'] },
                { href: '/index.html', label: 'Nueva matrícula', match: ['/index.html'] }
            ];
        }
    } else {
        // Invitado / Sin sesión
        items = [
            { href: '/disciplinas.html', label: 'Disciplinas', match: ['/disciplinas.html'] },
            { href: '/index.html', label: 'Nueva matrícula', match: ['/index.html', '/'] }
        ];
    }

    if (nav) {
        nav.innerHTML = items.map(item => {
            const isActive = item.match.some(m => path === m || (m !== '/' && path.endsWith(m)));
            return `<a href="${item.href}" class="${isActive ? 'active' : ''}">${item.label}</a>`;
        }).join('\n');
        nav.style.display = 'flex';
    }

    if (usuario) {
        if (userInfo) {
            userInfo.style.display = 'flex';
            const nameEl = userInfo.querySelector('.user-name');
            const roleEl = userInfo.querySelector('.user-role');
            if (nameEl) nameEl.textContent = usuario.nombre || usuario.correo;
            if (roleEl) {
                if (esAlumno) {
                    roleEl.textContent = 'Cliente';
                } else {
                    roleEl.textContent = roles.length > 0 ? roles.join(' / ') : 'Cliente';
                }
            }
        }
        if (guestNav) guestNav.style.display = 'none';
    } else {
        if (userInfo) userInfo.style.display = 'none';
        if (guestNav) guestNav.style.display = 'block';
    }

    document.querySelectorAll('.logout-btn:not([data-no-logout])').forEach(button => {
        if (!button.dataset.hasLogoutListener) {
            button.dataset.hasLogoutListener = 'true';
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
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (!verificarSesion()) {
        return;
    }

    renderNavbar();

    // Mostrar/ocultar elementos según rol con data-rol
    const usuario = obtenerUsuario();
    const roles = usuario ? obtenerRolesUsuario(usuario) : [];
    document.querySelectorAll('[data-rol]').forEach(el => {
        const rolesPermitidos = el.dataset.rol.split(',').map(r => r.trim());
        const tieneRol = roles.some(r => rolesPermitidos.includes(r));
        el.style.display = tieneRol ? '' : 'none';
    });
});