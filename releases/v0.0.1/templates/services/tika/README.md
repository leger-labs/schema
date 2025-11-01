# Apache Tika

Content analysis toolkit for extracting text and metadata from 1000+ file types.

## Overview

Apache Tika extracts text from documents (PDF, Word, Excel, etc.) for RAG and document analysis in Open WebUI.

**Container:** `tika`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 9998
**Published Port:** 9998
**Image:** `docker.io/apache/tika:latest`

## Features

- 📄 **1000+ File Types** - PDF, DOCX, XLSX, PPTX, images, etc.
- 📝 **Text Extraction** - Extract plain text from documents
- 🏷️ **Metadata** - Extract author, creation date, etc.
- 🔍 **Content Detection** - Auto-detect file types
- 🖼️ **OCR** - Extract text from images (with Tesseract)

## Quick Start

```bash
systemctl --user daemon-reload
systemctl --user enable tika.service
systemctl --user start tika.service
```

### Test Extraction

```bash
# Extract text from file
curl -T document.pdf http://localhost:9998/tika --header "Accept: text/plain"

# Get metadata
curl -T document.pdf http://localhost:9998/meta --header "Accept: application/json"
```

## Integration with Open WebUI

```bash
# In openwebui.env
RAG_TIKA_SERVER_URL=http://tika:9998
```

## Documentation

- **Official Docs:** https://tika.apache.org/
- **REST API:** https://tika.apache.org/documentation.html

---

**Built with Apache Tika**
