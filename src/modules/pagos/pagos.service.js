const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const pagosRepository = require('./pagos.repository');
const db = require('../../shared/config/database');

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
        }

        const resumen = await pagosRepository.obtenerResumenMatricula(datosMatricula.id_matricula);
        const monto = Number(resumen.monto);
        if (!Number.isFinite(monto) || monto <= 0) {
            throw new Error('VALIDACION:La matrícula no tiene disciplinas con tarifa configurada.');
        }

        const preference = new Preference(client);

        // auto_return y notification_url se habilitan siempre que tengamos una URL pública.
        // En localhost el webhook no puede recibirse desde MP, pero auto_return sí funciona
        // porque MP redirige al navegador del usuario.
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
            back_urls: {
                success: `${appUrl}/api/pagos/success`,
                failure: `${appUrl}/api/pagos/failure`,
                pending: `${appUrl}/api/pagos/pending`
            },
            auto_return: 'approved',
            ...(appUrl.startsWith('https://') ? {
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
                estadoMatricula: transaccionExistente.Estado_Matricula,
                mensaje: 'El pago ya fue procesado anteriormente.'
            };
        }

        const pagoActualizado = await pagosRepository.actualizarEstadoPago(
            idMatricula,
            estadoPago
        );


        let estadoMatricula = 'Pendiente';
        if (estadoMP === 'approved') {
            const esFutura = await pagosRepository.esMatriculaPeriodoFuturo(idMatricula);
            estadoMatricula = esFutura ? 'Reservada' : 'Activa';
        } else if (estadoMP === 'rejected') {
            estadoMatricula = 'Inactiva';
        }

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

    async confirmarRetornoExitosoSandbox({ id_matricula, preference_id, payment_id }) {
        let matriculaId = id_matricula;

        if (!matriculaId && preference_id) {
            const row = await db.query(`
                SELECT p."Id_Matricula"
                FROM "Academia Forca&Fitness"."Mercado_Pago" mp
                JOIN "Academia Forca&Fitness"."Pago" p ON p."Id_Pago" = mp."Id_Pago"
                WHERE mp."Preference_Id" = $1
                LIMIT 1
            `, [preference_id]);
            matriculaId = row.rows[0]?.Id_Matricula;
        }

        if (!matriculaId) {
            console.warn('Sandbox return: No se pudo determinar el ID de matrícula.');
            return null;
        }

        const pagoActualizado = await pagosRepository.actualizarEstadoPago(matriculaId, 'APROBADO');

        const esFutura = await pagosRepository.esMatriculaPeriodoFuturo(matriculaId);
        const estadoMatricula = esFutura ? 'Reservada' : 'Activa';

        await pagosRepository.actualizarEstadoMatricula(matriculaId, estadoMatricula);
        const usuarioActivado = await pagosRepository.activarUsuarioPorMatricula(matriculaId);

        if (pagoActualizado) {
            // Registrar siempre el cobro (aunque no haya payment_id en sandbox)
            await pagosRepository.registrarRegistroCobro({
                id_registro: `REG${Date.now().toString().slice(-14)}`,
                monto: pagoActualizado.Monto,
                medio_pago: 'MERCADO_PAGO',
                resultado: 'APROBADO',
                id_pago: pagoActualizado.Id_Pago,
                referencia_operacion: payment_id ? String(payment_id) : null
            });
            // Asociar el payment_id si MP lo envió (fix: era 'paymentId' undefined)
            if (payment_id) {
                await pagosRepository.asociarPaymentId({
                    mp_payment_id: payment_id,
                    id_pago: pagoActualizado.Id_Pago
                });
            }
        }

        return {
            estadoPago: 'APROBADO',
            estadoMatricula,
            usuarioActivado
        };
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