const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require('mercadopago');
const pagosRepository = require('./pagos.repository');
const { montoEnLetras } = require('../../shared/utils/monto-letras.util');
const {
    calcularBalanceCompleto,
    normalizarMedioPago,
    fechaLimaIso
} = require('./balance.calculator');

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});
const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

const MOCK_PENDIENTES = [
    {
        id_pago: 'PAG-TMP-01',
        id_matricula: 'MAT-2026-0101',
        monto: '180.00',
        fecha_pago: new Date(Date.now() - 3600000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 47 * 3600000).toISOString(),
        alumno: 'Carlos Mendoza Ramos',
        disciplinas: 'Boxeo, Funcional'
    },
    {
        id_pago: 'PAG-TMP-02',
        id_matricula: 'MAT-2026-0102',
        monto: '150.00',
        fecha_pago: new Date(Date.now() - 7200000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 41 * 3600000).toISOString(),
        alumno: 'Lucía Fernández Salas',
        disciplinas: 'Muay Thai'
    },
    {
        id_pago: 'PAG-TMP-03',
        id_matricula: 'MAT-2026-0103',
        monto: '200.00',
        fecha_pago: new Date(Date.now() - 14400000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 34 * 3600000).toISOString(),
        alumno: 'Jorge Luis Morales',
        disciplinas: 'CrossFit'
    }
];

const MOCK_COBROS = [
    {
        id_pago: 'PAG-TMP-01',
        id_matricula: 'MAT-2026-0101',
        monto: '180.00',
        estado_pago: 'PENDIENTE',
        fecha_pago: new Date(Date.now() - 3600000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 47 * 3600000).toISOString(),
        medio_pago: 'EFECTIVO',
        alumno: 'Carlos Mendoza Ramos',
        disciplinas: 'Boxeo, Funcional',
        estado_matricula: 'Pendiente'
    },
    {
        id_pago: 'PAG-TMP-02',
        id_matricula: 'MAT-2026-0102',
        monto: '150.00',
        estado_pago: 'PENDIENTE',
        fecha_pago: new Date(Date.now() - 7200000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 41 * 3600000).toISOString(),
        medio_pago: 'EFECTIVO',
        alumno: 'Lucía Fernández Salas',
        disciplinas: 'Muay Thai',
        estado_matricula: 'Pendiente'
    },
    {
        id_pago: 'PAG-TMP-03',
        id_matricula: 'MAT-2026-0103',
        monto: '200.00',
        estado_pago: 'PENDIENTE',
        fecha_pago: new Date(Date.now() - 14400000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 34 * 3600000).toISOString(),
        medio_pago: 'EFECTIVO',
        alumno: 'Jorge Luis Morales',
        disciplinas: 'CrossFit',
        estado_matricula: 'Pendiente'
    },
    {
        id_pago: 'PAG-TMP-04',
        id_matricula: 'MAT-2026-0099',
        monto: '250.00',
        estado_pago: 'APROBADO',
        fecha_pago: new Date(Date.now() - 86400000).toISOString(),
        fecha_vencimiento: new Date(Date.now() + 86400000).toISOString(),
        medio_pago: 'MERCADO_PAGO',
        alumno: 'Valeria Castro Ruiz',
        disciplinas: 'Spinning, Yoga',
        estado_matricula: 'Activa'
    },
    {
        id_pago: 'PAG-TMP-05',
        id_matricula: 'MAT-2026-0098',
        monto: '180.00',
        estado_pago: 'APROBADO',
        fecha_pago: new Date(Date.now() - 172800000).toISOString(),
        fecha_vencimiento: new Date(Date.now() - 86400000).toISOString(),
        medio_pago: 'EFECTIVO',
        alumno: 'Mateo Quispe Paredes',
        disciplinas: 'Jiu Jitsu',
        estado_matricula: 'Activa'
    }
];

const NOMBRES_MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Setiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const MOCK_ALUMNOS_PAGOS = [
    {
        id_alumno: 'ALU-001',
        nombre_completo: 'Carlos Alberto Mendoza Ramos',
        dni: '74839201',
        correo: 'carlos.mendoza@gmail.com',
        disciplinas: ['Box', 'Cross Training'],
        profesores: ['Faridh Cruz', 'Paul Rafael'],
        pagos: [
            {
                id_pago: 'PAG-2026-101',
                id_matricula: 'MAT-2026-0045',
                monto: 180.00,
                monto_letras: 'CIENTO OCHENTA Y 00/100 SOLES',
                fecha_pago: '2026-10-18T16:30:00.000Z',
                mes: 'Octubre',
                disciplinas: 'Box, Cross Training',
                profesor: 'Faridh Cruz',
                medio_pago: 'EFECTIVO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0038',
                referencia: 'REC-0098'
            },
            {
                id_pago: 'PAG-2026-085',
                id_matricula: 'MAT-2026-0032',
                monto: 180.00,
                monto_letras: 'CIENTO OCHENTA Y 00/100 SOLES',
                fecha_pago: '2026-09-18T11:15:00.000Z',
                mes: 'Setiembre',
                disciplinas: 'Box, Cross Training',
                profesor: 'Paul Rafael',
                medio_pago: 'MERCADO_PAGO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0027',
                referencia: 'MP-892301'
            },
            {
                id_pago: 'PAG-2026-050',
                id_matricula: 'MAT-2026-0018',
                monto: 180.00,
                monto_letras: 'CIENTO OCHENTA Y 00/100 SOLES',
                fecha_pago: '2026-08-18T09:40:00.000Z',
                mes: 'Agosto',
                disciplinas: 'Box',
                profesor: 'Faridh Cruz',
                medio_pago: 'EFECTIVO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0015',
                referencia: 'REC-0042'
            }
        ]
    },
    {
        id_alumno: 'ALU-002',
        nombre_completo: 'Lucía Elena Fernández Salas',
        dni: '48392019',
        correo: 'lucia.fernandez@hotmail.com',
        disciplinas: ['BJJ', 'MMA'],
        profesores: ['Cristian Benites'],
        pagos: [
            {
                id_pago: 'PAG-2026-102',
                id_matricula: 'MAT-2026-0046',
                monto: 220.00,
                monto_letras: 'DOSCIENTOS VEINTE Y 00/100 SOLES',
                fecha_pago: '2026-10-12T14:20:00.000Z',
                mes: 'Octubre',
                disciplinas: 'BJJ, MMA',
                profesor: 'Cristian Benites',
                medio_pago: 'MERCADO_PAGO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0036',
                referencia: 'MP-910284'
            },
            {
                id_pago: 'PAG-2026-079',
                id_matricula: 'MAT-2026-0029',
                monto: 220.00,
                monto_letras: 'DOSCIENTOS VEINTE Y 00/100 SOLES',
                fecha_pago: '2026-09-12T10:00:00.000Z',
                mes: 'Setiembre',
                disciplinas: 'BJJ',
                profesor: 'Cristian Benites',
                medio_pago: 'EFECTIVO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0023',
                referencia: 'REC-0077'
            }
        ]
    },
    {
        id_alumno: 'ALU-003',
        nombre_completo: 'Mateo Sebastián Quispe Paredes',
        dni: '71928374',
        correo: 'mateo.quispe@yahoo.com',
        disciplinas: ['Capoeira', 'Capoeira Kids'],
        profesores: ['Paul Rafael'],
        pagos: [
            {
                id_pago: 'PAG-2026-098',
                id_matricula: 'MAT-2026-0040',
                monto: 160.00,
                monto_letras: 'CIENTO SESENTA Y 00/100 SOLES',
                fecha_pago: '2026-10-05T18:10:00.000Z',
                mes: 'Octubre',
                disciplinas: 'Capoeira',
                profesor: 'Paul Rafael',
                medio_pago: 'EFECTIVO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0033',
                referencia: 'REC-0065'
            },
            {
                id_pago: 'PAG-2026-066',
                id_matricula: 'MAT-2026-0022',
                monto: 160.00,
                monto_letras: 'CIENTO SESENTA Y 00/100 SOLES',
                fecha_pago: '2026-08-05T16:00:00.000Z',
                mes: 'Agosto',
                disciplinas: 'Capoeira',
                profesor: 'Paul Rafael',
                medio_pago: 'MERCADO_PAGO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0012',
                referencia: 'MP-736291'
            }
        ]
    },
    {
        id_alumno: 'ALU-004',
        nombre_completo: 'Valeria Sofía Castro Ruiz',
        dni: '75839201',
        correo: 'valeria.castro@outlook.com',
        disciplinas: ['BJJ Kids', 'Cross Training'],
        profesores: ['Cristian Benites', 'Faridh Cruz'],
        pagos: [
            {
                id_pago: 'PAG-2026-095',
                id_matricula: 'MAT-2026-0038',
                monto: 190.00,
                monto_letras: 'CIENTO NOVENTA Y 00/100 SOLES',
                fecha_pago: '2026-09-28T12:00:00.000Z',
                mes: 'Setiembre',
                disciplinas: 'BJJ Kids',
                profesor: 'Cristian Benites',
                medio_pago: 'MERCADO_PAGO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0031',
                referencia: 'MP-849201'
            },
            {
                id_pago: 'PAG-2026-055',
                id_matricula: 'MAT-2026-0019',
                monto: 190.00,
                monto_letras: 'CIENTO NOVENTA Y 00/100 SOLES',
                fecha_pago: '2026-07-28T11:30:00.000Z',
                mes: 'Julio',
                disciplinas: 'BJJ Kids',
                profesor: 'Cristian Benites',
                medio_pago: 'EFECTIVO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0008',
                referencia: 'REC-0021'
            }
        ]
    },
    {
        id_alumno: 'ALU-005',
        nombre_completo: 'Jorge Luis Morales Chávez',
        dni: '46781293',
        correo: 'jorge.morales@gmail.com',
        disciplinas: ['Box', 'MMA'],
        profesores: ['Faridh Cruz', 'Cristian Benites'],
        pagos: [
            {
                id_pago: 'PAG-2026-088',
                id_matricula: 'MAT-2026-0035',
                monto: 240.00,
                monto_letras: 'DOSCIENTOS CUARENTA Y 00/100 SOLES',
                fecha_pago: '2026-09-20T17:45:00.000Z',
                mes: 'Setiembre',
                disciplinas: 'Box, MMA',
                profesor: 'Faridh Cruz',
                medio_pago: 'EFECTIVO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0028',
                referencia: 'REC-0081'
            }
        ]
    },
    {
        id_alumno: 'ALU-006',
        nombre_completo: 'Mariana Isabel Torres Benites',
        dni: '76123490',
        correo: 'mariana.torres@gmail.com',
        disciplinas: ['Capoeira Kids', 'Cross Training'],
        profesores: ['Paul Rafael', 'Faridh Cruz'],
        pagos: [
            {
                id_pago: 'PAG-2026-104',
                id_matricula: 'MAT-2026-0048',
                monto: 175.00,
                monto_letras: 'CIENTO SETENTA Y CINCO Y 00/100 SOLES',
                fecha_pago: '2026-10-21T09:15:00.000Z',
                mes: 'Octubre',
                disciplinas: 'Capoeira Kids',
                profesor: 'Paul Rafael',
                medio_pago: 'MERCADO_PAGO',
                estado_pago: 'APROBADO',
                numero_recibo: 'CP-2026-0040',
                referencia: 'MP-984210'
            }
        ]
    }
];

function esFechaIsoValida(valor) {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
        return false;
    }
    const [anio, mes, dia] = valor.split('-').map(Number);
    const fecha = new Date(Date.UTC(anio, mes - 1, dia));
    return (
        fecha.getUTCFullYear() === anio &&
        fecha.getUTCMonth() === mes - 1 &&
        fecha.getUTCDate() === dia
    );
}

function formatearNumeroRecibo(row) {
    if (row.numero_recibo) return row.numero_recibo;
    const fecha = new Date(row.fecha_operacion || Date.now());
    const anio = Number.isNaN(fecha.getTime())
        ? new Date().getFullYear()
        : Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric' }).format(fecha));
    const correlativo = row.correlativo && Number(row.correlativo) > 0
        ? String(row.correlativo).padStart(4, '0')
        : (String(row.id_pago || '').replace(/\D/g, '').slice(-4).padStart(4, '0') || '0001');
    return `CP-${anio}-${correlativo}`;
}

function construirMontoLetras(monto) {
    try {
        return montoEnLetras(monto);
    } catch {
        return `${Number(monto || 0).toFixed(2)} soles`;
    }
}

function mapearOperacionBalance(row) {
    const montoNumero = Number(row.monto || 0);
    const medioNorm = normalizarMedioPago(row.medio_pago);
    return {
        id_pago: row.id_pago,
        id_registro: row.id_registro || row.id_pago,
        id_matricula: row.id_matricula,
        alumno: row.alumno || 'Alumno registrado',
        tipo_documento: row.tipo_documento || 'DNI',
        dni: row.dni || '—',
        correo: row.correo || '—',
        disciplinas: row.disciplinas || 'Mensualidad',
        periodo_matricula: row.periodo_matricula || null,
        medio_pago: medioNorm,
        metodo_nombre: row.metodo_nombre || (medioNorm === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Efectivo'),
        estado_pago: row.estado_pago || 'APROBADO',
        fecha_solicitud: row.fecha_solicitud || row.fecha_operacion,
        fecha_operacion: row.fecha_operacion,
        referencia: row.referencia || '—',
        registrado_por: row.registrado_por || (medioNorm === 'MERCADO_PAGO' ? 'Pasarela Mercado Pago' : 'Tesorería'),
        numero_recibo: formatearNumeroRecibo(row),
        monto: Number(montoNumero.toFixed(2)),
        monto_letras: row.monto_letras || construirMontoLetras(montoNumero)
    };
}

function obtenerMockOperacionesBalance() {
    return MOCK_ALUMNOS_PAGOS.flatMap(alu =>
        (alu.pagos || []).map(p => ({
            id_pago: p.id_pago,
            id_registro: p.id_pago,
            id_matricula: p.id_matricula,
            monto: p.monto,
            estado_pago: p.estado_pago,
            fecha_solicitud: p.fecha_pago,
            fecha_operacion: p.fecha_pago,
            medio_pago: normalizarMedioPago(p.medio_pago),
            metodo_nombre: p.medio_pago === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Efectivo',
            referencia: p.referencia || '—',
            alumno: alu.nombre_completo,
            tipo_documento: 'DNI',
            dni: alu.dni,
            correo: alu.correo,
            disciplinas: p.disciplinas || 'Mensualidad',
            registrado_por: p.medio_pago === 'MERCADO_PAGO' ? 'Pasarela Mercado Pago' : 'Tesorería',
            numero_recibo: p.numero_recibo,
            monto_letras: p.monto_letras
        }))
    );
}

class PagosService {
    async listarCobrosPorAlumno(filtros = {}) {
        let listaAlumnos = [];
        try {
            const rows = await pagosRepository.listarCobrosPorAlumno();
            if (rows && rows.length > 0) {
                const mapa = new Map();
                for (const r of rows) {
                    if (!mapa.has(r.id_alumno)) {
                        mapa.set(r.id_alumno, {
                            id_alumno: r.id_alumno,
                            nombre_completo: r.nombre_completo,
                            dni: r.dni || '—',
                            correo: r.correo || '—',
                            disciplinas: new Set(),
                            profesores: new Set(),
                            pagos: []
                        });
                    }
                    const alu = mapa.get(r.id_alumno);
                    if (r.disciplinas) {
                        r.disciplinas.split(',').map(d => d.trim()).filter(Boolean).forEach(d => alu.disciplinas.add(d));
                    }
                    if (r.profesores) {
                        r.profesores.split(',').map(p => p.trim()).filter(Boolean).forEach(p => alu.profesores.add(p));
                    }
                    if (r.id_pago && !alu.pagos.some(p => p.id_pago === r.id_pago)) {
                        const fecha = new Date(r.fecha_pago);
                        const mes = NOMBRES_MESES[fecha.getMonth()] || '';
                        alu.pagos.push({
                            id_pago: r.id_pago,
                            id_matricula: r.id_matricula,
                            monto: Number(r.monto),
                            fecha_pago: r.fecha_pago,
                            mes,
                            disciplinas: r.disciplinas || 'Mensualidad',
                            profesor: r.profesores || 'Profesor asignado',
                            medio_pago: r.medio_pago,
                            estado_pago: r.estado_pago,
                            referencia: r.referencia || '—'
                        });
                    }
                }
                listaAlumnos = Array.from(mapa.values()).map(alu => ({
                    id_alumno: alu.id_alumno,
                    nombre_completo: alu.nombre_completo,
                    dni: alu.dni,
                    correo: alu.correo,
                    disciplinas: Array.from(alu.disciplinas),
                    profesores: Array.from(alu.profesores),
                    pagos: alu.pagos.sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago))
                }));
            } else {
                listaAlumnos = [];
            }
        } catch (error) {
            throw error;
        }

        // Asegurar que cada alumno tenga sus pagos ordenados del más reciente al más antiguo
        return listaAlumnos.map(alu => {
            const pagosOrdenados = [...alu.pagos].sort((a, b) => new Date(b.fecha_pago) - new Date(a.fecha_pago));
            return {
                ...alu,
                total_pagos: pagosOrdenados.length,
                ultimo_pago: pagosOrdenados[0]?.fecha_pago || null,
                pagos: pagosOrdenados
            };
        });
    }

    async listarCobros(filtros = {}) {
        try {
            return await pagosRepository.listarCobros({
                estado: filtros.estado,
                medio: filtros.medio,
                busqueda: filtros.busqueda
            });
        } catch (error) {
            throw error;
        }
    }

    /**
     * Consulta el balance de ingresos y las operaciones aprobadas dentro de un periodo dado.
     * Utiliza las consultas agregadas y de detalle en PostgreSQL.
     */
    async obtenerBalanceFinanciero({ fechaInicio, fechaFin, medio } = {}) {
        if (!esFechaIsoValida(fechaInicio) || !esFechaIsoValida(fechaFin)) {
            throw new Error('VALIDACION:Debes indicar un rango de fechas válido (AAAA-MM-DD).');
        }
        if (fechaInicio > fechaFin) {
            throw new Error('VALIDACION:La fecha de inicio no puede ser posterior a la fecha de fin.');
        }

        const medioNormalizado = normalizarMedioPago(medio);
        if (medioNormalizado && !['EFECTIVO', 'MERCADO_PAGO'].includes(medioNormalizado)) {
            throw new Error('VALIDACION:El medio de pago indicado no es válido.');
        }

        let rows;
        let resumenPg = null;

        try {
            const [resumenBd, operacionesBd] = await Promise.all([
                pagosRepository.obtenerResumenBalancePorPeriodo({
                    fechaInicio,
                    fechaFin,
                    medio: medioNormalizado
                }),
                pagosRepository.obtenerBalancePorPeriodo({
                    fechaInicio,
                    fechaFin,
                    medio: medioNormalizado
                })
            ]);
            resumenPg = resumenBd;
            rows = operacionesBd;
        } catch (error) {
            throw error;
        }

        const operaciones = rows.map(mapearOperacionBalance);
        const calculo = calcularBalanceCompleto(operaciones, resumenPg);

        return {
            periodo: {
                fechaInicio,
                fechaFin,
                medio: medioNormalizado || null
            },
            resumen: calculo.resumen,
            desglose: {
                medios: calculo.desglose_medios,
                conceptos: calculo.desglose_conceptos,
                flujo_diario: calculo.flujo_diario
            },
            operaciones
        };
    }

    /**
     * Recupera el detalle en modo consulta de una operación financiera aprobada por su Id_Pago.
     */
    async obtenerDetalleOperacionBalance(idPago) {
        if (!idPago || !String(idPago).trim()) {
            throw new Error('VALIDACION:El identificador de la operación es obligatorio.');
        }

        let row = null;
        try {
            row = await pagosRepository.obtenerDetalleOperacionPorId(String(idPago).trim());
        } catch (error) {
            throw error;
        }

        if (!row) {
            return null;
        }

        return mapearOperacionBalance(row);
    }

    async listarEfectivoPendientes() {
        try {
            return await pagosRepository.listarEfectivoPendientes();
        } catch (error) {
            throw error;
        }
    }

    async verificarEstadoMatricula(idMatricula) {
        const pagoExistente = await pagosRepository.obtenerPagoActivoPorMatricula(idMatricula);
        if (!pagoExistente) {
            return { tienePago: false };
        }
        return {
            tienePago: true,
            estado_pago: pagoExistente.estado_pago,
            estado_matricula: pagoExistente.estado_matricula,
            medio_pago: pagoExistente.medio_pago,
            id_pago: pagoExistente.Id_Pago
        };
    }



    async crearPreferencia(datosMatricula) {
        if (!datosMatricula.id_matricula || !datosMatricula.correo) {
            throw new Error('VALIDACION:La matrícula y el correo son obligatorios.');
        }

        // Verificar si ya existe un pago activo para esta matrícula
        const pagoExistente = await pagosRepository.obtenerPagoActivoPorMatricula(datosMatricula.id_matricula);
        if (pagoExistente) {
            const esAprobado = pagoExistente.estado_pago === 'APROBADO';
            const esEfectivo = pagoExistente.medio_pago === 'EFECTIVO';
            if (esAprobado) {
                throw new Error('VALIDACION:Esta matrícula ya tiene un pago aprobado. No es necesario volver a pagar.');
            }
            if (esEfectivo) {
                throw new Error('VALIDACION:Ya tienes una solicitud de pago en efectivo pendiente de confirmación por el tesorero. Espera a que sea aprobada para activar tu acceso.');
            }
            const [transaccion] = await pagosRepository.obtenerTransaccionesMercado(datosMatricula.id_matricula);
            if (transaccion) {
                return new Preference(client).get({ preferenceId: transaccion.Preference_Id });
            }
        }

        const resumen = await pagosRepository.obtenerResumenMatricula(datosMatricula.id_matricula);
        const monto = Number(resumen.monto);
        if (!Number.isFinite(monto) || monto <= 0) {
            throw new Error('VALIDACION:La matrícula no tiene disciplinas con tarifa configurada.');
        }

        const preference = new Preference(client);

        // Sin HTTPS público se confirma desde Forca consultando la API.
        // Mercado Pago no admite localhost como URL de retorno.
        const body = {
            items: [{
                title: `Mensualidad - ${resumen.disciplinas}`,
                quantity: 1,
                unit_price: monto,
                currency_id: 'PEN'
            }],
            payer: {
                name: datosMatricula.nombres,
                email: datosMatricula.correo
            },
            external_reference: datosMatricula.id_matricula,
            ...(appUrl.startsWith('https://') ? {
                back_urls: {
                    success: `${appUrl}/api/pagos/success`,
                    failure: `${appUrl}/api/pagos/failure`,
                    pending: `${appUrl}/api/pagos/pending`
                },
                auto_return: 'approved',
                notification_url: `${appUrl}/api/pagos/webhook`
            } : {})
        };

        const resultado = await preference.create({ body });

        const idPago = `PAG${Date.now().toString().slice(-7)}`;
        await pagosRepository.registrarPagoMercado({
            id_pago: idPago,
            monto,
            id_matricula: datosMatricula.id_matricula,
            preference_id: resultado.id
        });
        await pagosRepository.registrarRegistroCobro({
            id_registro: `REG${Date.now().toString().slice(-14)}`,
            monto,
            medio_pago: 'MERCADO_PAGO',
            resultado: 'PENDIENTE',
            id_pago: idPago
        });

        return resultado;
    }

    async registrarEfectivo(datosPago) {
        if (!datosPago.id_matricula) {
            throw new Error('VALIDACION:La matrícula es obligatoria.');
        }

        // Verificar si ya existe un pago activo para esta matrícula
        const pagoExistente = await pagosRepository.obtenerPagoActivoPorMatricula(datosPago.id_matricula);
        if (pagoExistente) {
            const esAprobado = pagoExistente.estado_pago === 'APROBADO';
            const esEfectivo = pagoExistente.medio_pago === 'EFECTIVO';
            if (esAprobado) {
                throw new Error('VALIDACION:Esta matrícula ya tiene un pago aprobado. No es necesario volver a pagar.');
            }
            if (esEfectivo) {
                throw new Error('VALIDACION:Ya tienes una solicitud de pago en efectivo pendiente de confirmación por el tesorero. Por favor, espera a que sea aprobada.');
            }
        }

        const resumen = await pagosRepository.obtenerResumenMatricula(datosPago.id_matricula);
        const monto = Number(resumen.monto);
        if (!Number.isFinite(monto) || monto <= 0) {
            throw new Error('VALIDACION:La matrícula no tiene disciplinas con tarifa configurada.');
        }

        return pagosRepository.registrarPagoEfectivo({
            id_pago: `PAG${Date.now().toString().slice(-7)}`,
            monto,
            id_matricula: datosPago.id_matricula
        });
    }

    async procesarWebhook(tipo, id) {
        if (tipo !== 'payment') return null;
        if (!['string', 'number'].includes(typeof id) || !/^\d+$/.test(String(id))) {
            throw new Error('VALIDACION:Identificador de pago inválido.');
        }
        const pago = await new Payment(client).get({ id });
        if (String(pago.id) !== String(id) || !pago.external_reference || !pago.order?.id) {
            throw new Error('VALIDACION:El pago no tiene una matrícula y una orden verificables.');
        }
        const orden = await new MerchantOrder(client).get({ merchantOrderId: pago.order.id });
        if (!orden.preference_id || orden.external_reference !== pago.external_reference ||
            !orden.payments?.some(item => String(item.id) === String(pago.id))) {
            throw new Error('VALIDACION:El pago no corresponde a la orden de matrícula.');
        }
        const estados = {
            approved: 'APROBADO', rejected: 'RECHAZADO', cancelled: 'ANULADO',
            pending: 'PENDIENTE', in_process: 'PENDIENTE', authorized: 'PENDIENTE'
        };
        if (!estados[pago.status] || pago.currency_id !== 'PEN' ||
            !Number.isFinite(pago.transaction_amount) || pago.transaction_amount <= 0 ||
            Number(pago.transaction_amount_refunded || 0) > 0) {
            throw new Error('VALIDACION:El estado, moneda o monto del pago requiere revisión.');
        }
        return pagosRepository.actualizarPagoMercado({
            payment_id: String(pago.id),
            preference_id: orden.preference_id,
            id_matricula: pago.external_reference,
            monto: pago.transaction_amount,
            estado_pago: estados[pago.status]
        });
    }

    async sincronizarPago(idMatricula) {
        const transacciones = await pagosRepository.obtenerTransaccionesMercado(idMatricula);
        if (!transacciones.length) {
            throw new Error('VALIDACION:No hay un pago de Mercado Pago registrado para esta matrícula.');
        }
        if (transacciones.some(transaccion => transaccion.estado_pago === 'APROBADO')) {
            return this.verificarEstadoMatricula(idMatricula);
        }
        let resultado;
        for (const transaccion of transacciones) {
            const busqueda = await new MerchantOrder(client).search({
                options: { preference_id: transaccion.Preference_Id }
            });
            const pagos = (busqueda.elements || [])
                .filter(orden => orden.preference_id === transaccion.Preference_Id &&
                    orden.external_reference === idMatricula)
                .flatMap(orden => orden.payments || [])
                .sort((a, b) => Number(b.status === 'approved') - Number(a.status === 'approved') ||
                    Number(b.id) - Number(a.id));
            if (pagos[0]) resultado = await this.procesarWebhook('payment', pagos[0].id);
            if (resultado?.estadoPago === 'APROBADO') break;
        }
        const estado = await this.verificarEstadoMatricula(idMatricula);
        return { ...estado, estado_pago: estado.estado_pago || resultado?.estadoPago || transacciones[0].estado_pago };
    }


    async confirmarEfectivo(idMatricula, referenciaOperacion, idUsuario) {
        return await pagosRepository.confirmarPagoEfectivo(
            idMatricula,
            idUsuario,
            referenciaOperacion
        );
    }

    async anularSolicitudesEfectivoVencidas() {
        try {
            return await pagosRepository.anularSolicitudesEfectivoVencidas();
        } catch (error) {
            return 0;
        }
    }

    async activarReservasIniciadas() {
        try {
            return await pagosRepository.activarReservasIniciadas();
        } catch (error) {
            return 0;
        }
    }
}

module.exports = new PagosService();
