# Forca-Fitness

Sistema de matrículas y control de pagos de la Academia Forca & Fitness.
Aplicación Node.js/Express con PostgreSQL, pagos con Mercado Pago, cola de
correos con Redis y BullMQ, y comprobantes en PDF.

## Puesta en marcha

1. Instala las dependencias:

```bash
npm install
```

2. Copia `.env.example` a `.env` y completa los valores. Las credenciales
   reales se piden al equipo; `.env` está en `.gitignore` y nunca se sube.

| Variables | Para qué sirven |
|---|---|
| `PORT` | Puerto de la app (por defecto 3000) |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL` | Conexión a PostgreSQL. Para la base de Render, `DB_SSL=true` |
| `DATABASE_URL` | Alternativa a las `DB_*`, con la URL completa de la base |
| `JWT_SECRET` | Firma de la sesión. Cualquier texto largo; sin ella el login responde error interno |
| `MP_ACCESS_TOKEN`, `MP_PUBLIC_KEY`, `APP_URL` | Mercado Pago y la dirección de la app a la que vuelve el cliente después de pagar |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_USERNAME`, `REDIS_PASSWORD`, `REDIS_TLS` (o `REDIS_URL`) | Cola de correos |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Cuenta que envía los correos (comprobantes) |

3. Inicia la app y abre `http://localhost:3000` (muestra el login):

```bash
npm start
```

`GET /api/health` comprueba el servidor y la base: responde `200` con
`database: "connected"`, o `503` con `database: "disconnected"`.

## Probar Mercado Pago desde localhost

Usa las credenciales del vendedor de prueba en `MP_ACCESS_TOKEN` y conserva
`APP_URL=http://localhost:3000`. Al continuar con Mercado Pago, el checkout se
abre en otra pestaña y Forca permanece abierta. Completa la compra con el
comprador y la tarjeta de prueba; luego vuelve a Forca y pulsa **Verificar pago**.
También se consulta al recuperar el foco de la pestaña. No se necesita un túnel
para esta consulta: el servidor local accede a la API de Mercado Pago.

Solo un pago verificado como aprobado habilita la cuenta y confirma la matrícula.
Los periodos futuros quedan **Reservados**. Una respuesta pendiente o un error de
la API no se convierte en aprobación. Las cuentas y tarjetas se obtienen de la
[guía oficial de pruebas](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases).

Para recibir notificaciones aunque el alumno cierre Forca, configura `APP_URL`
con una dirección pública HTTPS que llegue a ese mismo servidor. Con ella se
incluyen el webhook y las URLs de retorno; Mercado Pago desaconseja usar
[localhost en las URLs de retorno](https://www.mercadopago.com.pe/developers/es/docs/checkout-pro-preferences/configure-back-urls).

## Base de datos

El equipo trabaja con la base PostgreSQL compartida en Render: con sus
credenciales en el `.env` no hace falta crear nada.

Para usar una base propia, créala y ejecuta solo este archivo:

```bash
psql -U postgres -d forca_fitness -f "src/modules/matriculas/Forca&Fitness Diagrama version 4.sql"
```

- `src/modules/pagos/pagos.schema version 2.sql` es una copia del mismo
  esquema: no ejecutes los dos, el segundo falla porque las tablas ya existen.
- El esquema crea las tablas vacías. Los roles, métodos de pago, disciplinas,
  horarios y profesores hay que cargarlos aparte; hoy solo existen en la base
  del equipo.

## Cuentas de prueba

Hay una cuenta por rol (director, tesorero, profesor y cliente) para probar
cada vista. Los accesos se piden al equipo por privado; nunca se escriben en el
repositorio.

## Qué ve cada rol

El encabezado es el mismo en todas las páginas y el menú depende del rol de
quien inicia sesión (se define en `public/js/auth.js`, en `MENU_POR_ROL`):

| Rol | Menú |
|---|---|
| Director | Alumnos, Control de acceso |
| Tesorero | Alumnos, Pagos |
| Profesor | Control de acceso, Alumnos |
| Cliente | Nueva matrícula, Disciplinas, Renovar, Mis matrículas, Mi perfil |

Si una cuenta tiene varios roles, ve las opciones de todos sin repetir.

## Despliegue con Docker en Render

El `Dockerfile` usa `npm ci --omit=dev`, escucha en `0.0.0.0` y respeta la
variable `PORT` que Render inyecta. Para el servicio web en Render:

1. Crea una base de datos PostgreSQL y un Web Service desde este repositorio
   seleccionando **Docker**.
2. Define `DATABASE_URL` con la **Internal Database URL** de PostgreSQL y el
   resto de variables de la tabla de arriba, con `APP_URL` igual a la
   dirección pública del servicio. No subas `.env` ni copies una URL con
   credenciales al repositorio.
3. Ejecuta una vez el archivo SQL de la sección "Base de datos" contra esa base.
4. Configura `/api/health` como health check del servicio.

La imagen no crea tablas automáticamente: el esquema debe ejecutarse una vez
para evitar que cada despliegue modifique la base de datos de producción.
