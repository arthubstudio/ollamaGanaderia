import os
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from sentence_transformers import CrossEncoder


MODEL_NAME = os.getenv("RERANKER_MODEL", "BAAI/bge-reranker-v2-m3")
MAX_DOCUMENTS = int(os.getenv("RERANKER_MAX_DOCUMENTS", "50"))

app = FastAPI(title="Ganaderia AI Local Reranker", version="1.0.0")
model = CrossEncoder(MODEL_NAME)


class RerankRequest(BaseModel):
    query: str = Field(min_length=1, max_length=4000)
    documents: List[str] = Field(min_length=1, max_length=MAX_DOCUMENTS)


@app.get("/health")
def health():
    return {"status": "ok", "model": MODEL_NAME}


@app.post("/rerank")
def rerank(request: RerankRequest):
    try:
        pairs = [[request.query, document] for document in request.documents]
        scores = model.predict(pairs)
        results = [
            {"index": index, "score": float(score)}
            for index, score in enumerate(scores)
        ]
        results.sort(key=lambda item: item["score"], reverse=True)
        return {"results": results}
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

