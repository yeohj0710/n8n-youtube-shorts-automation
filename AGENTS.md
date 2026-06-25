# n8n Local Runner Rules

- Treat this folder as the deployable source for the local n8n runner.
- Do not commit `.n8n`, `node_modules`, `renders`, `binary-data`, logs, SQLite databases, or credentials.
- Before changing workflow JSON, export/read the current local n8n DB workflow first so manually adjusted node positions are preserved.
- Do not re-import an older workflow JSON over the local DB unless intentionally resetting layout.
- Keep `http://localhost:5678/` as the local n8n URL. Do not use `127.0.0.1` for OAuth work.
- Keep KIE and Google/YouTube secrets outside git.
