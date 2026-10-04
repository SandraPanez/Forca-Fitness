const db = require('../../shared/config/database');

class PagosRepository {

    async obtenerResumenMatricula(idMatricula) {
        const query = `
            SELECT
                COALESCE(SUM(d.tarifa), 0)::NUMERIC AS monto,
                COALESCE(STRING_AGG(d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina"), '') AS disciplinas
            FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
            JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh
              ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
            JOIN "Academia Forca&Fitness"."Disciplina" d
              ON d."Id_Disciplinas" = dh."Id_Disciplina"
            WHERE dm."Id_Matricula" = $1
        `;
        const result = await db.query(query, [idMatricula]);
        return result.rows[0];
    }

    async registrarRegistroCobro(datosCobro) {
        const query = `
            INSERT INTO "Academia Forca&Fitness"."Registro_Cobro"
            ("Id_Registro", "Fecha_Hora", "Monto", "Medio_Pago",
             "Resultado", "Id_Pago", "Referencia_Operacion")
            VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6)
            RETURNING "Id_Registro"
        `;
        const result = await db.query(query, [
            datosCobro.id_registro,
            datosCobro.monto,
            datosCobro.medio_pago,
            datosCobro.resultado,
            datosCobro.id_pago,
            datosCobro.referencia_operacion || null
        ]);
        return result.rows[0];
    }

    async registrarPagoMercado(datosPago) {
        const query = `
            INSERT INTO "Academia Forca&Fitness"."Pago"
            ("Id_Pago", "Monto", "Estado_Pago", "Id_Matricula", "Id_MPago")
            SELECT $1, $2, 'PENDIENTE', $3, "Id_MPago"
            FROM "Academia Forca&Fitness"."Metodo_Pago"
            WHERE UPPER("Nombre_Metodo") = 'MERCADO_PAGO'
            RETURNING "Id_Pago"
        `;
        const result = await db.query(query, [
            datosPago.id_pago,
            datosPago.monto,
            datosPago.id_matricula
        ]);
        if (!result.rows[0]) {
            throw new Error('El método de pago Mercado Pago no está configurado.');
        }
        await this.registrarTransaccionMP({
            id_mp_transaccion: `MP${Date.now().toString().slice(-8)}`,
            preference_id: datosPago.preference_id,
            referencia_ext: datosPago.id_matricula,
            id_pago: datosPago.id_pago
        });
        return result.rows[0];
    }

    async registrarPagoEfectivo(datosPago) {
        const query = `
            INSERT INTO "Academia Forca&Fitness"."Pago"
            ("Id_Pago", "Monto", "Estado_Pago", "Fecha_Vencimiento",
             "Id_Matricula", "Id_MPago")
            SELECT $1, $2, 'PENDIENTE', CURRENT_TIMESTAMP + INTERVAL '48 hours',
                   $3, "Id_MPago"
            FROM "Academia Forca&Fitness"."Metodo_Pago"
            WHERE UPPER("Nombre_Metodo") = 'EFECTIVO'
            RETURNING "Id_Pago", "Monto", "Estado_Pago", "Fecha_Vencimiento",
                      "Id_Matricula"
        `;
        const result = await db.query(query, [datosPago.id_pago, datosPago.monto, datosPago.id_matricula]);
        if (!result.rows[0]) {
            throw new Error('El método de pago en efectivo no está configurado.');
        }
        await this.registrarRegistroCobro({
            id_registro: `REG${Date.now().toString().slice(-14)}`,
            monto: datosPago.monto,
            medio_pago: 'EFECTIVO',
            resultado: 'PENDIENTE',
            id_pago: result.rows[0].Id_Pago
        });
        return result.rows[0];
    }

    async confirmarPagoEfectivo(idMatricula, referenciaOperacion) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const pago = await client.query(`
                UPDATE "Academia Forca&Fitness"."Pago"
                SET "Estado_Pago" = 'APROBADO',
                    "Referencia_Operacion" = $2
                WHERE "Id_Matricula" = $1
                  AND "Id_MPago" = 'MP02'
                  AND "Estado_Pago" = 'PENDIENTE'
                  AND ("Fecha_Vencimiento" IS NULL OR "Fecha_Vencimiento" >= CURRENT_TIMESTAMP)
                RETURNING "Id_Pago", "Monto"
            `, [idMatricula, referenciaOperacion || null]);
            if (!pago.rows[0]) {
                throw new Error('No existe una solicitud de efectivo pendiente o ya venció.');
            }
            await client.query(`
                UPDATE "Academia Forca&Fitness"."Matricula"
                SET "Estado_Matricula" = 'Activa'
                WHERE "Id_Matricula" = $1
            `, [idMatricula]);
            await client.query(`
                UPDATE "Academia Forca&Fitness"."Usuario" u
                SET "Estado_Usuario" = 'ACTIVO'
                FROM "Academia Forca&Fitness"."Matricula" m
                WHERE m."Id_Matricula" = $1 AND u."Id_alumno" = m."Id_alumno"
            `, [idMatricula]);
            await client.query(`
                INSERT INTO "Academia Forca&Fitness"."Registro_Cobro"
                ("Id_Registro", "Fecha_Hora", "Monto", "Medio_Pago",
                 "Resultado", "Id_Pago", "Referencia_Operacion")
                VALUES ($1, CURRENT_TIMESTAMP, $2, 'EFECTIVO', 'APROBADO', $3, $4)
            `, [`REG${Date.now().toString().slice(-14)}`, pago.rows[0].Monto, pago.rows[0].Id_Pago, referenciaOperacion || null]);
            await client.query('COMMIT');
            return pago.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async anularSolicitudesEfectivoVencidas() {
        const result = await db.query(`
            WITH vencidos AS (
                UPDATE "Academia Forca&Fitness"."Pago"
                SET "Estado_Pago" = 'ANULADO'
                WHERE "Id_MPago" = 'MP02'
                  AND "Estado_Pago" = 'PENDIENTE'
                  AND "Fecha_Vencimiento" < CURRENT_TIMESTAMP
                RETURNING "Id_Pago", "Id_Matricula", "Monto"
            )
            SELECT * FROM vencidos
        `);
        for (const pago of result.rows) {
            await db.query(`
                UPDATE "Academia Forca&Fitness"."Matricula"
                SET "Estado_Matricula" = 'Anulada'
                WHERE "Id_Matricula" = $1
            `, [pago.Id_Matricula]);
            await this.registrarRegistroCobro({
                id_registro: `REG${Date.now().toString().slice(-14)}`,
                monto: pago.Monto,
                medio_pago: 'EFECTIVO',
                resultado: 'ANULADO',
                id_pago: pago.Id_Pago
            });
        }
        return result.rows.length;
    }

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

    async obtenerTransaccionPorPaymentId(paymentId) {
        const result = await db.query(`
            SELECT "Id_Mp_Transaccion", "Id_Pago"
            FROM "Academia Forca&Fitness"."Mercado_Pago"
            WHERE "Mp_Payment_Id" = $1
        `, [String(paymentId)]);
        return result.rows[0] || null;
    }

    async asociarPaymentId(datosMP) {
        const result = await db.query(`
            UPDATE "Academia Forca&Fitness"."Mercado_Pago"
            SET "Mp_Payment_Id" = $1
            WHERE "Id_Pago" = $2
              AND "Mp_Payment_Id" IS NULL
            RETURNING "Id_Pago"
        `, [String(datosMP.mp_payment_id), datosMP.id_pago]);
        return result.rows[0] || null;
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
                "Estado_Pago",
                "Monto"
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