const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pagosRepository = require('./pagos.repository');

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

class PagosService {
    async crearPreferencia(datosMatricula) {
        const preference = new Preference(client);

        const body = {
            items: [{
                title: `Matrícula - ${datosMatricula.disciplinas}`,
                quantity: 1,
                unit_price: datosMatricula.monto,
                currency_id: 'PEN'
            }],
            payer: {
                name: datosMatricula.nombres,
                email: datosMatricula.correo
            },
            back_urls: {
                success: 'http://localhost:3000/api/pagos/success',
                failure: 'http://localhost:3000/api/pagos/failure',
                pending: 'http://localhost:3000/api/pagos/pending'
            },
            external_reference: datosMatricula.id_matricula,
            notification_url: 'http://localhost:3000/api/pagos/webhook'
        };

        const resultado = await preference.create({ body });
        return resultado;
    }

    async procesarWebhook(tipo, id) {
        if (tipo !== 'payment') return null;

        console.log('Webhook recibido - tipo:', tipo, 'id:', id);

        const payment = new Payment(client);
        const pago = await payment.get({ id });

        console.log('Estado del pago:', pago.status);
        console.log('ID matrícula:', pago.external_reference);

        const estadoMP = pago.status;
        const idMatricula = pago.external_reference;

        const estadoPago = estadoMP === 'approved' ? 'APROBADO'
            : estadoMP === 'rejected' ? 'RECHAZADO'
            : 'PENDIENTE';

        const estadoMatricula = estadoMP === 'approved' ? 'Activa'
            : estadoMP === 'rejected' ? 'Inactiva'
            : 'Pendiente';

        await pagosRepository.actualizarEstadoPago(idMatricula, estadoPago);
        await pagosRepository.actualizarEstadoMatricula(idMatricula, estadoMatricula);

        return { estadoPago, estadoMatricula };
    }
}

module.exports = new PagosService();