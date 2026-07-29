# Evidencia de base de datos y sembrado

## Entorno aislado

- Base exacta: `ganaderia_ai_security_test`.
- Puerto host: `127.0.0.1:55433`.
- Tablas publicas observadas: 32.
- Politicas RLS observadas: 0.
- Rol usado por la aplicacion aislada: superusuario, con permisos de crear bases y roles.

El ultimo punto reproduce el comportamiento de la imagen oficial cuando
`POSTGRES_USER` se reutiliza como usuario de aplicacion. No se probo ningun escape
del contenedor ni se intento abusar de esos privilegios.

## Fallo del seed original

En una base vacia, `database/seeds.sql` inserta IDs explicitos en
`semantic_contexts` y luego hace un INSERT con ID implicito sin sincronizar
`semantic_contexts_id_seq`. PostgreSQL aborto el seed por clave primaria duplicada.
La transaccion dejo cero tablas, por lo que no hubo datos parciales.

Para continuar la auditoria se uso un shim exclusivo de
`Initialize-SecurityDb.ps1` que ejecuta `setval` en memoria antes del segundo
INSERT. El archivo productivo no fue editado.

## Aislamiento comprobado

- 22/22 pruebas de autorizacion HTTP pasaron.
- Una cuenta no pudo leer ni modificar bovinos, duenos, ranchos, pesos,
  enfermedades, vacunas, ventas, memorias o conversaciones de otra cuenta.
- La tool de lectura IA tampoco encontro el bovino ajeno.
- Una transferencia pendiente no cambio al propietario.
- Solo el receptor pudo aceptar la transferencia.
- Tras aceptar, el acceso CRUD cambio del emisor al receptor.

## Riesgos de datos confirmados

- Una memoria enlazada al bovino cambio automaticamente de usuario al aceptar.
- Un propietario anterior pudo leer eventos posteriores y el correo de un tercero.
- Un contexto `semantic_contexts` con `bovino_id IS NULL` fue recuperado por otra cuenta.
