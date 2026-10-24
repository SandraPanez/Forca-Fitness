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

    async listarEfectivoPendientes(req, res) {
        try {
            const data = await pagosService.listarEfectivoPendientes();
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Error al listar pagos efectivo pendientes:', error);
            return res.status(500).json({
                success: false,
                message: 'No se pudieron cargar los pagos pendientes'
            });
        }
    }

    async verificarEstadoMatricula(req, res) {
        try {
            const { matricula } = req.params;
            if (!matricula) {
                return res.status(400).json({ success: false, message: 'ID de matrícula requerido' });
            }
            const data = await pagosService.verificarEstadoMatricula(matricula);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Error al verificar estado de matrícula:', error);
            return res.status(500).json({ success: false, message: 'Error interno al consultar estado' });
        }
    }

    async crearPreferencia(req, res) {
        try {
            const datosMatricula = req.body;
            const preferencia = await pagosService.crearPreferencia(datosMatricula);
            const checkoutUrl = (process.env.NODE_ENV === 'production' && !preferencia.sandbox_init_point)
                ? preferencia.init_point
                : (preferencia.sandbox_init_point || preferencia.init_point);
            return res.status(200).json({
                success: true,
                init_point: checkoutUrl,
                sandbox_init_point: preferencia.sandbox_init_point,
                preference_id: preferencia.id
            });
        } catch (error) {
            console.error('Error al crear preferencia:', error);
            const status = error.message.startsWith('VALIDACION:') ? 400 : 500;
            return res.status(status).json({
                success: false,
                message: error.message.replace(/^VALIDACION:\s*/, '')
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
                req.body.referencia_operacion,
                req.user.id
            );
            const esReserva = pago?.estadoMatricula === 'Reservada';
            return res.status(200).json({
                success: true,
                data: pago,
                message: esReserva
                    ? 'Pago en efectivo confirmado. Cupo reservado correctamente.'
                    : 'Pago en efectivo confirmado correctamente.'
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
            const paymentId      = req.query.payment_id || req.query.collection_id;
            const status         = req.query.status || req.query.collection_status;
            const externalReference = req.query.external_reference;
            const preferenceId   = req.query.preference_id;
            const appUrl         = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
            const isLocalhost    = !appUrl.startsWith('https://');

            console.log('[pagoExitoso] params:', { paymentId, status, externalReference, preferenceId, isLocalhost });

            if (status === 'approved' || status === 'success') {
                let resultado = null;

                // En localhost, MP no puede recibir webhooks y el payment de sandbox
                // no siempre es consultable con token de producción.
                // Por eso en localhost vamos directo al fallback de sandbox.
                if (!isLocalhost && paymentId) {
                    try {
                        resultado = await pagosService.procesarWebhook('payment', paymentId);
                        console.log('[pagoExitoso] webhook procesado:', resultado?.estadoPago);
                    } catch (mpError) {
                        console.error('[pagoExitoso] Error al consultar pago en MP API:', mpError.message);
                    }
                }

                // Fallback: confirmar por external_reference o preference_id
                // Se usa siempre en localhost o cuando el webhook falló
                if (!resultado && (externalReference || preferenceId)) {
                    try {
                        resultado = await pagosService.confirmarRetornoExitosoSandbox({
                            id_matricula: externalReference,
                            preference_id: preferenceId,
                            payment_id: paymentId
                        });
                        console.log('[pagoExitoso] sandbox fallback:', resultado?.estadoMatricula, '| usuario:', resultado?.usuarioActivado?.Correo);
                    } catch (sandboxError) {
                        console.error('[pagoExitoso] Error en confirmación sandbox:', sandboxError.message);
                    }
                }

                const esReserva = resultado?.estadoMatricula === 'Reservada';
                const tipoParam = esReserva ? '&tipo=reserva' : '';
                return res.redirect(`/pagos.html?resultado=exitoso${tipoParam}`);
            }

            if (status === 'pending' || status === 'in_process') {
                return res.redirect('/pagos.html?resultado=pendiente');
            }

            return res.redirect('/pagos.html?resultado=fallido');

        } catch (error) {
            console.error('[pagoExitoso] Error inesperado:', error);
            return res.redirect('/pagos.html?resultado=fallido');
        }
    }

    async pagoFallido(req, res) {
        return res.redirect('/pagos.html?resultado=fallido');
    }

    async pagoPendiente(req, res) {
        return res.redirect('/pagos.html?resultado=pendiente');
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