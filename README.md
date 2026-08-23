# CellVantage

A full-stack battery cell tracking and lifecycle management system with an AI agent layer for automated anomaly detection and spec-grounded decision-making.

Built as a portfolio project to demonstrate full-stack engineering, RBAC system design, and applied LLM/RAG integration in an industrial workflow context.

---

## What it does

CellVantage tracks individual battery cells through a defined lifecycle:

```
Received → Incoming QC → Storage → Under Test → Passed / Failed → Disposed
```

Each stage is owned by a specific business role, and every state transition is validated server-side — no role can skip steps or act outside its lane.

On top of the core tracking system sits an **AI agent** that can:
- Read a cell's cycle-test telemetry (voltage, internal resistance, capacity, temperature)
- Detect anomalies against configurable thresholds (rule-based, not LLM-based — deterministic and auditable)
- Retrieve grounding evidence from the USABC Battery Test Manual via RAG
- Automatically flag a cell as `Failed` when a critical anomaly is found, with the decision and its spec citation written to the audit log
- Run this analysis one cell at a time, or in batch across an entire test run
- Be operated entirely through natural language, in English, Chinese, or German

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                 │
│  ├─ Role-aware pages (Cells, Dashboard, Users, Import)    │
│  ├─ AgentCopilot — draggable chat widget (ball/window/    │
│  │  fullscreen), session history, i18n                    │
│  └─ recharts — line charts (metrics), donut chart          │
│     (state distribution)                                  │
└───────────────────────┬─────────────────────────────────┘
                         │ REST (axios + JWT)
┌───────────────────────┴─────────────────────────────────┐
│  Backend (Node.js + Express)                              │
│  ├─ Guardrail middleware — validates every state          │
│  │  transition against role rules, returns structured     │
│  │  machine-readable errors                                │
│  ├─ Anomaly detection — rule engine over telemetry         │
│  ├─ Agent orchestration — 5-step decision chain            │
│  │  (fetch → detect → retrieve → decide → log)             │
│  └─ RAG bridge — spawns Python subprocess for retrieval    │
└──────┬──────────────────────────────────┬───────────────┘
       │                                   │
┌──────┴──────┐                  ┌─────────┴──────────────┐
│   MySQL      │                  │  Python RAG pipeline    │
│  (cells,     │                  │  ├─ ChromaDB (vector     │
│   metrics,   │                  │  │  store, page-by-page  │
│   audit log, │                  │  │  ingestion)            │
│   batches)   │                  │  └─ USABC Battery Test    │
└─────────────┘                   │     Manual (public spec)  │
                                   └───────────────────────────┘
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React (Vite), recharts, axios |
| Backend | Node.js, Express, MySQL (mysql2) |
| Auth | JWT, bcrypt |
| RAG / Agent | Python, ChromaDB, pypdf |
| Data generation | Python (numpy-free synthetic telemetry generator) |

No LLM API is used for the core agent logic — anomaly detection and state-transition decisions are rule-based and fully deterministic, so every automated action is explainable and auditable. RAG retrieval uses ChromaDB's built-in lightweight embedding function (no external API calls, runs entirely locally).

---

## Role-based access control

Five business roles form a closed loop, each with a single responsibility:

| Role | Can move cells |
|---|---|
| `quality_engineer` | Received → Incoming QC / Failed |
| `warehouse_staff` | Incoming QC → Storage |
| `lab_operator` | Storage → Under Test → Passed / Failed |
| `disposal_manager` | Failed → Disposed |
| `admin` | manages users/roles only — does not participate in the workflow |

**Design principle:** visibility and permission are separated. Every logged-in user can *see* every cell (needed for traceability and audit purposes), but *state-changing actions* are strictly gated by role through the Guardrail layer. A `lab_operator` cannot, for example, dispose of a cell — attempting to do so returns a structured `403` with the exact rule that was violated.

---

## The Agent

### Single-cell analysis
```
POST /api/agent/analyze/:cellCode
```
Requires the cell to be in `Under Test` state and the caller to be a `lab_operator` (mirroring who owns that stage of the real workflow). Runs a 5-step chain:

1. Fetch cell + telemetry
2. Run anomaly detection (internal resistance, capacity drop, over-temperature)
3. For each *critical* anomaly, query the USABC manual via RAG
4. If critical anomalies exist, validate + execute a state change to `Failed` through the Guardrail
5. Write an audit log entry containing the anomaly details and the spec citation used to justify the decision

### Batch analysis
```
POST /api/agent/analyze-batch
```
Runs the same logic across a list of cells (or an entire state, e.g. all cells currently `Under Test`). Returns a per-cell outcome plus an aggregate summary — built for scenarios like "a new shipment just arrived, check all of it."

### Natural language interface
The `AgentCopilot` widget accepts commands in English, Chinese, or German:

```
analyze SIM-0081                   分析 SIM-0081                analysiere SIM-0081
analyze all under test             分析所有测试中的电池          analysiere alle im test
query <spec question>              查询 <问题>                  suche <Frage>
status SIM-0081                    状态 SIM-0081                status SIM-0081
history SIM-0081                   历史 SIM-0081                verlauf SIM-0081
list failed / list under test      列出失败的电池 / 列出测试中的电池
help                                帮助                          hilfe
```

---

## RAG pipeline

The knowledge base is the [USABC Battery Test Manual](https://avt.inl.gov) — a public DOE specification for EV battery testing, chosen deliberately over any proprietary/manufacturer documentation.

```bash
cd backend/rag
python ingest.py   # page-by-page PDF parsing + chunking → ChromaDB (~800 chunks)
python query.py "your question here"   # standalone test
```

Ingestion is done page-by-page rather than loading the full document into memory at once — this was a deliberate fix after early versions caused OOM kills on a memory-constrained VM.

---

## Getting started

### Prerequisites
- Node.js, MySQL, Python 3.11+ (conda recommended)

### Backend
```bash
cd backend
npm install
cp .env.example .env    # fill in DB credentials, JWT secret
mysql -u root -p < ../database/schema.sql
node server.js
```

### RAG setup (one-time)
```bash
conda create -n cellvantage python=3.11
conda activate cellvantage
pip install chromadb pypdf mysql-connector-python
cd backend/rag
# place a copy of the USABC manual PDF here as usabc_manual.pdf
python ingest.py
```
Update `PYTHON_BIN` in `backend/routes/agent.js` to point at your conda environment's Python.

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Demo data (optional)
Generates 100 simulated cells (80 normal, 10 thermal-runaway anomalies, 10 resistance-degradation anomalies) with 20 test cycles each:
```bash
cd backend/scripts
python generate_test_data.py
python bulk_import.py
```

---

## Project structure

```
backend/
  agent/           anomaly detection rule engine
  guardrails/       state-transition validation (role rules)
  rag/              Python ingestion + query scripts, ChromaDB store
  routes/           Express route handlers (cells, agent, metrics, audit, auth, batches)
  scripts/          synthetic data generation + bulk import
frontend/
  src/components/  AgentCopilot, Navbar
  src/context/      Auth, Language (i18n)
  src/pages/        Login, Dashboard, CellList, CellDetail, UserManagement, etc.
database/
  schema.sql
```

---

## Notes

This project intentionally avoids calling an external LLM API for its core decision logic — anomaly detection and state transitions are rule-based so that every automated action is deterministic, testable, and traceable to a specific threshold or rule. The RAG layer adds spec-grounded context to those decisions without making the decisions themselves probabilistic.