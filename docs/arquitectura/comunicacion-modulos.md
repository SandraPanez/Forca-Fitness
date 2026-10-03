# Comunicación entre módulos del sistema Forca&Fitness

## 1. Objetivo

Configurar la comunicación e integración entre los módulos del sistema Forca&Fitness manteniendo la separación de responsabilidades definida por la arquitectura monolítica modular.

## 2. Registro centralizado de módulos

Los módulos funcionales del backend se centralizan mediante:

src/modules/index.js

Este archivo permite exponer las rutas de los módulos disponibles hacia el punto de entrada principal de la aplicación.

Actualmente se encuentran registrados:

- Módulo Alumnos
- Módulo Matrículas

El archivo principal `index.js` utiliza este registro para incorporar los módulos a Express.

## 3. Comunicación con los módulos

La comunicación entre el cliente y el backend se realiza mediante HTTP utilizando una API REST y datos en formato JSON.

Las rutas principales configuradas actualmente son:

- /api/alumnos
- /api/matriculas
- /api/health

## 4. Flujo interno

El flujo definido dentro de los módulos es:

Cliente
→ Express
→ Route
→ Controller
→ Service
→ Repository
→ PostgreSQL

Cada capa mantiene una responsabilidad específica.

## 5. Componentes compartidos

Los módulos pueden utilizar componentes técnicos ubicados dentro de:

src/shared/

La configuración de conexión a PostgreSQL se encuentra centralizada en:

src/shared/config/database.js

Esto evita que cada módulo implemente su propia conexión a la base de datos.

## 6. Comunicación entre módulos

Los módulos deben mantener separadas sus responsabilidades y evitar dependencias innecesarias.

Cuando una funcionalidad necesite utilizar lógica perteneciente a otro módulo, la interacción deberá realizarse mediante las capas definidas por la arquitectura y no accediendo directamente al Repository de otro módulo.

## 7. Integración actual

La integración de los módulos actualmente implementados se representa de la siguiente manera:

index.js
→ src/modules/index.js
→ alumnos.routes.js
→ matriculas.routes.js

Esta organización permite incorporar nuevos módulos progresivamente sin modificar la estructura interna de los módulos existentes.