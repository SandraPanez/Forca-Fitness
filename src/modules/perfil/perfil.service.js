const perfilRepository = require("./perfil.repository");

async function obtenerPerfil(idAlumno) {
  const datos = await perfilRepository.obtenerDatosAlumno(idAlumno);
  if (!datos) throw new Error("Alumno no encontrado");
  return datos;
}

async function actualizarPerfil(idAlumno, datos) {
  if (!datos.nombre?.trim())             throw new Error("El nombre es obligatorio");
  if (!datos.apellido_paterno?.trim())   throw new Error("El apellido paterno es obligatorio");
  if (!datos.apellido_materno?.trim())   throw new Error("El apellido materno es obligatorio");
  if (!datos.fecha_nacimiento)           throw new Error("La fecha de nacimiento es obligatoria");
  if (!datos.genero)                     throw new Error("El género es obligatorio");
  if (!datos.direccion?.trim())          throw new Error("La dirección es obligatoria");

  if (datos.correo_electronico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo_electronico)) {
    throw new Error("El correo electrónico no tiene un formato válido");
  }
  if (datos.numero_celular && !/^[0-9]{9}$/.test(datos.numero_celular)) {
    throw new Error("El número de celular debe tener 9 dígitos");
  }

  await perfilRepository.actualizarDatosAlumno(idAlumno, datos);
  return { mensaje: "Datos actualizados correctamente" };
}

module.exports = { obtenerPerfil, actualizarPerfil };