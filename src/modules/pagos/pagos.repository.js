const db = require('../../shared/config/database');

class PagosRepository {

    async registrarPago(datosPago) {
        const query = `
            INSERT INTO "Academia Forca&Fitness"."Pago"
            (
                "Id_Pago",
                "Monto",
                "Estado_Pago",
                "Id_Matricula",
                "Id_MPago"
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "Id_Pago"
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
            INSERT INTO "Academia Forca&Fitness"."Mercado_Pago"
            (
                "Id_Mp_Transaccion",
                "Preference_Id",
                "Mp_Payment_Id",
                "Referencia_Ext",
                "Id_Pago"
            )
            VALUES ($1, $2, $3, $4, $5)
            RETURNING "Id_Mp_Transaccion"
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


    async actualizarEstadoPago(
        id_matricula,
        estado_pago
    ) {
        const query = `
            UPDATE "Academia Forca&Fitness"."Pago"
            SET "Estado_Pago" = $1
            WHERE "Id_Matricula" = $2
            RETURNING
                "Id_Pago",
                "Estado_Pago"
        `;

        const result = await db.query(
            query,
            [
                estado_pago,
                id_matricula
            ]
        );

        return result.rows[0];
    }


    async obtenerMetodosPago() {
        const query = `
            SELECT
                "Id_MPago",
                "Nombre_Metodo",
                "Descripcion",
                "RPasarela"
            FROM "Academia Forca&Fitness"."Metodo_Pago"
            WHERE "Activo" = TRUE
        `;

        const result = await db.query(query);

        return result.rows;
    }


    async actualizarEstadoMatricula(
        id_matricula,
        estado_matricula
    ) {
        const query = `
            UPDATE "Academia Forca&Fitness"."Matricula"
            SET "Estado_Matricula" = $1
            WHERE "Id_Matricula" = $2
            RETURNING
                "Id_Matricula",
                "Estado_Matricula"
        `;

        const result = await db.query(
            query,
            [
                estado_matricula,
                id_matricula
            ]
        );

        return result.rows[0];
    }


    // Habilitar la cuenta asociada a la matrícula
    async activarUsuarioPorMatricula(id_matricula) {
        const query = `
            UPDATE "Academia Forca&Fitness"."Usuario" u
            SET "Estado_Usuario" = 'ACTIVO'
            FROM "Academia Forca&Fitness"."Matricula" m
            WHERE m."Id_Matricula" = $1
              AND u."Id_alumno" = m."Id_alumno"
            RETURNING
                u."Id_Usuario",
                u."Correo",
                u."Estado_Usuario"
        `;

        const result = await db.query(
            query,
            [id_matricula]
        );

        return result.rows[0] || null;
    }
}

module.exports = new PagosRepository();