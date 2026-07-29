# AI_CONTEXT.md

## Resumen del proyecto

Ganaderia_AI es una aplicacion web fullstack para gestion de ganado bovino con asistencia de IA local. Permite administrar bovinos, duenos, ranchos, vacunas, vacunas aplicadas, pesos, enfermedades, historial de propiedad, ventas, conversaciones, memorias y observabilidad de interacciones con IA.

La fase de plataforma agrega transferencias de bovinos entre cuentas, catalogo global de razas, notificaciones en tiempo real, contactos y mensajeria privada. Estos dominios reutilizan la sesion firmada, PostgreSQL y las tools transaccionales existentes.

El proyecto esta construido como una aplicacion Nuxt: frontend y backend viven en el mismo repositorio. Las paginas Vue consumen endpoints Nitro ubicados en `server/api`, y esos endpoints consultan PostgreSQL usando una mezcla de Drizzle ORM y SQL directo con `postgres`.

La IA funciona con Ollama local. Usa un router principal que combina reglas, consultas SQL directas, guardrails, memoria de usuario, function calling con herramientas internas y fallback RAG sobre contexto semantico almacenado en PostgreSQL con pgvector.

Desde Semana 7, el endpoint principal delega en una arquitectura multiagente incremental: un router determinista clasifica cada turno como `direct`, `transactional` o `rag`; el agente transaccional reutiliza las tools existentes y el agente RAG usa busqueda hibrida, RRF y reranking local con fallback.

El flujo actual incluye una capa determinista previa al LLM para clasificar intenciones frecuentes, extraer parametros, detectar datos faltantes, mantener acciones pendientes por conversacion y pedir confirmacion antes de cualquier escritura. La autenticacion usa una cookie v3 cifrada y HttpOnly; la sesion aleatoria se almacena como hash revocable en PostgreSQL y los endpoints obtienen `usuario_id` exclusivamente de esa sesion.

## Stack tecnologico

Frontend:

- Nuxt 4
- Vue 3
- TailwindCSS
- Nuxt Icon

Backend:

- Nitro server routes de Nuxt
- PostgreSQL
- Drizzle ORM
- Cliente SQL `postgres`

IA:

- Ollama
- Modelo de chat: `llama3.2:latest`
- Modelo de embeddings: `nomic-embed-text`
- pgvector
- RAG con `semantic_contexts` y `memories`
- Function calling con herramientas internas

Testing:

- Playwright

Infraestructura:

- Docker
- Docker Compose
- Imagen `pgvector/pgvector:pg16`
- Contenedor Ollama

## Estructura de carpetas

```text
app/
  app.vue                    Punto de entrada Nuxt
  nuxt.config.ts             Configuracion Nuxt
  package.json               Scripts y dependencias
  docker-compose.yml         PostgreSQL pgvector y Ollama
  README.md                  Documentacion general

  pages/                     Rutas frontend Nuxt
    index.vue                Dashboard principal
    login.vue                Inicio de sesion
    register.vue             Registro
    bovinos/                 CRUD y detalle de bovinos
    duenos/                  CRUD de duenos
    ranchos/                 CRUD de ranchos
    vacunas/                 Catalogo de vacunas
    ia/                      Chat con IA
    observabilidad/          Logs de IA

  layouts/                   Layouts de la aplicacion
    default.vue              Layout autenticado
    auth.vue                 Layout de login/registro

  middleware/
    auth.ts                  Middleware client-side que valida la cookie con `/api/auth/me`

  components/                Componentes Vue reutilizables
    vacas/                   Componentes heredados con nombre anterior
    ui/                      Componentes UI

  server/api/                Endpoints backend Nitro
    auth/                    Login y registro
    bovinos/                 CRUD bovinos
    duenos/                  CRUD duenos
    ranchos/                 CRUD ranchos
    vacunas/                 CRUD vacunas
    pesos/                   Pesos de bovinos
    enfermedades/            Enfermedades
    historial-propiedad/     Historial de propiedad
    transferencias/          Transferencias de propiedad
    dashboard/               Metricas del inicio
    ia/                      Router IA, chat y evaluacion; las tools no son rutas publicas
    memories/                Memorias semanticas del usuario
    conversations/           Conversaciones y mensajes
    observabilidad/          Logs de IA
    ventas/                  CRUD de ventas

  server/ai/
    agents/routerAgent.ts          Seleccion determinista de agente
    agents/transactionalAgent.ts   Acceso autorizado a tools existentes
    agents/ragAgent.ts             Respuesta de solo lectura basada en contexto
    context/agentContext.ts        Contexto corto y tipado entre agentes
    rag/hybridSearch.ts            Vector + FTS + RRF
    rag/rerankerClient.ts          Cliente del reranker local con timeout
    rag/advancedRagPipeline.ts     Top-10, reranking y Top-3 final

  server/utils/
    session.ts               Sesiones v3 cifradas, persistentes, revocables y hash de contrasenas
    api.ts                   Normalizacion y errores seguros
    ownership.ts             Validacion de propiedad por usuario
    iaRequest.ts             Validacion de preguntas y UUID de conversaciones
    rateLimit.ts             Limites persistentes por IP, identidad y usuario
    requestSecurity.ts       Validacion same-origin para metodos de escritura

  server/middleware/
    security.ts              Headers HTTP, no-cache y proteccion CSRF por origen

  server/services/
    ownershipTransfer.ts     Transferencias transaccionales
    accountTransfer.ts       Solicitudes y aceptacion entre cuentas
    breedService.ts          Catalogo global de razas
    community.ts             Amistades, conversaciones y mensajes
    communityRealtime.ts     Hub WebSocket, sincronizacion y acuses del chat
    notifications.ts         Bandeja y estado de lectura
    userDirectory.ts         Busqueda priorizada de usuarios
    activityAudit.ts         Auditoria operativa
    vaccination.ts           Regla transaccional de vacunacion cada seis meses
    ownershipRelations.ts    Relaciones activas rancho-duenos y bovino-duenos

  server/routes/_ws/
    community.ts             WebSocket autenticado del chat entre usuarios

  lib/                       Logica compartida
    db.ts                    Conexion Drizzle/PostgreSQL
    ollama.ts                Cliente Ollama
    embeddings.ts            Generacion de embeddings
    rebuildBovinoContext.ts  Reconstruccion de contexto semantico
    bovinoValidation.ts      Validaciones de datos bovinos
    iaIntentRouter.ts        Deteccion de intenciones
    iaWriteActionRouter.ts   Inferencia de acciones de escritura
    iaActionPlanner.js       Planner determinista de intenciones, parametros y datos faltantes
    iaConversationState.js   Estado temporal de acciones pendientes por conversacion
    vaccinationInterval.js   Calculo puro del intervalo semestral
    ventaReadiness.js        Regla unica para determinar aptitud de venta
    conversationContext.ts   Contexto conversacional

  drizzle/
    schema.ts                Modelos Drizzle
    drizzle.config.ts        Configuracion Drizzle Kit

  database/
    schema.sql               Schema SQL base
    seeds.sql                Schema ampliado y datos iniciales
    migrations/              Migraciones manuales

  e2e/
    ia.spec.ts               Prueba E2E del asistente IA
    ia.improvements.spec.ts  Reglas de vacunacion, venta, relaciones, contexto y loading
    community.websocket.spec.ts  Tiempo real, deduplicacion, reconexion y lectura
```

## Flujo principal

1. Se levantan servicios con Docker Compose:
   - PostgreSQL con pgvector en `localhost:5433`.
   - Ollama en `localhost:11435`.

2. Se carga la base de datos, normalmente desde `database/seeds.sql`.

3. Se inicia Nuxt en modo desarrollo.

4. El usuario entra a `/login`.

5. El frontend manda email y password a `/api/auth/login`.

6. El backend limita intentos por IP/identidad, normaliza el costo de verificacion para evitar enumeracion por tiempo, valida la password y crea una cookie v3 cifrada, HttpOnly, SameSite=Strict y `Secure` bajo HTTPS confiable. La sesion se registra como hash en `auth_sessions`, dura hasta 12 horas, revoca sesiones anteriores de la cuenta y se elimina en logout. Las contrasenas usan scrypt.

7. Si el login es correcto, el frontend guarda el usuario en:
   - `localStorage`
   - `useState("usuario")`

8. Las paginas protegidas validan la cookie contra `/api/auth/me`; `localStorage` solo se actualiza despues de confirmar una sesion valida.

9. El dashboard consulta `/api/dashboard?usuario_id=...`.

10. Las pantallas CRUD consultan endpoints como:
    - `/api/bovinos`
    - `/api/duenos`
    - `/api/ranchos`
    - `/api/vacunas`
    - `/api/pesos`
    - `/api/enfermedades`

11. Cuando se crea o actualiza informacion relevante de un bovino, se llama a `rebuildBovinoContext`, que reconstruye el texto semantico del animal y genera su embedding.

12. En `/ia`, el frontend crea o recupera una conversacion y manda preguntas a `/api/ia/router`.

13. El router de IA:
    - Clasifica el turno como directo, transaccional o RAG mediante reglas deterministas.
    - Transfiere solo los ultimos mensajes y las entidades relevantes.
    - Guarda mensajes de conversacion.
    - Aplica guardrails.
    - Responde saludos o ayuda sin LLM cuando aplica.
    - Detecta y guarda memorias.
    - Ejecuta un planner determinista para consultas simples, acciones incompletas y confirmaciones.
    - Conserva temporalmente acciones pendientes y la ultima entidad bovino en memoria del servidor.
    - Resuelve referencias como `la vaca`, `ella` o `su peso` contra el contexto estructurado de la conversacion.
    - Confirma los parametros antes de cualquier escritura.
    - Pide datos faltantes en lugar de mostrar errores tecnicos.
    - Ejecuta tools directamente cuando la accion ya esta validada.
    - Ejecuta consultas SQL directas para casos comunes.
    - Intenta function calling con herramientas internas.
    - Consulta datos especificos si detecta un bovino.
    - Usa RAG con memorias y contexto ganadero como fallback.
    - En RAG combina similitud vectorial y Full Text Search mediante RRF.
    - Intenta reranking local y usa los Top-3 de RRF si el servicio no esta disponible.
    - Registra metricas en `ai_logs`.

14. El chat usa streaming tipo SSE para pintar tokens y estados en tiempo real.

15. El chat privado entre usuarios usa `/_ws/community`: autentica la cookie de sesion durante el upgrade, persiste cada mensaje antes del acuse, publica cambios por WebSocket y recupera mensajes posteriores al ultimo cursor al reconectar.

16. El middleware global agrega CSP, HSTS en HTTPS, proteccion contra clickjacking/MIME sniffing, politicas de permisos y no-cache para autenticacion, IA y observabilidad. Los metodos de escritura sin origen verificable, con un `Origin` externo o con `Sec-Fetch-Site: cross-site` se rechazan antes de ejecutar el endpoint.

## Base de datos y modelos

Tablas principales:

- `usuarios`: usuarios del sistema.
- `auth_sessions`: hashes de sesiones activas, expiracion, revocacion y ultima actividad.
- `bovinos`: animales registrados por usuario.
- `duenos`: propietarios.
- `ranchos`: ranchos o ubicaciones.
- `historial_propiedad`: relacion historica entre bovino, dueno y rancho.
- `rancho_duenos`: relacion muchos a muchos entre ranchos y duenos administrados por la cuenta.
- `bovino_duenos`: relacion muchos a muchos entre bovinos y duenos; el bovino conserva un solo `rancho_id` activo.
- `vacunas`: catalogo de vacunas por usuario.
- `vacuna_aplicada`: vacunas aplicadas a bovinos.
- `pesos`: historial de pesos.
- `enfermedades`: enfermedades, tratamientos y veterinario.
- `ventas`: ventas de bovinos.
- `semantic_contexts`: contexto textual y embedding por bovino.
- `memories`: memorias personales no transferibles del usuario con embedding.
- `conversations`: conversaciones de IA.
- `conversation_messages`: mensajes de conversaciones.
- `ai_logs`: observabilidad de prompts, respuestas, latencia, bloqueos y tools.
- `security_rate_limits`: ventanas y contadores persistentes para limites por IP, usuario e identidad.
- `requisitos_venta`: requisitos sanitarios para venta.
- `breeds`: catalogo global y razas personalizadas.
- `bovino_transfers`: solicitudes entre cuentas y estado permanente.
- `bovino_transfer_events`: bitacora inmutable de cada transferencia.
- `notifications` y `notification_reads`: notificaciones y lecturas por usuario.
- `friend_requests` y `friendships`: solicitudes y contactos confirmados.
- `community_conversations`, `community_conversation_members` y `community_messages`: chat privado separado de las conversaciones IA. Cada mensaje puede guardar `client_message_id`, `delivered_at` y `read_at`.
- `activity_audit_logs`: acciones operativas, permisos, duracion y errores controlados.

Notas importantes:

- PostgreSQL usa la extension `vector`.
- Los embeddings tienen dimension `768`.
- `semantic_contexts` usa un indice HNSW con `vector_cosine_ops`.
- `database/seeds.sql` esta mas completo que `database/schema.sql`.
- `drizzle/schema.ts` no coincide al 100% con `seeds.sql`, especialmente en `memories`.

## Comandos para correr el proyecto

Instalar dependencias:

```bash
npm install
```

Levantar servicios:

```bash
docker compose up -d
```

Cargar datos iniciales:

```bash
docker exec -i ganaderia_db psql -U ganaderia -d ganaderia_ai < database/seeds.sql
```

Iniciar desarrollo:

```bash
npm run dev
```

Abrir la aplicacion:

```text
http://localhost:3000
```

Entrar a PostgreSQL:

```bash
docker exec -it ganaderia_db psql -U ganaderia -d ganaderia_ai
```

Detener servicios:

```bash
docker compose down
```

Scripts disponibles en `package.json`:

```bash
npm run dev
npm run build
npm run start
npm run tunnel:start
npm run tunnel:serve
npm run tunnel:quick
npm run test
npm run generate
npm run preview
npm run postinstall
npm run db:migrate:platform
npm run db:migrate:improvements
npm run db:migrate:websocket
npm run db:migrate:security
npm run db:migrate:security-remediation
npm run db:migrate:account-security
npm run db:runtime:configure
npm run db:runtime:verify
npm run admin:bootstrap
npm run test:e2e:platform
npm run test:e2e:improvements
npm run test:e2e:chat
npm run test:e2e:security
```

## Convenciones importantes

- La entidad actual es `bovinos`, aunque todavia existen nombres heredados como `vacas` en componentes, comentarios y algunos textos.
- Las rutas antiguas `/vacas` redirigen a `/bovinos`.
- Algunas paginas todavia envian `usuario_id` por compatibilidad, pero el backend lo ignora y usa la sesion autenticada.
- Las preguntas de IA admiten como maximo 4096 caracteres; `conversation_id` debe ser un UUID valido antes de consultar PostgreSQL.
- `/api/auth/login` limita intentos por IP e identidad. Todos los endpoints API tienen un limite global y los endpoints de IA conservan limites por usuario; los contadores viven en PostgreSQL y responden `429 RATE_LIMITED` con `Retry-After`.
- El registro solicita unicamente nombre, correo electronico y contrasena; conserva validacion server-side, limite de 20 solicitudes por hora e IP y una respuesta identica para correos nuevos o existentes.
- No se crean usuarios demo ni administradores conocidos. La migracion `009` bloquea las cuentas legacy publicadas y el administrador se crea explicitamente con `npm run admin:bootstrap`.
- Las contrasenas nuevas deben tener entre 12 y 200 caracteres y se rechazan valores comunes, repeticiones y datos derivados de nombre/correo.
- Las sesiones v3 son revocables, se guardan solo como hash, aplican una sesion activa por cuenta y no aceptan cookies legacy como autorizacion.
- La observabilidad filtra por la sesion autenticada. Las cuentas normales reciben metricas con prompts, respuestas, sesion, agente, intencion y tools redactados; solo `admin` puede consultar esos detalles y las tools se reducen a `name` y `status`.
- Para un Cloudflare Quick Tunnel se usa `npm run tunnel:quick`: el comando detecta la URL temporal e inyecta su origen y hostname exactos solo durante esa ejecucion. Para hosts estables se mantienen `NUXT_PUBLIC_APP_ORIGIN`, `NUXT_ALLOWED_HOSTS` y `npm run tunnel:serve`. Nunca se expone Vite en el puerto 3000 ni se usan `allowedHosts: true` o comodines `.trycloudflare.com`.
- Las solicitudes mutables requieren `Origin` o `Referer` del mismo origen. Las cookies de sesion son `HttpOnly`, `SameSite=Strict` y `Secure` cuando la solicitud usa HTTPS.
- La CSP de produccion no usa `unsafe-inline` ni `unsafe-eval`; Nitro calcula hashes SHA-256 para los scripts inline de hidratacion de cada respuesta HTML.
- PostgreSQL, Ollama y el reranker se publican unicamente en `127.0.0.1`. La aplicacion usa `DATABASE_RUNTIME_URL` con un rol sin DDL; `DATABASE_MIGRATION_URL` se reserva para tareas administrativas y no hay credenciales fallback.
- `localStorage` solo mantiene la representacion visual del usuario despues de validar `/api/auth/me`; no concede acceso a datos.
- La pantalla `/login` limpia el estado local y cierra cualquier cookie de sesion previa para evitar que aparezca una cuenta activa en el formulario.
- Todas las relaciones se validan contra el usuario autenticado antes de leer o escribir.
- Las fechas vacias se convierten a `null`; IDs, numeros, fechas, enums y textos se normalizan en el servidor.
- Los errores API se serializan sin SQL, parametros, stack traces ni rutas locales.
- Los logs de errores usan `safeErrorDetails`: conservan solo tipo, codigo y estado; los mensajes 5xx nunca se devuelven al cliente.
- Todas las APIs y las paginas de autenticacion usan `Cache-Control: private, no-store`.
- El origen canonico usa el `Host` real; headers reenviados solo se confian desde un peer loopback cuando `NUXT_TRUST_PROXY=loopback`.
- Las tools viven en `server/ai/tools`, no generan endpoints Nitro y las escrituras IA publicas requieren propuesta y confirmacion server-side.
- Los logs IA conservan hashes, longitudes, metricas y nombres de tools permitidos durante 30 dias; no guardan prompts, respuestas, emails ni parametros crudos.
- `semantic_contexts` exige propietario/alcance/fuente/confianza y el RAG solo recupera contexto privado propio o publico explicitamente confiable.
- Para llamadas de lectura se usa normalmente `useFetch`.
- Para acciones de escritura se usa normalmente `$fetch`.
- Para el chat IA con streaming se usa `fetch` nativo.
- Los endpoints mezclan dos estilos de acceso a datos:
  - Drizzle ORM con `db`
  - SQL directo con `postgres`
- Cada cambio importante en datos de un bovino deberia reconstruir su contexto semantico con `rebuildBovinoContext`.
- Al registrar bovinos, el servidor genera el arete `MX-0001` por usuario. El consecutivo vive en `bovino_arete_sequences`, se incrementa de forma atomica dentro de la misma transaccion del alta y no se reutiliza si se elimina un bovino.
- La unicidad del arete es por usuario (`usuario_id`, `numero_arete`); se conserva la busqueda por arete dentro de la cuenta autenticada.
- Las validaciones de bovinos estan centralizadas parcialmente en `lib/bovinoValidation.ts`.
- El router de IA prefiere reglas y consultas concretas antes de invocar el modelo.
- El planner determinista se ejecuta antes de la busqueda por bovino para evitar falsos positivos como interpretar `tengo` o `registrados` como nombres.
- Las acciones incompletas no deben llamar al LLM ni a la base de datos: deben crear una accion pendiente y pedir solo los campos faltantes.
- Las acciones sensibles, como eliminar o transferir propiedad, requieren confirmacion antes de ejecutarse.
- Cada accion pendiente guarda tool, parametros, faltantes, fecha y estado; expira despues de 15 minutos y se cancela al detectar un cambio de intencion.
- Un `si` aislado solo confirma una accion pendiente vigente; nunca reutiliza datos de un proceso cancelado o expirado.
- Las confirmaciones y consultas de memoria deben hablarle al usuario en segunda persona: `soy` se confirma como `eres`, `me llamo` como `te llamas`, `mi` como `tu`.
- El modelo no debe inventar informacion: el prompt del RAG exige usar memorias, contexto ganadero e historial.
- Los agentes no se llaman entre si ni vuelven a invocar al router; el orquestador es el unico punto de seleccion.
- El agente transaccional no recibe documentos RAG y solo puede usar la lista de tools autorizadas.
- El agente RAG es de solo lectura y entrega como maximo tres contextos al modelo.
- La busqueda hibrida recupera Top-10 vectoriales/textuales, fusiona con RRF constante 60 y luego rerankea Top-3.
- Si `RERANKER_URL` no responde, la consulta continua con Top-3 por RRF y registra el fallback.
- El seeder de estres usa operaciones set-based dentro de una transaccion y lotes idempotentes en `stress_seed_batches`.
- Los contextos del seeder no tienen embedding por defecto; `--real-embeddings=N` genera solo un subconjunto real y declarado.
- La evaluacion usa `/api/ia/evaluate`, un juez Ollama local y genera JSON, Markdown y PDF con resultados reales.
- Un bovino esta listo para venta solo si su ultimo peso registrado es de al menos 380 kg y tiene aplicadas Brucelosis, Rabia Paralitica Bovina y Carbon Sintomatico (Pierna Negra) y Edema Maligno. La evaluacion muestra peso, vacunas cumplidas y vacunas faltantes usando exclusivamente datos del usuario autenticado.
- Las tres vacunas obligatorias de venta se crean para usuarios nuevos y la migracion `005` las agrega de forma idempotente a cuentas existentes.
- Una misma pareja `bovino_id`/`vacuna_id` solo admite otra aplicacion al cumplir seis meses calendario. Cada registro conserva fecha, proxima fecha permitida y usuario aplicador; la regla compartida se usa desde la UI y desde IA.
- Los pesos siempre se agregan al historial; registrar uno nuevo mediante IA no sobrescribe el registro anterior.
- Un rancho puede tener varios duenos y un bovino varios duenos mediante tablas puente. `bovinos.rancho_id` representa el unico rancho activo y `created_by_user_id` registra al creador.
- Las transferencias entre cuentas se crean como `PENDING`; el remitente conserva la propiedad hasta que el receptor acepte.
- Solo el receptor puede aceptar o rechazar; solo el remitente puede cancelar. Los estados finales son `ACCEPTED`, `REJECTED`, `CANCELLED` o `EXPIRED`.
- La aceptacion bloquea la transferencia y el bovino dentro de una sola transaccion. Actualiza el rancho activo y los duenos del bovino con los del rancho receptor, cierra la propiedad anterior y conserva pesos, vacunas, enfermedades e historial por `bovino_id`.
- Si el arete colisiona en la cuenta receptora, se genera otro mediante `bovino_arete_sequences` y el cambio queda auditado.
- `bovinos.raza` se conserva por compatibilidad, pero altas y ediciones tambien requieren `breed_id` del catalogo.
- Las razas globales pueden ser administradas por usuarios con rol `admin`; una raza personalizada tambien puede editarla su creador.
- La busqueda de usuarios prioriza correo exacto, nombre exacto, nombre parcial y similitud con `pg_trgm`.
- El chat comunitario solo se habilita entre contactos confirmados. Sus tablas no se mezclan con `conversations` de IA.
- Los mensajes usan WebSocket de Nitro con recuperacion por cursor y respaldo HTTP idempotente. Las notificaciones conservan SSE; ninguno requiere un servicio Docker adicional.
- El estado visible de un mensaje se deriva de PostgreSQL: `sending` es optimista en Vue y `sent`, `delivered` y `read` dependen del alta, `delivered_at` y `read_at`.
- Las nuevas tools comparten servicios con la interfaz y nunca toman `usuario_id` del texto ni del body.

## Pendientes o riesgos detectados

- El flujo `npm run tunnel:quick` se verifico el 2026-07-29 con un hostname Cloudflare nuevo: detecto la URL dinamica, inicio exclusivamente Nitro y `/login` respondio HTTP 200 sin bloqueo de host. La puntuacion tecnica sigue provisional hasta repetir la matriz externa completa de redirect, HSTS, CSP, cookies, WebSocket y ausencia de rutas Vite.
- El perfil opcional del reranker esta endurecido, pero no se construyo ni descargo el modelo pesado durante la auditoria autorizada; falta validarlo y generar SBOM/escaneo de imagen en CI.
- El registro publico no verifica la propiedad del correo electronico ni usa CAPTCHA. Para un despliegue abierto de produccion se recomienda integrar verificacion por correo y controles antiabuso adicionales.
- Las credenciales y el secreto de sesion dependen de `.env`; cada despliegue debe usar valores largos, distintos y fuera del control de versiones.
- PostgreSQL no usa RLS. El aislamiento actual combina rol runtime sin privilegios y ownership en aplicacion; RLS queda como defensa adicional futura que requiere una migracion cuidadosamente probada.
- Hay mezcla de Drizzle y SQL directo, lo que puede complicar mantenimiento.
- `database/schema.sql`, `database/seeds.sql` y `drizzle/schema.ts` no estan completamente sincronizados.
- `memories` ya declara `slot`, `tipo` y `updated_at` en Drizzle, aunque los tres esquemas aun deben mantenerse sincronizados manualmente.
- Hay problemas de encoding en textos con acentos, por ejemplo `GanaderÃ­a` y `DueÃ±os`.
- La suite unitaria cubre extraccion, datos faltantes, confirmaciones, consultas, contexto, venta e intervalo de vacunas. `e2e/ia.improvements.spec.ts` automatiza las relaciones multiples y reglas integradas, pero aun falta ejecutarla desde CI.
- La carpeta `node_modules`, `.nuxt`, `playwright-report` y `test-results` existen localmente; conviene no tratarlas como fuente principal.
- Hay deuda terminologica por la migracion de `vacas` a `bovinos`.
- El estado multi-turno de acciones pendientes es temporal en memoria; no sobrevive reinicios ni multiples instancias del servidor.
- El planner cubre las intenciones principales, pero operaciones menos usadas pueden seguir cayendo al function calling legacy.
- La secuencia automatica de aretes ya evita reutilizar consecutivos por usuario; aun falta automatizar una prueba de concurrencia de base de datos en CI.
- El modelo `BAAI/bge-reranker-v2-m3` es pesado; el servicio es opcional y se activa con el perfil Compose `reranker`.
- No existen metricas oficiales de Semana 7 hasta ejecutar `npm run evaluate:agent` en el entorno de entrega.
- El catalogo inicial incluye 50 razas principales, no un censo mundial exhaustivo de 800-900 razas.
- El hub WebSocket vive en memoria del proceso Nuxt. Para desplegar varias instancias simultaneas se necesita PostgreSQL `LISTEN/NOTIFY` o un bus local que distribuya eventos entre procesos; la persistencia y recuperacion por cursor ya permanecen en PostgreSQL.
- Los archivos y fotografias no tienen tablas propias en el esquema actual. Cualquier tabla futura relacionada mediante `bovino_id` permanecera con el bovino durante la transferencia.
- Las acciones pendientes de IA siguen en memoria; una seleccion de destinatario o confirmacion se pierde si el proceso Nuxt se reinicia.
