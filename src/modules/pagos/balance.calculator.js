const { montoEnLetras } = require('../../shared/utils/monto-letras.util');

/**
 * Convierte un monto numérico o texto a céntimos enteros para evitar errores de coma flotante.
 */
function aCentimos(monto) {
    const numero = Number(monto || 0);
    if (!Number.isFinite(numero)) return 0;
    return Math.round(numero * 100);
}

/**
 * Convierte una cantidad en céntimos enteros a soles con 2 decimales.
 */
function deCentimos(centimos) {
    return Number((Number(centimos || 0) / 100).toFixed(2));
}

/**
 * Calcula un porcentaje con 1 decimal seguro frente a división por cero.
 */
function calcularPorcentaje(parteCentimos, totalCentimos) {
    if (!totalCentimos || totalCentimos <= 0) return 0;
    return Number(((parteCentimos / totalCentimos) * 100).toFixed(1));
}

/**
 * Normaliza el identificador del medio de pago (ej. 'Mercado Pago' -> 'MERCADO_PAGO').
 */
function normalizarMedioPago(medio) {
    if (!medio) return '';
    return String(medio).trim().toUpperCase().replace(/\s+/g, '_');
}

/**
 * Convierte un timestamp o fecha a formato AAAA-MM-DD en zona horaria de Perú (America/Lima).
 */
function fechaLimaIso(fechaInput) {
    const fecha = new Date(fechaInput);
    if (Number.isNaN(fecha.getTime())) return '';
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'America/Lima',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(fecha);
}

function construirMontoLetrasSeguro(monto) {
    try {
        return montoEnLetras(monto);
    } catch {
        return `${Number(monto || 0).toFixed(2)} soles`;
    }
}

/**
 * Filtra únicamente las operaciones válidas aprobadas que ingresan al balance financiero.
 */
function filtrarOperacionesAprobadas(operaciones = []) {
    return (Array.isArray(operaciones) ? operaciones : []).filter(
        op => !op.estado_pago || String(op.estado_pago).toUpperCase() === 'APROBADO'
    );
}

/**
 * Calcula el resumen del balance financiero en céntimos enteros y lo concilia
 * contra los totales agregados obtenidos de PostgreSQL cuando están disponibles.
 */
function calcularResumenBalance(operaciones = [], resumenBd = null) {
    const aprobadas = filtrarOperacionesAprobadas(operaciones);

    let totalIngresosCentimos = 0;
    let totalEgresosCentimos = 0;
    let efectivoCentimos = 0;
    let operacionesEfectivo = 0;
    let mpCentimos = 0;
    let operacionesMp = 0;

    for (const op of aprobadas) {
        const centimos = Math.max(0, aCentimos(op.monto));
        const medio = normalizarMedioPago(op.medio_pago);
        const tipoMovimiento = String(op.tipo_movimiento || 'INGRESO').toUpperCase();

        if (tipoMovimiento === 'EGRESO') {
            totalEgresosCentimos += centimos;
            continue;
        }

        totalIngresosCentimos += centimos;
        if (medio === 'EFECTIVO') {
            efectivoCentimos += centimos;
            operacionesEfectivo += 1;
        } else if (medio === 'MERCADO_PAGO') {
            mpCentimos += centimos;
            operacionesMp += 1;
        }
    }

    const totalOperaciones = aprobadas.length;
    const balanceNetoCentimos = totalIngresosCentimos - totalEgresosCentimos;
    const ticketPromedioCentimos = totalOperaciones > 0
        ? Math.round(totalIngresosCentimos / totalOperaciones)
        : 0;

    const cuadraConBd = resumenBd
        ? (
            aCentimos(resumenBd.total_ingresos) === totalIngresosCentimos &&
            Number(resumenBd.total_operaciones || 0) === totalOperaciones &&
            aCentimos(resumenBd.ingresos_efectivo) === efectivoCentimos &&
            aCentimos(resumenBd.ingresos_mercado_pago) === mpCentimos
        )
        : true;

    const balanceNeto = deCentimos(balanceNetoCentimos);

    return {
        total_ingresos: deCentimos(totalIngresosCentimos),
        total_egresos: deCentimos(totalEgresosCentimos),
        balance_neto: balanceNeto,
        balance_neto_letras: construirMontoLetrasSeguro(Math.max(0, balanceNeto)),
        total_operaciones: totalOperaciones,
        ticket_promedio: deCentimos(ticketPromedioCentimos),
        ingresos_efectivo: deCentimos(efectivoCentimos),
        operaciones_efectivo: operacionesEfectivo,
        porcentaje_efectivo: calcularPorcentaje(efectivoCentimos, totalIngresosCentimos),
        ingresos_mercado_pago: deCentimos(mpCentimos),
        operaciones_mercado_pago: operacionesMp,
        porcentaje_mercado_pago: calcularPorcentaje(mpCentimos, totalIngresosCentimos),
        operaciones_pendientes: Number(resumenBd?.operaciones_pendientes || 0),
        operaciones_no_completadas: Number(resumenBd?.operaciones_no_completadas || 0),
        cuadra_con_bd: cuadraConBd
    };
}

/**
 * Genera el desglose porcentual por medio de pago a partir del resumen calculado.
 */
function calcularDesglosePorMedio(resumen) {
    return [
        {
            medio: 'EFECTIVO',
            nombre: 'Efectivo',
            monto: resumen.ingresos_efectivo,
            operaciones: resumen.operaciones_efectivo,
            porcentaje: resumen.porcentaje_efectivo
        },
        {
            medio: 'MERCADO_PAGO',
            nombre: 'Mercado Pago',
            monto: resumen.ingresos_mercado_pago,
            operaciones: resumen.operaciones_mercado_pago,
            porcentaje: resumen.porcentaje_mercado_pago
        }
    ];
}

/**
 * Agrupa los ingresos aprobados por concepto/disciplina y calcula su participación porcentual.
 */
function calcularDesglosePorConcepto(operaciones = []) {
    const aprobadas = filtrarOperacionesAprobadas(operaciones);
    const mapa = new Map();
    let totalGeneralCentimos = 0;

    for (const op of aprobadas) {
        const concepto = String(op.disciplinas || 'Mensualidad').trim() || 'Mensualidad';
        const centimos = Math.max(0, aCentimos(op.monto));
        totalGeneralCentimos += centimos;

        if (!mapa.has(concepto)) {
            mapa.set(concepto, { concepto, operaciones: 0, centimos: 0 });
        }
        const grupo = mapa.get(concepto);
        grupo.operaciones += 1;
        grupo.centimos += centimos;
    }

    return Array.from(mapa.values())
        .map(item => ({
            concepto: item.concepto,
            operaciones: item.operaciones,
            total: deCentimos(item.centimos),
            porcentaje: calcularPorcentaje(item.centimos, totalGeneralCentimos)
        }))
        .sort((a, b) => b.total - a.total || b.operaciones - a.operaciones);
}

/**
 * Agrupa los ingresos aprobados por fecha calendario (America/Lima) en orden cronológico.
 */
function calcularFlujoDiario(operaciones = []) {
    const aprobadas = filtrarOperacionesAprobadas(operaciones);
    const mapa = new Map();

    for (const op of aprobadas) {
        const fecha = fechaLimaIso(op.fecha_operacion || op.fecha_pago);
        if (!fecha) continue;

        const centimos = Math.max(0, aCentimos(op.monto));
        const medio = normalizarMedioPago(op.medio_pago);

        if (!mapa.has(fecha)) {
            mapa.set(fecha, {
                fecha,
                cantidad_operaciones: 0,
                efectivoCentimos: 0,
                mpCentimos: 0,
                totalCentimos: 0
            });
        }

        const dia = mapa.get(fecha);
        dia.cantidad_operaciones += 1;
        dia.totalCentimos += centimos;
        if (medio === 'EFECTIVO') {
            dia.efectivoCentimos += centimos;
        } else if (medio === 'MERCADO_PAGO') {
            dia.mpCentimos += centimos;
        }
    }

    return Array.from(mapa.values())
        .sort((a, b) => a.fecha.localeCompare(b.fecha))
        .map(d => ({
            fecha: d.fecha,
            cantidad_operaciones: d.cantidad_operaciones,
            ingresos_efectivo: deCentimos(d.efectivoCentimos),
            ingresos_mercado_pago: deCentimos(d.mpCentimos),
            total_dia: deCentimos(d.totalCentimos)
        }));
}

/**
 * Orquesta el cálculo completo del balance financiero (resumen, medios, conceptos y flujo diario).
 */
function calcularBalanceCompleto(operaciones = [], resumenBd = null) {
    const resumen = calcularResumenBalance(operaciones, resumenBd);
    return {
        resumen,
        desglose_medios: calcularDesglosePorMedio(resumen),
        desglose_conceptos: calcularDesglosePorConcepto(operaciones),
        flujo_diario: calcularFlujoDiario(operaciones)
    };
}

module.exports = {
    aCentimos,
    deCentimos,
    calcularPorcentaje,
    normalizarMedioPago,
    fechaLimaIso,
    calcularResumenBalance,
    calcularDesglosePorMedio,
    calcularDesglosePorConcepto,
    calcularFlujoDiario,
    calcularBalanceCompleto
};

// Autoverificación unitaria: node src/modules/pagos/balance.calculator.js
if (require.main === module) {
    const assert = require('assert');

    const muestra = [
        {
            id_pago: 'PAG-1',
            monto: '130.10',
            medio_pago: 'EFECTIVO',
            estado_pago: 'APROBADO',
            disciplinas: 'MMA',
            fecha_operacion: '2026-11-07T08:36:38.960Z'
        },
        {
            id_pago: 'PAG-2',
            monto: 140.2,
            medio_pago: 'Mercado Pago',
            estado_pago: 'APROBADO',
            disciplinas: 'Jiu Jitsu',
            fecha_operacion: '2026-11-07T14:33:15.724Z'
        },
        {
            id_pago: 'PAG-3',
            monto: 999,
            medio_pago: 'EFECTIVO',
            estado_pago: 'PENDIENTE',
            disciplinas: 'Boxeo',
            fecha_operacion: '2026-11-08T10:00:00.000Z'
        }
    ];

    const bdResumen = {
        total_ingresos: '270.30',
        total_operaciones: 2,
        ingresos_efectivo: '130.10',
        ingresos_mercado_pago: '140.20',
        operaciones_pendientes: 1,
        operaciones_no_completadas: 0
    };

    const resultado = calcularBalanceCompleto(muestra, bdResumen);
    assert.strictEqual(resultado.resumen.total_ingresos, 270.3);
    assert.strictEqual(resultado.resumen.balance_neto, 270.3);
    assert.strictEqual(resultado.resumen.total_operaciones, 2);
    assert.strictEqual(resultado.resumen.ticket_promedio, 135.15);
    assert.strictEqual(resultado.resumen.porcentaje_efectivo, 48.1);
    assert.strictEqual(resultado.resumen.porcentaje_mercado_pago, 51.9);
    assert.strictEqual(resultado.resumen.operaciones_pendientes, 1);
    assert.strictEqual(resultado.resumen.cuadra_con_bd, true);
    assert.strictEqual(resultado.flujo_diario.length, 1);
    assert.strictEqual(resultado.flujo_diario[0].fecha, '2026-11-07');
    assert.strictEqual(resultado.flujo_diario[0].total_dia, 270.3);
    assert.strictEqual(resultado.desglose_conceptos[0].concepto, 'Jiu Jitsu');

    const vacio = calcularBalanceCompleto([], null);
    assert.strictEqual(vacio.resumen.total_ingresos, 0);
    assert.strictEqual(vacio.resumen.ticket_promedio, 0);
    assert.strictEqual(vacio.resumen.porcentaje_efectivo, 0);

    console.log('Autoverificación balance.calculator.js: OK');
}

