const db = require('../../shared/config/database');

class PagosRepository {
    async registrarPago(datosPago) {
        const query = `
            INSERT INTO academia_forca_fitness.pago 
            (id_pago, monto, estado_pago, id_matricula, id_mpago)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_pago
        `;
        const values = [
            datosPago.id_pago,
            datosPago.monto,
            datosPago.estado_pago || 'PENDIENTE',
            datosPago.id_matricula,
            datosPago.id_mpago
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    async registrarTransaccionMP(datosMP) {
        const query = `
            INSERT INTO academia_forca_fitness.mercado_pago
            (id_mp_transaccion, preference_id, mp_payment_id, referencia_ext, id_pago)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id_mp_transaccion
        `;
        const values = [
            datosMP.id_mp_transaccion,
            datosMP.preference_id,
            datosMP.mp_payment_id || null,
            datosMP.referencia_ext,
            datosMP.id_pago
        ];
        const result = await db.query(query, values);
        return result.rows[0];
    }

    async actualizarEstadoPago(id_pago, estado_pago) {
        const query = `
            UPDATE academia_forca_fitness.pago
            SET estado_pago = $1
            WHERE id_pago = $2
            RETURNING id_pago, estado_pago
        `;
        const result = await db.query(query, [estado_pago, id_pago]);
        return result.rows[0];
    }

    async obtenerMetodosPago() {
        const query = `
            SELECT id_mpago, nombre_metodo, descripcion, rpasarela
            FROM academia_forca_fitness.metodo_pago
            WHERE activo = TRUE
        `;
        const result = await db.query(query);
        return result.rows;
    }
}

module.exports = new PagosRepository();