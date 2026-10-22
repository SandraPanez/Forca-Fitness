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

    function crearFila(persona) {
        const fila = document.createElement('tr');
        const nombre = document.createElement('td');
        const rol = document.createElement('td');
        const acciones = document.createElement('td');

        nombre.textContent = persona.nombre;
        rol.textContent = persona.roles.map(rolPersona => NOMBRE_ROL[rolPersona] || rolPersona).join(' y ');
        acciones.className = 'text-right';

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

    cargarPersonal();
});
