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
        COALESCE(NULLIF("Tarifa", 0), tarifa, 0) AS tarifa
      FROM ${SCHEMA}."Disciplina"
      ORDER BY "Nombre_Disciplina" ASC
    `;

    const result = await db.query(query);
    return result.rows;
  }

  async getResumenMatricula(id_matricula, client = db) {
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
    const result = await client.query(query, [id_matricula]);
    return result.rows[0];
  }

  async getMatriculaPendientePorAlumno(alumnoId, client = db) {
    const result = await client.query(`
      SELECT m."Id_Matricula" AS matricula
      FROM ${SCHEMA}."Matricula" m
      WHERE m."Id_alumno" = $1
        AND UPPER(m."Estado_Matricula") IN ('PENDIENTE', 'PENDIENTE DE CONFIRMACIÓN')
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

  async countInscritosPorHorario(id_disc_horario, client = db, excluirAlumno = null) {
    const query = `
      SELECT COUNT(DISTINCT m."Id_alumno") AS total
      FROM ${SCHEMA}."Detalles_Matricula" dm
      JOIN ${SCHEMA}."Matricula" m ON m."Id_Matricula" = dm."Id_Matricula"
      WHERE dm."Id_DiscHorario" = $1
        AND dm."Fecha_Fin" >= CURRENT_DATE
        AND UPPER(m."Estado_Matricula") IN ('ACTIVA', 'ACTIVO', 'PENDIENTE', 'PENDIENTE DE CONFIRMACIÓN')
        AND ($2::VARCHAR IS NULL OR m."Id_alumno" <> $2)
    `;

    const result = await client.query(query, [id_disc_horario, excluirAlumno]);

    return parseInt(result.rows[0].total, 10);
  }

  async getDisciplinaById(id_disciplina) {
    const query = `
      SELECT
        "Id_Disciplinas" AS id,
        "Nombre_Disciplina" AS nombre,
        "Descripcion" AS descripcion,
        COALESCE(NULLIF("Tarifa", 0), tarifa, 0) AS tarifa
      FROM ${SCHEMA}."Disciplina"
      WHERE "Id_Disciplinas" = $1
    `;
    const result = await db.query(query, [id_disciplina]);
    return result.rows[0] || null;
  }

  async countInscritosPorHorarioYPeriodo(id_disc_horario, fechaInicioStr, fechaFinStr) {
    const query = `
      SELECT COUNT(DISTINCT dm."Id_DetMatricula") AS total
      FROM ${SCHEMA}."Detalles_Matricula" dm
      JOIN ${SCHEMA}."Matricula" m ON m."Id_Matricula" = dm."Id_Matricula"
      LEFT JOIN ${SCHEMA}."Pago" p ON p."Id_Matricula" = m."Id_Matricula"
      WHERE dm."Id_DiscHorario" = $1
        AND dm."Fecha_Inicio" <= $3::date
        AND dm."Fecha_Fin" >= $2::date
        AND m."Estado_Matricula" != 'Anulada'
        AND (
          m."Estado_Matricula" IN ('Activa', 'Reservada')
          OR p."Estado_Pago" = 'APROBADO'
        )
    `;
    const result = await db.query(query, [id_disc_horario, fechaInicioStr, fechaFinStr]);
    return parseInt(result.rows[0].total, 10);
  }

  async countReservasPorDisciplinaYPeriodo(id_disciplina, fechaInicioStr, fechaFinStr) {
    const query = `
      SELECT COUNT(DISTINCT m."Id_Matricula") AS total
      FROM ${SCHEMA}."Matricula" m
      JOIN ${SCHEMA}."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
      JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      LEFT JOIN ${SCHEMA}."Pago" p ON p."Id_Matricula" = m."Id_Matricula"
      WHERE dh."Id_Disciplina" = $1
        AND dm."Fecha_Inicio" <= $3::date
        AND dm."Fecha_Fin" >= $2::date
        AND m."Estado_Matricula" != 'Anulada'
        AND (
          m."Estado_Matricula" = 'Reservada'
          OR (p."Estado_Pago" = 'APROBADO' AND (
            m."Fecha_Inscripcion" < dm."Fecha_Inicio"
            OR EXTRACT(MONTH FROM dm."Fecha_Inicio") > EXTRACT(MONTH FROM m."Fecha_Inscripcion")
            OR EXTRACT(YEAR FROM dm."Fecha_Inicio") > EXTRACT(YEAR FROM m."Fecha_Inscripcion")
          ))
        )
    `;
    const result = await db.query(query, [id_disciplina, fechaInicioStr, fechaFinStr]);
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
        AND SUBSTRING("${columna}" FROM ${posicionInicio}) ~ '^[0-9]+$'
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
         OR ($1 = 'CE' AND UPPER("Tipo_Documento") LIKE '%EXTRANJER%')
         OR (UPPER($1) LIKE '%EXTRANJER%' AND UPPER("Tipo_Documento") = 'CE')
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

  async findEstudianteByCorreo(correo) {
    if (!correo) return null;
    const query = `
      SELECT
        a."Id_alumno" AS id
      FROM ${SCHEMA}."Alumno" a
      JOIN ${SCHEMA}."Persona" p ON p."Id_Persona" = a."Id_Persona"
      JOIN ${SCHEMA}."Usuario" u ON u."Id_Persona" = p."Id_Persona"
      WHERE LOWER(u."Correo") = LOWER($1)
      LIMIT 1
    `;
    const result = await db.query(query, [correo]);
    return result.rows[0] || null;
  }


  async createEstudiante(data, client = db) {

    // Buscar tipo de documento real
    const docQuery = `
      SELECT "Id_Documento"
      FROM ${SCHEMA}."Documento_Identificacion"
      WHERE UPPER("Tipo_Documento") = UPPER($1)
         OR ($1 = 'CE' AND UPPER("Tipo_Documento") LIKE '%EXTRANJER%')
         OR (UPPER($1) LIKE '%EXTRANJER%' AND UPPER("Tipo_Documento") = 'CE')
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


    let genero = 'OTRO';
    if (data.genero) {
      const g = data.genero.trim().toUpperCase();
      if (g.startsWith('M')) genero = 'M';
      else if (g.startsWith('F')) genero = 'F';
      else genero = g.substring(0, 6);
    }
    const direccion = (data.direccion || 'Sin direccion').substring(0, 50);
    const apPaterno = (data.apellido_paterno || '').substring(0, 20);
    const apMaterno = (data.apellido_materno || '').substring(0, 20);

    const idPersona = await this.generateId(client, 'Persona', 'Id_Persona', 'PERALU');
    await client.query(`
      INSERT INTO ${SCHEMA}."Persona" (
        "Id_Persona", "Nombre", "Segundo_Nombre", "Apellido_Paterno",
        "Apellido_Materno", "Fecha_Nacimiento", "Genero", "Direccion",
        "Numero_Documento", "Id_Documento"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      idPersona, primerNombre, segundoNombre, apPaterno,
      apMaterno, data.fecha_nacimiento, genero,
      direccion, data.numero_documento, idDocumento
    ]);

    const query = `
      INSERT INTO ${SCHEMA}."Alumno" (
        "Id_alumno", "Estado_Alumno", "Condicion", "Id_Persona"
      ) VALUES ($1, 'ACTIVO', 'Ninguna', $2)
    `;

    await client.query(query, [idAlumno, idPersona]);


    await this.guardarContactos(idPersona, data, client);


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

  async guardarContactos(idPersona, datos, client) {
    for (const [tipo, campo] of [['CORREO', 'correo_electronico'], ['CELULAR', 'numero_celular']]) {
      if (datos[campo] === undefined) continue;
      if (typeof datos[campo] !== 'string') throw new Error('El contacto debe ser texto.');
      const valor = datos[campo].trim();
      if (tipo === 'CELULAR' && valor && !/^\d{9}$/.test(valor)) {
        throw new Error('El número de celular debe tener 9 dígitos.');
      }
      const actualizado = await client.query(`
        UPDATE ${SCHEMA}."Metodo_Contacto"
        SET "Contacto" = $1, "Tipo_Contacto" = $2
        WHERE "Id_Persona" = $3 AND UPPER("Tipo_Contacto") = $2
        RETURNING "Id_contacto"
      `, [valor, tipo, idPersona]);
      if (!actualizado.rows.length && valor) {
        const idContacto = await this.generateId(client, 'Metodo_Contacto', 'Id_contacto', 'CON');
        await client.query(`
          INSERT INTO ${SCHEMA}."Metodo_Contacto" ("Id_contacto", "Tipo_Contacto", "Contacto", "Id_Persona")
          VALUES ($1, $2, $3, $4)
        `, [idContacto, tipo, valor, idPersona]);
      }
    }
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


    let genero = 'OTRO';
    if (data.genero) {
      const g = data.genero.trim().toUpperCase();
      if (g.startsWith('M')) genero = 'M';
      else if (g.startsWith('F')) genero = 'F';
      else genero = g.substring(0, 6);
    }
    const direccion = (data.direccion || 'Sin direccion').substring(0, 50);
    const apPaterno = (data.apellido_paterno || '').substring(0, 20);
    const apMaterno = (data.apellido_materno || '').substring(0, 20);

    const query = `
      UPDATE ${SCHEMA}."Persona" p
      SET
        "Nombre" = $1, "Segundo_Nombre" = $2, "Apellido_Paterno" = $3,
        "Apellido_Materno" = $4, "Fecha_Nacimiento" = $5, "Genero" = $6,
        "Direccion" = $7
      FROM ${SCHEMA}."Alumno" a
      WHERE a."Id_alumno" = $8 AND p."Id_Persona" = a."Id_Persona"
      RETURNING p."Id_Persona"
    `;

    const persona = await client.query(
      query,
      [
        primerNombre,
        segundoNombre,
        apPaterno,
        apMaterno,
        data.fecha_nacimiento,
        genero,
        direccion,
        id
      ]
    );
    if (!persona.rows[0]) throw new Error('Alumno no encontrado.');
    await this.guardarContactos(persona.rows[0].Id_Persona, data, client);


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

      // Si ya tiene usuario, actualizar correo y credenciales (si se proporcionó nueva contraseña)
      if (data.password_hash) {
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
        await client.query(
          `
            UPDATE ${SCHEMA}."Usuario" u
            SET
              "Correo" = $1
            FROM ${SCHEMA}."Alumno" a
            WHERE a."Id_alumno" = $2 AND u."Id_Persona" = a."Id_Persona"
          `,
          [
            data.correo_electronico,
            id
          ]
        );
      }

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
  // T_41 - CONSULTAR MATRÍCULAS DEL CLIENTE AUTENTICADO
  // =========================================================

  async getMatriculasPorUsuario(idUsuario) {
    const query = `
      SELECT
        m."Id_Matricula" AS id_matricula,
        m."Fecha_Inscripcion" AS fecha_inscripcion,
        m."Estado_Matricula" AS estado_matricula,
        a."Id_alumno" AS id_alumno,

        dm."Id_DetMatricula" AS id_detalle,
        dh."Id_DiscHorario" AS id_disc_horario,
        h."Dias" AS dias,
        h."Hora_Inicio" AS hora_inicio,
        h."Hora_Fin" AS hora_fin,
        d."Id_Disciplinas" AS id_disciplina,
        d."Nombre_Disciplina" AS disciplina,
        dm."Fecha_Inicio" AS fecha_inicio,
        dm."Fecha_Fin" AS fecha_fin,
        p."Monto" AS tarifa_congelada,
        MAX(CASE WHEN UPPER(m."Estado_Matricula") IN ('ACTIVA', 'ACTIVO', 'VENCIDA') THEN dm."Fecha_Fin" END)
          OVER (PARTITION BY a."Id_alumno", dh."Id_DiscHorario") AS fecha_fin_actual

      FROM ${SCHEMA}."Usuario" u

      JOIN ${SCHEMA}."Alumno" a
        ON a."Id_Persona" = u."Id_Persona"

      JOIN ${SCHEMA}."Matricula" m
        ON m."Id_alumno" = a."Id_alumno"

      LEFT JOIN ${SCHEMA}."Detalles_Matricula" dm
        ON dm."Id_Matricula" = m."Id_Matricula"

      LEFT JOIN ${SCHEMA}."Disciplina_Horario" dh
        ON dh."Id_DiscHorario" = dm."Id_DiscHorario"

      LEFT JOIN ${SCHEMA}."Disciplina" d
        ON d."Id_Disciplinas" = dh."Id_Disciplina"

      LEFT JOIN ${SCHEMA}."Pago" p
        ON p."Id_Matricula" = m."Id_Matricula"

      LEFT JOIN ${SCHEMA}."Horarios" h
        ON h."Id_Horario" = dh."Id_Horario"

      WHERE u."Id_Usuario" = $1

      ORDER BY
        m."Fecha_Inscripcion" DESC,
        m."Id_Matricula" DESC,
        d."Nombre_Disciplina" ASC
    `;

    const result = await db.query(query, [idUsuario]);

    return result.rows;
  }

  async getAlumnoPorUsuario(idUsuario, client = db) {
    const query = `
      SELECT
        a."Id_alumno" AS id_alumno,
        TO_CHAR(p."Fecha_Nacimiento", 'YYYY-MM-DD') AS fecha_nacimiento,
        u."Correo" AS correo,
        TRIM(p."Nombre" || ' ' || p."Apellido_Paterno" || ' ' || COALESCE(p."Apellido_Materno", '')) AS nombre_completo
      FROM ${SCHEMA}."Usuario" u
      JOIN ${SCHEMA}."Alumno" a ON a."Id_Persona" = u."Id_Persona"
      JOIN ${SCHEMA}."Persona" p ON p."Id_Persona" = u."Id_Persona"
      WHERE u."Id_Usuario" = $1
    `;
    const result = await client.query(query, [idUsuario]);
    return result.rows[0] || null;
  }


  // =========================================================
  // DETALLES DE MATRÍCULA
  // =========================================================

  async getDetalleParaRenovar(idUsuario, idDetalle, client) {
    const result = await client.query(`
      SELECT a."Id_alumno" AS id_alumno, dh."Id_DiscHorario" AS id_disc_horario,
        TO_CHAR(pe."Fecha_Nacimiento", 'YYYY-MM-DD') AS fecha_nacimiento,
        d."Nombre_Disciplina" AS disciplina, u."Correo" AS correo,
        TRIM(CONCAT_WS(' ', pe."Nombre", pe."Segundo_Nombre", pe."Apellido_Paterno", pe."Apellido_Materno")) AS nombre,
        vigencia.fecha_fin <= CURRENT_DATE + 3 AS puede_renovar,
        TO_CHAR(GREATEST(CURRENT_DATE, vigencia.fecha_fin + 1), 'YYYY-MM-DD') AS fecha_inicio,
        TO_CHAR(GREATEST(CURRENT_DATE, vigencia.fecha_fin + 1) + 29, 'YYYY-MM-DD') AS fecha_fin
      FROM ${SCHEMA}."Usuario" u
      JOIN ${SCHEMA}."Alumno" a ON a."Id_Persona" = u."Id_Persona"
      JOIN ${SCHEMA}."Persona" pe ON pe."Id_Persona" = a."Id_Persona"
      JOIN ${SCHEMA}."Matricula" m ON m."Id_alumno" = a."Id_alumno"
      JOIN ${SCHEMA}."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
      JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      JOIN ${SCHEMA}."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
      JOIN LATERAL (
        SELECT MAX(anterior."Fecha_Fin") AS fecha_fin
        FROM ${SCHEMA}."Detalles_Matricula" anterior
        JOIN ${SCHEMA}."Matricula" ma ON ma."Id_Matricula" = anterior."Id_Matricula"
        WHERE ma."Id_alumno" = a."Id_alumno" AND anterior."Id_DiscHorario" = dh."Id_DiscHorario"
          AND UPPER(ma."Estado_Matricula") IN ('ACTIVA', 'ACTIVO', 'VENCIDA')
      ) vigencia ON TRUE
      WHERE u."Id_Usuario" = $1 AND dm."Id_DetMatricula" = $2
        AND UPPER(u."Estado_Usuario") = 'ACTIVO'
        AND UPPER(m."Estado_Matricula") IN ('ACTIVA', 'ACTIVO', 'VENCIDA')
      FOR UPDATE OF a
    `, [idUsuario, idDetalle]);
    return result.rows[0] || null;
  }

  async addDetalleRenovacion(idMatricula, info, client) {
    const idDetalle = await this.generateId(client, 'Detalles_Matricula', 'Id_DetMatricula', 'DET');
    await client.query(`
      INSERT INTO ${SCHEMA}."Detalles_Matricula"
        ("Id_DetMatricula", "Id_Matricula", "Fecha_Inicio", "Fecha_Fin", "Id_DiscHorario")
      VALUES ($1, $2, $3::DATE, $4::DATE, $5)
    `, [idDetalle, idMatricula, info.fecha_inicio, info.fecha_fin, info.id_disc_horario]);
  }

  async addDisciplinasAMatricula(
    matricula_id,
    disciplinasIds,
    client = db,
    fechas = null
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

      const fechaInicio = fechas?.fecha_inicio || null;
      const fechaFin = fechas?.fecha_fin || null;

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
            COALESCE($4::date, CURRENT_DATE),
            COALESCE($5::date, (CURRENT_DATE + INTERVAL '30 days')::date),
            $3
          )
        `,
        [
          idDetalle,
          matricula_id,
          horarioResult.rows[0].Id_DiscHorario,
          fechaInicio,
          fechaFin
        ]
      );
    }
  }

  async verificarDisciplinaActivaOPendiente(idAlumno, idDisciplina, fechaInicioStr, fechaFinStr, client = db) {
    const query = `
      SELECT
        m."Id_Matricula" AS id_matricula,
        m."Estado_Matricula" AS estado_matricula,
        p."Estado_Pago" AS estado_pago,
        UPPER(mp."Nombre_Metodo") AS medio_pago,
        d."Nombre_Disciplina" AS disciplina
      FROM ${SCHEMA}."Matricula" m
      JOIN ${SCHEMA}."Detalles_Matricula" dm ON dm."Id_Matricula" = m."Id_Matricula"
      JOIN ${SCHEMA}."Disciplina_Horario" dh ON dh."Id_DiscHorario" = dm."Id_DiscHorario"
      JOIN ${SCHEMA}."Disciplina" d ON d."Id_Disciplinas" = dh."Id_Disciplina"
      LEFT JOIN ${SCHEMA}."Pago" p ON p."Id_Matricula" = m."Id_Matricula"
      LEFT JOIN ${SCHEMA}."Metodo_Pago" mp ON mp."Id_MPago" = p."Id_MPago"
      WHERE m."Id_alumno" = $1
        AND dh."Id_Disciplina" = $2
        AND m."Estado_Matricula" != 'Anulada'
        AND dm."Fecha_Inicio" <= $4::date
        AND dm."Fecha_Fin" >= $3::date
        AND (
          m."Estado_Matricula" IN ('Activa', 'Reservada')
          OR p."Estado_Pago" IN ('APROBADO', 'PENDIENTE')
          OR UPPER(m."Estado_Matricula") IN ('PENDIENTE', 'PENDIENTE DE CONFIRMACIÓN')
        )
      ORDER BY m."Fecha_Inscripcion" DESC
      LIMIT 1
    `;
    const result = await client.query(query, [idAlumno, idDisciplina, fechaInicioStr, fechaFinStr]);
    return result.rows[0] || null;
  }

  async activarReservasIniciadas() {
    const result = await db.query(`
      WITH activadas AS (
        UPDATE ${SCHEMA}."Matricula" m
        SET "Estado_Matricula" = 'Activa'
        WHERE m."Estado_Matricula" = 'Reservada'
          AND EXISTS (
            SELECT 1 FROM ${SCHEMA}."Detalles_Matricula" dm
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
          UPDATE ${SCHEMA}."Usuario" u
          SET "Estado_Usuario" = 'ACTIVO'
          FROM ${SCHEMA}."Alumno" a
          WHERE a."Id_alumno" = $1 AND u."Id_Persona" = a."Id_Persona"
        `, [row.Id_alumno]);
      }
    }

    return result.rows.length;
  }
}

module.exports = new MatriculasRepository();
