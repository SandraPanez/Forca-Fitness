# Organización de módulos y responsabilidades funcionales

## 1. Objetivo

Organizar los módulos del sistema Forca&Fitness de acuerdo con las responsabilidades funcionales definidas en las Historias de Usuario del proyecto.

El sistema utiliza una arquitectura monolítica modular, donde cada módulo agrupa funcionalidades relacionadas con un mismo dominio o responsabilidad.

## 2. Módulo Alumnos

Responsable de gestionar la información de los alumnos registrados en la academia.

Funcionalidades asociadas:

- Editar datos personales del alumno.
- Inhabilitar temporalmente a un alumno.
- Consultar alumnos registrados y estado de matrícula.
- Visualizar el perfil del alumno.
- Buscar y filtrar alumnos por DNI, nombre o disciplina.

Ubicación:

src/modules/alumnos/

Estructura:

- alumnos.routes.js
- alumnos.controller.js
- alumnos.service.js
- alumnos.repository.js

## 3. Módulo Matrículas

Responsable de gestionar el proceso de matrícula, renovación, reserva y vigencia de los alumnos.

Funcionalidades asociadas:

- Registrar matrícula.
- Consultar disponibilidad de horarios y cupos.
- Renovar matrícula.
- Reservar cupo para una disciplina.
- Consultar estado de una reserva.
- Visualizar vigencia y vencimiento de matrículas.
- Verificar acceso del alumno de acuerdo con su matrícula vigente.

Ubicación:

src/modules/matriculas/

Estructura:

- matriculas.routes.js
- matriculas.controller.js
- matriculas.service.js
- matriculas.repository.js

## 4. Módulo Pagos

Responsable de gestionar los pagos y cobros realizados por los alumnos.

Funcionalidades asociadas:

- Procesar cobro de mensualidad.
- Consultar historial de pagos.
- Aplicar descuentos o promociones.

Ubicación prevista:

src/modules/pagos/

## 5. Módulo Comprobantes

Responsable de gestionar la generación y distribución de comprobantes de pago.

Funcionalidades asociadas:

- Generar comprobante electrónico.
- Descargar comprobante.
- Enviar comprobante digital al cliente.

Ubicación prevista:

src/modules/comprobantes/

## 6. Módulo Seguimiento

Responsable de consultar y controlar información relacionada con la vigencia e historial de matrículas.

Funcionalidades asociadas:

- Filtrar matrículas próximas o críticas por vencimiento.
- Consultar historial de matrículas del alumno.

Ubicación prevista:

src/modules/seguimiento/

## 7. Módulo Notificaciones

Responsable del envío de avisos y recordatorios automáticos.

Funcionalidades asociadas:

- Enviar recordatorios de vencimiento de matrícula.

Ubicación prevista:

src/modules/notificaciones/

## 8. Módulo Reportes

Responsable de generar información consolidada para la administración de la academia.

Funcionalidades asociadas:

- Reportar balance de ingresos y pagos.

Ubicación prevista:

src/modules/reportes/

## 9. Componentes compartidos

Los componentes que no pertenecen exclusivamente a un módulo funcional se mantienen dentro de:

src/shared/

Estos componentes incluyen:

- Configuración de la aplicación.
- Conexión a base de datos.
- Middleware.
- Utilidades compartidas.
- Componentes técnicos de autenticación y control de acceso.

## 10. Organización interna de los módulos

Los módulos del backend seguirán el siguiente flujo:

Route
→ Controller
→ Service
→ Repository
→ PostgreSQL

Cada componente tendrá una responsabilidad específica:

- Route: definición de endpoints.
- Controller: recepción y respuesta de solicitudes.
- Service: aplicación de reglas y lógica de negocio.
- Repository: acceso y persistencia de datos.

Esta organización permite mantener separadas las responsabilidades funcionales y reducir dependencias innecesarias entre módulos.