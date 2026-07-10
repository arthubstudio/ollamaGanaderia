# AI_CONTEXT.md

## Resumen del proyecto

Ganaderia_AI es una aplicacion web fullstack para gestion de ganado bovino con asistencia de IA local. Permite administrar bovinos, duenos, ranchos, vacunas, vacunas aplicadas, pesos, enfermedades, historial de propiedad, ventas, conversaciones, memorias y observabilidad de interacciones con IA.

El proyecto esta construido como una aplicacion Nuxt: frontend y backend viven en el mismo repositorio. Las paginas Vue consumen endpoints Nitro ubicados en `server/api`, y esos endpoints consultan PostgreSQL usando una mezcla de Drizzle ORM y SQL directo con `postgres`.

La IA funciona con Ollama local. Usa un router principal que combina reglas, consultas SQL directas, guardrails, memoria de usuario, function calling con herramientas internas y fallback RAG sobre contexto semantico almacenado en PostgreSQL con pgvector.

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
    auth.ts                  Middleware client-side basado en localStorage

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

  server/utils/
    session.ts               Sesion firmada y hash de contrasenas
    api.ts                   Normalizacion y errores seguros
    ownership.ts             Validacion de propiedad por usuario

  server/services/
    ownershipTransfer.ts     Transferencias transaccionales

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

8. Las paginas protegidas conservan `localStorage` para estado visual, pero la autorizacion real ocurre en Nitro mediante la cookie de sesion.

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
```

## Convenciones importantes

- La entidad actual es `bovinos`, aunque todavia existen nombres heredados como `vacas` en componentes, comentarios y algunos textos.
- Las rutas antiguas `/vacas` redirigen a `/bovinos`.
- Algunas paginas todavia envian `usuario_id` por compatibilidad, pero el backend lo ignora y usa la sesion firmada.
- `localStorage` solo mantiene la representacion visual del usuario; no concede acceso a datos.
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
- El modelo no debe inventar informacion: el prompt del RAG exige usar memorias, contexto ganadero e historial.
- Un bovino esta listo para venta solo si su ultimo peso registrado es de al menos 550 kg y tiene aplicadas Brucelosis, Clostridiales, Complejo Respiratorio y Rabia. La evaluacion usa exclusivamente datos del usuario autenticado.

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
- `numero_arete` sigue siendo unico globalmente en PostgreSQL, no unico por usuario.
- Varias tools legacy aun crean su propio cliente PostgreSQL con credenciales locales; los endpoints principales ya usan `DATABASE_URL`, pero falta terminar esa unificacion.
