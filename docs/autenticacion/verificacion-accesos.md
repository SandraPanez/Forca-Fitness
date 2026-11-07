# Verificación de accesos según rol - T_58

## Objetivo

Verificar que los usuarios autenticados puedan acceder únicamente a las funcionalidades permitidas según su rol.

## Pruebas realizadas

### Consulta de todos los alumnos

Ruta:

GET /api/alumnos

Resultados:

| Rol | Resultado | Validación |
| --- | --- | --- |
| DIRECTOR | HTTP 200 | Acceso permitido |
| TESORERO | HTTP 200 | Acceso permitido |
| PROFESOR | HTTP 403 | Acceso denegado |
| ALUMNO | HTTP 403 | Acceso denegado |

### Registro de matrícula

Ruta:

POST /api/matriculas

Resultados:

| Rol | Resultado | Validación |
| --- | --- | --- |
| DIRECTOR | HTTP 403 | Acceso denegado |
| TESORERO | HTTP 403 | Acceso denegado |
| PROFESOR | HTTP 403 | Acceso denegado |
| ALUMNO | HTTP 400 | Acceso autorizado; la solicitud llegó al controlador y fue rechazada por falta de campos obligatorios |

## Resultado

Las pruebas realizadas confirman que el control de acceso utiliza el rol contenido en el JWT y los permisos definidos para cada rol.

Los usuarios sin el permiso requerido reciben HTTP 403, mientras que los roles autorizados pueden continuar hacia la funcionalidad solicitada.