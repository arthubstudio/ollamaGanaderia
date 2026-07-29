import { generarEmbeddingSafe } from "~/lib/embeddings";
import { sql } from "~/lib/db";
import {
  reciprocalRankFusion,
  type RrfRankedRow
} from "~/lib/rrf";
import { buildPostgresTextQuery } from "~/lib/fullTextSearch";

export { reciprocalRankFusion } from "~/lib/rrf";

export type HybridSearchResult = {
  id: number | string;
  source: "semantic_contexts" | "memories";
  content: string;
  vectorScore: number;
  textScore: number;
  fusedScore: number;
};

export async function hybridSearch(params: {
  query: string;
  usuarioId: number;
  topK?: number;
}): Promise<HybridSearchResult[]> {
  const topK = Math.min(50, Math.max(1, params.topK ?? 10));
  const textQuery = buildPostgresTextQuery(params.query);
  const embedding = await generarEmbeddingSafe(params.query);
  let vectorRows: RrfRankedRow[] = [];

  if (embedding?.length) {
    const vectorLiteral = `[${embedding.join(",")}]`;
    const rows = await sql`
      WITH vector_candidates AS (
        SELECT
          sc.id::text AS id,
          'semantic_contexts'::text AS source,
          sc.contenido AS content,
          1 - (sc.embedding <=> ${vectorLiteral}::vector) AS score
        FROM semantic_contexts sc
        LEFT JOIN bovinos b ON b.id = sc.bovino_id
        WHERE sc.embedding IS NOT NULL
          AND sc.trusted = TRUE
          AND (
            (sc.scope = 'public' AND sc.owner_user_id IS NULL)
            OR (
              sc.scope = 'private'
              AND sc.owner_user_id = ${params.usuarioId}
              AND (sc.bovino_id IS NULL OR b.usuario_id = ${params.usuarioId})
            )
          )

        UNION ALL

        SELECT
          m.id::text AS id,
          'memories'::text AS source,
          m.contenido AS content,
          1 - (m.embedding <=> ${vectorLiteral}::vector) AS score
        FROM memories m
        WHERE m.usuario_id = ${params.usuarioId}
          AND m.embedding IS NOT NULL
      )
      SELECT id, source, content, score
      FROM vector_candidates
      ORDER BY score DESC
      LIMIT ${topK}
    `;

    vectorRows = rows.map((row: any) => ({
      id: row.id,
      source: row.source,
      content: row.content,
      score: Number(row.score) || 0
    }));
  }

  const textRowsRaw = await sql`
    WITH query AS (
      SELECT to_tsquery('simple', ${textQuery}) AS value
    ), text_candidates AS (
      SELECT
        sc.id::text AS id,
        'semantic_contexts'::text AS source,
        sc.contenido AS content,
        ts_rank_cd(
          to_tsvector('simple', COALESCE(sc.contenido, '')),
          query.value
        ) AS score
      FROM semantic_contexts sc
      LEFT JOIN bovinos b ON b.id = sc.bovino_id
      CROSS JOIN query
      WHERE sc.trusted = TRUE
        AND (
          (sc.scope = 'public' AND sc.owner_user_id IS NULL)
          OR (
            sc.scope = 'private'
            AND sc.owner_user_id = ${params.usuarioId}
            AND (sc.bovino_id IS NULL OR b.usuario_id = ${params.usuarioId})
          )
        )
        AND to_tsvector('simple', COALESCE(sc.contenido, '')) @@ query.value

      UNION ALL

      SELECT
        m.id::text AS id,
        'memories'::text AS source,
        m.contenido AS content,
        ts_rank_cd(
          to_tsvector('simple', COALESCE(m.contenido, '')),
          query.value
        ) AS score
      FROM memories m
      CROSS JOIN query
      WHERE m.usuario_id = ${params.usuarioId}
        AND to_tsvector('simple', COALESCE(m.contenido, '')) @@ query.value
    )
    SELECT id, source, content, score
    FROM text_candidates
    ORDER BY score DESC
    LIMIT ${topK}
  `;

  const textRows: RrfRankedRow[] = textRowsRaw.map((row: any) => ({
    id: row.id,
    source: row.source,
    content: row.content,
    score: Number(row.score) || 0
  }));

  return reciprocalRankFusion(vectorRows, textRows, topK);
}
