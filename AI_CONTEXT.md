# AI_CONTEXT.md

## Resumen del proyecto

Ganaderia_AI es una aplicacion web fullstack para gestion de ganado bovino con asistencia de IA local. Permite administrar bovinos, duenos, ranchos, vacunas, vacunas aplicadas, pesos, enfermedades, historial de propiedad, ventas, conversaciones, memorias y observabilidad de interacciones con IA.

La fase de plataforma agrega transferencias de bovinos entre cuentas, catalogo global de razas, notificaciones en tiempo real, contactos y mensajeria privada. Estos dominios reutilizan la sesion firmada, PostgreSQL y las tools transaccionales existentes.

El proyecto esta construido como una aplicacion Nuxt: frontend y backend viven en el mismo repositorio. Las paginas Vue consumen endpoints Nitro ubicados en `server/api`, y esos endpoints consultan PostgreSQL usando una mezcla de Drizzle ORM y SQL directo con `postgres`.

La IA funciona con Ollama local. Usa un router principal que combina reglas, consultas SQL directas, guardrails, memoria de usuario, function calling con herramientas internas y fallback RAG sobre contexto semantico almacenado en PostgreSQL con pgvector.

Desde Semana 7, el endpoint principal delega en una arquitectura multiagente incremental: un router determinista clasifica cada turno como `direct`, `transactional` o `rag`; el agente transaccional reutiliza las tools existentes y el agente RAG usa busqueda hibrida, RRF y reranking local con fallback.

El flujo actual incluye una capa determinista previa al LLM para clasificar intenciones frecuentes, extraer parametros, detectar datos faltantes, mantener acciones pendientes por conversacion y pedir confirmacion antes de cualquier escritura. La autenticacion usa una cookie de sesion firmada y HttpOnly; los endpoints obtienen `usuario_id` exclusivamente de esa sesion.

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
    ia/                      Router IA, chat, tools y acciones
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
    session.ts               Sesion firmada y hash de contrasenas
    api.ts                   Normalizacion y errores seguros
    ownership.ts             Validacion de propiedad por usuario

  server/services/
    ownershipTransfer.ts     Transferencias transaccionales
    accountTransfer.ts       Solicitudes y aceptacion entre cuentas
    breedService.ts          Catalogo global de razas
    community.ts             Amistades, conversaciones y mensajes
    notifications.ts         Bandeja y estado de lectura
    userDirectory.ts         Busqueda priorizada de usuarios
    activityAudit.ts         Auditoria operativa

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
```

## Flujo principal

1. Se levantan servicios con Docker Compose:
   - PostgreSQL con pgvector en `localhost:5433`.
   - Ollama en `localhost:11435`.

2. Se carga la base de datos, normalmente desde `database/seeds.sql`.

3. Se inicia Nuxt en modo desarrollo.

4. El usuario entra a `/login`.

5. El frontend manda email y password a `/api/auth/login`.

6. El backend busca el usuario, valida la password y crea una cookie de sesion firmada, HttpOnly y SameSite=Lax. Las contrasenas nuevas usan scrypt; las contrasenas legacy se actualizan al iniciar sesion.

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

## Base de datos y modelos

Tablas principales:

- `usuarios`: usuarios del sistema.
- `bovinos`: animales registrados por usuario.
- `duenos`: propietarios.
- `ranchos`: ranchos o ubicaciones.
- `historial_propiedad`: relacion historica entre bovino, dueno y rancho.
- `vacunas`: catalogo de vacunas por usuario.
- `vacuna_aplicada`: vacunas aplicadas a bovinos.
- `pesos`: historial de pesos.
- `enfermedades`: enfermedades, tratamientos y veterinario.
- `ventas`: ventas de bovinos.
- `semantic_contexts`: contexto textual y embedding por bovino.
- `memories`: memorias personales del usuario con embedding.
- `conversations`: conversaciones de IA.
- `conversation_messages`: mensajes de conversaciones.
- `ai_logs`: observabilidad de prompts, respuestas, latencia, bloqueos y tools.
- `requisitos_venta`: requisitos sanitarios para venta.
- `breeds`: catalogo global y razas personalizadas.
- `bovino_transfers`: solicitudes entre cuentas y estado permanente.
- `bovino_transfer_events`: bitacora inmutable de cada transferencia.
- `notifications` y `notification_reads`: notificaciones y lecturas por usuario.
- `friend_requests` y `friendships`: solicitudes y contactos confirmados.
- `community_conversations`, `community_conversation_members` y `community_messages`: chat privado separado de las conversaciones IA.
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
npm run test
npm run generate
npm run preview
npm run postinstall
npm run db:migrate:platform
npm run test:e2e:platform
```

## Convenciones importantes

- La entidad actual es `bovinos`, aunque todavia existen nombres heredados como `vacas` en componentes, comentarios y algunos textos.
- Las rutas antiguas `/vacas` redirigen a `/bovinos`.
- Algunas paginas todavia envian `usuario_id` por compatibilidad, pero el backend lo ignora y usa la sesion firmada.
- `localStorage` solo mantiene la representacion visual del usuario despues de validar `/api/auth/me`; no concede acceso a datos.
- La pantalla `/login` limpia el estado local y cierra cualquier cookie de sesion previa para evitar que aparezca una cuenta activa en el formulario.
- Todas las relaciones se validan contra el usuario autenticado antes de leer o escribir.
- Las fechas vacias se convierten a `null`; IDs, numeros, fechas, enums y textos se normalizan en el servidor.
- Los errores API se serializan sin SQL, parametros, stack traces ni rutas locales.
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
- El estado pendiente se guarda en memoria del servidor; si se reinicia Nuxt, se pierde.
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
- Un bovino esta listo para venta solo si su ultimo peso registrado es de al menos 550 kg y tiene aplicadas Brucelosis, Clostridiales, Complejo Respiratorio y Rabia. La evaluacion usa exclusivamente datos del usuario autenticado.
- Las transferencias entre cuentas se crean como `PENDING`; el remitente conserva la propiedad hasta que el receptor acepte.
- Solo el receptor puede aceptar o rechazar; solo el remitente puede cancelar. Los estados finales son `ACCEPTED`, `REJECTED`, `CANCELLED` o `EXPIRED`.
- La aceptacion bloquea la transferencia y el bovino dentro de una sola transaccion. Las relaciones por `bovino_id` no se copian ni eliminan, por lo que conservan su identidad e historial.
- Si el arete colisiona en la cuenta receptora, se genera otro mediante `bovino_arete_sequences` y el cambio queda auditado.
- `bovinos.raza` se conserva por compatibilidad, pero altas y ediciones tambien requieren `breed_id` del catalogo.
- Las razas globales pueden ser administradas por usuarios con rol `admin`; una raza personalizada tambien puede editarla su creador.
- La busqueda de usuarios prioriza correo exacto, nombre exacto, nombre parcial y similitud con `pg_trgm`.
- El chat comunitario solo se habilita entre contactos confirmados. Sus tablas no se mezclan con `conversations` de IA.
- Notificaciones y mensajes usan SSE con sondeo corto de PostgreSQL; no requieren un servicio Docker adicional.
- Las nuevas tools comparten servicios con la interfaz y nunca toman `usuario_id` del texto ni del body.

## Pendientes o riesgos detectados

- Los usuarios legacy de seeds conservan inicialmente contrasenas en texto plano, pero se migran a scrypt en su siguiente login.
- La sesion es stateless y firmada; no existe revocacion central antes de su expiracion de 12 horas.
- Las credenciales de PostgreSQL estan hardcodeadas en varios archivos.
- Hay mezcla de Drizzle y SQL directo, lo que puede complicar mantenimiento.
- `database/schema.sql`, `database/seeds.sql` y `drizzle/schema.ts` no estan completamente sincronizados.
- `memories` ya declara `slot`, `tipo` y `updated_at` en Drizzle, aunque los tres esquemas aun deben mantenerse sincronizados manualmente.
- Hay problemas de encoding en textos con acentos, por ejemplo `GanaderÃ­a` y `DueÃ±os`.
- El README menciona Nuxt 3, pero el proyecto usa Nuxt 4 en `package.json`.
- La suite unitaria cubre extraccion, datos faltantes, confirmaciones, consultas y contexto; la seguridad de endpoints tambien se verifico con dos sesiones reales, pero falta automatizar esa prueba de integracion en CI.
- La carpeta `node_modules`, `.nuxt`, `playwright-report` y `test-results` existen localmente; conviene no tratarlas como fuente principal.
- Hay deuda terminologica por la migracion de `vacas` a `bovinos`.
- El estado multi-turno de acciones pendientes es temporal en memoria; no sobrevive reinicios ni multiples instancias del servidor.
- El planner cubre las intenciones principales, pero operaciones menos usadas pueden seguir cayendo al function calling legacy.
- La secuencia automatica de aretes ya evita reutilizar consecutivos por usuario; aun falta automatizar una prueba de concurrencia de base de datos en CI.
- Varias tools legacy aun crean su propio cliente PostgreSQL con credenciales locales; los endpoints principales ya usan `DATABASE_URL`, pero falta terminar esa unificacion.
- El modelo `BAAI/bge-reranker-v2-m3` es pesado; el servicio es opcional y se activa con el perfil Compose `reranker`.
- No existen metricas oficiales de Semana 7 hasta ejecutar `npm run evaluate:agent` en el entorno de entrega.
- El catalogo inicial incluye 50 razas principales, no un censo mundial exhaustivo de 800-900 razas.
- El SSE actual consulta PostgreSQL cada dos segundos por conexion. Para una instalacion con muchas instancias conviene incorporar PostgreSQL `LISTEN/NOTIFY` o un bus local, sin cambiar la API publica.
- Los archivos y fotografias no tienen tablas propias en el esquema actual. Cualquier tabla futura relacionada mediante `bovino_id` permanecera con el bovino durante la transferencia.
- Las acciones pendientes de IA siguen en memoria; una seleccion de destinatario o confirmacion se pierde si el proceso Nuxt se reinicia.
