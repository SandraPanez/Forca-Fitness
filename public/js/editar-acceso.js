document.addEventListener('DOMContentLoaded', async () => {
    const id = new URLSearchParams(window.location.search).get('id');
    const nombre = document.getElementById('trabajador-nombre');
    const roles = document.getElementById('trabajador-roles');
    const nombres = document.getElementById('trabajador-nombres');
    const apellidos = document.getElementById('trabajador-apellidos');
    const documento = document.getElementById('trabajador-documento');
    const rolesContainer = document.getElementById('acceso-roles');
    const permisosContainer = document.getElementById('acceso-permisos');

    function crearOpcion(etiqueta, valor, grupo) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        const texto = document.createElement('span');

        label.className = grupo === 'rol' ? 'access-role-option' : 'access-permission-option';
        input.type = 'checkbox';
        input.checked = valor;
        input.disabled = true;
        input.setAttribute('aria-label', etiqueta);
        texto.textContent = etiqueta;
        label.append(input, texto);
        return label;
    }

    function limpiarCampos(mensaje) {
        nombre.textContent = mensaje;
        roles.textContent = mensaje;
        nombres.value = '';
        apellidos.value = '';
        documento.value = '';
        rolesContainer.replaceChildren(crearMensaje(mensaje));
        permisosContainer.replaceChildren(crearMensaje(mensaje));
    }

    function crearMensaje(texto) {
        const mensajeElement = document.createElement('span');
        mensajeElement.className = 'access-loading';
        mensajeElement.textContent = texto;
        return mensajeElement;
    }

    if (!id) {
        limpiarCampos('No se indicó qué trabajador modificar.');
        return;
    }

    try {
        const response = await authFetch(`/api/personal/${encodeURIComponent(id)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo cargar la información del trabajador.');
        }

        const trabajador = result.data;
        if (!trabajador || !Array.isArray(trabajador.roles) || !Array.isArray(trabajador.permisos)) {
            throw new Error('La información del trabajador tiene un formato inválido.');
        }

        const nombresPersona = [trabajador.nombres, trabajador.segundo_nombre].filter(Boolean).join(' ');
        const apellidosPersona = [
            trabajador.apellido_paterno,
            trabajador.apellido_materno
        ].filter(Boolean).join(' ');

        nombre.textContent = trabajador.nombre || 'Sin nombre registrado';
        roles.textContent = trabajador.roles
            .map(rol => NOMBRE_ROL[rol] || rol)
            .join(' y ') || 'Sin roles operativos asignados';
        nombres.value = nombresPersona;
        apellidos.value = apellidosPersona;
        documento.value = trabajador.documento || '';
        documento.labels[0].textContent = trabajador.tipo_documento || 'Documento';

        rolesContainer.replaceChildren(
            crearOpcion('Profesor', trabajador.roles.includes('PROFESOR'), 'rol'),
            crearOpcion('Tesorero', trabajador.roles.includes('TESORERO'), 'rol')
        );

        const nombresPermisos = {
            VER_TODOS_ALUMNOS: 'Ver todos los alumnos',
            VER_ALUMNOS_DISCIPLINAS: 'Ver alumnos de sus disciplinas',
            VER_MATRICULAS: 'Ver matrículas',
            GESTIONAR_PAGOS: 'Gestionar pagos',
            INHABILITAR_ALUMNO: 'Inhabilitar alumnos',
            ADMINISTRAR_COLAS: 'Administrar colas',
            ADMINISTRAR_ACCESOS: 'Administrar accesos',
            VER_PROPIO_PERFIL: 'Ver perfil propio',
            EDITAR_PROPIO_PERFIL: 'Editar perfil propio',
            VER_PROPIA_MATRICULA: 'Ver matrícula propia',
            REGISTRAR_MATRICULA: 'Registrar matrícula'
        };
        const permisos = trabajador.permisos;
        const permisosDisponibles = trabajador.permisosDisponibles;

        if (!Array.isArray(permisosDisponibles)) {
            throw new Error('No se pudieron cargar los permisos configurados.');
        }

        permisosContainer.replaceChildren(
            ...permisosDisponibles.map(permiso => crearOpcion(
                nombresPermisos[permiso] || permiso,
                permisos.includes(permiso),
                'permiso'
            ))
        );
    } catch (error) {
        limpiarCampos(error.message);
    }
});
