/**
 * balance.js - Control de acceso y lógica para la interfaz «Balance de ingresos y pagos»
 * Historia de Usuario 16: Consultar balance de ingresos y pagos
 *
 * REGLA DE NEGOCIO:
 * "Solo el tesorero tiene acceso a este apartado, pues es quien se encarga
 * completamente de los registros financieros de la academia."
 */

let operacionesPeriodo = [];
let consultaEnCurso = false;

// ────────────────────────────────────────────────────────────
// 1. CONTROL DE ACCESO ESTRICTO: EXCLUSIVO PARA ROL TESORERO
// ────────────────────────────────────────────────────────────
(function verificarAccesoExclusivoTesorero() {
    if (!verificarSesion()) {
        return;
    }

    const usuario = obtenerUsuario();
    const roles = obtenerRolesUsuario(usuario);
    const esTesorero = roles.includes('TESORERO');

    if (!esTesorero) {
        alert('Acceso restringido: El apartado «Balance de ingresos y pagos» es exclusivo para el rol de Tesorero.');
        window.location.href = paginaDeInicio();
        return;
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (typeof pintarEncabezado === 'function') {
            pintarEncabezado();
        }
        inicializarBalanceView();
    });
})();

// ────────────────────────────────────────────────────────────
// 2. UTILIDADES DE FORMATO Y FECHAS
// ────────────────────────────────────────────────────────────
function escapeHtml(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function formatearMoneda(monto) {
    return `S/ ${Number(monto || 0).toFixed(2)}`;
}

function formatearFechaISO(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const dia = String(fecha.getDate()).padStart(2, '0');
    return `${anio}-${mes}-${dia}`;
}

function formatearFechaCorta(isoDate) {
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '—';
    const [anio, mes, dia] = isoDate.split('-');
    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHoraOperacion(fechaStr) {
    const fecha = new Date(fechaStr);
    if (Number.isNaN(fecha.getTime())) {
        return { fecha: '—', hora: '' };
    }
    const fechaTexto = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    }).format(fecha);
    const horaTexto = new Intl.DateTimeFormat('es-PE', {
        timeZone: 'America/Lima',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    }).format(fecha);
    return { fecha: fechaTexto, hora: horaTexto };
}

function obtenerIniciales(nombre) {
    const partes = String(nombre || '').trim().split(/\s+/).filter(Boolean);
    if (!partes.length) return 'AL';
    if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
    return `${partes[0][0]}${partes[1][0]}`.toUpperCase();
}

function calcularRangoPreset(preset) {
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = hoy.getMonth();

    switch (preset) {
        case 'hoy': {
            const fecha = formatearFechaISO(hoy);
            return { fechaInicio: fecha, fechaFin: fecha };
        }
        case 'semana': {
            const diaSemana = hoy.getDay() === 0 ? 6 : hoy.getDay() - 1;
            const lunes = new Date(anio, mes, hoy.getDate() - diaSemana);
            const domingo = new Date(anio, mes, lunes.getDate() + 6);
            return {
                fechaInicio: formatearFechaISO(lunes),
                fechaFin: formatearFechaISO(domingo)
            };
        }
        case 'mes': {
            return {
                fechaInicio: formatearFechaISO(new Date(anio, mes, 1)),
                fechaFin: formatearFechaISO(new Date(anio, mes + 1, 0))
            };
        }
        case 'mes-ant': {
            return {
                fechaInicio: formatearFechaISO(new Date(anio, mes - 1, 1)),
                fechaFin: formatearFechaISO(new Date(anio, mes, 0))
            };
        }
        case 'anio': {
            return {
                fechaInicio: `${anio}-01-01`,
                fechaFin: `${anio}-12-31`
            };
        }
        default:
            return null;
    }
}

// ────────────────────────────────────────────────────────────
// 3. INICIALIZACIÓN Y EVENTOS DEL FILTRO POR PERIODO
// ────────────────────────────────────────────────────────────
function inicializarBalanceView() {
    const form = document.getElementById('form-consulta-balance');
    const inputInicio = document.getElementById('fecha-inicio');
    const inputFin = document.getElementById('fecha-fin');
    const selectMedio = document.getElementById('filtro-medio');
    const inputBuscar = document.getElementById('input-buscar-operacion');
    const botonesPreset = document.querySelectorAll('.btn-preset[data-preset]');

    // Configurar periodo predeterminado ("Este mes")
    const rangoMes = calcularRangoPreset('mes');
    if (inputInicio && inputFin && rangoMes) {
        inputInicio.value = rangoMes.fechaInicio;
        inputFin.value = rangoMes.fechaFin;
    }

    // Selección rápida de periodos (Hoy, Esta semana, Este mes, Mes anterior, Este año)
    botonesPreset.forEach((btn) => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            const rango = calcularRangoPreset(preset);
            if (!rango || !inputInicio || !inputFin) return;

            inputInicio.value = rango.fechaInicio;
            inputFin.value = rango.fechaFin;

            botonesPreset.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            consultarBalancePorPeriodo();
        });
    });

    // Sincronizar estado visual de presets cuando el tesorero edita manualmente las fechas
    const sincronizarPresetsManual = () => {
        if (!inputInicio || !inputFin) return;
        botonesPreset.forEach((btn) => {
            const rango = calcularRangoPreset(btn.dataset.preset);
            const coincide = Boolean(
                rango &&
                rango.fechaInicio === inputInicio.value &&
                rango.fechaFin === inputFin.value
            );
            btn.classList.toggle('active', coincide);
        });
    };

    inputInicio?.addEventListener('change', sincronizarPresetsManual);
    inputFin?.addEventListener('change', sincronizarPresetsManual);

    // Acción principal "Consultar balance" (Criterio 2)
    form?.addEventListener('submit', (event) => {
        event.preventDefault();
        consultarBalancePorPeriodo();
    });

    // Actualizar al cambiar filtro de medio de pago
    selectMedio?.addEventListener('change', () => {
        consultarBalancePorPeriodo();
    });

    // Búsqueda rápida en tiempo real sobre las operaciones del periodo consultado
    inputBuscar?.addEventListener('input', () => {
        aplicarFiltroTextoTabla();
    });

    // Carga inicial del balance para el periodo predeterminado
    consultarBalancePorPeriodo();
}

// ────────────────────────────────────────────────────────────
// 4. CONSULTA AL BACKEND Y RENDERIZADO DE RESULTADOS
// ────────────────────────────────────────────────────────────
function mostrarMensajeBalance(texto, tipo = 'error') {
    const el = document.getElementById('balance-message');
    if (!el) return;
    const icono = tipo === 'error' ? '⚠️' : 'ℹ️';
    el.className = `balance-message ${tipo}`;
    el.innerHTML = `<span>${icono}</span><span>${escapeHtml(texto)}</span>`;
    el.hidden = false;
    el.style.display = 'flex';
}

function limpiarMensajeBalance() {
    const el = document.getElementById('balance-message');
    if (!el) return;
    el.hidden = true;
    el.style.display = 'none';
    el.textContent = '';
}

async function consultarBalancePorPeriodo() {
    if (consultaEnCurso) return;

    const inputInicio = document.getElementById('fecha-inicio');
    const inputFin = document.getElementById('fecha-fin');
    const selectMedio = document.getElementById('filtro-medio');
    const btnConsultar = document.getElementById('btn-consultar');
    const tbody = document.getElementById('balance-tbody');

    const fechaInicio = inputInicio?.value || '';
    const fechaFin = inputFin?.value || '';
    const medio = selectMedio?.value || '';

    limpiarMensajeBalance();

    if (!fechaInicio || !fechaFin) {
        mostrarMensajeBalance('Selecciona tanto la fecha de inicio como la fecha de fin del periodo.');
        return;
    }

    if (fechaInicio > fechaFin) {
        mostrarMensajeBalance('La fecha de inicio no puede ser posterior a la fecha de fin.');
        inputInicio?.focus();
        return;
    }

    consultaEnCurso = true;
    if (btnConsultar) {
        btnConsultar.disabled = true;
        btnConsultar.innerHTML = '<span>⏳</span> Consultando...';
    }
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b;">
                    ⏳ Calculando balance y cargando operaciones del periodo...
                </td>
            </tr>
        `;
    }

    try {
        const params = new URLSearchParams({ fechaInicio, fechaFin });
        if (medio) params.set('medio', medio);

        const response = await authFetch(`/api/pagos/balance?${params.toString()}`);
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.success) {
            throw new Error(payload.message || 'No se pudo consultar el balance del periodo seleccionado.');
        }

        const { periodo, resumen, desglose, operaciones } = payload.data || {};
        operacionesPeriodo = Array.isArray(operaciones) ? operaciones : [];

        actualizarTarjetasResumen(resumen, periodo || { fechaInicio, fechaFin });
        renderizarDesgloseBalance(resumen, desglose);
        aplicarFiltroTextoTabla();
    } catch (error) {
        console.error('[BALANCE] Error al consultar periodo:', error);
        operacionesPeriodo = [];
        actualizarTarjetasResumen(null, { fechaInicio, fechaFin });
        renderizarDesgloseBalance(null, null);
        mostrarMensajeBalance(error.message || 'Ocurrió un error al consultar el balance.');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; padding: 2.5rem; color: #b91c1c;">
                        ⚠️ No se pudieron cargar las operaciones del periodo seleccionado.
                    </td>
                </tr>
            `;
        }
    } finally {
        consultaEnCurso = false;
        if (btnConsultar) {
            btnConsultar.disabled = false;
            btnConsultar.innerHTML = '<span>🔍</span> Consultar balance';
        }
    }
}

function actualizarTarjetasResumen(resumen, periodo) {
    const r = resumen || {
        total_ingresos: 0,
        balance_neto: 0,
        balance_neto_letras: 'Cero y 00/100 soles',
        total_operaciones: 0,
        ticket_promedio: 0,
        ingresos_efectivo: 0,
        operaciones_efectivo: 0,
        porcentaje_efectivo: 0,
        ingresos_mercado_pago: 0,
        operaciones_mercado_pago: 0,
        porcentaje_mercado_pago: 0
    };

    const setText = (id, text) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    };

    setText('kpi-total-ingresos', formatearMoneda(r.total_ingresos));
    setText('kpi-total-operaciones', String(r.total_operaciones));
    setText(
        'kpi-ops-sub',
        r.total_operaciones > 0
            ? `Ticket prom.: ${formatearMoneda(r.ticket_promedio)}`
            : 'Pagos aprobados'
    );
    setText('kpi-ingresos-efectivo', formatearMoneda(r.ingresos_efectivo));
    setText(
        'kpi-ops-efectivo',
        `${r.operaciones_efectivo} ${r.operaciones_efectivo === 1 ? 'transacción' : 'transacciones'} (${r.porcentaje_efectivo ?? 0}%)`
    );
    setText('kpi-ingresos-mp', formatearMoneda(r.ingresos_mercado_pago));
    setText(
        'kpi-ops-mp',
        `${r.operaciones_mercado_pago} ${r.operaciones_mercado_pago === 1 ? 'transacción' : 'transacciones'} (${r.porcentaje_mercado_pago ?? 0}%)`
    );

    if (periodo?.fechaInicio && periodo?.fechaFin) {
        setText(
            'kpi-rango-sub',
            `Del ${formatearFechaCorta(periodo.fechaInicio)} al ${formatearFechaCorta(periodo.fechaFin)}`
        );
    }
}

function renderizarDesgloseBalance(resumen, desglose) {
    const r = resumen || {
        balance_neto: 0,
        balance_neto_letras: 'Cero y 00/100 soles',
        ingresos_efectivo: 0,
        ingresos_mercado_pago: 0,
        porcentaje_efectivo: 0,
        porcentaje_mercado_pago: 0,
        cuadra_con_bd: true
    };
    const conceptos = desglose?.conceptos || [];
    const flujoDiario = desglose?.flujo_diario || [];

    const pctEfectivo = Math.max(0, Math.min(100, Number(r.porcentaje_efectivo || 0)));
    const pctMp = Math.max(0, Math.min(100, Number(r.porcentaje_mercado_pago || 0)));

    const barEfectivo = document.getElementById('bar-efectivo');
    const barMp = document.getElementById('bar-mp');
    const legEfectivo = document.getElementById('leg-efectivo');
    const legMp = document.getElementById('leg-mp');

    if (barEfectivo) barEfectivo.style.width = `${pctEfectivo}%`;
    if (barMp) barMp.style.width = `${pctMp}%`;
    if (legEfectivo) legEfectivo.textContent = `${pctEfectivo}% (${formatearMoneda(r.ingresos_efectivo)})`;
    if (legMp) legMp.textContent = `${pctMp}% (${formatearMoneda(r.ingresos_mercado_pago)})`;

    const listaConceptos = document.getElementById('desglose-conceptos-list');
    if (listaConceptos) {
        if (!conceptos.length) {
            listaConceptos.innerHTML = `
                <li class="breakdown-row" style="justify-content: center; color: #64748b;">
                    Sin ingresos por disciplina en este periodo
                </li>
            `;
        } else {
            listaConceptos.innerHTML = conceptos.map(item => `
                <li class="breakdown-row">
                    <div class="breakdown-row-label">
                        <span>${escapeHtml(item.concepto)}</span>
                        <span class="breakdown-row-meta">${item.operaciones} ${item.operaciones === 1 ? 'operación' : 'operaciones'} • ${item.porcentaje}% del total</span>
                    </div>
                    <span class="breakdown-row-val">${escapeHtml(formatearMoneda(item.total))}</span>
                </li>
            `).join('');
        }
    }

    const listaDiario = document.getElementById('flujo-diario-list');
    if (listaDiario) {
        if (!flujoDiario.length) {
            listaDiario.innerHTML = `
                <li class="breakdown-row" style="justify-content: center; color: #64748b;">
                    Sin movimientos diarios en este periodo
                </li>
            `;
        } else {
            listaDiario.innerHTML = flujoDiario.map(dia => `
                <li class="breakdown-row">
                    <div class="breakdown-row-label">
                        <span>${escapeHtml(formatearFechaCorta(dia.fecha))} (${dia.cantidad_operaciones} ${dia.cantidad_operaciones === 1 ? 'op.' : 'ops.'})</span>
                        <span class="breakdown-row-meta">Efec.: ${escapeHtml(formatearMoneda(dia.ingresos_efectivo))} | MP: ${escapeHtml(formatearMoneda(dia.ingresos_mercado_pago))}</span>
                    </div>
                    <span class="breakdown-row-val">${escapeHtml(formatearMoneda(dia.total_dia))}</span>
                </li>
            `).join('');
        }
    }

    const netAmountEl = document.getElementById('net-balance-amount');
    const netLettersEl = document.getElementById('net-balance-letras');
    const badgeConcilEl = document.getElementById('badge-conciliacion');

    if (netAmountEl) netAmountEl.textContent = formatearMoneda(r.balance_neto ?? r.total_ingresos);
    if (netLettersEl) netLettersEl.textContent = r.balance_neto_letras || 'Cero y 00/100 soles';
    if (badgeConcilEl) {
        const cuadra = r.cuadra_con_bd !== false;
        badgeConcilEl.className = cuadra ? 'reconcile-badge' : 'reconcile-badge warning';
        badgeConcilEl.textContent = cuadra ? '✓ Conciliado' : '⚠️ Diferencia detectada';
    }
}

function aplicarFiltroTextoTabla() {
    const termino = (document.getElementById('input-buscar-operacion')?.value || '').trim().toLowerCase();

    if (!termino) {
        renderizarTablaOperaciones(operacionesPeriodo, false);
        return;
    }

    const filtradas = operacionesPeriodo.filter((op) => {
        const campos = [
            op.alumno,
            op.dni,
            op.id_matricula,
            op.disciplinas,
            op.numero_recibo,
            op.referencia,
            op.id_pago
        ];
        return campos.some(c => String(c || '').toLowerCase().includes(termino));
    });

    renderizarTablaOperaciones(filtradas, true);
}

function renderizarTablaOperaciones(operaciones, tieneFiltroTexto) {
    const tbody = document.getElementById('balance-tbody');
    const badgeCount = document.getElementById('badge-operaciones-count');

    if (badgeCount) {
        const n = operaciones.length;
        const subtotalCentimos = operaciones.reduce(
            (acc, op) => acc + Math.round(Number(op.monto || 0) * 100),
            0
        );
        const subtotal = subtotalCentimos / 100;
        badgeCount.textContent = `${n} ${n === 1 ? 'registro' : 'registros'} • ${formatearMoneda(subtotal)}`;
    }

    if (!tbody) return;

    if (!operaciones.length) {
        const mensajeVacio = tieneFiltroTexto
            ? '🔍 Ninguna operación del periodo coincide con el criterio de búsqueda.'
            : '📭 No se registraron ingresos ni pagos aprobados en el periodo seleccionado.';
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b;">
                    ${mensajeVacio}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = operaciones.map((op) => {
        const { fecha, hora } = formatearFechaHoraOperacion(op.fecha_operacion);
        const iniciales = obtenerIniciales(op.alumno);
        const esMp = op.medio_pago === 'MERCADO_PAGO';
        const badgeMedio = esMp
            ? '<span class="badge-method badge-method-mp">🌐 Mercado Pago</span>'
            : '<span class="badge-method badge-method-cash">💵 Efectivo</span>';

        return `
            <tr>
                <td>
                    <strong>${escapeHtml(fecha)}</strong>
                    <span class="user-meta-sub">${escapeHtml(hora)}</span>
                </td>
                <td>
                    <div class="user-cell">
                        <div class="user-avatar-sm">${escapeHtml(iniciales)}</div>
                        <div>
                            <p class="user-name-title">${escapeHtml(op.alumno)}</p>
                            <p class="user-meta-sub">DNI: ${escapeHtml(op.dni || '—')}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <strong>${escapeHtml(op.id_matricula)}</strong>
                    <span class="user-meta-sub">${escapeHtml(op.disciplinas || 'Mensualidad')}</span>
                </td>
                <td>${badgeMedio}</td>
                <td>
                    <strong>${escapeHtml(op.numero_recibo || '—')}</strong>
                    <span class="user-meta-sub">Ref: ${escapeHtml(op.referencia || '—')}</span>
                </td>
                <td>
                    <span class="amount-cell amount-green">${escapeHtml(formatearMoneda(op.monto))}</span>
                </td>
                <td style="text-align: right;">
                    <button type="button" class="btn-action-detalle" data-pago-id="${escapeHtml(op.id_pago)}">
                        👁️ Ver detalle
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}
