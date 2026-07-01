"""
RAG Ingest Pipeline（逐页处理版）
----------------------------------
逐页读取 PDF，每页处理完立即写入 ChromaDB 再释放内存，
避免把整个文档一次性读进内存导致 OOM。
"""

import os
import re
from pypdf import PdfReader
import chromadb
from chromadb.utils import embedding_functions

PDF_PATH = "./usabc_manual.pdf"
CHROMA_DB_DIR = "./chroma_db"
COLLECTION_NAME = "battery_specs"
CHUNK_SIZE = 300   # 调小一点，进一步减少单次内存压力


def clean_text(text: str) -> str:
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {2,}', ' ', text)
    return text.strip()


def chunk_text(text: str, chunk_size: int) -> list:
    """把一段文字切成固定大小的片段（无重叠，简化版）。"""
    chunks = []
    words = text.split()
    current_chunk = []
    current_len = 0

    for word in words:
        current_chunk.append(word)
        current_len += len(word) + 1
        if current_len >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_len = 0

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


def ingest():
    if not os.path.exists(PDF_PATH):
        print(f"❌ 找不到 PDF 文件：{PDF_PATH}")
        return

    print(f"📄 开始逐页处理：{PDF_PATH}")

    ef = embedding_functions.DefaultEmbeddingFunction()
    client = chromadb.PersistentClient(path=CHROMA_DB_DIR)

    # 清空旧数据
    existing = [c.name for c in client.list_collections()]
    if COLLECTION_NAME in existing:
        client.delete_collection(COLLECTION_NAME)

    collection = client.create_collection(
        name=COLLECTION_NAME,
        embedding_function=ef,
        metadata={"hnsw:space": "cosine"}
    )

    reader = PdfReader(PDF_PATH)
    total_pages = len(reader.pages)
    total_chunks = 0
    chunk_id = 0

    for page_num, page in enumerate(reader.pages):
        text = page.extract_text()
        if not text or len(text.strip()) < 20:
            continue

        text = clean_text(text)
        chunks = chunk_text(text, CHUNK_SIZE)

        if chunks:
            collection.add(
                ids=[f"p{page_num}_c{i}" for i in range(len(chunks))],
                documents=chunks,
                metadatas=[{"page": page_num + 1} for _ in chunks]
            )
            total_chunks += len(chunks)

        print(f"   页 {page_num + 1}/{total_pages}，累计片段：{total_chunks}", end="\r")

    print(f"\n✅ 完成！共存入 {total_chunks} 个片段")
    print(f"   数据库位置：{os.path.abspath(CHROMA_DB_DIR)}")
    print("\n现在可以运行 query.py 来测试检索了。")


if __name__ == "__main__":
    ingest()