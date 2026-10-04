const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pagosRepository = require('./pagos.repository');

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});
const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

class PagosService {

    async crearPreferencia(datosMatricula) {
        if (!datosMatricula.id_matricula || !datosMatricula.correo) {
            throw new Error('VALIDACION:La matrícula y el correo son obligatorios.');
        }
        const resumen = await pagosRepository.obtenerResumenMatricula(datosMatricula.id_matricula);
        const monto = Number(resumen.monto);
        if (!Number.isFinite(monto) || monto <= 0) {
            throw new Error('VALIDACION:La matrícula no tiene disciplinas con tarifa configurada.');
        }

        const preference = new Preference(client);

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
            back_urls: {
                success: `${appUrl}/api/pagos/success`,
                failure: `${appUrl}/api/pagos/failure`,
                pending: `${appUrl}/api/pagos/pending`
            },
            external_reference: datosMatricula.id_matricula,
            notification_url: `${appUrl}/api/pagos/webhook`
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

        if (tipo !== 'payment') {
            return null;
        }

        console.log(
            'Webhook recibido - tipo:',
            tipo,
            'id:',
            id
        );

        const payment = new Payment(client);

        const pago = await payment.get({ id });

        console.log(
            'Estado del pago:',
            pago.status
        );

        console.log(
            'ID matrícula:',
            pago.external_reference
        );


        const estadoMP = pago.status;
        const idMatricula = pago.external_reference;


        const estadoPago =
            estadoMP === 'approved'
                ? 'APROBADO'
                : estadoMP === 'rejected'
                    ? 'RECHAZADO'
                    : 'PENDIENTE';

        const transaccionExistente =
            await pagosRepository.obtenerTransaccionPorPaymentId(id);
        if (transaccionExistente) {
            return {
                duplicado: true,
                estadoPago,
                mensaje: 'El pago ya fue procesado anteriormente.'
            };
        }

        const pagoActualizado = await pagosRepository.actualizarEstadoPago(
            idMatricula,
            estadoPago
        );


        const estadoMatricula =
            estadoMP === 'approved'
                ? 'Activa'
                : estadoMP === 'rejected'
                    ? 'Inactiva'
                    : 'Pendiente';


        // Actualizar matrícula
        await pagosRepository.actualizarEstadoMatricula(
            idMatricula,
            estadoMatricula
        );


        // SOLO si el pago fue aprobado,
        // habilitamos la cuenta del alumno.
        let usuarioActivado = null;

        if (estadoMP === 'approved') {

            usuarioActivado =
                await pagosRepository.activarUsuarioPorMatricula(
                    idMatricula
                );

            console.log(
                'Usuario habilitado:',
                usuarioActivado
            );
        }

        if (pagoActualizado) {
            const asociado = await pagosRepository.asociarPaymentId({
                mp_payment_id: id,
                id_pago: pagoActualizado.Id_Pago
            });
            if (!asociado) {
                const transaccionRegistrada =
                    await pagosRepository.obtenerTransaccionPorPaymentId(id);
                if (transaccionRegistrada) {
                    return {
                        duplicado: true,
                        estadoPago,
                        mensaje: 'El pago ya fue procesado anteriormente.'
                    };
                }
                throw new Error('No se pudo asociar el pago externo con la matrícula.');
            }
            await pagosRepository.registrarRegistroCobro({
                id_registro: `REG${Date.now().toString().slice(-14)}`,
                monto: pagoActualizado.Monto,
                medio_pago: 'MERCADO_PAGO',
                resultado: estadoPago,
                id_pago: pagoActualizado.Id_Pago,
                referencia_operacion: String(id)
            });
        }


        return {
            estadoPago,
            estadoMatricula,
            usuarioActivado
        };
    }

    async confirmarEfectivo(idMatricula, referenciaOperacion) {
        return pagosRepository.confirmarPagoEfectivo(idMatricula, referenciaOperacion);
    }

    async anularSolicitudesEfectivoVencidas() {
        return pagosRepository.anularSolicitudesEfectivoVencidas();
    }
}

module.exports = new PagosService();