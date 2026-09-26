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
        
        if (disciplinas.length === 0) {
            errorDiv.style.display = 'block';
            // Scroll a la sección de disciplinas
            errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        errorDiv.style.display = 'none';
        
        // TODO (T_08): Aquí llamaremos a la API (POST /api/matriculas) en el siguiente commit
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
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                alert('¡Matrícula registrada exitosamente!');
                form.reset();
                document.getElementById('disciplinas-count').style.display = 'none';
            } else {
                alert('Error: ' + result.message);
            }
        })
        .catch(error => {
            console.error('Error enviando datos:', error);
            alert('Error de conexión al guardar la matrícula.');
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
        // Redirigir o limpiar formulario
        form.reset();
        modal.style.display = 'none';
        // En una app real redigiría al inicio
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
});
