document.addEventListener('DOMContentLoaded', () => {
    // ── Referencias DOM ──────────────────────────────────────
    const form           = document.getElementById('editarPerfilForm');
    const btnCancelar    = document.getElementById('btn-cancelar');
    const btnGuardar     = document.getElementById('btn-guardar');

    const modalExito     = document.getElementById('modalExito');
    const btnOkExito     = document.getElementById('btn-ok-exito');

    const modalCancelar  = document.getElementById('modalCancelar');
    const btnNoCancelar  = document.getElementById('btn-no-cancelar');
    const btnSiCancelar  = document.getElementById('btn-si-cancelar');

    const userName       = document.querySelector('.app-usuario-nombre');
    const fechaNacimiento = document.getElementById('fecha_nacimiento');
    fechaNacimiento.max = new Date().toLocaleDateString('en-CA');
    let datosCargados = false;
    btnGuardar.disabled = true;

    // Datos originales guardados al cargar (para detectar cambios)
    let datosOriginales = {};

    // ── Helpers ──────────────────────────────────────────────
    const mostrarError = (campo, mensaje) => {
        const el = document.getElementById(`error-${campo}`);
        if (el) { el.textContent = mensaje; el.style.display = 'block'; }
        const input = document.getElementById(campo);
        if (input) input.style.borderColor = 'var(--danger-color)';
    };

    const limpiarError = (campo) => {
        const el = document.getElementById(`error-${campo}`);
        if (el) el.style.display = 'none';
        const input = document.getElementById(campo);
        if (input) input.style.borderColor = '';
    };

    const limpiarTodosLosErrores = () => {
        ['nombre','apellido_paterno','apellido_materno',
         'fecha_nacimiento','genero','direccion',
         'correo_electronico','numero_celular'].forEach(limpiarError);
    };

    const haycambios = () => {
        const campos = ['nombre','apellido_paterno','apellido_materno',
                        'fecha_nacimiento','genero','direccion',
                        'correo_electronico','numero_celular'];
        return campos.some(c => {
            const el = document.getElementById(c);
            return el && el.value !== (datosOriginales[c] ?? '');
        });
    };

    // ── T-01: Cargar datos actuales del alumno ────────────────
    const cargarDatos = async () => {
        const token = obtenerToken();
        if (!token) {
            window.location.href = '/login.html';
            return;
        }

        try {
            const res = await authFetch('/api/perfil');
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || 'No se pudieron cargar los datos.');
            }

            const d = json.data;

            // Mostrar nombre en header
            userName.textContent = [d.nombre, d.apellido_paterno, d.apellido_materno].filter(Boolean).join(' ');

            // T-04: Precargar formulario
            document.getElementById('nombre').value            = d.nombre            ?? '';
            document.getElementById('apellido_paterno').value  = d.apellido_paterno  ?? '';
            document.getElementById('apellido_materno').value  = d.apellido_materno  ?? '';
            document.getElementById('fecha_nacimiento').value  = d.fecha_nacimiento
                ? d.fecha_nacimiento.substring(0, 10) : '';
            document.getElementById('genero').value = d.genero || '';
            document.getElementById('direccion').value         = d.direccion         ?? '';
            document.getElementById('correo_electronico').value = d.correo_electronico ?? '';
            document.getElementById('numero_celular').value    = d.numero_celular    ?? '';

            // Guardar snapshot para detectar cambios
            datosOriginales = {
                nombre:             document.getElementById('nombre').value,
                apellido_paterno:   document.getElementById('apellido_paterno').value,
                apellido_materno:   document.getElementById('apellido_materno').value,
                fecha_nacimiento:   document.getElementById('fecha_nacimiento').value,
                genero:             document.getElementById('genero').value,
                direccion:          document.getElementById('direccion').value,
                correo_electronico: document.getElementById('correo_electronico').value,
                numero_celular:     document.getElementById('numero_celular').value,
            };
            datosCargados = true;
            btnGuardar.disabled = false;

        } catch (err) {
            console.error('Error cargando perfil:', err);
            alert('Error al cargar los datos. Por favor recarga la página.');
        }
    };

    // ── T-02: Validar formulario ──────────────────────────────
    const validarFormulario = () => {
        limpiarTodosLosErrores();
        let valido = true;

        const nombre = document.getElementById('nombre').value.trim();
        if (!nombre || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(nombre)) {
            mostrarError('nombre', 'El nombre es obligatorio y solo debe contener letras.');
            valido = false;
        }

        const apPat = document.getElementById('apellido_paterno').value.trim();
        if (!apPat || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(apPat)) {
            mostrarError('apellido_paterno', 'El apellido paterno es obligatorio.');
            valido = false;
        }

        const apMat = document.getElementById('apellido_materno').value.trim();
        if (!apMat || !/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(apMat)) {
            mostrarError('apellido_materno', 'El apellido materno es obligatorio.');
            valido = false;
        }

        const fechaNac = document.getElementById('fecha_nacimiento').value;
        if (!fechaNac || fechaNac < fechaNacimiento.min || fechaNac > fechaNacimiento.max) {
            mostrarError('fecha_nacimiento', 'Ingresa una fecha de nacimiento válida, sin fechas futuras.');
            valido = false;
        }

        const genero = document.getElementById('genero').value;
        if (!genero) {
            mostrarError('genero', 'Debes seleccionar un género.');
            valido = false;
        }

        const direccion = document.getElementById('direccion').value.trim();
        if (!direccion) {
            mostrarError('direccion', 'La dirección es obligatoria.');
            valido = false;
        }

        const correo = document.getElementById('correo_electronico').value.trim();
        if (correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
            mostrarError('correo_electronico', 'Ingresa un correo válido.');
            valido = false;
        }

        const celular = document.getElementById('numero_celular').value.trim();
        if (celular && !/^[0-9]{9}$/.test(celular)) {
            mostrarError('numero_celular', 'Ingresa un número de celular de 9 dígitos.');
            valido = false;
        }

        return valido;
    };

    // ── T-05: Guardar cambios ─────────────────────────────────
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (!datosCargados) return;
        if (!validarFormulario()) return;

        btnGuardar.disabled    = true;
        btnGuardar.textContent = 'Guardando...';

        const payload = {
            nombre:             document.getElementById('nombre').value.trim(),
            apellido_paterno:   document.getElementById('apellido_paterno').value.trim(),
            apellido_materno:   document.getElementById('apellido_materno').value.trim(),
            fecha_nacimiento:   document.getElementById('fecha_nacimiento').value,
            genero:             document.getElementById('genero').value,
            direccion:          document.getElementById('direccion').value.trim(),
            correo_electronico: document.getElementById('correo_electronico').value.trim(),
            numero_celular:     document.getElementById('numero_celular').value.trim(),
        };

        try {
            const res = await authFetch('/api/perfil', {
                method:  'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            const json = await res.json();

            if (!res.ok || !json.success) {
                throw new Error(json.message || 'Error al guardar los datos.');
            }

            // T-06: Mostrar mensaje de éxito
            modalExito.style.display = 'flex';

        } catch (err) {
            console.error('Error guardando:', err);
            alert(`Error: ${err.message}`);
        } finally {
            btnGuardar.disabled    = false;
            btnGuardar.textContent = 'Guardar cambios';
        }
    });

    // T-06: Botón OK del modal de éxito → volver al perfil
    btnOkExito.addEventListener('click', () => {
        modalExito.style.display = 'none';
        window.location.href = '/perfil.html';
    });

    // ── T-07: Cancelar con confirmación ──────────────────────
    btnCancelar.addEventListener('click', () => {
        if (haycambios()) {
            modalCancelar.style.display = 'flex';
        } else {
            window.location.href = '/perfil.html';
        }
    });

    btnNoCancelar.addEventListener('click', () => {
        modalCancelar.style.display = 'none';
    });

    btnSiCancelar.addEventListener('click', () => {
        modalCancelar.style.display = 'none';
        window.location.href = '/perfil.html';
    });

    // Cerrar modales con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            modalCancelar.style.display = 'none';
            modalExito.style.display    = 'none';
        }
    });

    // ── Init ─────────────────────────────────────────────────
    cargarDatos();
});
