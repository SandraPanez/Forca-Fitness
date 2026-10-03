const pagosService = require('./pagos.service');

class PagosController {
    async crearPreferencia(req, res) {
        try {
            const datosMatricula = req.body;
            const preferencia = await pagosService.crearPreferencia(datosMatricula);
            return res.status(200).json({
                success: true,
                init_point: preferencia.init_point,
                preference_id: preferencia.id
            });
        } catch (error) {
            console.error('Error al crear preferencia:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al crear la preferencia de pago'
            });
        }
    }

    async pagoExitoso(req, res) {
        const { payment_id, status } = req.query;
        return res.status(200).json({
            success: true,
            message: 'Pago realizado correctamente',
            payment_id,
            status
        });
    }

    async pagoFallido(req, res) {
        return res.status(200).json({
            success: false,
            message: 'El pago no pudo procesarse, intente nuevamente'
        });
    }

    async pagoPendiente(req, res) {
        return res.status(200).json({
            success: true,
            message: 'El pago está pendiente de confirmación'
        });
    }

    async webhook(req, res) {
        try {
            const { type, data } = req.body;
            const resultado = await pagosService.procesarWebhook(type, data?.id);
            console.log('Webhook recibido:', resultado);
            return res.status(200).send('OK');
        } catch (error) {
            console.error('Error en webhook:', error);
            return res.status(500).send('Error');
        }
    }
}

module.exports = new PagosController();