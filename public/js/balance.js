/**
 * balance.js - Control de acceso y lógica para la interfaz «Balance de ingresos y pagos»
 * Historia de Usuario 16: Consultar balance de ingresos y pagos
 * 
 * REGLA DE NEGOCIO:
 * "Solo el tesorero tiene acceso a este apartado, pues es quien se encarga
 * completamente de los registros financieros de la academia."
 */

// ────────────────────────────────────────────────────────────
// 1. CONTROL DE ACCESO ESTRICTO: EXCLUSIVO PARA ROL TESORERO
// ────────────────────────────────────────────────────────────
(function verificarAccesoExclusivoTesorero() {
    // Comprobar autenticación de sesión
    if (!verificarSesion()) {
        return;
    }

    const usuario = obtenerUsuario();
    const roles = obtenerRolesUsuario(usuario);
    const esTesorero = roles.includes('TESORERO');

    // Si el usuario no posee el rol de Tesorero, denegar acceso inmediatamente
    if (!esTesorero) {
        alert('Acceso restringido: El apartado «Balance de ingresos y pagos» es exclusivo para el rol de Tesorero.');
        window.location.href = paginaDeInicio();
        return;
    }

    // Usuario autenticado y con rol de Tesorero verificado
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof pintarEncabezado === 'function') {
            pintarEncabezado();
        }
        inicializarBalanceView();
    });
})();

function inicializarBalanceView() {
    console.log('[BALANCE] Acceso verificado correctamente: Rol TESORERO activo.');

    // Configurar fechas iniciales del mes en curso
    const hoy = new Date();
    const anio = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, '0');
    const dia = String(hoy.getDate()).padStart(2, '0');

    const inputInicio = document.getElementById('fecha-inicio');
    const inputFin = document.getElementById('fecha-fin');

    if (inputInicio && inputFin) {
        inputInicio.value = `${anio}-${mes}-01`;
        inputFin.value = `${anio}-${mes}-${dia}`;
    }
}

