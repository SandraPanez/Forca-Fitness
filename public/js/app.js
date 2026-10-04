document.addEventListener('DOMContentLoaded', () => {
    // 1. Establecer fecha actual
    const currentDateElement = document.getElementById('currentDate');
    const today = new Date();
    currentDateElement.textContent = today.toLocaleDateString('es-PE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    // 2. Manejo de formulario (Validaciones básicas para T_01/T_06)
    const form = document.getElementById('matriculaForm');
    const errorDiv = document.getElementById('disciplinas-error');

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Agregar clase para mostrar estilos de error en campos obligatorios vacíos (T_02)
        form.classList.add('was-validated');

        // Validar que el formulario HTML nativo esté completo
        if (!form.checkValidity()) {
            return; // Detiene el envío si faltan campos obligatorios
        }
        
        // Validar que al menos una disciplina esté seleccionada
        const disciplinas = document.querySelectorAll('input[name="disciplinas"]:checked');
        
        const password = form.querySelector('#password').value;
        const confirmPassword = form.querySelector('#confirm_password').value;

        if (password !== confirmPassword) {
            alert('Las contraseñas no coinciden. Por favor, verifícalas.');
            form.querySelector('#confirm_password').focus();
            return;
        }
        
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

        fetch('/api/matriculas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
                const monto = cursos.length * 150;
                const params = new URLSearchParams({
                    matricula: result.data.matriculaId,
                    nombre,
                    correo,
                    concepto: `Mensualidad - ${cursos.join(', ')}`,
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
        // Descartar datos ingresados y redirigir a la pantalla principal (Criterio de Aceptación 2)
        form.reset();
        modal.style.display = 'none';
        alert('Simulación: Redirigiendo al Menú Principal...');
        // En producción sería: window.location.href = '/ruta-del-menu';
    });

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
                        </div>
                        <input type="checkbox" name="disciplinas" value="${d.id}">
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
        const countBadge = document.getElementById('disciplinas-count');

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const selectedCount = document.querySelectorAll('input[name="disciplinas"]:checked').length;
                if (selectedCount > 0) {
                    countBadge.style.display = 'inline-block';
                    countBadge.textContent = `${selectedCount} seleccionada${selectedCount > 1 ? 's' : ''}`;
                } else {
                    countBadge.style.display = 'none';
                }
            });
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
