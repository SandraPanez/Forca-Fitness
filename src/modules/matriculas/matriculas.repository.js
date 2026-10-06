const db = require('../../shared/config/database');

const SCHEMA = '"Academia Forca&Fitness"';

class MatriculasRepository {

  // =========================================================
  // DISCIPLINAS
  // =========================================================

  async getDisciplinas() {
    const query = `
      SELECT
        "Id_Disciplinas" AS id,
        "Nombre_Disciplina" AS nombre,
        "Descripcion" AS descripcion,
        "Tarifa" AS tarifa
      FROM ${SCHEMA}."Disciplina"
      ORDER BY "Nombre_Disciplina" ASC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  async getResumenMatricula(id_matricula) {
    const query = `
      SELECT
        COALESCE(SUM(d."Tarifa"), 0)::NUMERIC AS monto,
        COALESCE(STRING_AGG(d."Nombre_Disciplina", ', ' ORDER BY d."Nombre_Disciplina"), '') AS disciplinas
      FROM ${SCHEMA}."Detalles_Matricula" dm
      JOIN ${SCHEMA}."Disciplina_Horario" dh
        ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      JOIN ${SCHEMA}."Disciplina" d
        ON d."Id_Disciplinas" = dh."Id_Disciplina"
      WHERE dm."Id_Matricula" = $1
    `;
    const result = await db.query(query, [id_matricula]);
    return result.rows[0];
  }

  async getMatriculaPendientePorAlumno(alumnoId, client = db) {
    const result = await client.query(`
      SELECT m."Id_Matricula" AS matricula
      FROM ${SCHEMA}."Matricula" m
      WHERE m."Id_alumno" = $1
        AND m."Estado_Matricula" IN ('PENDIENTE', 'Pendiente de confirmación')
        AND NOT EXISTS (
          SELECT 1
          FROM ${SCHEMA}."Pago" p
          WHERE p."Id_Matricula" = m."Id_Matricula"
            AND p."Id_MPago" = 'MP02'
            AND p."Estado_Pago" = 'PENDIENTE'
            AND p."Fecha_Pago" + INTERVAL '48 hours' < CURRENT_TIMESTAMP
        )
      ORDER BY m."Fecha_Inscripcion" DESC
      LIMIT 1
    `, [alumnoId]);
    return result.rows[0]?.matricula || null;
  }

  async getHorariosPorDisciplina(id_disciplina) {
    const query = `
      SELECT
        dh."Id_DiscHorario" AS id_disc_horario,
        h."Dias" AS dias,
        h."Hora_Inicio" AS hora_inicio,
        h."Hora_Fin" AS hora_fin,
        h."Turno" AS turno,
        dh."Capacidad_Max" AS capacidad_max,
        pp."Nombre" || ' ' || pp."Apellido_Paterno" AS profesor_nombre
      FROM ${SCHEMA}."Disciplina_Horario" dh
      JOIN ${SCHEMA}."Horarios" h
        ON dh."Id_Horario" = h."Id_Horario"
      LEFT JOIN ${SCHEMA}."Profesor" p
        ON dh."Id_Profesor" = p."Id_Profesor"
      LEFT JOIN ${SCHEMA}."Persona" pp
      ON p."Id_Persona" = pp."Id_Persona"
      WHERE dh."Id_Disciplina" = $1
      ORDER BY h."Hora_Inicio" ASC
    `;

    const result = await db.query(query, [id_disciplina]);
    return result.rows;
  }

  async countInscritosPorHorario(id_disc_horario) {
    const query = `
      SELECT COUNT(*) AS total
      FROM ${SCHEMA}."Detalles_Matricula"
      WHERE "Id_DiscHorario" = $1
        AND "Fecha_Fin" >= CURRENT_DATE
    `;

    const result = await db.query(query, [id_disc_horario]);

    return parseInt(result.rows[0].total, 10);
  }


  // =========================================================
  // GENERACIÓN DE IDs
  // ALU01, USU01, MAT01, DET01, CON01...
  // =========================================================

  async generateId(client, tabla, columna, prefijo) {

    // Evita que dos registros generen el mismo correlativo
    // dentro de transacciones simultáneas.
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1))',
      [`${tabla}_${columna}_${prefijo}`]
    );

    const posicionInicio = prefijo.length + 1;

    const query = `
      SELECT COALESCE(
        MAX(
          CAST(
            SUBSTRING("${columna}" FROM ${posicionInicio})
            AS INTEGER
          )
        ),
        0
      ) + 1 AS siguiente
      FROM ${SCHEMA}."${tabla}"
      WHERE "${columna}" LIKE $1
    `;

    const result = await client.query(
      query,
      [`${prefijo}%`]
    );

    const numero = Number(result.rows[0].siguiente);

    return `${prefijo}${String(numero).padStart(2, '0')}`;
  }


  // =========================================================
  // ALUMNO
  // =========================================================

  async findEstudianteByDocumento(
    tipo_documento,
    numero_documento
  ) {

    const docQuery = `
      SELECT "Id_Documento"
      FROM ${SCHEMA}."Documento_Identificacion"
      WHERE UPPER("Tipo_Documento") = UPPER($1)
      LIMIT 1
    `;

    const docResult = await db.query(
      docQuery,
      [tipo_documento]
    );

    if (docResult.rows.length === 0) {
      return null;
    }

    const idDocumento = docResult.rows[0].Id_Documento;

    const query = `
      SELECT
        a."Id_alumno" AS id
      FROM ${SCHEMA}."Alumno" a
      JOIN ${SCHEMA}."Persona" p ON p."Id_Persona" = a."Id_Persona"
      WHERE p."Id_Documento" = $1
        AND p."Numero_Documento" = $2
      LIMIT 1
    `;

    const result = await db.query(
      query,
      [
        idDocumento,
        numero_documento
      ]
    );

    return result.rows[0] || null;
  }


  async createEstudiante(data, client = db) {

    // Buscar tipo de documento real
    const docQuery = `
      SELECT "Id_Documento"
      FROM ${SCHEMA}."Documento_Identificacion"
      WHERE UPPER("Tipo_Documento") = UPPER($1)
      LIMIT 1
    `;

    const docResult = await client.query(
      docQuery,
      [data.tipo_documento]
    );

    if (docResult.rows.length === 0) {
      throw new Error(
        `El tipo de documento ${data.tipo_documento} no está registrado en la base de datos.`
      );
    }

    const idDocumento =
      docResult.rows[0].Id_Documento;


    // Generar ALUxx
    const idAlumno = await this.generateId(
      client,
      'Alumno',
      'Id_alumno',
      'ALU'
    );


    // Separar primer y segundo nombre
    const nombresArray =
      data.nombres.trim().split(/\s+/);

    const primerNombre =
      nombresArray.shift();

    const segundoNombre =
      nombresArray.length > 0
        ? nombresArray.join(' ')
        : null;


    const idPersona = await this.generateId(client, 'Persona', 'Id_Persona', 'PER');
    await client.query(`
      INSERT INTO ${SCHEMA}."Persona" (
        "Id_Persona", "Nombre", "Segundo_Nombre", "Apellido_Paterno",
        "Apellido_Materno", "Fecha_Nacimiento", "Genero", "Direccion",
        "Numero_Documento", "Id_Documento"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      idPersona, primerNombre, segundoNombre, data.apellido_paterno,
      data.apellido_materno, data.fecha_nacimiento, data.genero || 'OTRO',
      data.direccion || 'Sin direccion', data.numero_documento, idDocumento
    ]);

    const query = `
      INSERT INTO ${SCHEMA}."Alumno" (
        "Id_alumno", "Estado_Alumno", "Condicion", "Id_Persona"
      ) VALUES ($1, 'ACTIVO', 'Ninguna', $2)
    `;

    await client.query(query, [idAlumno, idPersona]);


    // Guardar correo como método de contacto
    if (data.correo_electronico) {

      const idContactoCorreo =
        await this.generateId(
          client,
          'Metodo_Contacto',
          'Id_contacto',
          'CON'
        );

      await client.query(
        `
          INSERT INTO ${SCHEMA}."Metodo_Contacto" (
            "Id_contacto",
            "Tipo_Contacto",
            "Contacto",
            "Id_Persona"
          )
          VALUES ($1, 'CORREO', $2, $3)
        `,
        [
          idContactoCorreo,
          data.correo_electronico,
          idPersona
        ]
      );
    }


    // Guardar celular
    if (data.numero_celular) {

      const idContactoCelular =
        await this.generateId(
          client,
          'Metodo_Contacto',
          'Id_contacto',
          'CON'
        );

      await client.query(
        `
          INSERT INTO ${SCHEMA}."Metodo_Contacto" (
            "Id_contacto",
            "Tipo_Contacto",
            "Contacto",
            "Id_Persona"
          )
          VALUES ($1, 'CELULAR', $2, $3)
        `,
        [
          idContactoCelular,
          data.numero_celular,
          idPersona
        ]
      );
    }


    // Generar USUxx
    const idUsuario = await this.generateId(
      client,
      'Usuario',
      'Id_Usuario',
      'USU'
    );


    // Crear Usuario vinculado al Alumno
    const userQuery = `
      INSERT INTO ${SCHEMA}."Usuario" (
        "Id_Usuario",
        "Correo",
        "Password_Hash",
        "Estado_Usuario",
        "Id_Persona"
      )
      VALUES (
        $1,
        $2,
        $3,
        'PENDIENTE',
        $4
      )
    `;

    await client.query(
      userQuery,
      [
        idUsuario,
        data.correo_electronico,
        data.password_hash,
        idPersona
      ]
    );
    await client.query(
      `INSERT INTO ${SCHEMA}."Usuario_Rol" ("Id_Usuario", "Id_Rol") VALUES ($1, 'ROL04')`,
      [idUsuario]
    );


    return idAlumno;
  }


  // =========================================================
  // ACTUALIZAR ALUMNO EXISTENTE
  // =========================================================

  async updateEstudiante(
    id,
    data,
    client = db
  ) {

    const nombresArray =
      data.nombres.trim().split(/\s+/);

    const primerNombre =
      nombresArray.shift();

    const segundoNombre =
      nombresArray.length > 0
        ? nombresArray.join(' ')
        : null;


    const query = `
      UPDATE ${SCHEMA}."Persona" p
      SET
        "Nombre" = $1, "Segundo_Nombre" = $2, "Apellido_Paterno" = $3,
        "Apellido_Materno" = $4, "Fecha_Nacimiento" = $5, "Genero" = $6,
        "Direccion" = $7
      FROM ${SCHEMA}."Alumno" a
      WHERE a."Id_alumno" = $8 AND p."Id_Persona" = a."Id_Persona"
    `;

    await client.query(
      query,
      [
        primerNombre,
        segundoNombre,
        data.apellido_paterno,
        data.apellido_materno,
        data.fecha_nacimiento,
        data.genero,
        data.direccion,
        id
      ]
    );


    // Verificar si el alumno ya tiene Usuario
    const usuarioExistente =
      await client.query(
        `
          SELECT u."Id_Usuario"
          FROM ${SCHEMA}."Usuario" u
          JOIN ${SCHEMA}."Alumno" a ON a."Id_Persona" = u."Id_Persona"
          WHERE a."Id_alumno" = $1
          LIMIT 1
        `,
        [id]
      );


    if (usuarioExistente.rows.length > 0) {

      // Si ya tiene usuario, actualizar credenciales
      await client.query(
        `
          UPDATE ${SCHEMA}."Usuario" u
          SET
            "Correo" = $1,
            "Password_Hash" = $2
          FROM ${SCHEMA}."Alumno" a
          WHERE a."Id_alumno" = $3 AND u."Id_Persona" = a."Id_Persona"
        `,
        [
          data.correo_electronico,
          data.password_hash,
          id
        ]
      );

    } else {

      // Alumno presencial sin cuenta:
      // crearle Usuario al registrarse en el portal.
      const idUsuario =
        await this.generateId(
          client,
          'Usuario',
          'Id_Usuario',
          'USU'
        );

      await client.query(
        `
          INSERT INTO ${SCHEMA}."Usuario" (
            "Id_Usuario",
            "Correo",
            "Password_Hash",
            "Estado_Usuario",
            "Id_Persona"
          )
          VALUES (
            $1,
            $2,
            $3,
            'PENDIENTE',
            (SELECT "Id_Persona" FROM ${SCHEMA}."Alumno" WHERE "Id_alumno" = $4)
          )
        `,
        [
          idUsuario,
          data.correo_electronico,
          data.password_hash,
          id
        ]
      );
      await client.query(
        `INSERT INTO ${SCHEMA}."Usuario_Rol" ("Id_Usuario", "Id_Rol") VALUES ($1, 'ROL04')`,
        [idUsuario]
      );
    }
  }


  // =========================================================
  // MATRÍCULA
  // =========================================================

  async createMatricula(
    estudiante_id,
    observaciones_medicas,
    client = db
  ) {

    const idMatricula =
      await this.generateId(
        client,
        'Matricula',
        'Id_Matricula',
        'MAT'
      );

    const query = `
      INSERT INTO ${SCHEMA}."Matricula" (
        "Id_Matricula",
        "Fecha_Inscripcion",
        "Estado_Matricula",
        "Id_alumno"
      )
      VALUES (
        $1,
        CURRENT_DATE,
        'PENDIENTE',
        $2
      )
    `;

    await client.query(
      query,
      [
        idMatricula,
        estudiante_id
      ]
    );

    return idMatricula;
  }


  // =========================================================
  // DETALLES DE MATRÍCULA
  // =========================================================

  async addDisciplinasAMatricula(
    matricula_id,
    disciplinasIds,
    client = db
  ) {

    for (const disciplina_id of disciplinasIds) {

      // Buscar un horario asociado a la disciplina
      const horarioResult =
        await client.query(
          `
            SELECT "Id_DiscHorario"
            FROM ${SCHEMA}."Disciplina_Horario"
            WHERE "Id_Disciplina" = $1
            ORDER BY "Id_DiscHorario"
            LIMIT 1
          `,
          [disciplina_id]
        );


      if (horarioResult.rows.length === 0) {
        throw new Error(
          `La disciplina ${disciplina_id} no tiene un horario configurado.`
        );
      }


      const idDetalle =
        await this.generateId(
          client,
          'Detalles_Matricula',
          'Id_DetMatricula',
          'DET'
        );


      await client.query(
        `
          INSERT INTO ${SCHEMA}."Detalles_Matricula" (
            "Id_DetMatricula",
            "Id_Matricula",
            "Fecha_Inicio",
            "Fecha_Fin",
            "Id_DiscHorario"
          )
          VALUES (
            $1,
            $2,
            CURRENT_DATE,
            (CURRENT_DATE + INTERVAL '30 days')::date,
            $3
          )
        `,
        [
          idDetalle,
          matricula_id,
          horarioResult.rows[0].Id_DiscHorario
        ]
      );
    }
  }
}

module.exports = new MatriculasRepository();