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

    // Compatibilidad con sesiones anteriores de un solo rol
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
        const paginaPublica = document.body?.dataset.public === 'true';
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
}

// Menú de cada rol, según los prototipos de las historias de usuario.
// Cada opción: [texto, enlace, vista de la página de control de acceso (opcional)]
const MENU_POR_ROL = {
    DIRECTOR: [
        ['Alumnos', '/alumnos.html'],
        ['Control de acceso', '/control-acceso']
    ],
    TESORERO: [
        ['Alumnos', '/alumnos.html'],
        ['Pagos', '/tesoreria.html']
    ],
    PROFESOR: [
        ['Control de acceso', '/control-acceso#vista-control', 'access'],
        ['Alumnos', '/control-acceso#vista-alumnos', 'students']
    ],
    ALUMNO: [
        ['Nueva matrícula', '/index.html'],
        ['Disciplinas', '/disciplinas.html'],
        ['Renovar', '/mis-matriculas.html#renovar'],
        ['Mis matrículas', '/mis-matriculas.html'],
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

// Pantalla principal de quien usa el sistema (sin sesión, el login)
function paginaDeInicio() {
    const roles = obtenerToken() ? obtenerRolesUsuario() : [];
    const rol = Object.keys(INICIO_POR_ROL).find(rolInicio => roles.includes(rolInicio));
    return INICIO_POR_ROL[rol] || '/';
}

// Opción del menú que corresponde a la página actual.
// Una página puede indicar a qué opción pertenece con data-menu (ej. el comprobante es parte de Pagos).
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
    const rolesConMenu = Object.keys(MENU_POR_ROL).filter(rol => roles.includes(rol));

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

    // Las opciones de todos los roles del usuario, sin repetir
    const textos = new Set();
    const opciones = rolesConMenu
        .flatMap(rol => MENU_POR_ROL[rol])
        .filter(([texto]) => !textos.has(texto) && textos.add(texto));
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
    cuenta.querySelector('.app-usuario-nombre').textContent = usuario.nombre || usuario.correo;
    cuenta.querySelector('.app-usuario-rol').textContent =
        rolesConMenu.map(rol => NOMBRE_ROL[rol]).join(' / ') || 'Sin rol';
    cuenta.querySelector('.app-salir').addEventListener('click', cerrarSesion);

    header.append(nav, cuenta);
}

// Se arma apenas carga el script (va al final de cada página), antes que los scripts propios
// de la página, porque control de acceso usa los enlaces del menú para cambiar de vista.
pintarEncabezado();

document.addEventListener('DOMContentLoaded', verificarSesion);
