// Regla compartida por el formulario y el servidor, sin depender del huso del navegador.
function calcularEdadMatricula(fechaNacimiento, hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' })) {
    if (typeof fechaNacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fechaNacimiento) ||
        fechaNacimiento < '1930-01-01' || fechaNacimiento > hoy) return null;
    const fecha = new Date(`${fechaNacimiento}T00:00:00Z`);
    if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== fechaNacimiento) return null;
    return Number(hoy.slice(0, 4)) - Number(fechaNacimiento.slice(0, 4)) -
        Number(hoy.slice(5) < fechaNacimiento.slice(5));
}

function disciplinaPermitidaPorEdad(edad, nombre) {
    return Number.isInteger(edad) && edad >= 0 &&
        (edad <= 12) === /\bkids\b/i.test(nombre);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { calcularEdadMatricula, disciplinaPermitidaPorEdad };
}
