const db = require('../../shared/config/database');
const { randomUUID } = require('node:crypto');

class PagosRepository {

    async listarCobros({ estado, medio, busqueda }) {
        const condiciones = [];
        const valores = [];

        if (estado) {
            valores.push(estado.toUpperCase());
            condiciones.push(`p."Estado_Pago" = $${valores.length}`);
        }
        if (medio) {
            valores.push(medio.toUpperCase());
            condiciones.push(`UPPER(mp."Nombre_Metodo") = $${valores.length}`);
        }
        if (busqueda) {
            valores.push(`%${busqueda}%`);
            condiciones.push(`(
                p."Id_Matricula" ILIKE $${valores.length}
                OR per."Nombre" || ' ' || per."Apellido_Paterno" || ' ' || per."Apellido_Materno" ILIKE $${valores.length}
            )`);
        }

        const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
        const result = await db.query(`
            SELECT
                p."Id_Pago" AS id_pago,
                p."Id_Matricula" AS id_matricula,
                p."Monto" AS monto,
                p."Estado_Pago" AS estado_pago,
                p."Fecha_Pago" AS fecha_pago,
                p."Fecha_Pago" + INTERVAL '48 hours' AS fecha_vencimiento,
                UPPER(mp."Nombre_Metodo") AS medio_pago,
                TRIM(per."Nombre" || ' ' || per."Apellido_Paterno" || ' ' || per."Apellido_Materno") AS alumno,
                COALESCE(STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina"), '') AS disciplinas,
                m."Estado_Matricula" AS estado_matricula
            FROM "Academia Forca&Fitness"."Pago" p
            JOIN "Academia Forca&Fitness"."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
            JOIN "Academia Forca&Fitness"."Matricula" m ON m."Id_Matricula" = p."Id_Matricula"
            JOIN "Academia Forca&Fitness"."Alumno" a ON a."Id_alumno" = m."Id_alumno"
            JOIN "Academia Forca&Fitness"."Persona" per ON per."Id_Persona" = a."Id_Persona"
            LEFT JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
            LEFT JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
            LEFT JOIN "Academia Forca&Fitness"."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
            ${where}
            GROUP BY p."Id_Pago", mp."Nombre_Metodo", per."Nombre", per."Apellido_Paterno", per."Apellido_Materno", m."Estado_Matricula"
            ORDER BY p."Fecha_Pago" DESC
        `, valores);
        return result.rows;
    }

    async listarEfectivoPendientes() {
        const result = await db.query(`
            SELECT
                p."Id_Pago" AS id_pago,
                p."Id_Matricula" AS id_matricula,
                p."Monto" AS monto,
                p."Fecha_Pago" AS fecha_pago,
                p."Fecha_Pago" + INTERVAL '48 hours' AS fecha_vencimiento,
                TRIM(per."Nombre" || ' ' || per."Apellido_Paterno" || ' ' || per."Apellido_Materno") AS alumno,
                COALESCE(STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina"), '') AS disciplinas
            FROM "Academia Forca&Fitness"."Pago" p
            JOIN "Academia Forca&Fitness"."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
            JOIN "Academia Forca&Fitness"."Matricula" m ON m."Id_Matricula" = p."Id_Matricula"
            JOIN "Academia Forca&Fitness"."Alumno" a ON a."Id_alumno" = m."Id_alumno"
            JOIN "Academia Forca&Fitness"."Persona" per ON per."Id_Persona" = a."Id_Persona"
            LEFT JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
            LEFT JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
            LEFT JOIN "Academia Forca&Fitness"."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
            WHERE p."Estado_Pago" = 'PENDIENTE'
              AND UPPER(mp."Nombre_Metodo") = 'EFECTIVO'
              AND p."Fecha_Pago" + INTERVAL '48 hours' >= CURRENT_TIMESTAMP
            GROUP BY p."Id_Pago", per."Nombre", per."Apellido_Paterno", per."Apellido_Materno"
            ORDER BY p."Fecha_Pago" ASC
        `);
        return result.rows;
    }

    async obtenerResumenMatricula(idMatricula) {
        const query = `
            SELECT
                COALESCE(SUM(d."Tarifa"), 0)::NUMERIC AS monto,
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

    async registrarRegistroCobro(datosCobro, client = db) {
        const query = `
            INSERT INTO "Academia Forca&Fitness"."Registro_Cobro"
            ("Id_Registro", "Fecha_Hora", "Monto", "Medio_Pago",
             "Resultado", "Id_Pago", "Referencia_Operacion")
            VALUES ($1, CURRENT_TIMESTAMP, $2, $3, $4, $5, $6)
            RETURNING "Id_Registro"
        `;
        const result = await client.query(query, [
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
            WHERE REPLACE(UPPER("Nombre_Metodo"), ' ', '_') = 'MERCADO_PAGO'
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

    async obtenerPagoActivoPorMatricula(idMatricula) {
        const result = await db.query(`
            SELECT p."Id_Pago", p."Estado_Pago" AS estado_pago,
                   m."Estado_Matricula" AS estado_matricula,
                   UPPER(mp."Nombre_Metodo") AS medio_pago
            FROM "Academia Forca&Fitness"."Pago" p
            JOIN "Academia Forca&Fitness"."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
            JOIN "Academia Forca&Fitness"."Matricula" m ON m."Id_Matricula" = p."Id_Matricula"
            WHERE p."Id_Matricula" = $1
              AND p."Estado_Pago" IN ('PENDIENTE', 'APROBADO')
            ORDER BY (p."Estado_Pago" = 'APROBADO') DESC, p."Fecha_Pago" DESC
            LIMIT 1
        `, [idMatricula]);
        return result.rows[0] || null;
    }

    async registrarPagoEfectivo(datosPago) {
        const query = `
            INSERT INTO "Academia Forca&Fitness"."Pago"
            ("Id_Pago", "Monto", "Estado_Pago",
             "Id_Matricula", "Id_MPago")
            SELECT $1, $2, 'PENDIENTE',
                   $3, "Id_MPago"
            FROM "Academia Forca&Fitness"."Metodo_Pago"
            WHERE UPPER("Nombre_Metodo") = 'EFECTIVO'
              AND "Activo" = TRUE
            RETURNING "Id_Pago", "Monto", "Estado_Pago", "Fecha_Pago",
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

    async confirmarPagoEfectivo(idMatricula, idUsuario, referenciaOperacion) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            const pago = await client.query(`
                UPDATE "Academia Forca&Fitness"."Pago"
                SET "Estado_Pago" = 'APROBADO',
                    "Id_Usuario_Registro" = $2
                WHERE "Id_Matricula" = $1
                  AND "Id_MPago" = 'MP02'
                  AND "Estado_Pago" = 'PENDIENTE'
                  AND "Fecha_Pago" + INTERVAL '48 hours' >= CURRENT_TIMESTAMP
                RETURNING "Id_Pago", "Monto"
            `, [idMatricula, idUsuario || null]);
            if (!pago.rows[0]) {
                throw new Error('No existe una solicitud de efectivo pendiente o ya venció.');
            }
            const esFutura = await this.esMatriculaPeriodoFuturo(idMatricula, client);
            const estadoMatricula = esFutura ? 'Reservada' : 'Activa';

            await this.actualizarEstadoMatricula(idMatricula, estadoMatricula, client);
            await client.query(`
                UPDATE "Academia Forca&Fitness"."Usuario" u
                SET "Estado_Usuario" = 'ACTIVO'
                FROM "Academia Forca&Fitness"."Matricula" m
                JOIN "Academia Forca&Fitness"."Alumno" a ON a."Id_alumno" = m."Id_alumno"
                WHERE m."Id_Matricula" = $1 AND u."Id_Persona" = a."Id_Persona"
            `, [idMatricula]);
            await client.query(`
                INSERT INTO "Academia Forca&Fitness"."Registro_Cobro"
                ("Id_Registro", "Fecha_Hora", "Monto", "Medio_Pago",
                 "Resultado", "Id_Pago", "Referencia_Operacion")
                VALUES ($1, CURRENT_TIMESTAMP, $2, 'EFECTIVO', 'APROBADO', $3, $4)
            `, [`REG${Date.now().toString().slice(-14)}`, pago.rows[0].Monto, pago.rows[0].Id_Pago, referenciaOperacion || null]);
            await client.query('COMMIT');
            return {
                ...pago.rows[0],
                estadoMatricula
            };
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
                  AND "Fecha_Pago" + INTERVAL '48 hours' < CURRENT_TIMESTAMP
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

    async activarReservasIniciadas() {
        const result = await db.query(`
            WITH activadas AS (
                UPDATE "Academia Forca&Fitness"."Matricula" m
                SET "Estado_Matricula" = 'Activa'
                WHERE m."Estado_Matricula" = 'Reservada'
                  AND EXISTS (
                      SELECT 1 FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
                      WHERE dm."Id_Matricula" = m."Id_Matricula"
                        AND dm."Fecha_Inicio" <= CURRENT_DATE
                  )
                RETURNING m."Id_Matricula", m."Id_alumno"
            )
            SELECT * FROM activadas
        `);

        if (result.rows.length > 0) {
            for (const row of result.rows) {
                await db.query(`
                    UPDATE "Academia Forca&Fitness"."Usuario" u
                    SET "Estado_Usuario" = 'ACTIVO'
                    FROM "Academia Forca&Fitness"."Alumno" a
                    WHERE a."Id_alumno" = $1 AND u."Id_Persona" = a."Id_Persona"
                `, [row.Id_alumno]);
            }
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

    async obtenerTransaccionesMercado(idMatricula) {
        const result = await db.query(`
            SELECT mp."Preference_Id", p."Estado_Pago" AS estado_pago
            FROM "Academia Forca&Fitness"."Mercado_Pago" mp
            JOIN "Academia Forca&Fitness"."Pago" p ON p."Id_Pago" = mp."Id_Pago"
            WHERE p."Id_Matricula" = $1
            ORDER BY (p."Estado_Pago" = 'APROBADO') DESC, p."Fecha_Pago" DESC
        `, [idMatricula]);
        return result.rows;
    }

    async actualizarPagoMercado({ payment_id, preference_id, id_matricula, monto, estado_pago }) {
        const client = await db.pool.connect();
        try {
            await client.query('BEGIN');
            // Retorno, consulta manual y webhook comparten el mismo bloqueo.
            const matricula = await client.query(`
                SELECT "Estado_Matricula" FROM "Academia Forca&Fitness"."Matricula"
                WHERE "Id_Matricula" = $1 FOR UPDATE
            `, [id_matricula]);
            const transaccion = await client.query(`
                SELECT p."Id_Pago", p."Monto", p."Estado_Pago", mp."Mp_Payment_Id"
                FROM "Academia Forca&Fitness"."Mercado_Pago" mp
                JOIN "Academia Forca&Fitness"."Pago" p ON p."Id_Pago" = mp."Id_Pago"
                JOIN "Academia Forca&Fitness"."Metodo_Pago" medio ON medio."Id_MPago" = p."Id_MPago"
                WHERE mp."Preference_Id" = $1 AND mp."Referencia_Ext" = $2
                  AND p."Id_Matricula" = $2 AND REPLACE(UPPER(medio."Nombre_Metodo"), ' ', '_') = 'MERCADO_PAGO'
                FOR UPDATE OF p, mp
            `, [preference_id, id_matricula]);
            const pago = transaccion.rows[0];
            if (!matricula.rows[0] || !pago ||
                Math.round(Number(pago.Monto) * 100) !== Math.round(monto * 100)) {
                throw new Error('VALIDACION:El pago no coincide con la matrícula, preferencia o monto registrado.');
            }
            if (pago.Estado_Pago === 'APROBADO' ||
                (pago.Estado_Pago === estado_pago && pago.Mp_Payment_Id === payment_id)) {
                await client.query('COMMIT');
                return { duplicado: true, estadoPago: pago.Estado_Pago,
                    estadoMatricula: matricula.rows[0].Estado_Matricula, idMatricula: id_matricula };
            }
            await client.query(`
                UPDATE "Academia Forca&Fitness"."Pago" SET "Estado_Pago" = $1 WHERE "Id_Pago" = $2
            `, [estado_pago, pago.Id_Pago]);
            await client.query(`
                UPDATE "Academia Forca&Fitness"."Mercado_Pago" SET "Mp_Payment_Id" = $1
                WHERE "Id_Pago" = $2
            `, [payment_id, pago.Id_Pago]);

            let estadoMatricula = matricula.rows[0].Estado_Matricula;
            const otroAprobado = await client.query(`
                SELECT 1 FROM "Academia Forca&Fitness"."Pago"
                WHERE "Id_Matricula" = $1 AND "Id_Pago" <> $2 AND "Estado_Pago" = 'APROBADO'
            `, [id_matricula, pago.Id_Pago]);
            if (estado_pago === 'APROBADO') {
                const futura = await this.esMatriculaPeriodoFuturo(id_matricula, client);
                estadoMatricula = futura ? 'Reservada' : 'Activa';
                await this.actualizarEstadoMatricula(id_matricula, estadoMatricula, client);
                await this.activarUsuarioPorMatricula(id_matricula, client);
            } else if (otroAprobado.rows.length === 0) {
                estadoMatricula = 'Pendiente';
                await this.actualizarEstadoMatricula(id_matricula, estadoMatricula, client);
            }
            await this.registrarRegistroCobro({
                id_registro: `REG${randomUUID().replaceAll('-', '').slice(0, 17)}`,
                monto: pago.Monto,
                medio_pago: 'MERCADO_PAGO',
                resultado: estado_pago,
                id_pago: pago.Id_Pago,
                referencia_operacion: payment_id
            }, client);
            await client.query('COMMIT');
            return { estadoPago: estado_pago, estadoMatricula, idMatricula: id_matricula };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
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
        estado_matricula,
        client = db
    ) {
        if (['ACTIVA', 'ACTIVO'].includes(String(estado_matricula).toUpperCase())) {
            // Se activa y se calcula la renovación una sola vez, también ante webhooks repetidos.
            const result = await client.query(`
                WITH activacion AS (
                    UPDATE "Academia Forca&Fitness"."Matricula"
                    SET "Estado_Matricula" = $1
                    WHERE "Id_Matricula" = $2
                      AND UPPER("Estado_Matricula") NOT IN ('ACTIVA', 'ACTIVO')
                    RETURNING "Id_Matricula", "Estado_Matricula", "Id_alumno"
                ), periodos AS (
                    SELECT actual."Id_DetMatricula",
                        GREATEST(CURRENT_DATE, MAX(anterior."Fecha_Fin") + 1) AS inicio
                    FROM activacion a
                    JOIN "Academia Forca&Fitness"."Detalles_Matricula" actual
                      ON actual."Id_Matricula" = a."Id_Matricula"
                    JOIN "Academia Forca&Fitness"."Matricula" previa
                      ON previa."Id_alumno" = a."Id_alumno" AND previa."Id_Matricula" <> a."Id_Matricula"
                      AND UPPER(previa."Estado_Matricula") IN ('ACTIVA', 'ACTIVO', 'VENCIDA')
                    JOIN "Academia Forca&Fitness"."Detalles_Matricula" anterior
                      ON anterior."Id_Matricula" = previa."Id_Matricula"
                      AND anterior."Id_DiscHorario" = actual."Id_DiscHorario"
                    GROUP BY actual."Id_DetMatricula"
                ), fechas AS (
                    UPDATE "Academia Forca&Fitness"."Detalles_Matricula" dm
                    SET "Fecha_Inicio" = p.inicio,
                        "Fecha_Fin" = (p.inicio + INTERVAL '29 days')::DATE
                    FROM periodos p WHERE dm."Id_DetMatricula" = p."Id_DetMatricula"
                    RETURNING dm."Id_DetMatricula"
                )
                SELECT "Id_Matricula", "Estado_Matricula" FROM activacion
                UNION ALL
                SELECT "Id_Matricula", "Estado_Matricula" FROM "Academia Forca&Fitness"."Matricula"
                WHERE "Id_Matricula" = $2 AND NOT EXISTS (SELECT 1 FROM activacion)
            `, [estado_matricula, id_matricula]);
            return result.rows[0] || null;
        }
        const query = `
            UPDATE "Academia Forca&Fitness"."Matricula"
            SET "Estado_Matricula" = $1
            WHERE "Id_Matricula" = $2
            RETURNING
                "Id_Matricula",
                "Estado_Matricula"
        `;

        const result = await client.query(query, [estado_matricula, id_matricula]);

        return result.rows[0];
    }

    async esMatriculaPeriodoFuturo(idMatricula, client = db) {
        const query = `
            SELECT 1
            FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
            WHERE dm."Id_Matricula" = $1
              AND (
                  EXTRACT(YEAR FROM dm."Fecha_Inicio") > EXTRACT(YEAR FROM CURRENT_DATE)
                  OR (
                      EXTRACT(YEAR FROM dm."Fecha_Inicio") = EXTRACT(YEAR FROM CURRENT_DATE)
                      AND EXTRACT(MONTH FROM dm."Fecha_Inicio") > EXTRACT(MONTH FROM CURRENT_DATE)
                  )
              )
            LIMIT 1
        `;
        const result = await client.query(query, [idMatricula]);
        return result.rows.length > 0;
    }


    // Habilitar la cuenta asociada a la matrícula
    async activarUsuarioPorMatricula(id_matricula, client = db) {
        const query = `
            UPDATE "Academia Forca&Fitness"."Usuario" u
            SET "Estado_Usuario" = 'ACTIVO'
            FROM "Academia Forca&Fitness"."Matricula" m
            JOIN "Academia Forca&Fitness"."Alumno" a
              ON a."Id_alumno" = m."Id_alumno"
            WHERE m."Id_Matricula" = $1
              AND u."Id_Persona" = a."Id_Persona"
            RETURNING
                u."Id_Usuario",
                u."Correo",
                u."Estado_Usuario"
        `;

        const result = await client.query(
            query,
            [id_matricula]
        );

        return result.rows[0] || null;
    }

    async obtenerUsuarioPorMatricula(id_matricula) {
        const query = `
            SELECT
                u."Id_Usuario",
                u."Correo",
                u."Estado_Usuario",
                TRIM(per."Nombre" || ' ' || per."Apellido_Paterno" || ' ' || per."Apellido_Materno") AS nombre
            FROM "Academia Forca&Fitness"."Matricula" m
            JOIN "Academia Forca&Fitness"."Alumno" a ON a."Id_alumno" = m."Id_alumno"
            JOIN "Academia Forca&Fitness"."Persona" per ON per."Id_Persona" = a."Id_Persona"
            LEFT JOIN "Academia Forca&Fitness"."Usuario" u ON u."Id_Persona" = a."Id_Persona"
            WHERE m."Id_Matricula" = $1
            LIMIT 1
        `;

        const result = await db.query(query, [id_matricula]);
        return result.rows[0] || null;
    }

    async listarCobrosPorAlumno() {
        const query = `
            SELECT
                a."Id_alumno" AS id_alumno,
                per."Numero_Documento" AS dni,
                TRIM(per."Nombre" || ' ' || COALESCE(per."Segundo_Nombre" || ' ', '') || per."Apellido_Paterno" || ' ' || per."Apellido_Materno") AS nombre_completo,
                (
                    SELECT mc."Contacto"
                    FROM "Academia Forca&Fitness"."Metodo_Contacto" mc
                    WHERE mc."Id_Persona" = a."Id_Persona" AND mc."Tipo_Contacto" = 'CORREO'
                    LIMIT 1
                ) AS correo,
                p."Id_Pago" AS id_pago,
                p."Id_Matricula" AS id_matricula,
                p."Monto" AS monto,
                p."Estado_Pago" AS estado_pago,
                p."Fecha_Pago" AS fecha_pago,
                UPPER(COALESCE(mp."Nombre_Metodo", 'EFECTIVO')) AS medio_pago,
                cobro."Referencia_Operacion" AS referencia,
                COALESCE(
                    (
                        SELECT STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ')
                        FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
                        JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
                        JOIN "Academia Forca&Fitness"."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
                        WHERE dm."Id_Matricula" = m."Id_Matricula"
                    ),
                    (
                        SELECT STRING_AGG(DISTINCT d."Nombre_Disciplina", ', ')
                        FROM "Academia Forca&Fitness"."Matricula" m2
                        JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm ON dm."Id_Matricula" = m2."Id_Matricula"
                        JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
                        JOIN "Academia Forca&Fitness"."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
                        WHERE m2."Id_alumno" = a."Id_alumno"
                    )
                ) AS disciplinas,
                COALESCE(
                    (
                        SELECT STRING_AGG(DISTINCT TRIM(per_prof."Nombre" || ' ' || per_prof."Apellido_Paterno"), ', ')
                        FROM "Academia Forca&Fitness"."Detalles_Matricula" dm
                        JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
                        JOIN "Academia Forca&Fitness"."Profesor" prof ON prof."Id_Profesor" = dh."Id_Profesor"
                        JOIN "Academia Forca&Fitness"."Persona" per_prof ON per_prof."Id_Persona" = prof."Id_Persona"
                        WHERE dm."Id_Matricula" = m."Id_Matricula"
                    ),
                    (
                        SELECT STRING_AGG(DISTINCT TRIM(per_prof."Nombre" || ' ' || per_prof."Apellido_Paterno"), ', ')
                        FROM "Academia Forca&Fitness"."Matricula" m2
                        JOIN "Academia Forca&Fitness"."Detalles_Matricula" dm ON dm."Id_Matricula" = m2."Id_Matricula"
                        JOIN "Academia Forca&Fitness"."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
                        JOIN "Academia Forca&Fitness"."Profesor" prof ON prof."Id_Profesor" = dh."Id_Profesor"
                        JOIN "Academia Forca&Fitness"."Persona" per_prof ON per_prof."Id_Persona" = prof."Id_Persona"
                        WHERE m2."Id_alumno" = a."Id_alumno"
                    )
                ) AS profesores
            FROM "Academia Forca&Fitness"."Alumno" a
            JOIN "Academia Forca&Fitness"."Persona" per ON per."Id_Persona" = a."Id_Persona"
            LEFT JOIN "Academia Forca&Fitness"."Matricula" m ON m."Id_alumno" = a."Id_alumno"
            LEFT JOIN "Academia Forca&Fitness"."Pago" p ON p."Id_Matricula" = m."Id_Matricula"
            LEFT JOIN "Academia Forca&Fitness"."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
            LEFT JOIN LATERAL (
                SELECT rc."Referencia_Operacion"
                FROM "Academia Forca&Fitness"."Registro_Cobro" rc
                WHERE rc."Id_Pago" = p."Id_Pago"
                ORDER BY rc."Fecha_Hora" DESC
                LIMIT 1
            ) cobro ON TRUE
            ORDER BY a."Id_alumno", p."Fecha_Pago" DESC NULLS LAST;
        `;
        const result = await db.query(query);
        return result.rows;
    }
}

module.exports = new PagosRepository();
