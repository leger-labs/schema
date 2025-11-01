# Leger Schema v0.0.1

**Release Date:** 2025-01-31
**Status:** Initial Release

## What's Included

- Complete JSON Schema with 29 decision variables
- 39 Nunjucks templates for 13+ services
- Tailscale MagicDNS integration
- Progressive disclosure UI metadata
- Database-per-service architecture

## Services

### Core
- OpenWebUI + Postgres + Redis
- LiteLLM + Postgres + Redis
- Caddy (reverse proxy)

### AI Features
- RAG: Qdrant, Tika
- Web Search: SearXNG + Redis
- Speech: Whisper (STT), EdgeTTS (TTS)
- Images: ComfyUI
- Code: Jupyter

### Infrastructure
- Cockpit (system management)
- Llama-Swap (local model router)
- MCP Context Forge + Postgres

## Breaking Changes

N/A - Initial release

## Known Issues

None - all templates tested and working

## Upgrade Path

N/A - Initial release
