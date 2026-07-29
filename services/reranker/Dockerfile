FROM python:3.11.13-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

RUN useradd --create-home --uid 10001 reranker \
    && chown -R reranker:reranker /app

ENV HOME=/home/reranker \
    HF_HOME=/home/reranker/.cache/huggingface \
    TRANSFORMERS_CACHE=/home/reranker/.cache/huggingface

USER 10001:10001

EXPOSE 8010

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8010"]
