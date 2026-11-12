// HU-26: panel del Director para cambiar precios y ofertas de matrícula.
// Requiere /js/auth.js, /js/descuentos.js y /js/precios-promociones.js.

const preciosValidacion = (typeof module !== 'undefined' && module.exports)
    ? require('./precios-promociones')
    : { validarConfiguracionPrecio, calcularPrecioVigente, describirPromocion, mismaPromocion };

function escaparHtmlPrecio(texto) {
    return String(texto ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatearSoles(monto) {
    return `S/ ${Number(monto).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// HU-26 VISUAL (solo esta pantalla): los cambios se aplican únicamente en memoria
// del navegador; nunca se llama al PUT ni se escribe en la BD. Si la API de precios
// no puede cargar (p. ej. BD sin columnas Promocion_*), se usan estos datos locales.
// ---------------------------------------------------------------------------
const DISCIPLINAS_DEMO = Object.freeze([
    { id: 'DEMO-MMA', nombre: 'MMA', descripcion: 'Artes Marciales Mixtas', tarifa: 150, promocion: { tipo: 'PORCENTAJE', valor: 10, texto: 'Promo nuevos alumnos' } },
    { id: 'DEMO-JJ', nombre: 'Jiu Jitsu', descripcion: 'Brazilian Jiu Jitsu - Adultos', tarifa: 180, promocion: null },
    { id: 'DEMO-CAP', nombre: 'Capoeira', descripcion: 'Arte marcial y danza afrobrasileña - Adultos', tarifa: 160, promocion: { tipo: 'MONTO_FIJO', valor: 20, texto: 'Promo temporada' } },
    { id: 'DEMO-BOX', nombre: 'Boxeo', descripcion: 'Entrenamiento técnico de boxeo', tarifa: 110, promocion: null }
]);

function conPrecioVigente(disciplina) {
    return {
        ...disciplina,
        promocion: disciplina.promocion ? { ...disciplina.promocion } : null,
        precio_vigente: preciosValidacion.calcularPrecioVigente(disciplina).precioFinal
    };
}

function crearDisciplinasDemo() {
    return DISCIPLINAS_DEMO.map(conPrecioVigente);
}

// Solo errores del servidor o respuestas inválidas activan el demo.
// 401 (sesión) y 403 (permisos) se tratan como en el modo real.
function debeActivarModoDemo(status, resultado) {
    if (status >= 500) return true;
    if (status >= 200 && status < 300) return !resultado || !resultado.success || !Array.isArray(resultado.data);
    return false;
}

function aplicarCambioDemo(disciplina, cambios) {
    return conPrecioVigente({ ...disciplina, tarifa: cambios.tarifa, promocion: cambios.promocion });
}

// T7: tarjeta de disciplina con precio actual, etiqueta verde si hay promoción y botón Editar.
function htmlTarjetaPrecio(disciplina) {
    const promo = disciplina.promocion;
    const id = escaparHtmlPrecio(disciplina.id);
    return `
        <article class="precio-card${promo ? ' tiene-promocion' : ''}" data-id="${id}">
            <h3>${escaparHtmlPrecio(disciplina.nombre)}</h3>
            ${disciplina.descripcion ? `<p class="precio-card-descripcion">${escaparHtmlPrecio(disciplina.descripcion)}</p>` : ''}
            ${promo ? `<span class="promo-tag">${escaparHtmlPrecio(promo.texto)}</span>` : ''}
            <p class="precio-card-valor">
                ${formatearSoles(disciplina.precio_vigente)}
                ${promo ? `<span class="precio-card-base" aria-label="Precio base">${formatearSoles(disciplina.tarifa)}</span>` : ''}
            </p>
            <p class="text-muted precio-card-descripcion">${promo ? escaparHtmlPrecio(preciosValidacion.describirPromocion(promo)) : 'Sin promoción activa'}</p>
            <button type="button" class="btn-primary" data-editar="${id}">Editar</button>
        </article>`;
}

// T5: filas del resumen anterior / nuevo.
function filasResumenCambios(anterior, nuevo) {
    const precioAnterior = preciosValidacion.calcularPrecioVigente(anterior).precioFinal;
    const precioNuevo = preciosValidacion.calcularPrecioVigente(nuevo).precioFinal;
    return [
        { campo: 'Precio base', anterior: formatearSoles(anterior.tarifa), nuevo: formatearSoles(nuevo.tarifa) },
        {
            campo: 'Promoción / descuento',
            anterior: preciosValidacion.describirPromocion(anterior.promocion),
            nuevo: preciosValidacion.describirPromocion(nuevo.promocion)
        },
        { campo: 'Precio para nuevas matrículas', anterior: formatearSoles(precioAnterior), nuevo: formatearSoles(precioNuevo) }
    ].map(fila => ({ ...fila, cambio: fila.anterior !== fila.nuevo }));
}

function iniciarPanelPrecios() {
    const grid = document.getElementById('precios-grid');
    const mensaje = document.getElementById('precios-mensaje');
    const dialogEditar = document.getElementById('precio-editar');
    const dialogConfirmar = document.getElementById('precio-confirmar');
    const form = document.getElementById('precio-form');
    const campos = {
        tarifa: document.getElementById('precio-tarifa'),
        tipo: document.getElementById('precio-promo-tipo'),
        valor: document.getElementById('precio-promo-valor'),
        texto: document.getElementById('precio-promo-texto')
    };
    const errores = {
        tarifa: document.getElementById('precio-tarifa-error'),
        promocion_tipo: document.getElementById('precio-promo-tipo-error'),
        promocion_valor: document.getElementById('precio-promo-valor-error'),
        promocion_texto: document.getElementById('precio-promo-texto-error'),
        promocion: document.getElementById('precio-promocion-error')
    };
    const camposPromo = document.getElementById('precio-promo-campos');
    const labelValor = document.getElementById('precio-promo-valor-label');
    const precioFinal = document.getElementById('precio-final');
    const sinCambios = document.getElementById('precio-sin-cambios');
    const btnGuardar = document.getElementById('precio-guardar');
    const btnCancelar = document.getElementById('precio-cancelar');
    const btnVolver = document.getElementById('precio-volver');
    const btnConfirmar = document.getElementById('precio-confirmar-boton');
    const errorConfirmar = document.getElementById('precio-confirmar-error');

    const disciplinas = new Map();
    let seleccion = null;
    let pendiente = null;
    let guardando = false;

    function mostrarMensaje(texto, esError = false) {
        mensaje.textContent = texto;
        mensaje.classList.toggle('es-error', esError);
        mensaje.hidden = false;
    }

    function pintarTarjetas() {
        if (!disciplinas.size) {
            grid.innerHTML = '<p class="text-muted">No hay disciplinas registradas.</p>';
            return;
        }
        grid.innerHTML = [...disciplinas.values()].map(htmlTarjetaPrecio).join('');
    }

    function usarDatosLocales() {
        disciplinas.clear();
        crearDisciplinasDemo().forEach(d => disciplinas.set(d.id, d));
        pintarTarjetas();
    }

    // 1) API real (solo lectura); 2) si no puede cargar, datos locales de esta pantalla.
    // 401 (sesión) y 403 (permisos) muestran su mensaje como cualquier pantalla.
    async function cargar() {
        let response;
        let result = null;
        try {
            response = await authFetch('/api/matriculas/disciplinas/precios');
            result = await response.json().catch(() => null);
        } catch {
            usarDatosLocales(); // sin conexión con el servidor
            return;
        }

        if (response.ok && result && result.success && Array.isArray(result.data)) {
            disciplinas.clear();
            result.data.forEach(d => disciplinas.set(d.id, d));
            pintarTarjetas();
            return;
        }
        if (debeActivarModoDemo(response.status, result)) {
            usarDatosLocales();
            return;
        }
        grid.innerHTML = '';
        mostrarMensaje((result && result.message) || 'No se pudieron cargar los precios.', true);
    }

    function leerFormulario() {
        const tipo = campos.tipo.value;
        return {
            tarifa: campos.tarifa.value,
            promocion: tipo ? { tipo, valor: campos.valor.value, texto: campos.texto.value } : null
        };
    }

    function pintarErrores(lista = {}) {
        Object.entries(errores).forEach(([campo, el]) => { el.textContent = lista[campo] || ''; });
        campos.tarifa.setAttribute('aria-invalid', String(Boolean(lista.tarifa)));
        campos.valor.setAttribute('aria-invalid', String(Boolean(lista.promocion_valor)));
        campos.texto.setAttribute('aria-invalid', String(Boolean(lista.promocion_texto)));
    }

    // T4 / CA4: valida en cada cambio y deja "Guardar cambios" deshabilitado si hay errores.
    function actualizarEstado() {
        const tipo = campos.tipo.value;
        camposPromo.hidden = !tipo;
        labelValor.firstChild.textContent = tipo === 'MONTO_FIJO'
            ? 'Monto del descuento (S/) '
            : 'Porcentaje de descuento (%) ';

        const validacion = preciosValidacion.validarConfiguracionPrecio(leerFormulario());
        pintarErrores(validacion.errores);

        const igual = validacion.valido &&
            validacion.datos.tarifa === Number(seleccion.tarifa) &&
            preciosValidacion.mismaPromocion(validacion.datos.promocion, seleccion.promocion);

        sinCambios.hidden = !igual;
        pendiente = validacion.valido && !igual ? validacion.datos : null;
        btnGuardar.disabled = !pendiente;
        precioFinal.textContent = validacion.valido
            ? formatearSoles(preciosValidacion.calcularPrecioVigente(validacion.datos).precioFinal)
            : '—';
    }

    // CA1 / T2: abre la ventana con el precio base y la promoción actual.
    function abrirEdicion(id) {
        seleccion = disciplinas.get(id);
        if (!seleccion) return;
        document.getElementById('precio-editar-disciplina').textContent = seleccion.nombre;
        campos.tarifa.value = Number(seleccion.tarifa).toFixed(2);
        campos.tipo.value = seleccion.promocion ? seleccion.promocion.tipo : '';
        campos.valor.value = seleccion.promocion ? String(seleccion.promocion.valor) : '';
        campos.texto.value = seleccion.promocion ? seleccion.promocion.texto : '';
        errorConfirmar.textContent = '';
        actualizarEstado();
        dialogEditar.showModal();
        campos.tarifa.focus();
    }

    // CA2 / T5: "Guardar cambios" no guarda; muestra el resumen para confirmar.
    function abrirConfirmacion() {
        actualizarEstado();
        if (!pendiente) return;
        document.getElementById('precio-confirmar-disciplina').textContent = seleccion.nombre;
        const tbody = document.getElementById('precio-resumen');
        tbody.innerHTML = filasResumenCambios(
            { tarifa: Number(seleccion.tarifa), promocion: seleccion.promocion },
            pendiente
        ).map(fila => `
            <tr class="${fila.cambio ? 'cambio' : ''}">
                <th scope="row">${escaparHtmlPrecio(fila.campo)}</th>
                <td>${escaparHtmlPrecio(fila.anterior)}</td>
                <td>${escaparHtmlPrecio(fila.nuevo)}</td>
            </tr>`).join('');
        errorConfirmar.textContent = '';
        dialogConfirmar.showModal();
        btnConfirmar.focus();
    }

    // CA3 / T7 / T8: actualiza la tarjeta, cierra ventanas y muestra el mensaje.
    function finalizarGuardado(actual, texto) {
        disciplinas.set(actual.id, actual);
        const tarjeta = grid.querySelector(`[data-id="${CSS.escape(actual.id)}"]`);
        if (tarjeta) tarjeta.outerHTML = htmlTarjetaPrecio(actual);
        else pintarTarjetas();

        dialogConfirmar.close();
        dialogEditar.close();
        seleccion = null;
        pendiente = null;
        mostrarMensaje(texto || 'Precio actualizado con éxito');
    }

    // CA3 / T6 (visual): aplica el cambio solo en memoria; no se guarda en la BD.
    function confirmar() {
        if (guardando || !pendiente || !seleccion) return;
        finalizarGuardado(aplicarCambioDemo(seleccion, pendiente), 'Precio actualizado con éxito');
    }

    grid.addEventListener('click', event => {
        const boton = event.target.closest('[data-editar]');
        if (boton) abrirEdicion(boton.dataset.editar);
    });
    Object.values(campos).forEach(campo => {
        campo.addEventListener('input', actualizarEstado);
        campo.addEventListener('change', actualizarEstado);
    });
    form.addEventListener('submit', event => {
        event.preventDefault();
        if (!btnGuardar.disabled) abrirConfirmacion();
    });
    btnCancelar.addEventListener('click', () => dialogEditar.close());
    btnVolver.addEventListener('click', () => { if (!guardando) dialogConfirmar.close(); });
    btnConfirmar.addEventListener('click', confirmar);
    [dialogEditar, dialogConfirmar].forEach(dialog => dialog.addEventListener('cancel', event => {
        if (guardando) event.preventDefault();
    }));

    cargar();
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        htmlTarjetaPrecio,
        filasResumenCambios,
        formatearSoles,
        crearDisciplinasDemo,
        debeActivarModoDemo,
        aplicarCambioDemo
    };
} else {
    document.addEventListener('DOMContentLoaded', iniciarPanelPrecios);
}
