// HU-26: pruebas unitarias (sin base de datos) de precios y promociones.
// Ejecutar: node --test src/modules/matriculas/disciplinas-precios.test.js
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const {
  validarConfiguracionPrecio,
  calcularPrecioVigente,
  MENSAJE_PROMOCION_UNICA
} = require('../../../public/js/precios-promociones');
const { crearServicioPreciosDisciplinas } = require('./disciplinas-precios.service');
const { crearControladorPreciosDisciplinas } = require('./disciplinas-precios.controller');
const { htmlTarjetaPrecio, filasResumenCambios } = require('../../../public/js/precios');
const { tienePermiso, PERMISOS } = require('../../shared/constants/permisos');

function crearDobles(disciplinaInicial = { id: 'DISC01', nombre: 'Capoeira', descripcion: 'Adultos', tarifa: 120, promocion: null }) {
  const llamadas = [];
  let disciplina = disciplinaInicial
    ? { ...disciplinaInicial, precio_vigente: calcularPrecioVigente(disciplinaInicial).precioFinal }
    : null;

  const client = {
    async query(sql) { llamadas.push(sql); return { rows: [] }; },
    release() { llamadas.push('RELEASE'); }
  };
  const database = { pool: { connect: async () => client } };
  const repository = {
    async listarPreciosDisciplinas() { return disciplina ? [disciplina] : []; },
    async obtenerPrecioDisciplina(id, cliente, opciones = {}) {
      llamadas.push(opciones.bloquear ? 'LEER_BLOQUEANDO' : 'LEER');
      return disciplina && disciplina.id === id ? { ...disciplina } : null;
    },
    async congelarPrecioMatriculasRegistradas(id, cliente) {
      assert.equal(cliente, client, 'el congelado debe ir en la misma transacción');
      llamadas.push('CONGELAR');
      return 3;
    },
    async actualizarPrecioDisciplina(id, datos, cliente) {
      assert.equal(cliente, client, 'la actualización debe ir en la misma transacción');
      llamadas.push('ACTUALIZAR');
      disciplina = { ...disciplina, ...datos, precio_vigente: calcularPrecioVigente(datos).precioFinal };
      return 1;
    }
  };

  return { llamadas, repository, servicio: crearServicioPreciosDisciplinas({ repository, database }) };
}

async function rechazaCon(promesa, status) {
  try {
    await promesa;
  } catch (error) {
    assert.equal(error.status, status);
    return error;
  }
  return assert.fail('Se esperaba un error');
}

function crearResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

describe('HU-26 · Validación de precio y promoción (CA4 / T4)', () => {
  it('1. acepta un precio válido', () => {
    const r = validarConfiguracionPrecio({ tarifa: '135.50', promocion: null });
    assert.equal(r.valido, true);
    assert.deepEqual(r.datos, { tarifa: 135.5, promocion: null });
  });

  it('2. rechaza precio 0 con mensaje en el campo precio', () => {
    const r = validarConfiguracionPrecio({ tarifa: 0 });
    assert.equal(r.valido, false);
    assert.equal(r.errores.tarifa, 'El precio base debe ser mayor que 0.');
  });

  it('3. rechaza precio negativo', () => {
    const r = validarConfiguracionPrecio({ tarifa: '-10' });
    assert.equal(r.valido, false);
    assert.equal(r.errores.tarifa, 'El precio base debe ser mayor que 0.');
  });

  it('4. rechaza campos obligatorios vacíos (precio, tipo, valor y texto)', () => {
    assert.equal(validarConfiguracionPrecio({ tarifa: '' }).errores.tarifa, 'El precio base es obligatorio.');
    assert.equal(validarConfiguracionPrecio({}).errores.tarifa, 'El precio base es obligatorio.');

    const r = validarConfiguracionPrecio({ tarifa: 120, promocion: { tipo: '', valor: '', texto: '  ' } });
    assert.equal(r.valido, false);
    assert.equal(r.errores.promocion_tipo, 'Selecciona el tipo de descuento.');
    assert.equal(r.errores.promocion_valor, 'El valor del descuento es obligatorio.');
    assert.equal(r.errores.promocion_texto, 'El texto de la promoción es obligatorio.');
  });

  it('rechaza precio no numérico o con más de dos decimales', () => {
    assert.equal(validarConfiguracionPrecio({ tarifa: 'abc' }).errores.tarifa, 'El precio base debe ser un número válido.');
    assert.equal(validarConfiguracionPrecio({ tarifa: '10.555' }).errores.tarifa, 'El precio base admite como máximo dos decimales.');
  });

  it('5. acepta descuentos válidos (porcentaje y monto fijo) y calcula el precio final', () => {
    const porcentaje = validarConfiguracionPrecio({
      tarifa: 120, promocion: { tipo: 'PORCENTAJE', valor: '20', texto: ' Verano 20% ' }
    });
    assert.equal(porcentaje.valido, true);
    assert.deepEqual(porcentaje.datos.promocion, { tipo: 'PORCENTAJE', valor: 20, texto: 'Verano 20%' });
    assert.equal(calcularPrecioVigente(porcentaje.datos).precioFinal, 96);

    const fijo = validarConfiguracionPrecio({
      tarifa: 110, promocion: { tipo: 'MONTO_FIJO', valor: 15.5, texto: 'Lanzamiento' }
    });
    assert.equal(fijo.valido, true);
    assert.equal(calcularPrecioVigente(fijo.datos).precioFinal, 94.5);
  });

  it('6. rechaza descuentos inválidos', () => {
    const casos = [
      [{ tipo: 'PORCENTAJE', valor: 150, texto: 'X' }, /no superar el 100%/],
      [{ tipo: 'PORCENTAJE', valor: 100, texto: 'X' }, /menor que 100%/],
      [{ tipo: 'PORCENTAJE', valor: 0, texto: 'X' }, /mayor que cero/],
      [{ tipo: 'PORCENTAJE', valor: -5, texto: 'X' }, /mayor que cero/],
      [{ tipo: 'PORCENTAJE', valor: 'diez', texto: 'X' }, /número válido/],
      [{ tipo: 'MONTO_FIJO', valor: 130, texto: 'X' }, /no puede superar el precio/],
      [{ tipo: 'MONTO_FIJO', valor: 120, texto: 'X' }, /menor que el precio base/],
      [{ tipo: 'MONTO_FIJO', valor: 10.123, texto: 'X' }, /dos decimales/]
    ];
    for (const [promocion, mensaje] of casos) {
      const r = validarConfiguracionPrecio({ tarifa: 120, promocion });
      assert.equal(r.valido, false, JSON.stringify(promocion));
      assert.match(r.errores.promocion_valor, mensaje, JSON.stringify(promocion));
    }

    const tipo = validarConfiguracionPrecio({ tarifa: 120, promocion: { tipo: 'AUMENTO', valor: 10, texto: 'X' } });
    assert.equal(tipo.errores.promocion_tipo, 'Selecciona un tipo de descuento válido.');

    const texto = validarConfiguracionPrecio({ tarifa: 120, promocion: { tipo: 'PORCENTAJE', valor: 10, texto: 'x'.repeat(41) } });
    assert.match(texto.errores.promocion_texto, /máximo 40 caracteres/);
  });

  it('7. rechaza múltiples descuentos activos (no acumulables)', () => {
    const dos = [
      { tipo: 'PORCENTAJE', valor: 10, texto: 'A' },
      { tipo: 'MONTO_FIJO', valor: 5, texto: 'B' }
    ];
    assert.equal(validarConfiguracionPrecio({ tarifa: 120, promocion: dos }).errores.promocion, MENSAJE_PROMOCION_UNICA);
    assert.equal(validarConfiguracionPrecio({ tarifa: 120, promociones: dos }).errores.promocion, MENSAJE_PROMOCION_UNICA);
    assert.equal(
      validarConfiguracionPrecio({ tarifa: 120, promocion: dos[0], promociones: [dos[1]] }).errores.promocion,
      MENSAJE_PROMOCION_UNICA
    );
  });
});

describe('HU-26 · Servicio de precios (T1 / T6)', () => {
  it('1. guarda un precio válido: congela matrículas registradas y luego actualiza, en una transacción', async () => {
    const { llamadas, servicio } = crearDobles();
    const r = await servicio.actualizarPrecio('DISC01', {
      tarifa: 150, promocion: { tipo: 'PORCENTAJE', valor: 10, texto: 'Temporada' }
    });

    assert.equal(r.anterior.tarifa, 120);
    assert.equal(r.actual.tarifa, 150);
    assert.equal(r.actual.precio_vigente, 135);
    assert.equal(r.matriculas_con_precio_conservado, 3);
    assert.deepEqual(llamadas, ['BEGIN', 'LEER_BLOQUEANDO', 'CONGELAR', 'ACTUALIZAR', 'LEER', 'COMMIT', 'RELEASE']);
  });

  it('2-4. no abre transacción ni guarda si el precio es 0, negativo o vacío', async () => {
    for (const tarifa of [0, -1, '']) {
      const { llamadas, servicio } = crearDobles();
      const error = await rechazaCon(servicio.actualizarPrecio('DISC01', { tarifa }), 400);
      assert.ok(error.errores.tarifa);
      assert.deepEqual(llamadas, []);
    }
  });

  it('7. rechaza varias promociones sin tocar la base', async () => {
    const { llamadas, servicio } = crearDobles();
    const error = await rechazaCon(servicio.actualizarPrecio('DISC01', {
      tarifa: 120,
      promociones: [{ tipo: 'PORCENTAJE', valor: 10, texto: 'A' }, { tipo: 'PORCENTAJE', valor: 5, texto: 'B' }]
    }), 400);
    assert.equal(error.errores.promocion, MENSAJE_PROMOCION_UNICA);
    assert.deepEqual(llamadas, []);
  });

  it('hace ROLLBACK y no congela nada si no hay cambios', async () => {
    const { llamadas, servicio } = crearDobles();
    await rechazaCon(servicio.actualizarPrecio('DISC01', { tarifa: '120.00', promocion: null }), 409);
    assert.deepEqual(llamadas, ['BEGIN', 'LEER_BLOQUEANDO', 'ROLLBACK', 'RELEASE']);
  });

  it('devuelve 404 si la disciplina no existe y 400 si el id no es válido', async () => {
    const { servicio } = crearDobles();
    await rechazaCon(servicio.actualizarPrecio('NOEXISTE', { tarifa: 100 }), 404);
    await rechazaCon(servicio.obtenerPrecio('NOEXISTE'), 404);
    await rechazaCon(servicio.obtenerPrecio('X'.repeat(11)), 400);
  });

  it('T1. obtiene precio base y promoción actual', async () => {
    const { servicio } = crearDobles({
      id: 'DISC05', nombre: 'Jiu Jitsu', tarifa: 140, promocion: { tipo: 'MONTO_FIJO', valor: 20, texto: 'Promo' }
    });
    const d = await servicio.obtenerPrecio('DISC05');
    assert.equal(d.tarifa, 140);
    assert.equal(d.precio_vigente, 120);
    assert.deepEqual(d.promocion, { tipo: 'MONTO_FIJO', valor: 20, texto: 'Promo' });
  });
});

describe('HU-26 · Controlador y permisos', () => {
  it('CA3. responde "Precio actualizado con éxito" al confirmar', async () => {
    const { servicio } = crearDobles();
    const controlador = crearControladorPreciosDisciplinas(servicio);
    const res = crearResponse();
    await controlador.actualizarPrecio({ params: { id: 'DISC01' }, body: { tarifa: 125 } }, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, 'Precio actualizado con éxito');
    assert.equal(res.body.data.actual.tarifa, 125);
  });

  it('CA4. devuelve los errores por campo para mostrarlos debajo de cada uno', async () => {
    const { servicio } = crearDobles();
    const controlador = crearControladorPreciosDisciplinas(servicio);
    const res = crearResponse();
    await controlador.actualizarPrecio({ params: { id: 'DISC01' }, body: { tarifa: 0 } }, res);
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.success, false);
    assert.equal(res.body.errors.tarifa, 'El precio base debe ser mayor que 0.');
  });

  it('solo el Director tiene el permiso GESTIONAR_PRECIOS', () => {
    assert.equal(tienePermiso(['DIRECTOR'], PERMISOS.GESTIONAR_PRECIOS), true);
    for (const rol of ['TESORERO', 'PROFESOR', 'ALUMNO']) {
      assert.equal(tienePermiso([rol], PERMISOS.GESTIONAR_PRECIOS), false, rol);
    }
  });
});

describe('HU-26 · Tarjeta y resumen (T5 / T7)', () => {
  it('10. la tarjeta muestra la etiqueta verde de promoción activa, precio final y botón Editar', () => {
    const html = htmlTarjetaPrecio({
      id: 'DISC01', nombre: 'Capoeira', descripcion: 'Adultos', tarifa: 120, precio_vigente: 96,
      promocion: { tipo: 'PORCENTAJE', valor: 20, texto: 'Verano <20%>' }
    });
    assert.match(html, /<span class="promo-tag">Verano &lt;20%&gt;<\/span>/);
    assert.match(html, /S\/ 96\.00/);
    assert.match(html, /precio-card-base[^>]*>S\/ 120\.00/);
    assert.match(html, /data-editar="DISC01">Editar</);
  });

  it('10. sin promoción no muestra etiqueta verde', () => {
    const html = htmlTarjetaPrecio({ id: 'DISC03', nombre: 'Boxeo', tarifa: 110, precio_vigente: 110, promocion: null });
    assert.doesNotMatch(html, /promo-tag/);
    assert.match(html, /Sin promoción activa/);
  });

  it('CA2. el resumen muestra precio y promoción anterior y nuevo', () => {
    const filas = filasResumenCambios(
      { tarifa: 120, promocion: null },
      { tarifa: 130, promocion: { tipo: 'MONTO_FIJO', valor: 10, texto: 'Promo' } }
    );
    assert.deepEqual(filas.map(f => [f.campo, f.anterior, f.nuevo, f.cambio]), [
      ['Precio base', 'S/ 120.00', 'S/ 130.00', true],
      ['Promoción / descuento', 'Sin promoción', 'Promo (S/ 10.00 de descuento)', true],
      ['Precio para nuevas matrículas', 'S/ 120.00', 'S/ 120.00', false]
    ]);
  });
});
