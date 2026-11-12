const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const db = require('../../shared/config/database');
const pagosRepository = require('./pagos.repository');
const pagosService = require('./pagos.service');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

function cargarBalanceFrontend() {
    const jsBalance = fs.readFileSync(path.join(PUBLIC_DIR, 'js/balance.js'), 'utf8');
    const elementos = new Map();
    const obtenerElemento = (id) => {
        if (!elementos.has(id)) {
            elementos.set(id, { id, textContent: '', innerHTML: '', value: '', style: {} });
        }
        return elementos.get(id);
    };
    const sandbox = {
        verificarSesion: () => true,
        obtenerUsuario: () => ({ roles: ['TESORERO'] }),
        obtenerRolesUsuario: usuario => usuario.roles,
        paginaDeInicio: () => '/balance.html',
        alert: () => {},
        window: { location: { pathname: '/balance.html', href: '/balance.html' } },
        document: {
            getElementById: obtenerElemento,
            addEventListener: () => {}
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(jsBalance, sandbox);
    return { sandbox, obtenerElemento };
}

describe('HU-15 PSW-297: descuentos en el balance de caja', () => {
    it('suma el total cobrado y conserva el precio y el descuento para auditoría', async () => {
        const resumenOriginal = pagosRepository.obtenerResumenBalancePorPeriodo;
        const operacionesOriginal = pagosRepository.obtenerBalancePorPeriodo;
        pagosRepository.obtenerResumenBalancePorPeriodo = async () => ({
            total_ingresos: '165.00',
            total_operaciones: 2,
            ingresos_efectivo: '165.00',
            operaciones_efectivo: 2,
            ingresos_mercado_pago: '0.00',
            operaciones_mercado_pago: 0,
            operaciones_pendientes: 0,
            operaciones_no_completadas: 0
        });
        pagosRepository.obtenerBalancePorPeriodo = async () => [
            {
                id_pago: 'PAG-DESC',
                id_registro: 'REG-DESC',
                id_matricula: 'MAT-DESC',
                monto: '85.00',
                monto_original: '100.00',
                tipo_descuento: 'PORCENTAJE',
                valor_descuento: '15.00',
                monto_descuento: '15.00',
                estado_pago: 'APROBADO',
                fecha_operacion: '2026-11-03T15:00:00.000Z',
                medio_pago: 'EFECTIVO',
                alumno: 'Alumno con descuento',
                dni: '12345678'
            },
            {
                id_pago: 'PAG-SIN-DESC',
                id_matricula: 'MAT-SIN-DESC',
                monto: '80.00',
                estado_pago: 'APROBADO',
                fecha_operacion: '2026-11-04T15:00:00.000Z',
                medio_pago: 'EFECTIVO',
                alumno: 'Alumno sin descuento',
                dni: '87654321'
            }
        ];

        try {
            const resultado = await pagosService.obtenerBalanceFinanciero({
                fechaInicio: '2026-11-01',
                fechaFin: '2026-11-30'
            });
            const [conDescuento, sinDescuento] = resultado.operaciones;

            assert.equal(resultado.resumen.total_ingresos, 165);
            assert.equal(resultado.resumen.cuadra_con_bd, true);
            assert.equal(conDescuento.monto_original, 100);
            assert.equal(conDescuento.tipo_descuento, 'PORCENTAJE');
            assert.equal(conDescuento.valor_descuento, 15);
            assert.equal(conDescuento.monto_descuento, 15);
            assert.equal(conDescuento.monto, 85);
            assert.equal(sinDescuento.monto_original, 80);
            assert.equal(sinDescuento.monto_descuento, 0);
            assert.equal(sinDescuento.monto, 80);
        } finally {
            pagosRepository.obtenerResumenBalancePorPeriodo = resumenOriginal;
            pagosRepository.obtenerBalancePorPeriodo = operacionesOriginal;
        }
    });

    it('consulta los campos de descuento y agrega al balance el importe realmente cobrado', async () => {
        const queryOriginal = db.query;
        const consultas = [];
        db.query = async (text, params) => {
            consultas.push({ text, params });
            return { rows: [] };
        };

        try {
            await pagosRepository.obtenerResumenBalancePorPeriodo({
                fechaInicio: '2026-11-01',
                fechaFin: '2026-11-30'
            });
            await pagosRepository.obtenerBalancePorPeriodo({
                fechaInicio: '2026-11-01',
                fechaFin: '2026-11-30'
            });
        } finally {
            db.query = queryOriginal;
        }

        assert.match(consultas[0].text, /COALESCE\(cobro\."Monto", p\."Monto"\)/);
        assert.match(consultas[0].text, /SELECT rc\."Fecha_Hora", rc\."Monto"/);
        assert.match(consultas[1].text, /cobro\."Monto_Original"/);
        assert.match(consultas[1].text, /cobro\."Tipo_Descuento"/);
        assert.match(consultas[1].text, /cobro\."Valor_Descuento"/);
        assert.match(consultas[1].text, /cobro\."Monto_Descuento"/);
    });

    it('muestra precio original, descuento y total cobrado en la tabla y el detalle', () => {
        const { sandbox, obtenerElemento } = cargarBalanceFrontend();
        const operacion = {
            id_pago: 'PAG-DESC',
            id_registro: 'REG-DESC',
            id_matricula: 'MAT-DESC',
            alumno: 'Alumno con descuento',
            dni: '12345678',
            tipo_documento: 'DNI',
            monto_original: 100,
            tipo_descuento: 'PORCENTAJE',
            valor_descuento: 15,
            monto_descuento: 15,
            monto: 85,
            medio_pago: 'EFECTIVO',
            estado_pago: 'APROBADO',
            fecha_operacion: '2026-11-03T15:00:00.000Z'
        };

        sandbox.renderizarTablaOperaciones([operacion], false);
        const htmlTabla = obtenerElemento('balance-tbody').innerHTML;
        assert.match(htmlTabla, /S\/ 100\.00/);
        assert.match(htmlTabla, /S\/ 15\.00/);
        assert.match(htmlTabla, /15%/);
        assert.match(htmlTabla, /S\/ 85\.00/);
        assert.equal((htmlTabla.match(/<td(?:\s[^>]*)?>/g) || []).length, 9);
        assert.equal(obtenerElemento('tfoot-total-monto').textContent, 'S/ 85.00');

        sandbox.poblarModalDetalle(operacion);
        assert.equal(obtenerElemento('det-monto-original').textContent, 'S/ 100.00');
        assert.equal(obtenerElemento('det-monto-descuento').textContent, 'S/ 15.00 (15%)');
        assert.equal(obtenerElemento('det-monto').textContent, 'S/ 85.00');
    });
});
