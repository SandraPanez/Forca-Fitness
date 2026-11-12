// HU-26: cambiar precios y ofertas de matrícula (Director).
const {
  validarConfiguracionPrecio,
  mismaPromocion
} = require('../../../public/js/precios-promociones');

function errorConEstado(mensaje, status, extra = {}) {
  return Object.assign(new Error(mensaje), { status, ...extra });
}

function validarIdDisciplina(idDisciplina) {
  if (typeof idDisciplina !== 'string' || !idDisciplina.trim() || idDisciplina.length > 10) {
    throw errorConEstado('La disciplina seleccionada no es válida.', 400);
  }
}

function crearServicioPreciosDisciplinas({ repository, database }) {
  return {
    // T1: precio base y promoción actual de todas las disciplinas.
    async listarPrecios() {
      return repository.listarPreciosDisciplinas();
    },

    // T1: precio base y promoción actual de una disciplina.
    async obtenerPrecio(idDisciplina) {
      validarIdDisciplina(idDisciplina);
      const disciplina = await repository.obtenerPrecioDisciplina(idDisciplina);
      if (!disciplina) throw errorConEstado('La disciplina no existe.', 404);
      return disciplina;
    },

    // T6: guarda precio y promoción. Solo afecta a matrículas futuras: antes de
    // cambiar la disciplina se congela el precio de las matrículas ya registradas.
    async actualizarPrecio(idDisciplina, entrada = {}) {
      validarIdDisciplina(idDisciplina);

      const validacion = validarConfiguracionPrecio(entrada);
      if (!validacion.valido) {
        throw errorConEstado('Revisa los datos ingresados.', 400, { errores: validacion.errores });
      }
      const nuevo = validacion.datos;

      const client = await database.pool.connect();
      try {
        await client.query('BEGIN');

        const anterior = await repository.obtenerPrecioDisciplina(idDisciplina, client, { bloquear: true });
        if (!anterior) throw errorConEstado('La disciplina no existe.', 404);

        if (anterior.tarifa === nuevo.tarifa && mismaPromocion(anterior.promocion, nuevo.promocion)) {
          throw errorConEstado('No hay cambios para guardar.', 409);
        }

        const matriculasCongeladas =
          await repository.congelarPrecioMatriculasRegistradas(idDisciplina, client);
        await repository.actualizarPrecioDisciplina(idDisciplina, nuevo, client);
        const actual = await repository.obtenerPrecioDisciplina(idDisciplina, client);

        await client.query('COMMIT');
        return { anterior, actual, matriculas_con_precio_conservado: matriculasCongeladas };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

module.exports = { crearServicioPreciosDisciplinas };
