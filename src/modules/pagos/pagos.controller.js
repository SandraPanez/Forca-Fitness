const pagosService = require('./pagos.service');

class PagosController {
    async listarCobros(req, res) {
        try {
            const data = await pagosService.listarCobros(req.query);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Error al listar cobros:', error);
            return res.status(500).json({
                success: false,
                message: 'No se pudieron cargar los cobros'
            });
        }
    }

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

    async registrarEfectivo(req, res) {
        try {
            const pago = await pagosService.registrarEfectivo(req.body);
            return res.status(201).json({
                success: true,
                data: pago,
                message: 'Solicitud de pago en efectivo registrada'
            });
        } catch (error) {
            console.error('Error al registrar pago en efectivo:', error);
            const status = error.message.startsWith('VALIDACION:') ? 400 : 500;
            return res.status(status).json({
                success: false,
                message: error.message.replace(/^VALIDACION:\s*/, '')
            });
        }
    }

    async confirmarEfectivo(req, res) {
        try {
            const pago = await pagosService.confirmarEfectivo(
                req.body.id_matricula,
                req.body.referencia_operacion
            );
            return res.status(200).json({
                success: true,
                data: pago,
                message: 'Pago en efectivo confirmado'
            });
        } catch (error) {
            console.error('Error al confirmar pago en efectivo:', error);
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    async pagoExitoso(req, res) {
        try {
            const { payment_id, status } = req.query;

            if (status === 'approved' && payment_id) {

                // Confirmar el pago también desde la URL de retorno.
                // Esto actualiza Pago, Matrícula y activa el Usuario.
                await pagosService.procesarWebhook(
                    'payment',
                    payment_id
                );

                return res.redirect('/pagos.html?preview=1&resultado=exitoso');
            }

            return res.redirect('/pagos.html?preview=1&resultado=pendiente');

        } catch (error) {
            console.error(
                'Error al procesar retorno de pago:',
                error
            );

            return res.redirect('/pagos.html?preview=1&resultado=fallido');
        }
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