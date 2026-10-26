document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('personal-tbody');
    const advertenciaBaja = document.getElementById('advertencia-baja');
    const nombreBaja = document.getElementById('baja-personal-nombre');
    const errorBaja = document.getElementById('baja-error');
    const cancelarBaja = document.getElementById('cancelar-baja');
    const continuarBaja = document.getElementById('continuar-baja');
    let seleccionBaja = null;
    let bajaEnCurso = false;
    cancelarBaja.addEventListener('click', () => {
        if (bajaEnCurso) return;
        advertenciaBaja.close();
        seleccionBaja = null;
    });
    advertenciaBaja.addEventListener('cancel', event => {
        if (bajaEnCurso) event.preventDefault();
        else seleccionBaja = null;
    });
    continuarBaja.addEventListener('click', async () => {
        if (bajaEnCurso || !seleccionBaja || !advertenciaBaja.open) return;
        bajaEnCurso = true;
        continuarBaja.disabled = true;
        cancelarBaja.disabled = true;
        continuarBaja.textContent = 'Procesando...';
        errorBaja.textContent = '';
        try {
            const response = await authFetch(`/api/personal/${encodeURIComponent(seleccionBaja.id)}/inactivar`, { method: 'POST' });
            const result = await response.json();
            if (!response.ok || !result.success) {
                errorBaja.textContent = result.message || 'No se pudo inactivar la cuenta.';
                return;
            }
            seleccionBaja.boton.disabled = true;
            seleccionBaja.boton.textContent = 'Inactiva';
            seleccionBaja = null;
            advertenciaBaja.close();
            personalMensaje.textContent = result.message;
            personalMensaje.className = 'text-muted';
            personalMensaje.hidden = false;
            document.getElementById('btn-agregar-personal').focus();
        } catch {
            errorBaja.textContent = 'No se pudo confirmar la baja. Inténtalo nuevamente.';
        } finally {
            bajaEnCurso = false;
            continuarBaja.disabled = false;
            cancelarBaja.disabled = false;
            continuarBaja.textContent = 'Continuar';
        }
    });

    function mostrarMensaje(texto) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        celda.colSpan = 3;
        celda.className = 'text-center text-muted';
        celda.textContent = texto;
        fila.append(celda);
        tbody.replaceChildren(fila);
    }

    function crearItem(etiqueta, valor) {
        const item = document.createElement('div');
        const textoEtiqueta = document.createElement('span');
        const textoValor = document.createElement('span');

        item.className = 'info-item';
        textoEtiqueta.className = 'info-label';
        textoValor.className = 'info-value';
        textoEtiqueta.textContent = etiqueta;
        textoValor.textContent = valor || 'No registrado';

        item.append(textoEtiqueta, textoValor);
        return item;
    }

    // Fila desplegable con la información detallada del trabajador
    function crearFilaDetalle(detalle) {
        const fila = document.createElement('tr');
        const celda = document.createElement('td');
        const datos = document.createElement('div');

        fila.className = 'personal-detalle';
        celda.colSpan = 3;
        datos.className = 'info-grid';
        datos.append(
            crearItem('Nombre', detalle.nombre),
            crearItem(detalle.tipo_documento || 'Documento', detalle.documento),
            crearItem('Correo', detalle.correo),
            crearItem('Teléfono', detalle.telefono)
        );

        if (detalle.roles.includes('PROFESOR')) {
            datos.append(crearItem(
                'Disciplina a cargo',
                detalle.disciplinas.join(', ') || 'Sin disciplinas asignadas'
            ));
        }

        celda.append(datos);
        fila.append(celda);
        return fila;
    }

    async function obtenerDetalle(id) {
        const response = await authFetch(`/api/personal/${encodeURIComponent(id)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo cargar la información del trabajador.');
        }

        return result.data;
    }

    function crearBotonVerMas(persona, fila) {
        const boton = document.createElement('button');
        let filaDetalle = null;

        boton.type = 'button';
        boton.className = 'btn-link';
        boton.textContent = 'Ver más';
        boton.setAttribute('aria-expanded', 'false');

        boton.addEventListener('click', async () => {
            if (filaDetalle) {
                const oculta = !filaDetalle.hidden;
                filaDetalle.hidden = oculta;
                boton.textContent = oculta ? 'Ver más' : 'Ver menos';
                boton.setAttribute('aria-expanded', String(!oculta));
                return;
            }

            boton.disabled = true;
            boton.textContent = 'Cargando...';

            try {
                filaDetalle = crearFilaDetalle(await obtenerDetalle(persona.id));
                fila.after(filaDetalle);
                boton.textContent = 'Ver menos';
                boton.setAttribute('aria-expanded', 'true');
            } catch (error) {
                boton.textContent = 'Ver más';
                alert(error.message);
            } finally {
                boton.disabled = false;
            }
        });

        return boton;
    }

    // Lleva a la pantalla de modificar roles y permisos de la HU-24
    function crearBotonModificar(persona) {
        const boton = document.createElement('button');

        boton.type = 'button';
        boton.className = 'btn-link';
        boton.textContent = 'Modificar';
        boton.addEventListener('click', () => {
            window.location.href = `/editar-acceso.html?id=${encodeURIComponent(persona.id)}`;
        });

        return boton;
    }

    function crearBotonDarBaja(persona) {
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.className = 'btn-submit btn-danger personal-baja';
        boton.textContent = 'Dar de baja';
        boton.setAttribute('aria-haspopup', 'dialog');
        boton.setAttribute('aria-controls', 'advertencia-baja');
        boton.addEventListener('click', () => {
            if (bajaEnCurso || boton.disabled) return;
            seleccionBaja = { id: persona.id, boton };
            errorBaja.textContent = '';
            personalMensaje.hidden = true;
            nombreBaja.textContent = persona.nombre;
            advertenciaBaja.showModal();
        });
        return boton;
    }

    function crearFila(persona) {
        const fila = document.createElement('tr');
        const nombre = document.createElement('td');
        const rol = document.createElement('td');
        const acciones = document.createElement('td');

        nombre.textContent = persona.nombre;
        rol.textContent = persona.roles.map(rolPersona => NOMBRE_ROL[rolPersona] || rolPersona).join(' y ');
        acciones.className = 'text-right';
        acciones.append(crearBotonVerMas(persona, fila), crearBotonModificar(persona));
        if (obtenerRolesUsuario().includes('DIRECTOR') && persona.id !== obtenerUsuario()?.id) {
            acciones.append(crearBotonDarBaja(persona));
        }

        fila.append(nombre, rol, acciones);
        return fila;
    }

    async function cargarPersonal() {
        mostrarMensaje('Cargando personal...');

        try {
            const response = await authFetch('/api/personal');
            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || 'No se pudo cargar el personal registrado.');
            }

            if (result.data.length === 0) {
                mostrarMensaje('No hay personal operativo registrado.');
                return;
            }

            tbody.replaceChildren(...result.data.map(crearFila));
        } catch (error) {
            mostrarMensaje(error.message);
        }
    }

    // Ventana "Agregar personal"
    const registroModal = document.getElementById('registroModal');
    const registroForm = document.getElementById('registroForm');
    const registroMensaje = document.getElementById('registro-mensaje');
    const personalMensaje = document.getElementById('personal-mensaje');
    const inputsRegistro = [...registroForm.querySelectorAll('input, select')];
    const rolesRegistro = inputsRegistro.filter(input => input.name === 'roles');
    const botonRegistrar = registroForm.querySelector('[type="submit"]');
    const confirmarRegistro = document.getElementById('confirmar-registro');
    const resumenRegistro = document.getElementById('confirmar-registro-resumen');
    const errorConfirmacion = document.getElementById('confirmar-registro-error');
    const botonConfirmar = document.getElementById('confirmar-registro-boton');
    const botonVolver = document.getElementById('cancelar-confirmacion-registro');
    let validacionRegistro = null;
    let datosConfirmados = null;
    let guardandoRegistro = false;
    registroForm.elements.fecha_nacimiento.max = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    function limpiarValidacionRegistro() {
        if (guardandoRegistro) return;
        if (confirmarRegistro.open) confirmarRegistro.close();
        datosConfirmados = null;
        errorConfirmacion.textContent = '';
        validacionRegistro?.abort();
        validacionRegistro = null;
        inputsRegistro.forEach(input => input.setCustomValidity(''));
        registroMensaje.hidden = true;
        botonRegistrar.disabled = false;
        botonRegistrar.textContent = 'Registrar';
    }

    function mostrarResultadoRegistro(texto, esError = false) {
        registroMensaje.className = esError ? 'error-message' : 'text-muted';
        registroMensaje.textContent = texto;
        registroMensaje.hidden = false;
    }

    function mostrarErrorRegistro(mensaje, nombreCampo) {
        mostrarResultadoRegistro(mensaje, true);
        const campo = nombreCampo === 'roles' ? rolesRegistro[0] : registroForm.elements.namedItem(nombreCampo);
        if (campo) {
            campo.setCustomValidity(mensaje);
            campo.reportValidity();
        }
    }

    function abrirRegistro() {
        personalMensaje.hidden = true;
        registroModal.style.display = 'flex';
        registroForm.elements.nombres.focus();
    }

    function cerrarRegistro() {
        if (guardandoRegistro) return;
        limpiarValidacionRegistro();
        registroModal.style.display = 'none';
        registroForm.reset();
    }

    document.getElementById('btn-agregar-personal').addEventListener('click', abrirRegistro);
    document.getElementById('btn-cancelar-registro').addEventListener('click', cerrarRegistro);
    botonVolver.addEventListener('click', () => {
        if (!guardandoRegistro) confirmarRegistro.close();
    });
    confirmarRegistro.addEventListener('cancel', event => {
        if (guardandoRegistro) event.preventDefault();
    });
    botonConfirmar.addEventListener('click', async () => {
        if (guardandoRegistro || !datosConfirmados || !confirmarRegistro.open) return;
        guardandoRegistro = true;
        botonConfirmar.disabled = true;
        botonVolver.disabled = true;
        botonConfirmar.textContent = 'Guardando...';
        errorConfirmacion.textContent = '';
        try {
            const response = await authFetch('/api/personal', {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datosConfirmados)
            });
            const result = await response.json();
            if (!response.ok || !result.success) {
                confirmarRegistro.close();
                datosConfirmados = null;
                mostrarErrorRegistro(result.message || 'No se pudo crear la cuenta.', result.campo);
                return;
            }
            await cargarPersonal();
            guardandoRegistro = false;
            cerrarRegistro();
            personalMensaje.textContent = result.message;
            personalMensaje.className = 'text-muted';
            personalMensaje.hidden = false;
            document.getElementById('btn-agregar-personal').focus();
        } catch {
            errorConfirmacion.textContent = 'No se pudo confirmar el registro. Inténtalo nuevamente.';
        } finally {
            guardandoRegistro = false;
            botonConfirmar.disabled = false;
            botonVolver.disabled = false;
            botonConfirmar.textContent = 'Confirmar';
        }
    });
    registroModal.addEventListener('click', event => {
        if (event.target === registroModal) {
            cerrarRegistro();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && registroModal.style.display === 'flex' && !confirmarRegistro.open) {
            cerrarRegistro();
        }
    });
    registroForm.addEventListener('input', limpiarValidacionRegistro);
    registroForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (validacionRegistro || guardandoRegistro) return;

        limpiarValidacionRegistro();
        for (const input of inputsRegistro) {
            if (input.type !== 'password') input.value = input.value.trim();
        }
        rolesRegistro[0].setCustomValidity(
            rolesRegistro.some(input => input.checked) ? '' : 'Selecciona al menos un rol.'
        );
        if (!registroForm.reportValidity()) return;

        const datos = Object.fromEntries(new FormData(registroForm));
        datos.roles = rolesRegistro.filter(input => input.checked).map(input => input.value);
        const solicitud = new AbortController();
        validacionRegistro = solicitud;
        botonRegistrar.disabled = true;
        botonRegistrar.textContent = 'Validando...';

        try {
            const response = await authFetch('/api/personal/validar-registro', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos),
                signal: solicitud.signal
            });
            const result = await response.json();
            if (solicitud.signal.aborted) return;

            if (!response.ok || !result.success) {
                const mensaje = result.message || 'No se pudieron validar los datos.';
                mostrarErrorRegistro(mensaje, result.campo);
                return;
            }

            mostrarResultadoRegistro('Los datos son válidos.');
            datosConfirmados = datos;
            resumenRegistro.textContent = `${datos.nombres} ${datos.apellido_paterno} ${datos.apellido_materno} · ${datos.correo_electronico} · Roles: ${datos.roles.map(rol => NOMBRE_ROL[rol]).join(' y ')}.`;
            confirmarRegistro.showModal();
        } catch {
            if (!solicitud.signal.aborted) {
                mostrarResultadoRegistro('No se pudieron validar los datos. Inténtalo nuevamente.', true);
            }
        } finally {
            if (validacionRegistro === solicitud) {
                validacionRegistro = null;
                botonRegistrar.disabled = false;
                botonRegistrar.textContent = 'Registrar';
            }
        }
    });

    cargarPersonal();
});
