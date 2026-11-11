const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scriptPath = path.resolve(__dirname, '../../../public/js/comprobante.js');

async function cargarComprobante(datos) {
    const elementos = new Map();
    const obtenerElemento = (id) => {
        if (!elementos.has(id)) {
            elementos.set(id, {
                id,
                textContent: '',
                hidden: false,
                disabled: false,
                style: {},
                listeners: {},
                addEventListener(evento, callback) {
                    this.listeners[evento] = callback;
                }
            });
        }
        return elementos.get(id);
    };

    let inicializar;
    const sandbox = {
        URLSearchParams,
        encodeURIComponent,
        window: { location: { search: '?pago=PAG-TEST' } },
        document: {
            getElementById: obtenerElemento,
            addEventListener(evento, callback) {
                if (evento === 'DOMContentLoaded') inicializar = callback;
            }
        },
        authFetch: async () => ({
            ok: true,
            json: async () => ({ success: true, data: datos })
        })
    };

    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(scriptPath, 'utf8'), sandbox);
    await inicializar();
    return obtenerElemento;
}

describe('HU-15 PSW-298: comprobante digital en navegador', () => {
    it('presenta precio original, porcentaje descontado y total pagado', async () => {
        const obtenerElemento = await cargarComprobante({
            numero: 'CP-2026-0001',
            fecha: '11/11/2026',
            hora: '12:00:00',
            alumno: 'Alumno de prueba',
            documento: '12345678',
            disciplinas: 'Box',
            concepto: 'Mensualidad',
            metodo_pago: 'Efectivo',
            referencia: 'REC-001',
            total: 'S/ 96.00',
            total_letras: 'Noventa y seis soles',
            monto_original: 120,
            tipo_descuento: 'PORCENTAJE',
            valor_descuento: 20,
            monto_descuento: 24
        });

        assert.equal(obtenerElemento('detalle-descuento').hidden, false);
        assert.equal(obtenerElemento('precio-original-pago').textContent, 'S/ 120.00');
        assert.equal(obtenerElemento('descuento-aplicado-pago').textContent, ' (20%) - S/ 24.00');
        assert.equal(obtenerElemento('total-numero').textContent, 'S/ 96.00');
    });

    it('oculta el desglose si el pago no tuvo descuento', async () => {
        const obtenerElemento = await cargarComprobante({
            numero: 'CP-2026-0002',
            fecha: '11/11/2026',
            hora: '12:00:00',
            alumno: 'Alumno sin descuento',
            documento: '87654321',
            disciplinas: 'Box',
            concepto: 'Mensualidad',
            metodo_pago: 'Efectivo',
            referencia: 'REC-002',
            total: 'S/ 75.00',
            total_letras: 'Setenta y cinco soles',
            monto_original: 75,
            tipo_descuento: null,
            valor_descuento: null,
            monto_descuento: 0
        });

        assert.equal(obtenerElemento('detalle-descuento').hidden, true);
        assert.equal(obtenerElemento('total-numero').textContent, 'S/ 75.00');
    });
});
