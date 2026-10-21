const perfilRepository = require("./perfil.repository");

async function obtenerPerfil(idAlumno) {
  const datos = await perfilRepository.obtenerDatosAlumno(idAlumno);
  if (!datos) throw new Error("Alumno no encontrado");
  return datos;
}

async function actualizarPerfil(idAlumno, datos) {
  if (!datos || typeof datos !== 'object' || Array.isArray(datos)) throw new Error('Datos personales no válidos');
  for (const campo of ['nombre', 'apellido_paterno', 'apellido_materno', 'direccion']) {
    if (typeof datos[campo] !== 'string') throw new Error('Los datos personales deben ser texto');
    datos[campo] = datos[campo].trim();
  }
  if (!datos.nombre?.trim())             throw new Error("El nombre es obligatorio");
  if (!datos.apellido_paterno?.trim())   throw new Error("El apellido paterno es obligatorio");
  if (!datos.apellido_materno?.trim())   throw new Error("El apellido materno es obligatorio");
  if (!datos.fecha_nacimiento)           throw new Error("La fecha de nacimiento es obligatoria");
  if (!['M', 'F', 'OTRO'].includes(datos.genero)) throw new Error('El género no es válido');
  if (!datos.direccion?.trim())          throw new Error("La dirección es obligatoria");

  const [primerNombre, ...otrosNombres] = datos.nombre.split(/\s+/);
  if (primerNombre.length > 40 || otrosNombres.join(' ').length > 40 ||
      datos.apellido_paterno.length > 20 || datos.apellido_materno.length > 20 || datos.direccion.length > 50) {
    throw new Error('Uno de los datos supera la longitud permitida');
  }
  const fecha = new Date(datos.fecha_nacimiento);
  const hoy = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  if (typeof datos.fecha_nacimiento !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha_nacimiento) ||
      Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== datos.fecha_nacimiento ||
      datos.fecha_nacimiento < '1930-01-01' || datos.fecha_nacimiento > hoy) {
    throw new Error('La fecha de nacimiento no es válida o es futura');
  }

  for (const campo of ['correo_electronico', 'numero_celular']) {
    if (datos[campo] === undefined) continue;
    if (typeof datos[campo] !== 'string') throw new Error('El contacto debe ser texto');
    datos[campo] = datos[campo].trim();
  }
  if (datos.correo_electronico && (datos.correo_electronico.length > 50 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo_electronico))) {
    throw new Error("El correo electrónico no tiene un formato válido");
  }
  if (datos.numero_celular && !/^[0-9]{9}$/.test(datos.numero_celular)) {
    throw new Error("El número de celular debe tener 9 dígitos");
  }

  await perfilRepository.actualizarDatosAlumno(idAlumno, datos);
  return { mensaje: "Datos actualizados correctamente" };
}

module.exports = { obtenerPerfil, actualizarPerfil };
