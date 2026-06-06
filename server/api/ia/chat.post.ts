import postgres from "postgres";

import ollama from "ollama";

import { generarEmbedding }
from "~/lib/embeddings";

const sql = postgres(
  "postgres://ganaderia:ganaderia123@127.0.0.1:5433/ganaderia_ai",
  {
    prepare: false
  }
);

export default defineEventHandler(async (event) => {

  const body = await readBody(event);



  // =====================================================
  // EMBEDDING
  // =====================================================

  const embedding =
    await generarEmbedding(
      body.pregunta
    );

  const vector =
    `[${embedding.join(",")}]`;



  // =====================================================
  // VECTOR SEARCH
  // =====================================================

  const resultados = await sql`

    SELECT

      contenido,

      embedding <=> ${vector}::vector
      AS distancia

    FROM semantic_contexts

    ORDER BY distancia ASC

    LIMIT 3

  `;



  // =====================================================
  // VALIDAR RELEVANCIA
  // =====================================================

  const mejorResultado =
    resultados[0];



  if (
    !mejorResultado ||
    mejorResultado.distancia > 0.45
  ) {

    return {

      respuesta:
        "No encontré información relacionada en el sistema.",

      contexto: null

    };

  }



  // =====================================================
  // CONTEXTO
  // =====================================================

  const contexto = resultados
    .map(r => r.contenido)
    .join("\n");



  // =====================================================
  // LLM
  // =====================================================

  const response =
    await ollama.chat({

      model: "llama3.2:latest",

      options: {

        temperature: 0,

        top_p: 0.1

      },

      messages: [

        {

          role: "system",

          content: `

Eres un sistema privado de gestión ganadera.

REGLAS OBLIGATORIAS:

- SOLO usa información del CONTEXTO.
- NO inventes información.
- NO uses conocimiento externo.
- NO expliques conceptos generales.
- Si la pregunta NO está relacionada
  con el contexto,
  responde:
  "No encontré información relacionada en el sistema."

- Responde breve,
  clara y natural.

`

        },

        {

          role: "user",

          content: `

CONTEXTO:

${contexto}

PREGUNTA:

${body.pregunta}

RESPUESTA:

`

        }

      ]

    });



  return {

    respuesta:
      response.message.content,

    contexto

  };

});