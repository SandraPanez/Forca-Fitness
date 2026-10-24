const { MercadoPagoConfig, Preference, Payment, MerchantOrder } = require('mercadopago');
const pagosRepository = require('./pagos.repository');

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});
const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

class PagosService {
    async listarCobros(filtros) {
        return pagosRepository.listarCobros({
            estado: filtros.estado,
            medio: filtros.medio,
            busqueda: filtros.busqueda
        });
    }

    async listarEfectivoPendientes() {
        return pagosRepository.listarEfectivoPendientes();
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
        return pagosRepository.confirmarPagoEfectivo(idMatricula, idUsuario, referenciaOperacion);
    }

    async anularSolicitudesEfectivoVencidas() {
        return pagosRepository.anularSolicitudesEfectivoVencidas();
    }

    async activarReservasIniciadas() {
        return pagosRepository.activarReservasIniciadas();
    }
}

module.exports = new PagosService();
