"""
RAG Query Engine（轻量版）
--------------------------
用法（手动测试）：
    conda activate CellVantage
    cd backend/rag
    python query.py "What is the cutoff voltage for lithium cells?"
"""

import sys
import json
import os
import chromadb
from chromadb.utils import embedding_functions


CHROMA_DB_DIR = "./chroma_db"
COLLECTION_NAME = "battery_specs"
TOP_K = 3


def query(question: str) -> dict:
    if not os.path.exists(CHROMA_DB_DIR):
        return {
            "success": False,
            "error": "Vector database not found. Please run ingest.py first."
        }

    ef = embedding_functions.DefaultEmbeddingFunction()
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
    collection = client.get_collection(
        name=COLLECTION_NAME,
        embedding_function=ef
    )

    results = collection.query(
        query_texts=[question],
        n_results=TOP_K,
        include=["documents", "distances"]
    )

    formatted_results = []
    docs = results["documents"][0]
    distances = results["distances"][0]

    for rank, (doc, dist) in enumerate(zip(docs, distances), start=1):
        similarity = round(1 - dist / 2, 4)
        formatted_results.append({
            "rank": rank,
            "text": doc,
            "similarity": similarity
        })

    return {
        "success": True,
        "question": question,
        "results": formatted_results
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "Usage: python query.py <question>"}))
        sys.exit(1)

    question = " ".join(sys.argv[1:])
    result = query(question)
    print(json.dumps(result, ensure_ascii=False, indent=2))