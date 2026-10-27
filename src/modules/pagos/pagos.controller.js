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

    async listarCobrosPorAlumno(req, res) {
        try {
            const data = await pagosService.listarCobrosPorAlumno(req.query);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Error al listar cobros por alumno:', error);
            return res.status(500).json({
                success: false,
                message: 'No se pudieron cargar los cobros por alumno'
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

    async sincronizarPago(req, res) {
        try {
            const data = await pagosService.sincronizarPago(req.params.matricula);
            return res.status(200).json({ success: true, data });
        } catch (error) {
            console.error('Error al consultar Mercado Pago:', error.message);
            const validacion = error.message?.startsWith('VALIDACION:');
            return res.status(validacion ? 400 : 502).json({
                success: false,
                message: validacion ? error.message.replace(/^VALIDACION:\s*/, '')
                    : 'No pudimos consultar tu pago en Mercado Pago. Vuelve a verificar en unos momentos.'
            });
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
        let idMatricula = typeof req.query.external_reference === 'string' ? req.query.external_reference : '';
        let resultado = 'verificar';
        let tipo = '';
        try {
            const paymentId = req.query.payment_id || req.query.collection_id;
            if (paymentId) {
                // El mismo chequeo se aplica en localhost, sandbox y producción.
                const pago = await pagosService.procesarWebhook('payment', paymentId);
                idMatricula = pago.idMatricula;
                resultado = pago.estadoPago === 'APROBADO' ? 'exitoso'
                    : pago.estadoPago === 'PENDIENTE' ? 'pendiente' : 'fallido';
                tipo = pago.estadoMatricula === 'Reservada' ? 'reserva' : '';
            }
        } catch (error) {
            console.error('No se pudo verificar el retorno del pago:', error.message);
        }
        const params = new URLSearchParams({ resultado });
        if (idMatricula) params.set('matricula', idMatricula);
        if (tipo) params.set('tipo', tipo);
        return res.redirect(`/pagos.html?${params}`);
    }

    async webhook(req, res) {
        try {
            const type = req.body?.type || req.query.type;
            const id = req.body?.data?.id || req.query['data.id'];
            await pagosService.procesarWebhook(type, id);
            return res.status(200).send('OK');
        } catch (error) {
            console.error('Error en webhook:', error.message);
            return res.status(500).send('Error');
        }
    }
}

module.exports = new PagosController();
