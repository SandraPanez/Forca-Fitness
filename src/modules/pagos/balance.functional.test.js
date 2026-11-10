const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const db = require('../../shared/config/database');
const ROLES = require('../../shared/constants/roles');
const { PERMISOS, tienePermiso } = require('../../shared/constants/permisos');
const { calcularBalanceCompleto } = require('./balance.calculator');
const pagosService = require('./pagos.service');
const pagosRoutes = require('./pagos.routes');

const PUBLIC_DIR = path.resolve(__dirname, '../../../public');

function cargarContextoFrontend(rolUsuario = 'TESORERO', usuarioSesion = true) {
    const htmlBalance = fs.readFileSync(path.join(PUBLIC_DIR, 'balance.html'), 'utf8');
    const jsAuth = fs.readFileSync(path.join(PUBLIC_DIR, 'js/auth.js'), 'utf8');
    const jsBalance = fs.readFileSync(path.join(PUBLIC_DIR, 'js/balance.js'), 'utf8');

    const elementos = new Map();
    const obtenerOcrearEl = (id) => {
        if (!elementos.has(id)) {
            elementos.set(id, {
                id,
                textContent: '',
                innerHTML: '',
                value: '',
                hidden: false,
                disabled: false,
                className: '',
                dataset: {},
                style: {},
                attributes: {},
                setAttribute(k, v) { this.attributes[k] = v; },
                getAttribute(k) { return this.attributes[k]; },
                insertAdjacentHTML: () => {},
                append: () => {},
                querySelector: () => obtenerOcrearEl(`${id}_child`),
                classList: {
                    _set: new Set(),
                    add(c) { this._set.add(c); },
                    remove(c) { this._set.delete(c); },
                    toggle(c, f) { if (f) this._set.add(c); else this._set.delete(c); },
                    contains(c) { return this._set.has(c); }
                },
                addEventListener: () => {},
                focus: () => {}
            });
        }
        return elementos.get(id);
    };

    const storage = new Map();
    if (usuarioSesion) {
        storage.set('token', 'token-test');
        storage.set('usuario', JSON.stringify({
            id: 'USU_TEST',
            nombre: 'Usuario Prueba',
            roles: Array.isArray(rolUsuario) ? rolUsuario : [rolUsuario]
        }));
    }

    const alertas = [];
    const domListeners = {};
    const sandbox = {
        console,
        Date,
        Intl,
        Math,
        Number,
        String,
        Array,
        Boolean,
        Object,
        Set,
        Map,
        URLSearchParams,
        alert: (msg) => alertas.push(msg),
        fetch: async () => ({ ok: true, json: async () => ({ success: true, data: {} }) }),
        window: { location: { href: '/balance.html', pathname: '/balance.html', hash: '', search: '' } },
        localStorage: {
            getItem: (k) => storage.get(k) ?? null,
            setItem: (k, v) => storage.set(k, String(v)),
            removeItem: (k) => storage.delete(k)
        },
        document: {
            body: { dataset: { menu: '/balance.html' }, style: {} },
            getElementById: obtenerOcrearEl,
            querySelectorAll: () => [],
            createElement: () => obtenerOcrearEl(`dyn_${Math.random()}`),
            addEventListener: (ev, fn) => { domListeners[ev] = fn; }
        }
    };

    vm.createContext(sandbox);
    vm.runInContext(jsAuth, sandbox);
    vm.runInContext(jsBalance, sandbox);
    const menuPorRol = vm.runInContext('MENU_POR_ROL', sandbox);

    return { htmlBalance, sandbox, menuPorRol, elementos, obtenerOcrearEl, alertas, domListeners };
}

describe('HU-16: Pruebas funcionales de consulta del balance financiero', () => {
    let server;
    let baseUrl;
    let tokenTesorero;
    let tokenDirector;
    let dbConectada = false;

    before(async () => {
        dbConectada = await db.checkConnection();
        assert.equal(dbConectada, true, 'Se requiere conexión activa a PostgreSQL para las pruebas funcionales');

        const usersRes = await db.query(`
            SELECT u."Id_Usuario", r."Rol_Cargo"
            FROM "Academia Forca&Fitness"."Usuario" u
            JOIN "Academia Forca&Fitness"."Usuario_Rol" ur ON ur."Id_Usuario" = u."Id_Usuario"
            JOIN "Academia Forca&Fitness"."Rol" r ON r."Id_Rol" = ur."Id_Rol"
            WHERE UPPER(u."Estado_Usuario") = 'ACTIVO'
        `);

        const tesorero = usersRes.rows.find(u => u.Rol_Cargo.toUpperCase() === 'TESORERO');
        const director = usersRes.rows.find(u => u.Rol_Cargo.toUpperCase() === 'DIRECTOR');
        assert.ok(tesorero, 'Debe existir un usuario TESORERO activo en la BD');
        assert.ok(director, 'Debe existir un usuario DIRECTOR activo en la BD');

        tokenTesorero = jwt.sign({ sub: tesorero.Id_Usuario }, process.env.JWT_SECRET, { expiresIn: '10m' });
        tokenDirector = jwt.sign({ sub: director.Id_Usuario }, process.env.JWT_SECRET, { expiresIn: '10m' });

        const app = express();
        app.use(express.json());
        app.use('/api/pagos', pagosRoutes);
        server = app.listen(0);
        baseUrl = `http://127.0.0.1:${server.address().port}/api/pagos/balance`;
    });

    after(async () => {
        if (server) {
            await new Promise(resolve => server.close(resolve));
        }
        await db.pool.end();
    });

    describe('CA 1 y Control de Acceso: Exclusivo para rol Tesorero', () => {
        it('Permiso CONSULTAR_BALANCE asignado exclusivamente al rol TESORERO', () => {
            assert.equal(tienePermiso([ROLES.TESORERO], PERMISOS.CONSULTAR_BALANCE), true);
            assert.equal(tienePermiso([ROLES.DIRECTOR], PERMISOS.CONSULTAR_BALANCE), false);
            assert.equal(tienePermiso([ROLES.PROFESOR], PERMISOS.CONSULTAR_BALANCE), false);
            assert.equal(tienePermiso([ROLES.ALUMNO], PERMISOS.CONSULTAR_BALANCE), false);
        });

        it('Menú y botón "Balance financiero" en Tesorería visibles solo para Tesorero', () => {
            const { menuPorRol } = cargarContextoFrontend('TESORERO');
            const htmlTesoreria = fs.readFileSync(path.join(PUBLIC_DIR, 'tesoreria.html'), 'utf8');
            const jsTesoreria = fs.readFileSync(path.join(PUBLIC_DIR, 'js/tesoreria.js'), 'utf8');

            assert.ok(menuPorRol.TESORERO.some(([txt, href]) => txt === 'Balance financiero' && href === '/balance.html'));
            assert.equal(menuPorRol.DIRECTOR.some(([, href]) => href === '/balance.html'), false);
            assert.ok(htmlTesoreria.includes('id="btn-balance-financiero"') && htmlTesoreria.includes('href="/balance.html"'));
            assert.ok(jsTesoreria.includes("rolesUsuario.includes('TESORERO')"));
        });

        it('Guardián de vista balance.html permite a TESORERO y expulsa a DIRECTOR / sin sesión', () => {
            const okTes = cargarContextoFrontend('TESORERO', true);
            assert.equal(okTes.sandbox.window.location.href, '/balance.html');
            assert.equal(okTes.alertas.length, 0);

            const noDir = cargarContextoFrontend('DIRECTOR', true);
            assert.equal(noDir.sandbox.window.location.href, '/alumnos.html');
            assert.equal(noDir.alertas.length, 1);

            const noAuth = cargarContextoFrontend('TESORERO', false);
            assert.equal(noAuth.sandbox.window.location.href, '/login.html');
        });

        it('API rechaza peticiones sin token (401) o con rol distinto a Tesorero (403)', async () => {
            const rUnauth = await fetch(`${baseUrl}?fechaInicio=2026-11-01&fechaFin=2026-11-30`);
            assert.equal(rUnauth.status, 401);

            const rDir = await fetch(`${baseUrl}?fechaInicio=2026-11-01&fechaFin=2026-11-30`, {
                headers: { Authorization: `Bearer ${tokenDirector}` }
            });
            assert.equal(rDir.status, 403);
        });
    });

    describe('CA 2: Filtro por periodo, cálculo del balance y listado de operaciones', () => {
        it('Rechaza rango invertido, fecha inexistente o medio inválido con HTTP 400', async () => {
            const headers = { Authorization: `Bearer ${tokenTesorero}` };

            const rInvertido = await fetch(`${baseUrl}?fechaInicio=2026-11-30&fechaFin=2026-11-01`, { headers });
            assert.equal(rInvertido.status, 400);
            const bInv = await rInvertido.json();
            assert.equal(bInv.success, false);

            const rInexistente = await fetch(`${baseUrl}?fechaInicio=2026-02-30&fechaFin=2026-03-01`, { headers });
            assert.equal(rInexistente.status, 400);

            const rMedio = await fetch(`${baseUrl}?fechaInicio=2026-11-01&fechaFin=2026-11-30&medio=CRIPTOMONEDA`, { headers });
            assert.equal(rMedio.status, 400);
        });

        it('Consulta periodo Noviembre 2026 en PostgreSQL y concilia totales, desgloses y listado', async () => {
            const headers = { Authorization: `Bearer ${tokenTesorero}` };
            const res = await fetch(`${baseUrl}?fechaInicio=2026-11-01&fechaFin=2026-11-30`, { headers });
            assert.equal(res.status, 200);

            const payload = await res.json();
            assert.equal(payload.success, true);

            const { periodo, resumen, desglose, operaciones } = payload.data;
            assert.deepEqual(periodo, { fechaInicio: '2026-11-01', fechaFin: '2026-11-30', medio: null });
            assert.equal(resumen.cuadra_con_bd, true);
            assert.equal(resumen.total_operaciones, operaciones.length);
            assert.ok(resumen.total_ingresos >= 270);
            assert.equal(
                Number((resumen.ingresos_efectivo + resumen.ingresos_mercado_pago).toFixed(2)),
                resumen.total_ingresos
            );
            assert.ok(Array.isArray(desglose.conceptos));
            assert.ok(Array.isArray(desglose.flujo_diario));

            // Verificar cálculo sobre la vista UI
            const { sandbox, obtenerOcrearEl } = cargarContextoFrontend('TESORERO');
            sandbox.actualizarBannerPeriodo(periodo, resumen);
            sandbox.actualizarTarjetasResumen(resumen, periodo);
            sandbox.renderizarDesgloseBalance(resumen, desglose);
            sandbox.renderizarTablaOperaciones(operaciones, false);

            assert.equal(obtenerOcrearEl('kpi-total-ingresos').textContent, `S/ ${resumen.total_ingresos.toFixed(2)}`);
            assert.equal(obtenerOcrearEl('tfoot-total-monto').textContent, `S/ ${resumen.total_ingresos.toFixed(2)}`);
            assert.equal(obtenerOcrearEl('balance-tfoot').style.display, '');
        });

        it('Filtra correctamente por medio de pago (EFECTIVO y MERCADO_PAGO) y maneja periodo vacío', async () => {
            const headers = { Authorization: `Bearer ${tokenTesorero}` };

            const rCash = await fetch(`${baseUrl}?fechaInicio=2026-11-01&fechaFin=2026-11-30&medio=EFECTIVO`, { headers });
            const dCash = (await rCash.json()).data;
            assert.equal(rCash.status, 200);
            assert.ok(dCash.operaciones.every(op => op.medio_pago === 'EFECTIVO'));
            assert.equal(dCash.resumen.ingresos_mercado_pago, 0);

            const rMp = await fetch(`${baseUrl}?fechaInicio=2026-11-01&fechaFin=2026-11-30&medio=MERCADO_PAGO`, { headers });
            const dMp = (await rMp.json()).data;
            assert.equal(rMp.status, 200);
            assert.ok(dMp.operaciones.every(op => op.medio_pago === 'MERCADO_PAGO'));
            assert.equal(dMp.resumen.ingresos_efectivo, 0);

            const rVacio = await fetch(`${baseUrl}?fechaInicio=2025-01-01&fechaFin=2025-01-31`, { headers });
            const dVacio = (await rVacio.json()).data;
            assert.equal(rVacio.status, 200);
            assert.equal(dVacio.resumen.total_ingresos, 0);
            assert.equal(dVacio.resumen.total_operaciones, 0);
            assert.deepEqual(dVacio.operaciones, []);
        });

        it('Motor de cálculo evita errores de coma flotante y excluye operaciones no aprobadas', () => {
            const calc = calcularBalanceCompleto([
                { id_pago: '1', monto: '10.10', medio_pago: 'EFECTIVO', estado_pago: 'APROBADO', fecha_operacion: '2026-11-05T15:00:00Z', disciplinas: 'Box' },
                { id_pago: '2', monto: 20.2, medio_pago: 'MERCADO_PAGO', estado_pago: 'APROBADO', fecha_operacion: '2026-11-05T16:00:00Z', disciplinas: 'MMA' },
                { id_pago: '3', monto: 500, medio_pago: 'EFECTIVO', estado_pago: 'PENDIENTE', fecha_operacion: '2026-11-05T17:00:00Z', disciplinas: 'MMA' }
            ]);
            assert.equal(calc.resumen.total_ingresos, 30.3);
            assert.equal(calc.resumen.total_operaciones, 2);
            assert.equal(calc.resumen.ticket_promedio, 15.15);
        });
    });

    describe('CA 3 y Regla de Negocio: Detalle en modo consulta e inmutabilidad', () => {
        it('GET /api/pagos/balance/:idPago entrega auditoría completa en solo lectura y 404 si no existe', async () => {
            const headers = { Authorization: `Bearer ${tokenTesorero}` };

            const rOk = await fetch(`${baseUrl}/PAG9941044`, { headers });
            assert.equal(rOk.status, 200);
            const det = (await rOk.json()).data;
            assert.equal(det.id_pago, 'PAG9941044');
            assert.equal(det.estado_pago, 'APROBADO');
            assert.ok(det.registrado_por);

            const r404 = await fetch(`${baseUrl}/PAG_NO_EXISTE`, { headers });
            assert.equal(r404.status, 404);
        });

        it('Vista de detalle solo lectura se puebla sin inputs ni botones de edición/eliminación', () => {
            const { htmlBalance, sandbox, obtenerOcrearEl } = cargarContextoFrontend('TESORERO');
            const modalHtml = htmlBalance.match(/<div id="modal-detalle-operacion"[\s\S]*?<\/body>/)[0];

            assert.equal(/<input|<select|<textarea/i.test(modalHtml), false);
            const sinNotasLegales = modalHtml
                .replace(/No se permiten ediciones, ajustes de montos ni eliminaciones\./g, '')
                .replace(/sin opciones de modificación o eliminación/g, '')
                .replace(/Sin botones de modificación ni eliminación/g, '');
            assert.equal(/guardar|editar|eliminar|borrar|modificar/i.test(sinNotasLegales), false);

            sandbox.poblarModalDetalle({
                id_pago: 'PAG9941044',
                id_registro: 'REG1794040598966',
                id_matricula: 'MAT14',
                alumno: 'Juan Rondón Pujay',
                tipo_documento: 'DNI',
                dni: '00000001',
                correo: 'juan.rondon@forcafitness.com',
                disciplinas: 'MMA',
                periodo_matricula: '07/11/2026 - 07/12/2026',
                medio_pago: 'EFECTIVO',
                registrado_por: 'Paul Rafael',
                numero_recibo: 'CP-2026-0001',
                referencia: '—',
                estado_pago: 'APROBADO',
                fecha_solicitud: '2026-11-07T08:25:41.045Z',
                fecha_operacion: '2026-11-07T08:36:38.960Z',
                monto: 130,
                monto_letras: 'Ciento treinta y 00/100 soles'
            });

            assert.equal(obtenerOcrearEl('det-id-pago').textContent, 'PAG9941044');
            assert.equal(obtenerOcrearEl('det-registrado-por').textContent, 'Paul Rafael');
            assert.equal(obtenerOcrearEl('det-monto').textContent, 'S/ 130.00');
        });

        it('API bloquea métodos POST, PUT, PATCH y DELETE sobre /balance con HTTP 405', async () => {
            const headers = { Authorization: `Bearer ${tokenTesorero}`, 'Content-Type': 'application/json' };
            for (const [method, url] of [
                ['POST', baseUrl],
                ['PUT', `${baseUrl}/PAG9941044`],
                ['PATCH', `${baseUrl}/PAG9941044`],
                ['DELETE', `${baseUrl}/PAG9941044`]
            ]) {
                const res = await fetch(url, { method, headers, body: method !== 'DELETE' ? '{"monto":1}' : undefined });
                assert.equal(res.status, 405, `${method} debe responder 405 Method Not Allowed`);
                assert.equal(res.headers.get('allow'), 'GET');
            }
        });

        it('Base de datos PostgreSQL impide DELETE y UPDATE de pagos aprobados o de Monto', async () => {
            const client = await db.pool.connect();
            try {
                await client.query('BEGIN');
                await client.query('SAVEPOINT sp_del');
                await assert.rejects(
                    () => client.query('DELETE FROM "Academia Forca&Fitness"."Pago" WHERE "Id_Pago" = $1', ['PAG9941044']),
                    /No está permitido eliminar/
                );
                await client.query('ROLLBACK TO SAVEPOINT sp_del');

                await client.query('SAVEPOINT sp_upd');
                await assert.rejects(
                    () => client.query('UPDATE "Academia Forca&Fitness"."Pago" SET "Monto" = 1 WHERE "Id_Pago" = $1', ['PAG9941044']),
                    /inmutables/
                );
                await client.query('ROLLBACK TO SAVEPOINT sp_upd');
                await client.query('ROLLBACK');
            } finally {
                client.release();
            }
        });
    });

    describe('CA 4: Navegación de retorno hacia la interfaz de pagos', () => {
        it('Botones "Volver" y breadcrumb redirigen limpiamente a /tesoreria.html', () => {
            const { htmlBalance, sandbox, obtenerOcrearEl } = cargarContextoFrontend('TESORERO');
            const enlaces = [...htmlBalance.matchAll(/href="([^"]+)"[^>]*data-nav-volver="pagos"/g)].map(m => m[1]);
            assert.equal(enlaces.length, 3);
            assert.ok(enlaces.every(href => href === '/tesoreria.html'));
            assert.ok(htmlBalance.includes('id="btn-volver-pagos-top"') && htmlBalance.includes('← Volver'));

            const modal = obtenerOcrearEl('modal-detalle-operacion');
            modal.style.display = 'flex';
            modal.hidden = false;

            let prevented = false;
            sandbox.volverAInterfazPagos({ preventDefault: () => { prevented = true; } });
            assert.equal(prevented, true);
            assert.equal(modal.style.display, 'none');
            assert.equal(modal.hidden, true);
            assert.equal(sandbox.window.location.href, '/tesoreria.html');
        });
    });
});
