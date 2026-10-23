
/**
 * HU-22: Modificar horarios de clases
 * Forca & Fitness
 */

(() => {
    'use strict';

    const $ = (id) => document.getElementById(id);

    const NOMBRES_DIAS = {
        L: 'Lunes',
        LUNES: 'Lunes',
        M: 'Martes',
        MA: 'Martes',
        MARTES: 'Martes',
        X: 'Miercoles',
        MIERCOLES: 'Miercoles',
        J: 'Jueves',
        JUEVES: 'Jueves',
        V: 'Viernes',
        VIERNES: 'Viernes',
        S: 'Sabado',
        SABADO: 'Sabado',
        D: 'Domingo',
        DOMINGO: 'Domingo'
    };

    const ETIQUETAS_DIAS = {
        Lunes: 'Lunes',
        Martes: 'Martes',
        Miercoles: 'Miércoles',
        Jueves: 'Jueves',
        Viernes: 'Viernes',
        Sabado: 'Sábado',
        Domingo: 'Domingo'
    };

    let clases = [];
    let claseSeleccionada = null;
    let propuestaPendiente = null;
    let procesando = false;
    let revisionFormulario = 0;

    function claveNormalizada(valor) {
        return String(valor || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toUpperCase();
    }

    function interpretarDias(dias) {
        // Convención antigua de la base de datos:
        // L-M-V significa lunes, miércoles y viernes.
        if (
            typeof dias === 'string' &&
            dias.toUpperCase().replace(/\s/g, '') === 'L-M-V'
        ) {
            return ['Lunes', 'Miercoles', 'Viernes'];
        }

        const valores = Array.isArray(dias)
            ? dias
            : String(dias || '').split(/[-,;]/);

        const resultado = valores
            .map((dia) => NOMBRES_DIAS[claveNormalizada(dia)])
            .filter(Boolean);

        return [...new Set(resultado)];
    }

    function mostrarDias(dias) {
        return interpretarDias(dias)
            .map((dia) => ETIQUETAS_DIAS[dia])
            .join(', ') || 'Sin días';
    }

    function mostrarHora(hora) {
        return String(hora || '').slice(0, 5);
    }

    function claseColor(disciplina) {
        const nombre = claveNormalizada(disciplina);

        if (nombre.includes('CAPOEIRA') && nombre.includes('KIDS')) {
            return 'disciplina-capoeira-kids';
        }

        if (nombre.includes('CAPOEIRA')) {
            return 'disciplina-capoeira';
        }

        if (nombre.includes('BOXEO')) {
            return 'disciplina-boxeo';
        }

        if (nombre.includes('MMA')) {
            return 'disciplina-mma';
        }

        if (nombre.includes('JIU') || nombre.includes('BJJ')) {
            return nombre.includes('KIDS')
                ? 'disciplina-jiu-jitsu-kids'
                : 'disciplina-jiu-jitsu';
        }

        if (nombre.includes('CROSS')) {
            return 'disciplina-cross-training';
        }

        return '';
    }

    function mostrarMensaje(texto, tipo = '') {
        const elemento = $('mensaje-horarios');

        elemento.textContent = texto;
        elemento.className = tipo ? `mensaje-${tipo}` : '';
    }

    function actualizarBotones() {
        $('btn-previsualizar').disabled =
            !claseSeleccionada || procesando;

        $('btn-confirmar').disabled =
            !propuestaPendiente ||
            !propuestaPendiente.vista.puede_confirmar ||
            procesando;
    }

    function ocultarVistaPrevia() {
        revisionFormulario++;
        propuestaPendiente = null;

        $('vista-previa').hidden = true;
        $('btn-confirmar').disabled = true;
    }

    async function solicitarAPI(url, opciones = {}) {
        const respuesta = await authFetch(url, opciones);

        const datos = await respuesta.json().catch(() => ({}));

        if (!respuesta.ok) {
            const error = new Error(
                datos.mensaje ||
                datos.message ||
                `Error HTTP ${respuesta.status}`
            );

            error.status = respuesta.status;
            throw error;
        }

        return datos;
    }

    function obtenerClasesDeRespuesta(datos) {
        const opciones = [
            datos.clases,
            datos.data?.clases,
            datos.datos?.clases,
            datos.data,
            datos.horarios,
            datos.datos,
            datos
        ];

        return opciones.find(Array.isArray);
    }

    function obtenerVistaDeRespuesta(datos) {
        const opciones = [
            datos.vista_previa,
            datos.vistaPrevia,
            datos.previsualizacion,
            datos.preview,
            datos.data,
            datos.datos,
            datos
        ];

        return opciones.find(
            (valor) =>
                valor &&
                typeof valor === 'object' &&
                valor.propuesta
        );
    }

    function crearTexto(claseCSS, contenido) {
        const elemento = document.createElement('span');

        elemento.className = claseCSS;
        elemento.textContent = contenido;

        return elemento;
    }

    function pintarListaClases() {
        const contenedor = $('lista-clases');
        contenedor.replaceChildren();

        if (clases.length === 0) {
            contenedor.textContent = 'No hay clases registradas.';
            return;
        }

        clases.forEach((clase) => {
            const boton = document.createElement('button');

            boton.type = 'button';

            boton.className = [
                'clase-horario',
                claseColor(clase.disciplina),
                claseSeleccionada?.id_disc_horario ===
                    clase.id_disc_horario
                    ? 'is-selected'
                    : ''
            ].filter(Boolean).join(' ');

            boton.setAttribute(
                'aria-pressed',
                String(
                    claseSeleccionada?.id_disc_horario ===
                    clase.id_disc_horario
                )
            );

            boton.append(
                crearTexto('clase-etiqueta', clase.turno || 'Clase'),
                crearTexto('clase-disciplina', clase.disciplina),
                crearTexto(
                    'clase-profesor',
                    `Profesor: ${clase.profesor_nombre || 'No asignado'}`
                ),
                crearTexto(
                    'clase-dias',
                    `Días: ${mostrarDias(clase.dias)}`
                ),
                crearTexto(
                    'clase-horas',
                    `${mostrarHora(clase.hora_inicio)} - ` +
                    `${mostrarHora(clase.hora_fin)}`
                )
            );

            boton.addEventListener('click', () => {
                seleccionarClase(clase.id_disc_horario);
            });

            contenedor.appendChild(boton);
        });
    }

    function seleccionarClase(idDiscHorario) {
        const clase = clases.find(
            (item) => item.id_disc_horario === idDiscHorario
        );

        if (!clase) {
            return;
        }

        claseSeleccionada = clase;
        ocultarVistaPrevia();

        $('id-disc-horario').value = clase.id_disc_horario;
        $('clase-seleccionada').value = clase.disciplina;
        $('profesor-seleccionado').value =
            clase.profesor_nombre || 'No asignado';

        const diasActuales = interpretarDias(clase.dias);

        document.querySelectorAll(
            '#form-horario input[name="dias"]'
        ).forEach((casilla) => {
            casilla.checked = diasActuales.includes(casilla.value);
        });

        $('hora-inicio').value = mostrarHora(clase.hora_inicio);
        $('hora-fin').value = mostrarHora(clase.hora_fin);

        const actual = $('horario-actual');

        actual.replaceChildren();

        const titulo = document.createElement('h4');
        titulo.textContent = 'Horario actual';

        const descripcion = document.createElement('p');
        descripcion.textContent =
            `${mostrarDias(clase.dias)} | ` +
            `${mostrarHora(clase.hora_inicio)} - ` +
            `${mostrarHora(clase.hora_fin)} | ` +
            `${clase.turno || 'Sin turno'}`;

        actual.append(titulo, descripcion);

        mostrarMensaje('');
        pintarListaClases();
        actualizarBotones();
    }

    async function cargarClases(idPreferido = null) {
        const datos = await solicitarAPI('/api/horarios');

        const resultado = obtenerClasesDeRespuesta(datos);

        if (!resultado) {
            throw new Error(
                'La API no devolvió una lista de clases válida.'
            );
        }

        clases = resultado;
        claseSeleccionada = null;
        ocultarVistaPrevia();

        pintarListaClases();

        if (idPreferido) {
            seleccionarClase(idPreferido);
        }
    }

    function leerPropuesta() {
        const dias = Array.from(
            document.querySelectorAll(
                '#form-horario input[name="dias"]:checked'
            )
        ).map((casilla) => casilla.value);

        return {
            dias,
            hora_inicio: $('hora-inicio').value,
            hora_fin: $('hora-fin').value
        };
    }

    function minutos(hora) {
        if (!/^\d{2}:\d{2}$/.test(hora)) {
            throw new Error('Debes seleccionar horas válidas.');
        }

        const [horas, minutos] = hora.split(':').map(Number);

        return horas * 60 + minutos;
    }

    function validarPropuesta(propuesta) {
        if (propuesta.dias.length === 0) {
            throw new Error(
                'Debes seleccionar al menos un día.'
            );
        }

        if (
            !propuesta.hora_inicio ||
            !propuesta.hora_fin
        ) {
            throw new Error(
                'Debes completar ambas horas.'
            );
        }

        const inicio = minutos(propuesta.hora_inicio);
        const fin = minutos(propuesta.hora_fin);

        if (inicio % 15 !== 0 || fin % 15 !== 0) {
            throw new Error(
                'Selecciona horas en intervalos de 15 minutos.'
            );
        }

        if (fin <= inicio) {
            throw new Error(
                'La hora de fin debe ser posterior a la de inicio.'
            );
        }
    }

    function agregarParrafo(contenedor, texto) {
        const parrafo = document.createElement('p');

        parrafo.textContent = texto;
        contenedor.appendChild(parrafo);
    }

    function pintarIncidencias(id, titulo, incidencias) {
        const contenedor = $(id);
        contenedor.replaceChildren();

        if (!Array.isArray(incidencias) ||
            incidencias.length === 0) {
            contenedor.hidden = true;
            return;
        }

        contenedor.hidden = false;

        const encabezado = document.createElement('strong');
        encabezado.textContent = titulo;
        contenedor.appendChild(encabezado);

        const lista = document.createElement('ul');

        incidencias.forEach((incidencia) => {
            const item = document.createElement('li');

            item.textContent =
                `${incidencia.disciplina} — ` +
                `${incidencia.profesor || 'Sin profesor'} — ` +
                `${mostrarDias(incidencia.dias)} — ` +
                `${mostrarHora(incidencia.hora_inicio)} a ` +
                `${mostrarHora(incidencia.hora_fin)}`;

            lista.appendChild(item);
        });

        contenedor.appendChild(lista);
    }

    function pintarVistaPrevia(vista) {
        const resumen = $('resumen-cambio');
        resumen.replaceChildren();

        agregarParrafo(
            resumen,
            `Disciplina: ${claseSeleccionada.disciplina}`
        );

        agregarParrafo(
            resumen,
            `Profesor: ${claseSeleccionada.profesor_nombre || 'No asignado'}`
        );

        agregarParrafo(
            resumen,
            `Horario actual: ${mostrarDias(claseSeleccionada.dias)} — ` +
            `${mostrarHora(claseSeleccionada.hora_inicio)} a ` +
            `${mostrarHora(claseSeleccionada.hora_fin)}`
        );

        agregarParrafo(
            resumen,
            `Horario propuesto: ${mostrarDias(vista.propuesta.dias)} — ` +
            `${mostrarHora(vista.propuesta.hora_inicio)} a ` +
            `${mostrarHora(vista.propuesta.hora_fin)}`
        );

        agregarParrafo(
            resumen,
            `Turno propuesto: ${vista.propuesta.turno}`
        );

        const alumnos = $('aviso-alumnos');
        const cantidad = Number(vista.alumnos_activos || 0);

        alumnos.hidden = cantidad === 0;

        alumnos.textContent = cantidad > 0
            ? vista.aviso_alumnos ||
              `Esta clase tiene ${cantidad} alumnos matriculados activos.`
            : '';

        pintarIncidencias(
            'conflictos-horario',
            'Conflictos: no se puede guardar este horario.',
            vista.conflictos
        );

        pintarIncidencias(
            'advertencias-horario',
            'Advertencias: coincide con clases de otros profesores.',
            vista.advertencias
        );

        $('vista-previa').hidden = false;

        if (!vista.puede_confirmar) {
            mostrarMensaje(
                'Existen conflictos con clases del mismo profesor. ' +
                'Debes elegir otro horario.',
                'error'
            );
        } else if (vista.advertencias?.length > 0) {
            mostrarMensaje(
                'La propuesta tiene advertencias, ' +
                'pero puede confirmarse.'
            );
        } else {
            mostrarMensaje(
                'Propuesta válida. Revisa la vista previa ' +
                'antes de confirmar.'
            );
        }

        actualizarBotones();
    }

    async function previsualizar(evento) {
        evento.preventDefault();

        if (!claseSeleccionada || procesando) {
            return;
        }

        const propuesta = leerPropuesta();

        try {
            validarPropuesta(propuesta);
        } catch (error) {
            ocultarVistaPrevia();
            mostrarMensaje(error.message, 'error');
            return;
        }

        ocultarVistaPrevia();

        const revision = revisionFormulario;
        const idClase = claseSeleccionada.id_disc_horario;

        procesando = true;
        actualizarBotones();

        mostrarMensaje('Comprobando el horario...');

        try {
            const datos = await solicitarAPI(
                `/api/horarios/${encodeURIComponent(idClase)}/previsualizar`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(propuesta)
                }
            );

            if (revision !== revisionFormulario) {
                return;
            }

            const vista = obtenerVistaDeRespuesta(datos);

            if (!vista) {
                throw new Error(
                    'La API no devolvió una vista previa válida.'
                );
            }


            if (!vista.preview_token) {
                throw new Error(
                    'La API no devolvió el token de confirmación.'
                );
            }

            propuestaPendiente = {
                idClase,
                propuesta,
                vista,
                previewToken: vista.preview_token
            };


            pintarVistaPrevia(vista);

        } catch (error) {
            if (revision === revisionFormulario) {
                mostrarMensaje(error.message, 'error');
            }

        } finally {
            procesando = false;
            actualizarBotones();
        }
    }

    async function confirmarCambio() {
        if (
            !propuestaPendiente ||
            !propuestaPendiente.vista.puede_confirmar ||
            procesando
        ) {
            return;
        }

        const pendiente = propuestaPendiente;
        procesando = true;
        actualizarBotones();

        mostrarMensaje('Guardando cambios...');

        try {
            const resultado = await solicitarAPI(
                `/api/horarios/${encodeURIComponent(pendiente.idClase)}/confirmar`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },

                    body: JSON.stringify({
                        ...pendiente.propuesta,
                        preview_token: pendiente.previewToken
                    })

                }
            );

            ocultarVistaPrevia();

            try {
                await cargarClases(pendiente.idClase);

                mostrarMensaje(
                    resultado.mensaje ||
                    'Horario actualizado correctamente.',
                    'exito'
                );
            } catch (errorRecarga) {
                mostrarMensaje(
                    'El servidor confirmó el guardado, ' +
                    'pero no se pudo actualizar la lista: ' +
                    errorRecarga.message,
                    'error'
                );
            }

        } catch (error) {
            // Antes de reintentar, será necesaria otra vista previa.
            ocultarVistaPrevia();

            mostrarMensaje(
                'No se pudo confirmar el cambio: ' + error.message,
                'error'
            );

        } finally {
            procesando = false;
            actualizarBotones();
        }
    }

    async function iniciar() {
        if (!verificarSesion()) {
            return;
        }

        const roles = obtenerRolesUsuario().map(
            (rol) => String(rol).toUpperCase()
        );

        if (!roles.includes('DIRECTOR')) {
            document.querySelector('.horarios-layout').hidden = true;

            mostrarMensaje(
                'Acceso restringido: solo el Director puede ' +
                'gestionar horarios.',
                'error'
            );

            return;
        }

        $('form-horario').addEventListener(
            'submit',
            previsualizar
        );

        $('form-horario').addEventListener(
            'input',
            ocultarVistaPrevia
        );

        $('form-horario').addEventListener(
            'change',
            ocultarVistaPrevia
        );

        $('btn-volver').addEventListener('click', () => {
            ocultarVistaPrevia();
            mostrarMensaje('');
        });

        $('btn-confirmar').addEventListener(
            'click',
            confirmarCambio
        );

        procesando = true;
        actualizarBotones();

        try {
            await cargarClases();

            mostrarMensaje(
                'Selecciona una clase para modificar su horario.'
            );

        } catch (error) {
            $('lista-clases').textContent =
                'No se pudieron cargar las clases.';

            mostrarMensaje(error.message, 'error');

        } finally {
            procesando = false;
            actualizarBotones();
        }
    }

    document.addEventListener('DOMContentLoaded', iniciar);
})();
