document.addEventListener('DOMContentLoaded', () => {
    // Referencias DOM
    const tbody = document.getElementById('alumnos-tbody');
    const overlay = document.getElementById('side-panel-overlay');
    const sidePanel = document.getElementById('side-panel');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const sidePanelContent = document.getElementById('side-panel-content');

    // Estado local
    let alumnosCache = [];

    // T_20: Abrir panel (T_25 se implementará después)
    const openPanel = () => {
        overlay.classList.add('active');
        sidePanel.classList.add('active');
    };

    // T_25 se implementará en su propio commit
    const closePanel = () => {
        overlay.classList.remove('active');
        sidePanel.classList.remove('active');
    };

    // Se comentarán los event listeners del cierre temporalmente para T_25
    // btnClosePanel.addEventListener('click', closePanel);
    // overlay.addEventListener('click', closePanel);
    
    // MOCK DATA TEMPORAL (Para que el Tester pueda validar la interfaz sin DB real)
    const mockAlumnos = [
        {
            id: 1,
            nombres: "Juan",
            apellido_paterno: "Rondón",
            apellido_materno: "Pujay",
            estado_matricula: "Activa",
            dias_restantes: 25,
            iniciales: "JR"
        },
        {
            id: 2,
            nombres: "Fernando Alonso",
            apellido_paterno: "Lezama",
            apellido_materno: "Rodríguez",
            estado_matricula: "Vencida",
            dias_restantes: -9,
            iniciales: "FA"
        }
    ];

    const mockDetalle = {
        1: {
            nombre_completo: "Juan Rondón Pujay",
            estado: "Activa",
            dni: "74628153",
            correo: "juan.rondon.pujay@gmail.com",
            celular: "+51 987 654 321",
            fecha_nacimiento: "14/03/2003",
            direccion: "Los Olivos, Lima, Perú",
            disciplinas: "Boxeo, Jiu Jitsu",
            fecha_inscripcion: "07/09/2026",
            dias_restantes_texto: "Activa - 25 días restantes",
            estado_alumno: "Habilitado",
            observaciones_medicas: "Asma leve, usar inhalador si es necesario."
        },
        2: {
            nombre_completo: "Fernando Alonso Lezama Rodríguez",
            estado: "Vencida",
            dni: "71234567",
            correo: "f.lezama@gmail.com",
            celular: "+51 988 777 666",
            fecha_nacimiento: "22/11/1998",
            direccion: "San Miguel, Lima, Perú",
            disciplinas: "Cross Training",
            fecha_inscripcion: "01/08/2026",
            dias_restantes_texto: "Vencida hace 9 días",
            estado_alumno: "Inhabilitado",
            observaciones_medicas: "Ninguna."
        }
    };

    // Renderizar tabla
    const renderTable = (alumnos) => {
        tbody.innerHTML = '';
        if (alumnos.length === 0) {
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No hay alumnos registrados.</td></tr>';
            return;
        }

        alumnos.forEach(al => {
            const tr = document.createElement('tr');
            
            // Estado badge HTML
            let estadoHtml = '';
            if (al.estado_matricula === 'Activa') {
                estadoHtml = `<span class="badge-status badge-activa">Activa</span> <span class="dias-text">${al.dias_restantes} días restantes</span>`;
            } else {
                estadoHtml = `<span class="badge-status badge-vencida">Vencida</span> <span class="dias-text">Venció hace ${Math.abs(al.dias_restantes)} días</span>`;
            }

            tr.innerHTML = `
                <td>
                    <div class="alumno-row">
                        <div class="avatar-circle">${al.iniciales}</div>
                        <span class="font-medium">${al.nombres} ${al.apellido_paterno} ${al.apellido_materno}</span>
                    </div>
                </td>
                <td>${estadoHtml}</td>
                <td class="text-right">
                    <button class="btn-link" data-id="${al.id}">Ver detalle</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Asignar eventos de clic al botón "Ver detalle"
        document.querySelectorAll('.btn-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.getAttribute('data-id');
                loadStudentDetails(id);
            });
        });
    };

    // Cargar alumnos (Mockeado temporalmente)
    const loadAlumnos = async () => {
        try {
            alumnosCache = mockAlumnos;
            renderTable(alumnosCache);
        } catch (error) {
            console.error('Error cargando alumnos', error);
            tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger">Error de conexión.</td></tr>';
        }
    };

    // Cargar detalles de un alumno (T_20 a T_23)
    const loadStudentDetails = async (id) => {
        openPanel();
        sidePanelContent.innerHTML = '<div class="text-center text-muted mt-4">Cargando información...</div>';
        
        try {
            setTimeout(() => {
                const detalle = mockDetalle[id];
                if (detalle) {
                    let badgeClass = detalle.estado === 'Activa' ? 'badge-activa' : 'badge-vencida';
                    
                    sidePanelContent.innerHTML = `
                        <div class="side-panel-header-info">
                            <div class="avatar-large">${detalle.nombre_completo.substring(0,2).toUpperCase()}</div>
                            <div>
                                <h2 class="student-name-large">${detalle.nombre_completo}</h2>
                                <span class="badge-status ${badgeClass}">${detalle.estado}</span>
                            </div>
                        </div>

                        <hr class="panel-divider">

                        <!-- T_21: Mostrar datos personales -->
                        <h4 class="panel-section-title">Información personal</h4>
                        <div class="info-grid">
                            <div class="info-item">
                                <span class="info-label">DNI</span>
                                <span class="info-value">${detalle.dni}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Correo</span>
                                <span class="info-value">${detalle.correo}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Celular</span>
                                <span class="info-value">${detalle.celular}</span>
                            </div>
                            <div class="info-item">
                                <span class="info-label">Fecha de nacimiento</span>
                                <span class="info-value">${detalle.fecha_nacimiento}</span>
                            </div>
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label">Dirección</span>
                                <span class="info-value">${detalle.direccion}</span>
                            </div>
                        </div>

                        <hr class="panel-divider">
                        
                        <!-- T_22 y T_23: Información de matrícula, fechas y disciplinas -->
                        <h4 class="panel-section-title">Información de matrícula</h4>
                        <div class="info-grid">
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label">Disciplina(s)</span>
                                <span class="info-value">${detalle.disciplinas}</span>
                            </div>
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label">Fecha de inscripción</span>
                                <span class="info-value">${detalle.fecha_inscripcion}</span>
                            </div>
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label">Estado de matrícula</span>
                                <span class="info-value font-medium">${detalle.dias_restantes_texto}</span>
                            </div>
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-label">Estado del alumno</span>
                                <span class="info-value">${detalle.estado_alumno}</span>
                            </div>
                        </div>

                        <hr class="panel-divider">
                        
                        <!-- T_24: Mostrar observaciones médicas -->
                        <h4 class="panel-section-title">Observaciones médicas</h4>
                        <div class="info-grid">
                            <div class="info-item" style="grid-column: span 2;">
                                <span class="info-value text-muted">${detalle.observaciones_medicas || 'Sin observaciones.'}</span>
                            </div>
                        </div>
                    `;
                }
            }, 300); 
        } catch (error) {
            console.error(error);
            sidePanelContent.innerHTML = '<div class="text-danger mt-4 text-center">Error al cargar datos del alumno.</div>';
        }
    };

    // Init
    loadAlumnos();
});
