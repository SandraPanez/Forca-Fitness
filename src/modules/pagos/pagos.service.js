const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pagosRepository = require('./pagos.repository');

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});
const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');

class PagosService {

    async crearPreferencia(datosMatricula) {
        const monto = Number(datosMatricula.monto);
        if (!datosMatricula.id_matricula || !datosMatricula.correo ||
            !Number.isFinite(monto) || monto <= 0) {
            throw new Error('VALIDACION:La matrícula, el correo y un monto válido son obligatorios.');
        }

        const preference = new Preference(client);

        const body = {
            items: [{
                title: `Matrícula - ${datosMatricula.disciplinas}`,
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

        await pagosRepository.registrarPagoMercado({
            id_pago: `PAG${Date.now()}`,
            monto,
            id_matricula: datosMatricula.id_matricula,
            preference_id: resultado.id
        });

        return resultado;
    }

    async registrarEfectivo(datosPago) {
        const monto = Number(datosPago.monto);
        if (!datosPago.id_matricula || !Number.isFinite(monto) || monto <= 0) {
            throw new Error('VALIDACION:La matrícula y un monto válido son obligatorios.');
        }

        return pagosRepository.registrarPagoEfectivo({
            id_pago: `PAG${Date.now()}`,
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


        const estadoMatricula =
            estadoMP === 'approved'
                ? 'Activa'
                : estadoMP === 'rejected'
                    ? 'Inactiva'
                    : 'Pendiente';


        // Actualizar pago
        await pagosRepository.actualizarEstadoPago(
            idMatricula,
            estadoPago
        );


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


        return {
            estadoPago,
            estadoMatricula,
            usuarioActivado
        };
    }
}

module.exports = new PagosService();