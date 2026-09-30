# Forca-Fitness

Aplicación Node.js/Express con PostgreSQL y Redis para la gestión de matrículas
y alumnos.

## Configuración local

1. Copia `.env.example` a `.env` y completa las credenciales de PostgreSQL y Redis.
2. Crea una base de datos llamada `forca_fitness`.
3. Ejecuta el esquema:

```bash
psql -U postgres -d forca_fitness -f "src/modules/matriculas/matriculas.schema.sql"
```

4. Instala dependencias y ejecuta la aplicación:

```bash
npm ci
npm start
```

El endpoint `GET /api/health` comprueba el servidor y las conexiones a PostgreSQL
y Redis. Responde `200` cuando ambos servicios están disponibles y `503` cuando
alguno no lo está. La conexión usa el protocolo indicado por `REDIS_TLS`.

## Despliegue con Docker en Render

El `Dockerfile` usa `npm ci --omit=dev`, escucha en `0.0.0.0` y respeta la
variable `PORT` que Render inyecta. Para el servicio web en Render:

1. Crea una base de datos PostgreSQL y un Web Service desde este repositorio
   seleccionando **Docker**.
2. Define `DATABASE_URL` con la **Internal Database URL** de PostgreSQL. No
   subas `.env` ni copies una URL con credenciales al repositorio. Define también
   `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME` y `REDIS_PASSWORD` como variables
   de entorno del servicio.
3. Ejecuta el archivo SQL anterior una vez contra esa base de datos.
4. Configura `/api/health` como health check del servicio.

La imagen no crea tablas automáticamente: el esquema debe ejecutarse una vez
para evitar que cada despliegue modifique la base de datos de producción.
