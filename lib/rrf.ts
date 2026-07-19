export type RrfSource = "semantic_contexts" | "memories";

export type RrfRankedRow = {
  id: string | number;
  source: RrfSource;
  content: string;
  score: number;
};

export type RrfResult = {
  id: number | string;
  source: RrfSource;
  content: string;
  vectorScore: number;
  textScore: number;
  fusedScore: number;
};

export function reciprocalRankFusion(
  vectorRows: RrfRankedRow[],
  textRows: RrfRankedRow[],
  topK = 10,
  rrfConstant = 60
): RrfResult[] {
  const merged = new Map<string, RrfResult>();

  const addRows = (rows: RrfRankedRow[], scoreType: "vectorScore" | "textScore") => {
    rows.forEach((row, index) => {
      const key = `${row.source}:${row.id}`;
      const current = merged.get(key) ?? {
        id: row.id,
        source: row.source,
        content: row.content,
        vectorScore: 0,
        textScore: 0,
        fusedScore: 0
      };
      current[scoreType] = Number(row.score) || 0;
      current.fusedScore += 1 / (rrfConstant + index + 1);
      merged.set(key, current);
    });
  };

  addRows(vectorRows, "vectorScore");
  addRows(textRows, "textScore");

  return [...merged.values()]
    .sort((left, right) => right.fusedScore - left.fusedScore)
    .slice(0, topK);
}

