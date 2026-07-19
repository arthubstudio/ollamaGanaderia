import postgres from "postgres";
import { Ollama } from "ollama";

function argumentValue(name: string) {
  const prefix = `--${name}=`;
  const argument = process.argv.find((item) => item.startsWith(prefix));
  return argument?.slice(prefix.length);
}

function asPositiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const requestedCount = asPositiveInteger(argumentValue("count"), 50000);
if (requestedCount < 6) {
  throw new Error("--count debe ser al menos 6 para distribuir datos entre todas las tablas.");
}

const rawBatch = argumentValue("batch") ?? "semana07";
const batchKey = rawBatch.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 40);
const usuarioId = asPositiveInteger(argumentValue("user"), Number(process.env.STRESS_USER_ID) || 2);
const realEmbeddings = Math.min(
  requestedCount,
  asPositiveInteger(argumentValue("real-embeddings"), 0)
);
const databaseUrl = process.env.DATABASE_URL ??
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai";
const sql = postgres(databaseUrl, { prepare: false, max: 1 });

const bovinosCount = Math.max(1, Math.floor(requestedCount * 0.3));
const pesosCount = Math.max(1, Math.floor(requestedCount * 0.25));
const enfermedadesCount = Math.max(1, Math.floor(requestedCount * 0.1));
const vacunasAplicadasCount = Math.max(1, Math.floor(requestedCount * 0.15));
const historialCount = Math.max(1, Math.floor(requestedCount * 0.1));
const contextosCount = requestedCount - bovinosCount - pesosCount -
  enfermedadesCount - vacunasAplicadasCount - historialCount;

if (contextosCount < 1) {
  throw new Error("La distribucion calculada no deja registros para semantic_contexts.");
}

const prefix = `ST-${batchKey}-`;
const startedAt = Date.now();
let skipped = false;

try {
  const userRows = await sql`SELECT id FROM usuarios WHERE id = ${usuarioId} LIMIT 1`;
  if (!userRows.length) {
    throw new Error(`No existe el usuario ${usuarioId}. Usa --user=<id> con un usuario valido.`);
  }

  await sql.begin(async (tx) => {
    const previous = await tx`
      SELECT status, requested_count
      FROM stress_seed_batches
      WHERE batch_key = ${batchKey}
      LIMIT 1
    `;

    if (previous[0]?.status === "completed") {
      skipped = true;
      return;
    }

    await tx`
      INSERT INTO stress_seed_batches (
        batch_key, usuario_id, requested_count, inserted_count, status
      ) VALUES (
        ${batchKey}, ${usuarioId}, ${requestedCount}, 0, 'running'
      )
      ON CONFLICT (batch_key) DO UPDATE SET
        usuario_id = EXCLUDED.usuario_id,
        requested_count = EXCLUDED.requested_count,
        inserted_count = 0,
        status = 'running',
        started_at = NOW(),
        completed_at = NULL
    `;

    await tx`
      INSERT INTO duenos (usuario_id, nombre, telefono, direccion)
      SELECT ${usuarioId}, ${`Stress Owner ${batchKey}`}, '0000000000', 'Datos ficticios Semana 7'
      WHERE NOT EXISTS (
        SELECT 1 FROM duenos
        WHERE usuario_id = ${usuarioId} AND nombre = ${`Stress Owner ${batchKey}`}
      )
    `;

    await tx`
      INSERT INTO ranchos (usuario_id, nombre, ubicacion, dueno_id)
      SELECT
        ${usuarioId},
        ${`Stress Ranch ${batchKey}`},
        'Ubicacion ficticia',
        (SELECT MIN(id) FROM duenos WHERE usuario_id = ${usuarioId} AND nombre = ${`Stress Owner ${batchKey}`})
      WHERE NOT EXISTS (
        SELECT 1 FROM ranchos
        WHERE usuario_id = ${usuarioId} AND nombre = ${`Stress Ranch ${batchKey}`}
      )
    `;

    await tx`
      INSERT INTO vacunas (usuario_id, nombre, descripcion)
      SELECT ${usuarioId}, value.nombre, 'Vacuna ficticia para prueba de estres'
      FROM (VALUES
        ('Stress Brucelosis'),
        ('Stress Clostridiales'),
        ('Stress Respiratoria'),
        ('Stress Rabia')
      ) AS value(nombre)
      ON CONFLICT (usuario_id, nombre) DO NOTHING
    `;

    await tx`
      INSERT INTO bovinos (
        usuario_id, numero_arete, nombre, raza, sexo,
        fecha_nacimiento, estado, created_at, updated_at
      )
      SELECT
        ${usuarioId},
        ${prefix} || LPAD(series.n::text, 6, '0'),
        'Stress ' || ${batchKey} || ' ' || series.n,
        (ARRAY['Brahman', 'Angus', 'Holstein', 'Charolais'])[((series.n - 1) % 4) + 1],
        CASE WHEN series.n % 2 = 0 THEN 'Hembra' ELSE 'Macho' END,
        CURRENT_DATE - ((series.n % 1825)::int),
        'activa',
        NOW(),
        NOW()
      FROM generate_series(1, ${bovinosCount}) AS series(n)
      ON CONFLICT DO NOTHING
    `;

    await tx`
      WITH batch_bovinos AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY numero_arete) AS rn
        FROM bovinos
        WHERE usuario_id = ${usuarioId} AND numero_arete LIKE ${`${prefix}%`}
      ), generated AS (
        SELECT n, ((n - 1) % ${bovinosCount}) + 1 AS bovino_rn
        FROM generate_series(1, ${pesosCount}) AS series(n)
      )
      INSERT INTO pesos (bovino_id, peso, fecha, created_at)
      SELECT b.id, 180 + (g.n % 480), CURRENT_DATE - (g.n % 730)::int, NOW()
      FROM generated g
      JOIN batch_bovinos b ON b.rn = g.bovino_rn
    `;

    await tx`
      WITH batch_bovinos AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY numero_arete) AS rn
        FROM bovinos
        WHERE usuario_id = ${usuarioId} AND numero_arete LIKE ${`${prefix}%`}
      ), generated AS (
        SELECT n, ((n - 1) % ${bovinosCount}) + 1 AS bovino_rn
        FROM generate_series(1, ${enfermedadesCount}) AS series(n)
      )
      INSERT INTO enfermedades (bovino_id, nombre, tratamiento, fecha, veterinario)
      SELECT
        b.id,
        (ARRAY['Fiebre ficticia', 'Tos ficticia', 'Revision preventiva'])[((g.n - 1) % 3) + 1],
        'Tratamiento ficticio controlado',
        CURRENT_DATE - (g.n % 365)::int,
        'Veterinario Stress'
      FROM generated g
      JOIN batch_bovinos b ON b.rn = g.bovino_rn
    `;

    await tx`
      WITH batch_bovinos AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY numero_arete) AS rn
        FROM bovinos
        WHERE usuario_id = ${usuarioId} AND numero_arete LIKE ${`${prefix}%`}
      ), batch_vaccines AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY nombre) AS rn
        FROM vacunas
        WHERE usuario_id = ${usuarioId} AND nombre LIKE 'Stress %'
      ), generated AS (
        SELECT
          n,
          ((n - 1) % ${bovinosCount}) + 1 AS bovino_rn,
          ((n - 1) % 4) + 1 AS vacuna_rn
        FROM generate_series(1, ${vacunasAplicadasCount}) AS series(n)
      )
      INSERT INTO vacuna_aplicada (
        bovino_id, vacuna_id, fecha_aplicacion, veterinario, observaciones, created_at
      )
      SELECT
        b.id, v.id, CURRENT_DATE - (g.n % 365)::int,
        'Veterinario Stress', ${`STRESS_BATCH=${batchKey}`}, NOW()
      FROM generated g
      JOIN batch_bovinos b ON b.rn = g.bovino_rn
      JOIN batch_vaccines v ON v.rn = g.vacuna_rn
    `;

    await tx`
      WITH batch_bovinos AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY numero_arete) AS rn
        FROM bovinos
        WHERE usuario_id = ${usuarioId} AND numero_arete LIKE ${`${prefix}%`}
      ), generated AS (
        SELECT n, ((n - 1) % ${bovinosCount}) + 1 AS bovino_rn
        FROM generate_series(1, ${historialCount}) AS series(n)
      )
      INSERT INTO historial_propiedad (
        bovino_id, dueno_id, rancho_id, fecha_inicio, observaciones
      )
      SELECT
        b.id,
        (SELECT MIN(id) FROM duenos WHERE usuario_id = ${usuarioId} AND nombre = ${`Stress Owner ${batchKey}`}),
        (SELECT MIN(id) FROM ranchos WHERE usuario_id = ${usuarioId} AND nombre = ${`Stress Ranch ${batchKey}`}),
        CURRENT_DATE - (g.n % 730)::int,
        ${`STRESS_BATCH=${batchKey}`}
      FROM generated g
      JOIN batch_bovinos b ON b.rn = g.bovino_rn
    `;

    await tx`
      WITH batch_bovinos AS (
        SELECT id, nombre, numero_arete, ROW_NUMBER() OVER (ORDER BY numero_arete) AS rn
        FROM bovinos
        WHERE usuario_id = ${usuarioId} AND numero_arete LIKE ${`${prefix}%`}
      ), generated AS (
        SELECT n, ((n - 1) % ${bovinosCount}) + 1 AS bovino_rn
        FROM generate_series(1, ${contextosCount}) AS series(n)
      )
      INSERT INTO semantic_contexts (bovino_id, contenido, embedding, updated_at)
      SELECT
        b.id,
        ${`STRESS_BATCH=${batchKey}; `} ||
          'Bovino ficticio ' || b.nombre || ' con arete ' || b.numero_arete ||
          '. Contexto de rendimiento numero ' || g.n || '.',
        NULL,
        NOW()
      FROM generated g
      JOIN batch_bovinos b ON b.rn = g.bovino_rn
    `;

    await tx`
      UPDATE stress_seed_batches
      SET inserted_count = ${requestedCount}, status = 'completed', completed_at = NOW()
      WHERE batch_key = ${batchKey}
    `;
  });

  if (realEmbeddings > 0 && !skipped) {
    const ollama = new Ollama({
      host: process.env.OLLAMA_HOST ?? "http://127.0.0.1:11435"
    });
    const contexts = await sql`
      SELECT id, contenido
      FROM semantic_contexts
      WHERE contenido LIKE ${`STRESS_BATCH=${batchKey};%`}
        AND embedding IS NULL
      ORDER BY id
      LIMIT ${realEmbeddings}
    `;

    for (const context of contexts) {
      const response = await ollama.embeddings({
        model: process.env.EMBEDDING_MODEL ?? "nomic-embed-text",
        prompt: String(context.contenido)
      });
      const vector = `[${response.embedding.join(",")}]`;
      await sql`
        UPDATE semantic_contexts
        SET embedding = ${vector}::vector, updated_at = NOW()
        WHERE id = ${context.id}
      `;
    }
  }

  const counts = await sql`
    SELECT
      (SELECT COUNT(*) FROM bovinos WHERE usuario_id = ${usuarioId} AND numero_arete LIKE ${`${prefix}%`})::int AS bovinos,
      (SELECT COUNT(*) FROM pesos p JOIN bovinos b ON b.id = p.bovino_id WHERE b.usuario_id = ${usuarioId} AND b.numero_arete LIKE ${`${prefix}%`})::int AS pesos,
      (SELECT COUNT(*) FROM enfermedades e JOIN bovinos b ON b.id = e.bovino_id WHERE b.usuario_id = ${usuarioId} AND b.numero_arete LIKE ${`${prefix}%`})::int AS enfermedades,
      (SELECT COUNT(*) FROM vacuna_aplicada va JOIN bovinos b ON b.id = va.bovino_id WHERE b.usuario_id = ${usuarioId} AND va.observaciones = ${`STRESS_BATCH=${batchKey}`})::int AS vacunas_aplicadas,
      (SELECT COUNT(*) FROM historial_propiedad hp JOIN bovinos b ON b.id = hp.bovino_id WHERE b.usuario_id = ${usuarioId} AND hp.observaciones = ${`STRESS_BATCH=${batchKey}`})::int AS historial_propiedad,
      (SELECT COUNT(*) FROM semantic_contexts WHERE contenido LIKE ${`STRESS_BATCH=${batchKey};%`})::int AS semantic_contexts,
      (SELECT COUNT(*) FROM semantic_contexts WHERE contenido LIKE ${`STRESS_BATCH=${batchKey};%`} AND embedding IS NOT NULL)::int AS embeddings_reales
  `;

  const elapsedMs = Date.now() - startedAt;
  const inserted = skipped ? 0 : requestedCount;
  console.log(JSON.stringify({
    batch: batchKey,
    usuario_id: usuarioId,
    cantidad_solicitada: requestedCount,
    cantidad_insertada_esta_ejecucion: inserted,
    lote_omitido_por_idempotencia: skipped,
    tiempo_total_ms: elapsedMs,
    filas_por_segundo: elapsedMs > 0 ? Number((inserted / (elapsedMs / 1000)).toFixed(2)) : 0,
    conteo_final_por_tabla: counts[0]
  }, null, 2));
} finally {
  await sql.end();
}

