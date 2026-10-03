# Estructura base de carpetas y componentes del sistema Forca&Fitness

## 1. Objetivo

Establecer la estructura base de carpetas y componentes del sistema Forca&Fitness de acuerdo con la arquitectura monolítica modular definida para el proyecto.

La estructura permite separar las funcionalidades del sistema por módulos y mantener los componentes técnicos reutilizables en una ubicación común.

## 2. Estructura base

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
|-- docs/
|   `-- arquitectura/
|
|-- index.js
|-- package.json
`-- package-lock.json

## 3. Carpeta src/modules

La carpeta `src/modules` contiene los módulos funcionales de la aplicación.

Actualmente se encuentran implementados los módulos:

- Alumnos
- Matrículas

Los demás módulos serán incorporados progresivamente de acuerdo con las Historias de Usuario del proyecto.

Cada módulo podrá seguir la siguiente estructura:

modulo/
- modulo.routes.js
- modulo.controller.js
- modulo.service.js
- modulo.repository.js

### Routes

Define las rutas o endpoints HTTP correspondientes al módulo.

### Controller

Recibe las solicitudes y coordina las respuestas hacia el cliente.

### Service

Contiene la lógica de negocio correspondiente al módulo.

### Repository

Gestiona el acceso y persistencia de información en la base de datos.

## 4. Carpeta src/shared

La carpeta `src/shared` contiene componentes técnicos reutilizables por diferentes módulos de la aplicación.

### config

Contiene archivos de configuración general.

Actualmente incluye `database.js`, encargado de centralizar la configuración de conexión con PostgreSQL.

### middleware

Contiene funciones intermedias reutilizables para procesar las solicitudes antes de llegar a los controladores.

### utils

Contiene funciones auxiliares que pueden ser utilizadas por diferentes módulos.

## 5. Punto de entrada

El archivo `index.js` funciona como punto de entrada del backend y se encarga de iniciar el servidor Node.js con Express y registrar las rutas de la aplicación.

## 6. Flujo base de los componentes

El flujo establecido para los módulos del backend es:

Cliente
→ Route
→ Controller
→ Service
→ Repository
→ PostgreSQL

Esta estructura permite mantener separadas las responsabilidades de cada componente y facilita la incorporación progresiva de nuevas funcionalidades.

## 7. Infraestructura

La aplicación está preparada para ser desplegada sobre infraestructura cloud en AWS.

AWS corresponde a la capa de infraestructura y despliegue, por lo que no modifica la organización interna de la arquitectura monolítica modular del sistema.