const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');

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
            notification_url: 'http://localhost:3000/api/pagos/webhook'
        };

        const resultado = await preference.create({ body });
        return resultado;
    }

    async procesarWebhook(tipo, id) {
        if (tipo === 'payment') {
            const payment = new Payment(client);
            const pago = await payment.get({ id });
            return pago;
        }
        return null;
    }
}

module.exports = new PagosService();