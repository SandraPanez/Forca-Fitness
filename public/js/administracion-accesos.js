document.addEventListener('DOMContentLoaded', () => {
    const tbody = document.getElementById('personal-tbody');

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

    function crearFila(persona) {
        const fila = document.createElement('tr');
        const nombre = document.createElement('td');
        const rol = document.createElement('td');
        const acciones = document.createElement('td');

        nombre.textContent = persona.nombre;
        rol.textContent = persona.roles.map(rolPersona => NOMBRE_ROL[rolPersona] || rolPersona).join(' y ');
        acciones.className = 'text-right';
        acciones.append(crearBotonVerMas(persona, fila), crearBotonModificar(persona));

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

    function abrirRegistro() {
        registroModal.style.display = 'flex';
        registroForm.elements.nombres.focus();
    }

    function cerrarRegistro() {
        registroModal.style.display = 'none';
        registroForm.reset();
    }

    document.getElementById('btn-agregar-personal').addEventListener('click', abrirRegistro);
    document.getElementById('btn-cancelar-registro').addEventListener('click', cerrarRegistro);
    registroModal.addEventListener('click', event => {
        if (event.target === registroModal) {
            cerrarRegistro();
        }
    });
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && registroModal.style.display === 'flex') {
            cerrarRegistro();
        }
    });
    // El envío del formulario se implementa en T-52 y T-53
    registroForm.addEventListener('submit', event => event.preventDefault());

    cargarPersonal();
});
