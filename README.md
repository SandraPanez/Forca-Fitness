# Forca-Fitness

Aplicación Node.js/Express con PostgreSQL para la gestión de matrículas y
alumnos.

## Configuración local

1. Copia `.env.example` a `.env` y completa las credenciales de PostgreSQL.
2. Crea una base de datos llamada `forca_fitness`.
3. Ejecuta el esquema:

```bash
psql -U postgres -d forca_fitness -f "src/modules/matriculas/Forca&Fitness Diagrama version 2.sql"
psql -U postgres -d forca_fitness -f "src/modules/pagos/pagos.schema.sql"
```

4. Instala dependencias y ejecuta la aplicación:

```bash
npm ci
npm start
```

El endpoint `GET /api/health` comprueba tanto el servidor como la conexión a
PostgreSQL. Responde `200` con `database: "connected"` cuando está disponible y
`503` con `database: "disconnected"` cuando no lo está.

## Despliegue con Docker en Render

El `Dockerfile` usa `npm ci --omit=dev`, escucha en `0.0.0.0` y respeta la
variable `PORT` que Render inyecta. Para el servicio web en Render:

1. Crea una base de datos PostgreSQL y un Web Service desde este repositorio
   seleccionando **Docker**.
2. Define `DATABASE_URL` con la **Internal Database URL** de PostgreSQL. No
   subas `.env` ni copies una URL con credenciales al repositorio.
3. Ejecuta el archivo SQL anterior una vez contra esa base de datos.
4. Configura `/api/health` como health check del servicio.

La imagen no crea tablas automáticamente: el esquema debe ejecutarse una vez
para evitar que cada despliegue modifique la base de datos de producción.
