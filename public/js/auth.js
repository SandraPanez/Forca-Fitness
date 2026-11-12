
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
        // Páginas que también puede abrir alguien sin sesión
        const paginaPublica =
            document.body?.dataset.public === 'true' ||
            document.body?.dataset.allowGuest === 'true';

        const previewEnabled =
            document.body?.dataset.previewAuth === 'true' &&
            new URLSearchParams(window.location.search).get('preview') === '1';

        if (paginaPublica || previewEnabled) {
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

async function cerrarSesion(event) {
    if (event) event.preventDefault();

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
}

// Menú de cada rol, según los prototipos de las historias de usuario.
// Cada opción: [texto, enlace, vista de la página de control de acceso (opcional)]
const MENU_POR_ROL = {
    DIRECTOR: [
        ['Alumnos', '/alumnos.html'],
        ['Control de acceso', '/control-acceso'],
        ['Horarios', '/horarios.html'],
        ['Administración de accesos', '/administracion-accesos.html'],
        ['Pagos', '/tesoreria.html'],
        ['Precios y ofertas', '/precios.html']
    ],
    TESORERO: [
        ['Alumnos', '/alumnos.html'],
        ['Pagos', '/tesoreria.html'],
        ['Balance financiero', '/balance.html']
    ],
    PROFESOR: [
        ['Control de acceso', '/control-acceso#vista-control', 'access'],
        ['Alumnos', '/control-acceso#vista-alumnos', 'students']
    ],
    ALUMNO: [
        ['Nueva matrícula', '/index.html?modo=nueva_matricula'],
        ['Disciplinas', '/disciplinas.html'],
        ['Renovar', '/renovar.html'],
        ['Mis matrículas', '/mis-matriculas.html'],
        ['Mis reservas', '/reservas.html'],
        ['Mi perfil', '/perfil.html']
    ]
};

const NOMBRE_ROL = {
    DIRECTOR: 'Director',
    TESORERO: 'Tesorero',
    PROFESOR: 'Profesor',
    ALUMNO: 'Cliente'
};

// La misma página a la que lleva el login según el rol
const INICIO_POR_ROL = {
    DIRECTOR: '/alumnos.html',
    TESORERO: '/tesoreria.html',
    PROFESOR: '/control-acceso',
    ALUMNO: '/mis-matriculas.html'
};

// HU-24: opciones del menú que dependen de un permiso que el Director puede dar o quitar a una persona
const PERMISO_DEL_MENU = {
    '/alumnos.html': 'VER_TODOS_ALUMNOS',
    '/tesoreria.html': 'GESTIONAR_PAGOS'
};

// Opciones de los roles del usuario sin las de un permiso que se le quitó,
// más la de un permiso que se le dio aunque su rol no lo tenga. Sin repetir.
function opcionesDelMenu(usuario, roles) {
    const permisos = Array.isArray(usuario?.permisos) ? usuario.permisos : null;
    const propias = Object.keys(MENU_POR_ROL)
        .filter(rol => roles.includes(rol))
        .flatMap(rol => MENU_POR_ROL[rol]);
    const candidatas = permisos ? [...propias, ...MENU_POR_ROL.TESORERO] : propias;
    const textos = new Set();

    return candidatas.filter(opcion => {
        const [texto, href] = opcion;
        const permiso = PERMISO_DEL_MENU[href];
        const visible = !permisos
            || (propias.includes(opcion)
                ? !permiso || permisos.includes(permiso)
                : !!permiso && permisos.includes(permiso));

        return visible && !textos.has(texto) && textos.add(texto);
    });
}

// Pantalla principal de quien usa el sistema (sin sesión, el login)
function paginaDeInicio() {
    const usuario = obtenerToken() ? obtenerUsuario() : null;
    const roles = obtenerRolesUsuario(usuario);

    const rol = Object.keys(INICIO_POR_ROL)
        .find(rolInicio => roles.includes(rolInicio));
    const inicio = INICIO_POR_ROL[rol];

    if (!inicio) {
        return '/';
    }

    // Si se le quitó el permiso de su pantalla de inicio, entra a la primera opción que conserva
    const permiso = PERMISO_DEL_MENU[inicio];
    if (permiso && Array.isArray(usuario?.permisos) && !usuario.permisos.includes(permiso)) {
        return opcionesDelMenu(usuario, roles)[0]?.[1] || '/';
    }

    return inicio;
}

// Opción del menú que corresponde a la página actual.
// Una página puede indicar a qué opción pertenece con data-menu.
function opcionActiva(opciones) {
    const pagina = document.body.dataset.menu || window.location.pathname;
    const actual = pagina + window.location.hash;

    return opciones.find(([, href]) => href === actual)
        || opciones.find(([, href]) => !href.includes('#') && href === pagina)
        || opciones.find(([, href]) => href.split('#')[0] === pagina);
}

// Arma el encabezado común dentro de <header id="app-header">
function pintarEncabezado() {
    const header = document.getElementById('app-header');

    if (!header) {
        return;
    }

    const usuario = obtenerToken() ? obtenerUsuario() : null;
    const roles = obtenerRolesUsuario(usuario);

    const rolesConMenu = Object.keys(MENU_POR_ROL)
        .filter(rol => roles.includes(rol));

    header.className = 'app-header';
    header.innerHTML = `
        <a class="app-marca" href="${paginaDeInicio()}">
            <img class="app-logo" src="/images/logo.png" alt="">
            <span>Portal Forca &amp; Fitness</span>
        </a>
    `;

    if (!usuario) {
        header.insertAdjacentHTML(
            'beforeend',
            '<div class="app-usuario"><a class="app-salir" href="/login.html">Iniciar sesión</a></div>'
        );
        return;
    }

    const opciones = opcionesDelMenu(usuario, roles);

    const activa = opcionActiva(opciones);

    const nav = document.createElement('nav');
    nav.className = 'app-nav';
    nav.setAttribute('aria-label', 'Menú principal');

    for (const opcion of opciones) {
        const [texto, href, vista] = opcion;
        const enlace = document.createElement('a');

        enlace.href = href;
        enlace.textContent = texto;

        if (vista) {
            enlace.dataset.view = vista;
        }

        if (opcion === activa) {
            enlace.setAttribute('aria-current', 'page');
        }

        nav.append(enlace);
    }

    const cuenta = document.createElement('div');
    cuenta.className = 'app-usuario';

    cuenta.innerHTML = `
        <div class="app-usuario-datos">
            <span class="app-usuario-nombre"></span>
            <span class="app-usuario-rol"></span>
        </div>
        <a class="app-salir" href="/login.html">Cerrar sesión</a>
    `;

    cuenta.querySelector('.app-usuario-nombre').textContent =
        usuario.nombre || usuario.correo;

    cuenta.querySelector('.app-usuario-rol').textContent =
        rolesConMenu.map(rol => NOMBRE_ROL[rol]).join(' / ') || 'Sin rol';

    cuenta.querySelector('.app-salir')
        .addEventListener('click', cerrarSesion);

    header.append(nav, cuenta);
}

const renderNavbar = pintarEncabezado;

// Se arma apenas carga el script, antes que los scripts propios
// de la página, porque control de acceso usa los enlaces del menú.
pintarEncabezado();

document.addEventListener('DOMContentLoaded', () => {
    verificarSesion();

    // Mostrar/ocultar elementos según rol con data-rol
    const usuario = obtenerUsuario();
    const roles = usuario ? obtenerRolesUsuario(usuario) : [];

    document.querySelectorAll('[data-rol]').forEach(el => {
        const rolesPermitidos = el.dataset.rol
            .split(',')
            .map(r => r.trim());

        const tieneRol = roles.some(r => rolesPermitidos.includes(r));

        el.style.display = tieneRol ? '' : 'none';
    });
});
