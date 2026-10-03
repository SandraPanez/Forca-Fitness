# Organización de módulos y responsabilidades funcionales

## 1. Objetivo

Organizar los módulos del sistema Forca&Fitness de acuerdo con las responsabilidades funcionales definidas en las Historias de Usuario del proyecto.

El sistema utiliza una arquitectura monolítica modular, donde cada módulo agrupa funcionalidades relacionadas con una misma responsabilidad del negocio.

## 2. Módulo Alumnos

Responsable de gestionar la información de los alumnos registrados en la academia.

Funcionalidades asociadas:

- Editar datos personales del alumno.
- Inhabilitar temporalmente a un alumno.
- Consultar alumnos registrados y estado de matrícula.
- Visualizar el perfil del alumno.
- Buscar y filtrar alumnos por DNI, nombre y disciplina.

Ubicación:

src/modules/alumnos/

Estructura actual:

- alumnos.routes.js
- alumnos.controller.js
- alumnos.service.js
- alumnos.repository.js

## 3. Módulo Matrículas

Responsable de gestionar los procesos de matrícula, renovación, reserva y vigencia.

Funcionalidades asociadas:

- Registrar matrícula.
- Consultar disponibilidad de horarios y cupos.
- Renovar matrícula con actualización de vigencia.
- Reservar cupo para una disciplina.
- Consultar estado y confirmación de reserva.
- Visualizar vigencia y vencimiento de matrículas.
- Verificar acceso del alumno según matrícula vigente.

Ubicación:

src/modules/matriculas/

Estructura actual:

- matriculas.routes.js
- matriculas.controller.js
- matriculas.service.js
- matriculas.repository.js

## 4. Módulo Pagos

Responsable de gestionar los cobros y pagos realizados por los alumnos.

Funcionalidades asociadas:

- Procesar cobro de mensualidad.
- Consultar historial de pagos realizados por alumno.
- Aplicar descuentos o promociones en el cobro de mensualidad.

Ubicación prevista:

src/modules/pagos/

## 5. Módulo Comprobantes

Responsable de gestionar los comprobantes relacionados con los pagos.

Funcionalidades asociadas:

- Generar comprobante electrónico de pago.
- Descargar comprobante.
- Enviar comprobante digital al correo del cliente.

Ubicación prevista:

src/modules/comprobantes/

## 6. Módulo Seguimiento

Responsable del seguimiento de matrículas y su historial.

Funcionalidades asociadas:

- Filtrar matrículas críticas con vencimiento.
- Consultar historial de matrículas del alumno.

Ubicación prevista:

src/modules/seguimiento/

## 7. Módulo Notificaciones

Responsable del envío de avisos y recordatorios automáticos.

Funcionalidades asociadas:

- Enviar notificaciones automáticas de recordatorio de vencimiento.

Ubicación prevista:

src/modules/notificaciones/

## 8. Módulo Reportes

Responsable de proporcionar información consolidada para la administración de la academia.

Funcionalidades asociadas:

- Reportar balance de ingresos y pagos.

Ubicación prevista:

src/modules/reportes/

## 9. Componentes compartidos

Los componentes técnicos reutilizables por distintos módulos se ubican en:

src/shared/

Entre ellos se encuentran:

- Configuración de la aplicación.
- Conexión a PostgreSQL.
- Middleware.
- Utilidades compartidas.
- Componentes de autenticación y control de acceso.

## 10. Organización interna de los módulos

Los módulos del backend seguirán el siguiente flujo:

Route
→ Controller
→ Service
→ Repository
→ PostgreSQL

Cada componente tiene una responsabilidad específica:

- Route: define los endpoints HTTP.
- Controller: recibe la solicitud y coordina la respuesta.
- Service: contiene la lógica de negocio.
- Repository: gestiona el acceso y persistencia de datos.

## 11. Separación de responsabilidades

Cada módulo debe mantener únicamente las funcionalidades correspondientes a su responsabilidad.

Se debe evitar que un módulo acceda directamente a la capa Repository de otro módulo.

Cuando sea necesario utilizar lógica de otro módulo, la interacción deberá realizarse mediante la capa Service correspondiente.

Esta organización permite reducir el acoplamiento y mantener la arquitectura modular del sistema.