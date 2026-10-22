document.addEventListener('DOMContentLoaded', async () => {
    const datos = document.getElementById('acceso-datos');
    const id = new URLSearchParams(window.location.search).get('id');

    function mostrar(etiqueta, valor) {
        const item = document.createElement('div');
        const textoEtiqueta = document.createElement('span');
        const textoValor = document.createElement('span');

        item.className = 'info-item';
        textoEtiqueta.className = 'info-label';
        textoValor.className = 'info-value';
        textoEtiqueta.textContent = etiqueta;
        textoValor.textContent = valor;

        item.append(textoEtiqueta, textoValor);
        return item;
    }

    if (!id) {
        datos.replaceChildren(mostrar('Trabajador', 'No se indicó qué trabajador modificar.'));
        return;
    }

    try {
        const response = await authFetch(`/api/personal/${encodeURIComponent(id)}`);
        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(result.message || 'No se pudo cargar la información del trabajador.');
        }

        datos.replaceChildren(
            mostrar('Trabajador', result.data.nombre),
            mostrar('Rol actual', result.data.roles.map(rol => NOMBRE_ROL[rol] || rol).join(' y '))
        );
    } catch (error) {
        datos.replaceChildren(mostrar('Trabajador', error.message));
    }
});
