document.addEventListener('DOMContentLoaded', async () => {
    const id = new URLSearchParams(window.location.search).get('id');
    const nombre = document.getElementById('trabajador-nombre');
    const roles = document.getElementById('trabajador-roles');
    const nombres = document.getElementById('trabajador-nombres');
    const apellidos = document.getElementById('trabajador-apellidos');
    const documento = document.getElementById('trabajador-documento');
    const rolesContainer = document.getElementById('acceso-roles');
    const rolesMensaje = document.getElementById('acceso-roles-mensaje');
    const permisosContainer = document.getElementById('acceso-permisos');
    const guardarButton = document.getElementById('guardar-accesos');
    const guardarMensaje = document.getElementById('acceso-guardado-mensaje');
    const dialogoConfirmacion = document.getElementById('confirmar-guardado');
    const errorConfirmacion = document.getElementById('confirmar-guardado-error');
    const confirmarButton = document.getElementById('confirmar-guardado-boton');
    let estadoEdicion = null;

    function limpiarMensajeGuardado() {
        guardarMensaje.textContent = '';
        guardarMensaje.classList.remove('is-success');
    }

    function crearOpcion(etiqueta, valor, grupo, opciones = {}) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        const texto = document.createElement('span');

        label.className = grupo === 'rol' ? 'access-role-option' : 'access-permission-option';
        input.type = 'checkbox';
        input.checked = valor;
        input.disabled = opciones.deshabilitado ?? true;
        if (opciones.valor) {
            input.value = opciones.valor;
        }
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
        rolesMensaje.textContent = '';
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
        if (!trabajador || !Array.isArray(trabajador.roles)) {
            throw new Error('El servidor no devolvió los roles del trabajador.');
        }
        if (!Array.isArray(trabajador.permisos)) {
            throw new Error('El servidor no devolvió los permisos efectivos. Reinicia el backend y vuelve a cargar.');
        }
        if (trabajador.roles.length === 0) {
            throw new Error('El trabajador debe tener al menos un rol operativo asignado.');
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
            crearOpcion('Profesor', trabajador.roles.includes('PROFESOR'), 'rol', {
                deshabilitado: false,
                valor: 'PROFESOR'
            }),
            crearOpcion('Tesorero', trabajador.roles.includes('TESORERO'), 'rol', {
                deshabilitado: false,
                valor: 'TESORERO'
            })
        );

        estadoEdicion = {
            roles: new Set(trabajador.roles),
            permisos: new Set(trabajador.permisos)
        };
        const controlesRoles = rolesContainer.querySelectorAll('input[type="checkbox"]');

        function actualizarControlesRoles() {
            controlesRoles.forEach(control => {
                control.disabled = estadoEdicion.roles.size === 1 &&
                    estadoEdicion.roles.has(control.value);
            });
        }

        controlesRoles.forEach(control => {
            control.addEventListener('change', () => {
                if (control.checked) {
                    estadoEdicion.roles.add(control.value);
                } else {
                    estadoEdicion.roles.delete(control.value);
                }
                limpiarMensajeGuardado();

                if (estadoEdicion.roles.size === 0) {
                    estadoEdicion.roles.add(control.value);
                    control.checked = true;
                    rolesMensaje.textContent = 'El trabajador debe mantener al menos un rol asignado.';
                    actualizarControlesRoles();
                    return;
                }

                rolesMensaje.textContent = '';
                roles.textContent = [...estadoEdicion.roles]
                    .map(rol => NOMBRE_ROL[rol] || rol)
                    .join(' y ');
                actualizarControlesRoles();
            });
        });
        actualizarControlesRoles();

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
            throw new Error('El servidor no devolvió la lista de permisos configurados. Reinicia el backend y vuelve a cargar.');
        }

        permisosContainer.replaceChildren(
            ...permisosDisponibles.map(permiso => crearOpcion(
                nombresPermisos[permiso] || permiso,
                estadoEdicion.permisos.has(permiso),
                'permiso',
                {
                    deshabilitado: false,
                    valor: permiso
                }
            ))
        );

        permisosContainer.querySelectorAll('input[type="checkbox"]').forEach(control => {
            control.addEventListener('change', () => {
                if (control.checked) {
                    estadoEdicion.permisos.add(control.value);
                } else {
                    estadoEdicion.permisos.delete(control.value);
                }
                limpiarMensajeGuardado();
            });
        });

        guardarButton.disabled = false;
    } catch (error) {
        limpiarCampos(error.message);
    }

    guardarButton.addEventListener('click', () => {
        if (!estadoEdicion) {
            return;
        }

        errorConfirmacion.textContent = '';
        dialogoConfirmacion.showModal();
    });

    document.getElementById('cancelar-confirmacion').addEventListener('click', () => {
        dialogoConfirmacion.close();
    });

    confirmarButton.addEventListener('click', async () => {
        if (!estadoEdicion || !id) {
            return;
        }

        confirmarButton.disabled = true;
        errorConfirmacion.textContent = '';

        try {
            const response = await authFetch(`/api/personal/${encodeURIComponent(id)}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    roles: [...estadoEdicion.roles],
                    permisos: [...estadoEdicion.permisos]
                })
            });
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'No se pudieron guardar los cambios.');
            }

            dialogoConfirmacion.close();
            guardarMensaje.textContent = result.message || 'Roles y permisos guardados correctamente.';
            guardarMensaje.classList.add('is-success');
        } catch (error) {
            errorConfirmacion.textContent = error.message;
        } finally {
            confirmarButton.disabled = false;
        }
    });
});
