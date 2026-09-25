# Estructura base del sistema Forca&Fitness

## Arquitectura

El sistema Forca&Fitness utiliza una arquitectura monolítica modular.

La aplicación organiza sus funcionalidades en módulos independientes según su responsabilidad, manteniendo componentes técnicos compartidos para evitar duplicación de código.

## Estructura principal

Forca-Fitness/
|
|-- public/
|
|-- src/
|   |
|   |-- modules/
|   |   |-- alumnos/
|   |   `-- matriculas/
|   |
|   `-- shared/
|       |-- config/
|       |   `-- database.js
|       |-- middleware/
|       `-- utils/
|
|-- index.js
|-- package.json
`-- package-lock.json

## src/modules

La carpeta `src/modules` contiene los módulos funcionales del sistema.

Cada funcionalidad principal será incorporada progresivamente de acuerdo con las Historias de Usuario del proyecto.

Los módulos podrán seguir la siguiente estructura:

modulo/
- modulo.routes.js
- modulo.controller.js
- modulo.service.js
- modulo.repository.js

### Responsabilidad de los componentes

- **Routes:** define las rutas o endpoints disponibles.
- **Controller:** recibe las solicitudes y coordina la respuesta.
- **Service:** contiene la lógica de negocio.
- **Repository:** realiza las operaciones de acceso a la base de datos.

## src/shared

La carpeta `src/shared` contiene componentes técnicos que pueden ser utilizados por diferentes módulos.

### config

Contiene configuraciones generales del sistema, como la conexión a PostgreSQL.

### middleware

Contiene funciones intermedias reutilizables para procesar solicitudes antes de llegar a los controladores.

### utils

Contiene funciones auxiliares que pueden ser utilizadas por distintos módulos.

## public

Contiene los recursos utilizados por la interfaz web de la aplicación.

## Flujo base

El flujo general definido para los módulos del backend es:

Cliente
→ Route
→ Controller
→ Service
→ Repository
→ PostgreSQL

Esta estructura permite separar responsabilidades y facilitar la incorporación progresiva de las funcionalidades del sistema.