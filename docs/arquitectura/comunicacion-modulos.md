# Comunicación entre módulos del sistema Forca&Fitness

## 1. Objetivo

Configurar la comunicación e integración de los módulos del sistema Forca&Fitness manteniendo la separación de responsabilidades establecida por la arquitectura monolítica modular.

## 2. Registro centralizado de módulos

Los módulos disponibles en el backend se centralizan mediante:

src/modules/index.js

Este archivo expone las rutas de los módulos funcionales hacia el punto de entrada principal de la aplicación.

Actualmente se encuentran registrados:

- Módulo Alumnos
- Módulo Matrículas

El archivo principal `index.js` utiliza este registro para incorporar los módulos a Express.

## 3. Comunicación del cliente con los módulos

La comunicación entre el cliente y el backend se realiza mediante solicitudes HTTP.

Las rutas principales actualmente configuradas son:

- /api/alumnos
- /api/matriculas
- /api/health

Los datos intercambiados por la API utilizan formato JSON.

## 4. Flujo interno

El flujo establecido dentro de cada módulo es:

Cliente
→ Express
→ Route
→ Controller
→ Service
→ Repository
→ PostgreSQL

Cada capa mantiene una responsabilidad específica.

## 5. Componentes compartidos

Los módulos pueden utilizar componentes técnicos ubicados en:

src/shared/

La conexión a PostgreSQL se encuentra centralizada en:

src/shared/config/database.js

Esto evita que cada módulo implemente una conexión independiente a la base de datos.

## 6. Comunicación entre módulos

Los módulos deben mantener sus responsabilidades separadas y evitar dependencias directas innecesarias.

No se debe acceder directamente al Repository de otro módulo.

Cuando una funcionalidad requiera utilizar lógica perteneciente a otro módulo, la interacción deberá realizarse mediante la capa Service correspondiente.

De esta manera se reduce el acoplamiento entre los módulos y se mantiene la organización establecida por la arquitectura monolítica modular.

## 7. Integración actual

El registro centralizado de módulos permite que el punto de entrada de la aplicación utilice las rutas disponibles sin depender directamente de la estructura interna de cada módulo.

La integración actual se representa de la siguiente manera:

index.js
→ src/modules/index.js
→ alumnos.routes.js
→ matriculas.routes.js

Los módulos utilizan los componentes compartidos de `src/shared` cuando requieren servicios técnicos comunes.