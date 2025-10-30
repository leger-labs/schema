# Qdrant

High-performance vector database for similarity search and RAG (Retrieval-Augmented Generation).

## Overview

Qdrant stores and retrieves document embeddings for Open WebUI's RAG functionality, enabling semantic search over uploaded documents.

**Container:** `qdrant`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 6333
**Published Port:** 6333
**Image:** `docker.io/qdrant/qdrant:latest`
**External URL:** https://qdrant.blueprint.tail8dd1.ts.net

## Features

- 🚀 **High Performance** - Written in Rust, optimized for speed
- 📊 **Vector Search** - Similarity search using cosine, dot product, euclidean
- 🎯 **Filtering** - Combine vector search with filters
- 📁 **Collections** - Organize vectors by collection
- 🔌 **gRPC & REST** - Multiple API options
- 📈 **Scalable** - Handles millions of vectors
- 🎨 **Web UI** - Built-in dashboard for management

## Quick Start

### 1. Enable and Start Service

```bash
systemctl --user daemon-reload
systemctl --user enable qdrant.service
systemctl --user start qdrant.service
systemctl --user status qdrant.service
```

### 2. Access Qdrant

- **Web UI:** http://localhost:6333/dashboard
- **API:** http://localhost:6333
- **Tailscale:** https://qdrant.blueprint.tail8dd1.ts.net

### 3. Test API

```bash
# Health check
curl http://localhost:6333/health

# List collections
curl http://localhost:6333/collections
```

## Configuration

### blueprint-config.json

```json
{
  "qdrant": {
    "hostname": "qdrant",
    "port": 6333,
    "published_port": 6333,
    "external_subdomain": "qdrant",
    "enabled": true,
    "volume": "qdrant.volume"
  }
}
```

### Storage

Vectors are persisted in `qdrant.volume` at `/qdrant/storage`.

## Integration with Open WebUI

Open WebUI uses Qdrant for document embeddings:

```bash
# In openwebui.env
VECTOR_DB=qdrant
QDRANT_URL=http://qdrant:6333
RAG_EMBEDDING_ENGINE=litellm
RAG_EMBEDDING_MODEL=text-embedding-3-small
```

When you upload documents to Open WebUI:
1. Documents are chunked
2. Chunks are embedded using the embedding model
3. Embeddings are stored in Qdrant
4. Queries retrieve relevant chunks via vector search

## Files

```
qdrant/
├── qdrant.container.njk      # Quadlet container
├── qdrant.volume             # Data volume
├── qdrant.caddy.njk          # Caddy config
└── README.md                 # This file
```

## Troubleshooting

### Check Logs

```bash
journalctl --user -u qdrant.service -f
```

### View Collections

```bash
# List all collections
curl http://localhost:6333/collections | jq .

# Get collection info
curl http://localhost:6333/collections/{collection_name} | jq .
```

### Common Issues

#### Collection Not Found

Collections are created automatically by Open WebUI when documents are uploaded.

#### Out of Memory

Increase available memory or reduce collection size:

```bash
# Delete a collection
curl -X DELETE http://localhost:6333/collections/{collection_name}
```

## Documentation

- **Official Docs:** https://qdrant.tech/documentation/
- **API Reference:** https://qdrant.tech/documentation/interfaces/
- **GitHub:** https://github.com/qdrant/qdrant

---

**Built with Qdrant**
