document.addEventListener('DOMContentLoaded', () => {
    // 1. Establecer fecha actual
    const currentDateElement = document.getElementById('currentDate');
    const today = new Date();
    currentDateElement.textContent = today.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    // Fecha de nacimiento sin edad mínima (también se matriculan niños), pero no puede ser futura
    const fechaNacimiento = document.getElementById('fecha_nacimiento');
    fechaNacimiento.max = today.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    // 2. Manejo de formulario (Validaciones básicas para T_01/T_06)
    const form = document.getElementById('matriculaForm');
    const errorDiv = document.getElementById('disciplinas-error');

    function actualizarContadorDisciplinas() {
        const cantidad = document.querySelectorAll('input[name="disciplinas"]:checked').length;
        const badge = document.getElementById('disciplinas-count');
        badge.style.display = cantidad ? 'inline-block' : 'none';
        badge.textContent = `${cantidad} seleccionada${cantidad === 1 ? '' : 's'}`;
    }

    function actualizarDisciplinasPorEdad() {
        const edad = calcularEdadMatricula(fechaNacimiento.value);
        document.getElementById('disciplinas-edad').textContent = edad === null
            ? 'Ingresa una fecha de nacimiento válida para habilitar las disciplinas.'
            : edad <= 12 ? 'Hasta los 12 años inclusive puedes matricularte en las disciplinas Kids.'
                : 'Desde los 13 años puedes matricularte en las disciplinas generales.';
        document.querySelectorAll('input[name="disciplinas"]').forEach(checkbox => {
            const nombre = checkbox.closest('label').querySelector('.disciplina-name').textContent;
            checkbox.disabled = !disciplinaPermitidaPorEdad(edad, nombre);
            if (checkbox.disabled) checkbox.checked = false;
            checkbox.closest('label').title = checkbox.disabled ? (edad === null
                ? 'Ingresa una fecha de nacimiento válida.'
                : edad <= 12 ? 'Disponible desde los 13 años.' : 'Kids: hasta los 12 años inclusive.') : '';
        });
        actualizarContadorDisciplinas();
    }
    fechaNacimiento.addEventListener('input', actualizarDisciplinasPorEdad);
    fechaNacimiento.addEventListener('change', actualizarDisciplinasPorEdad);

    // Validación y restricción dinámica de documento según su tipo
    const tipoDocSelect = document.getElementById('tipo_documento');
    const numDocInput = document.getElementById('numero_documento');

    const configDocs = {
        DNI: {
            placeholder: 'Ej: 74628153',
            pattern: '^[0-9]{8}$',
            title: 'El DNI debe contener exactamente 8 dígitos numéricos',
            maxLength: 8,
            minLength: 8,
            inputMode: 'numeric',
            cleaner: (val) => val.replace(/[^0-9]/g, '').slice(0, 8)
        },
        CE: {
            placeholder: 'Ej: 001234567',
            pattern: '^[0-9]{9}$',
            title: 'El Carnet de Extranjería debe contener exactamente 9 dígitos numéricos',
            maxLength: 9,
            minLength: 9,
            inputMode: 'numeric',
            cleaner: (val) => val.replace(/[^0-9]/g, '').slice(0, 9)
        },
        Pasaporte: {
            placeholder: 'Ej: PE1234567',
            pattern: '^[a-zA-Z0-9]{6,10}$',
            title: 'El Pasaporte debe contener entre 6 y 10 caracteres alfanuméricos',
            maxLength: 10,
            minLength: 6,
            inputMode: 'text',
            cleaner: (val) => val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10).toUpperCase()
        }
    };

    function actualizarReglasDocumento() {
        if (!tipoDocSelect || !numDocInput) return;
        const tipo = tipoDocSelect.value || 'DNI';
        const cfg = configDocs[tipo] || configDocs.DNI;

        numDocInput.placeholder = cfg.placeholder;
        numDocInput.pattern = cfg.pattern;
        numDocInput.title = cfg.title;
        numDocInput.maxLength = cfg.maxLength;
        numDocInput.minLength = cfg.minLength;
        numDocInput.inputMode = cfg.inputMode;

        numDocInput.value = cfg.cleaner(numDocInput.value);
    }

    if (tipoDocSelect && numDocInput) {
        tipoDocSelect.addEventListener('change', actualizarReglasDocumento);
        numDocInput.addEventListener('input', function() {
            const tipo = tipoDocSelect.value || 'DNI';
            const cfg = configDocs[tipo] || configDocs.DNI;
            this.value = cfg.cleaner(this.value);
        });
        actualizarReglasDocumento();
    }

    // Manejo de campos de contraseña:
    // Si viene desde "Registrarte" (?registro=1), nos aseguramos de que sea un flujo limpio de nuevo usuario
    const urlParams = new URLSearchParams(window.location.search);
    const esFlujoRegistro = urlParams.get('registro') === '1';

    if (esFlujoRegistro) {
        // En flujo de registro se limpian tokens residuales para no interferir
        if (typeof limpiarSesion === 'function') {
            limpiarSesion();
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('usuario');
        }
    }

    function eliminarCamposPassword() {
        const passwordGroup = document.getElementById('password-group');
        const confirmPasswordGroup = document.getElementById('confirm-password-group');
        if (passwordGroup) passwordGroup.remove();
        if (confirmPasswordGroup) confirmPasswordGroup.remove();
    }

    const tokenSesion = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
    const usuarioSesion = typeof obtenerUsuario === 'function' ? obtenerUsuario() : null;
    const esNuevaMatriculaAlumno = !esFlujoRegistro && !!(tokenSesion && usuarioSesion && usuarioSesion.correo);

    if (esNuevaMatriculaAlumno) {
        eliminarCamposPassword();
    }

    // Validación interactiva de coincidencia de contraseñas
    const passwordInput = document.getElementById('password');
    const confirmPasswordInput = document.getElementById('confirm_password');
    const confirmFeedback = document.getElementById('confirm-password-feedback');
    const passwordHint = document.getElementById('password-hint');

    function validarCoincidenciaPasswords() {
        const passEl = document.getElementById('password');
        const confirmEl = document.getElementById('confirm_password');
        if (!passEl || !confirmEl) return;

        const pass = passEl.value;
        const confirm = confirmEl.value;

        // Longitud mínima
        if (passwordHint) {
            if (pass.length > 0 && pass.length < 6) {
                passwordHint.textContent = 'La contraseña debe tener al menos 6 caracteres.';
                passwordHint.className = 'password-feedback mismatch';
                passwordHint.style.display = 'block';
                passEl.classList.add('input-error');
                passEl.classList.remove('input-success');
            } else if (pass.length >= 6) {
                passwordHint.style.display = 'none';
                passEl.classList.remove('input-error');
                passEl.classList.add('input-success');
            } else {
                passwordHint.style.display = 'none';
                passEl.classList.remove('input-error', 'input-success');
            }
        }

        // Coincidencia
        if (!confirmFeedback) return;

        if (!confirm) {
            confirmFeedback.style.display = 'none';
            confirmEl.classList.remove('input-error', 'input-success');
            return;
        }

        if (pass === confirm) {
            confirmFeedback.textContent = '✓ Las contraseñas coinciden';
            confirmFeedback.className = 'password-feedback match';
            confirmFeedback.style.display = 'block';
            confirmEl.classList.add('input-success');
            confirmEl.classList.remove('input-error');
        } else {
            confirmFeedback.textContent = '✕ Las contraseñas no coinciden';
            confirmFeedback.className = 'password-feedback mismatch';
            confirmFeedback.style.display = 'block';
            confirmEl.classList.add('input-error');
            confirmEl.classList.remove('input-success');
        }
    }

    if (passwordInput && confirmPasswordInput) {
        passwordInput.addEventListener('input', validarCoincidenciaPasswords);
        confirmPasswordInput.addEventListener('input', validarCoincidenciaPasswords);
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Agregar clase para mostrar estilos de error en campos obligatorios vacíos (T_02)
        form.classList.add('was-validated');

        // Validar cantidad exacta de caracteres según tipo de documento
        const tipoDoc = tipoDocSelect ? tipoDocSelect.value : 'DNI';
        const numDoc = numDocInput ? numDocInput.value.trim() : '';

        if (tipoDoc === 'DNI' && numDoc.length !== 8) {
            alert('El DNI debe contener exactamente 8 dígitos numéricos.');
            numDocInput.focus();
            return;
        }
        if (tipoDoc === 'CE' && numDoc.length !== 9) {
            alert('El Carnet de Extranjería debe contener exactamente 9 dígitos numéricos.');
            numDocInput.focus();
            return;
        }
        if (tipoDoc === 'Pasaporte' && (numDoc.length < 6 || numDoc.length > 10)) {
            alert('El Pasaporte debe contener entre 6 y 10 caracteres alfanuméricos.');
            numDocInput.focus();
            return;
        }

        // Validar contraseñas solo si los campos existen (para nuevo registro de cuenta)
        const passField = form.querySelector('#password');
        const confirmPassField = form.querySelector('#confirm_password');

        if (passField && confirmPassField) {
            const password = passField.value;
            const confirmPassword = confirmPassField.value;

            if (password.length < 6) {
                validarCoincidenciaPasswords();
                alert('La contraseña debe tener al menos 6 caracteres.');
                passField.focus();
                return;
            }

            if (password !== confirmPassword) {
                validarCoincidenciaPasswords();
                alert('Las contraseñas no coinciden. Por favor, verifícalas.');
                confirmPassField.focus();
                return;
            }
        }

        // Validar que el formulario HTML nativo esté completo
        if (!form.checkValidity()) {
            return; // Detiene el envío si faltan campos obligatorios
        }
        
        // Validar que al menos una disciplina esté seleccionada
        actualizarDisciplinasPorEdad();
        const disciplinas = document.querySelectorAll('input[name="disciplinas"]:checked');
        
        if (disciplinas.length === 0) {
            errorDiv.style.display = 'block';
            // Scroll a la sección de disciplinas
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        errorDiv.style.display = 'none';
        
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());
        data.disciplinas = Array.from(disciplinas).map(cb => cb.value);

        // Deshabilitar botón para evitar doble envío
        const btnSubmit = form.querySelector('.btn-submit');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = 'Enviando...';
        btnSubmit.disabled = true;

        const token = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
        const headers = { 'Content-Type': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        fetch('/api/matriculas', {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        })
        .then(async response => {
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'No se pudo registrar la matrícula.');
            }
            return result;
        })
        .then(result => {
            if (result.success) {
                const nombre = [
                    document.getElementById('nombres').value,
                    document.getElementById('apellido_paterno').value,
                    document.getElementById('apellido_materno').value
                ].join(' ');
                const correo = document.getElementById('correo_electronico').value;
                const cursos = Array.from(disciplinas)
                    .map((checkbox) => checkbox.closest('label')?.querySelector('.disciplina-name')?.textContent?.trim())
                    .filter(Boolean);
                const monto = Number(result.data?.monto ?? result.monto ?? 0);
                const matriculaId = result.data?.matriculaId || result.matriculaId;
                const disciplinasTexto = result.data?.disciplinas || result.disciplinas || cursos.join(', ');
                const params = new URLSearchParams({
                    matricula: matriculaId,
                    nombre,
                    correo,
                    concepto: `Mensualidad - ${disciplinasTexto}`,
                    monto: String(monto)
                });
                window.location.href = `/pagos.html?preview=1&${params.toString()}`;
            } else {
                throw new Error(result.message || 'No se pudo registrar la matrícula.');
            }
        })
        .catch(error => {
            console.error('Error enviando datos:', error);
            alert(error.message || 'Error de conexión al guardar la matrícula.');
        })
        .finally(() => {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        });
    });

    // 3. Lógica del botón cancelar (T_07 - Implementar botón Cancelar con confirmación de abandono)
    const btnCancel = document.getElementById('btn-cancel');
    const modal = document.getElementById('cancelModal');
    const btnNoCancel = document.getElementById('btn-no-cancel');
    const btnYesCancel = document.getElementById('btn-yes-cancel');

    btnCancel.addEventListener('click', () => {
        modal.style.display = 'flex';
    });

    btnNoCancel.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    btnYesCancel.addEventListener('click', () => {
        // Descartar datos ingresados y volver a la pantalla principal (Criterio de Aceptación 2)
        form.reset();
        modal.style.display = 'none';
        window.location.href = typeof paginaDeInicio === 'function' ? paginaDeInicio() : '/';
    });

    // Precargar datos del alumno autenticado si ya tiene sesión
    async function precargarDatosAlumno() {
        if (esFlujoRegistro) return;
        const token = typeof obtenerToken === 'function' ? obtenerToken() : localStorage.getItem('token');
        if (!token) return;

        try {
            const response = await fetch('/api/perfil', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) return;
            const result = await response.json();
            const d = result.data;
            if (!d) return;

            if (d.numero_documento && document.getElementById('numero_documento')) {
                document.getElementById('numero_documento').value = d.numero_documento;
            }
            if (d.nombre && document.getElementById('nombres')) {
                document.getElementById('nombres').value = d.nombre;
            }
            if (d.apellido_paterno && document.getElementById('apellido_paterno')) {
                document.getElementById('apellido_paterno').value = d.apellido_paterno;
            }
            if (d.apellido_materno && document.getElementById('apellido_materno')) {
                document.getElementById('apellido_materno').value = d.apellido_materno;
            }
            if (d.fecha_nacimiento && document.getElementById('fecha_nacimiento')) {
                document.getElementById('fecha_nacimiento').value = d.fecha_nacimiento.substring(0, 10);
            }
            if (d.correo_electronico && document.getElementById('correo_electronico')) {
                document.getElementById('correo_electronico').value = d.correo_electronico;
            }
            if (d.numero_celular && document.getElementById('numero_celular')) {
                document.getElementById('numero_celular').value = d.numero_celular;
            }
            if (d.genero && document.getElementById('genero')) {
                document.getElementById('genero').value = d.genero;
            }
            if (d.direccion && document.getElementById('direccion')) {
                document.getElementById('direccion').value = d.direccion;
            }
            actualizarReglasDocumento();
            actualizarDisciplinasPorEdad();
            eliminarCamposPassword();
        } catch (e) {
            // Silencioso en caso de error
        }
    }
    precargarDatosAlumno();

    // 4. Contador de caracteres para Observaciones Médicas (T_03)
    const observacionesInput = document.getElementById('observaciones_medicas');
    const obsCounter = document.getElementById('obs_counter');

    observacionesInput.addEventListener('input', () => {
        const currentLength = observacionesInput.value.length;
        obsCounter.textContent = `${currentLength} / 250 caracteres`;
    });

    // Cerrar modal al clickear fuera
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    // Cerrar modal con la tecla Escape (Mejora T_07)
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });

    // 5. Cargar disciplinas desde la base de datos (T_04)
    async function cargarDisciplinas() {
        const container = document.getElementById('disciplinas-container');
        try {
            const response = await fetch('/api/matriculas/disciplinas');
            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.message || 'No se pudieron cargar las disciplinas.');
            }
            
            if (result.success && result.data.length > 0) {
                container.innerHTML = ''; // Limpiar mensaje de carga
                result.data.forEach(d => {
                    const label = document.createElement('label');
                    label.className = 'disciplina-card';
                    label.innerHTML = `
                        <div class="disciplina-info">
                            <span class="disciplina-name">${d.nombre}</span>
                            <span class="disciplina-desc">${d.descripcion}</span>
                            <span class="disciplina-tarifa">Tarifa mensual: S/ ${Number(d.tarifa).toFixed(2)}</span>
                        </div>
                        <input type="checkbox" name="disciplinas" value="${d.id}" aria-describedby="disciplinas-edad" disabled>
                    `;
                    container.appendChild(label);
                });
            } else {
                container.innerHTML = '<div class="text-muted">No hay disciplinas disponibles.</div>';
            }
        } catch (error) {
            console.error('Error cargando disciplinas:', error);
            container.innerHTML = '<div class="error-message">Error al cargar disciplinas. Asegúrate de tener la BD conectada.</div>';
        }
    }
    
    // Llamar a la API al cargar la página
    cargarDisciplinas().then(() => {
        // T_05: Lógica para contar disciplinas seleccionadas dinámicamente
        const checkboxes = document.querySelectorAll('input[name="disciplinas"]');
        actualizarDisciplinasPorEdad();
        checkboxes.forEach(cb => {
            cb.addEventListener('change', actualizarContadorDisciplinas);
        });
    });

    // Lógica para visualizar/ocultar contraseñas
    const togglePasswordBtns = document.querySelectorAll('.toggle-password');
    const svgEye = '<svg class="icon-eye" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const svgEyeOff = '<svg class="icon-eye-off" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            
            if (input.type === 'password') {
                input.type = 'text';
                this.innerHTML = svgEyeOff;
                this.title = 'Ocultar contraseña';
            } else {
                input.type = 'password';
                this.innerHTML = svgEye;
                this.title = 'Mostrar contraseña';
            }
        });
    });
});
