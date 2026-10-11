# Roles de usuario del sistema Forca&Fitness

## Objetivo

Definir los roles de usuario que tendrán acceso al sistema Forca&Fitness como base para la autenticación y el control de acceso.

## DIRECTOR

Corresponde al dueño o responsable general de la academia.

Acceso general:
- Visualizar todos los alumnos registrados.
- Supervisar información general de la academia.
- Inhabilitar alumnos cuando corresponda.
- Acceder a funcionalidades administrativas autorizadas.

## TESORERO

Corresponde al responsable de matrículas, pagos y comprobantes.

Acceso general:
- Visualizar todos los alumnos registrados.
- Gestionar información relacionada con matrículas y pagos.
- No puede inhabilitar alumnos por motivos disciplinarios.

## PROFESOR

Corresponde al personal encargado de las disciplinas de la academia.

Acceso general:
- Visualizar únicamente alumnos matriculados en las disciplinas que tiene asignadas.
- Consultar información necesaria para sus clases.
- Realizar las acciones disciplinarias permitidas dentro de su ámbito.

## ALUMNO

Corresponde a los clientes o alumnos de la academia.

Acceso general:
- Consultar su propia información.
- Registrar y consultar su matrícula.
- Consultar profesor y disciplina.
- Consultar la vigencia de su matrícula.

## Definición técnica

Los roles están centralizados en:

src/shared/constants/roles.js

Los mecanismos de autenticación y autorización utilizarán esta definición.