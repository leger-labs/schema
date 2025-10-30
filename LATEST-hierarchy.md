Looking at your migration state, I can see the brilliance in your OpenWebUI config's **3-layer decision model** (Features → Providers → Config), but your sidebar navigation is still too **infrastructure-centric**. Let me propose a radical reorganization that's **capability-first** and **user-intent-driven**.

## 🎯 The Problem with Current Hierarchy

Your prototype sidebar is organized like this:
```
├─ Authentication
├─ Infrastructure  
├─ LLM Services
├─ User Interfaces
├─ Audio Services
└─ Supporting Services
```

This mirrors your **technical architecture**, not your **user's mental model**. A user doesn't think "I need to configure my supporting services" - they think **"I want my AI to understand documents"** or **"I want voice interaction"**.

---

## ✨ Proposed Capability-Based Hierarchy

### **Level 0: Project Metadata** (Always Visible)
```
📋 Project
├─ Name (default: "My LLM Stack")
├─ Environment (development/staging/production)
└─ Version (semver)
```

### **Level 1: Core Capabilities** (Progressive Disclosure)

#### **1️⃣ Identity & Access**
```
🔐 Who can use this?
├─ Authentication Method
│   ├─ None (open access)
│   ├─ Local accounts
│   ├─ OAuth (Google, GitHub, etc.)
│   └─ LDAP/Active Directory
├─ Network Access
│   ├─ Tailscale configuration
│   └─ External domain (optional)
└─ Secrets Management
    └─ API Keys (vault-style entry)
```

#### **2️⃣ Conversation** 
```
💬 What can your AI talk to?
├─ Cloud LLMs
│   ├─ OpenAI (GPT-5, GPT-4o)
│   ├─ Anthropic (Claude 4.x)
│   ├─ Google (Gemini 2.5)
│   ├─ X.AI (Grok 4)
│   └─ [+ Add Provider]
│
├─ Local LLMs
│   ├─ Enable Local Inference? [toggle]
│   ├─ Model Roster
│   │   ├─ Heavy Models (swap group)
│   │   │   ├─ GPT-OSS 120B
│   │   │   └─ Qwen3 235B
│   │   └─ Task Models (always loaded)
│   │       ├─ Qwen3 0.6B (fast)
│   │       └─ Qwen3 4B (balanced)
│   └─ Hardware
│       ├─ GPU Acceleration (auto-detect)
│       └─ Memory Allocation
│
└─ Routing Strategy
    ├─ Default Model
    ├─ Fallback Chain
    └─ Cost Optimization
```

**UX Note**: Provider cards with toggle switches. When enabled, show API key field. "Test Connection" button.

#### **3️⃣ Knowledge & Memory**
```
🧠 How does your AI remember and learn?
├─ Document Understanding (RAG)
│   ├─ Enable RAG? [toggle]
│   │
│   ├─ Document Processing
│   │   ├─ PDF, DOCX, Images → [Apache Tika | Docling | Mistral OCR]
│   │   └─ Chunking Strategy
│   │       ├─ Chunk Size: 1500 tokens
│   │       └─ Overlap: 100 tokens
│   │
│   ├─ Embeddings
│   │   ├─ Model: [Qwen3 Embedding 8B ✓ | Nomic | Voyage | OpenAI]
│   │   └─ Vector Database: [PGVector ✓ | Qdrant | ChromaDB | Pinecone]
│   │
│   └─ Retrieval
│       ├─ Top-K Results: 3
│       ├─ Enable Reranking? [toggle]
│       └─ Hybrid Search? [toggle]
│
├─ Web Search
│   ├─ Enable? [toggle]
│   ├─ Engine: [SearXNG (self-hosted) ✓ | Tavily | Brave | Perplexity]
│   └─ Result Count: 3
│
└─ Long-term Memory
    └─ Storage: [PostgreSQL ✓ | SQLite | External]
```

**UX Note**: Conditional fields - only show chunking strategy if RAG enabled. Visual diagram of RAG pipeline.

#### **4️⃣ Multimodal**
```
🎨 Beyond text: images, audio, video
├─ Vision
│   ├─ Image Understanding (via cloud LLMs)
│   └─ Image Generation
│       ├─ Enable? [toggle]
│       └─ Engine: [OpenAI DALL-E | Stability | ComfyUI | Automatic1111]
│
├─ Audio Input (Speech-to-Text)
│   ├─ Enable? [toggle]
│   ├─ Engine: [Whisper (local) ✓ | OpenAI | Deepgram]
│   └─ Language: [Auto-detect | English | ...]
│
└─ Audio Output (Text-to-Speech)
    ├─ Enable? [toggle]
    ├─ Engine: [Edge-TTS (free) ✓ | OpenAI | ElevenLabs]
    └─ Default Voice: [en-AU-NatashaNeural ▼]
```

**UX Note**: Audio preview buttons. Model comparison table.

#### **5️⃣ Actions & Tools**
```
⚡ What can your AI do?
├─ Code Execution
│   ├─ Enable? [toggle]
│   ├─ Environment: [Jupyter ✓ | Pyodide]
│   └─ Workspace: /home/jovyan/blueprint-workspace
│
├─ File Access
│   ├─ Google Drive [toggle]
│   └─ OneDrive [toggle]
│
└─ Custom Integrations
    └─ MCP Servers [+ Add]
```

#### **6️⃣ Intelligence Configuration**
```
🧩 How your AI thinks
├─ Task Models (background operations)
│   ├─ Title Generation: [qwen3-0.6b ▼]
│   ├─ Tags Generation: [qwen3-4b ▼]
│   ├─ Query Rewriting: [qwen3-4b ▼]
│   └─ Auto-complete: [qwen3-0.6b ▼]
│
├─ Context Management
│   ├─ Max Context Window: Auto (from model)
│   └─ Memory Span: 7 hours (Claude Opus 4.1)
│
└─ Reasoning Control
    ├─ Extended Thinking (o-models)
    ├─ Reasoning Budget
    └─ Thinking Traces (visible/hidden)
```

---

### **Level 2: Infrastructure** (Collapsed by Default)

#### **Advanced → System Services**
```
⚙️ Under the hood (auto-configured)
├─ Databases (read-only view)
│   ├─ LiteLLM Postgres (auto)
│   ├─ OpenWebUI Postgres (auto)
│   └─ Redis Instances (auto)
│
├─ Networking
│   ├─ Reverse Proxy: Caddy (auto)
│   ├─ Internal Network: 10.89.0.0/24
│   └─ Published Ports [view/edit]
│
└─ Resource Limits
    ├─ Memory per service
    └─ GPU allocation
```

**UX Note**: "You don't need to touch this" banner. Advanced users can expand.

---

## 📊 JSON Schema Structure

Here's how this translates to your manifest:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Leger Stack Configuration",
  "type": "object",
  
  "properties": {
    "project": {
      "type": "object",
      "title": "Project Metadata",
      "properties": {
        "name": { "type": "string", "default": "My LLM Stack" },
        "environment": { 
          "type": "string", 
          "enum": ["development", "staging", "production"],
          "default": "development"
        },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" }
      }
    },
    
    "identity": {
      "type": "object",
      "title": "Identity & Access",
      "properties": {
        "auth_method": {
          "type": "string",
          "enum": ["none", "local", "oauth", "ldap"],
          "default": "none"
        },
        "tailscale": {
          "type": "object",
          "properties": {
            "hostname": { "type": "string" },
            "tailnet": { "type": "string" }
          }
        }
      }
    },
    
    "conversation": {
      "type": "object",
      "title": "Conversation Capabilities",
      "properties": {
        "cloud_llms": {
          "type": "object",
          "title": "Cloud LLM Providers",
          "properties": {
            "openai": {
              "type": "object",
              "properties": {
                "enabled": { "type": "boolean", "default": false },
                "api_key": { 
                  "type": "string", 
                  "format": "password",
                  "x-secret": true  // Custom extension for secret handling
                },
                "models": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "name": { "type": "string" },
                      "enabled": { "type": "boolean" }
                    }
                  },
                  "default": [
                    { "name": "gpt-5", "enabled": true },
                    { "name": "gpt-5-mini", "enabled": true }
                  ]
                }
              },
              "dependencies": {
                "enabled": {
                  "oneOf": [
                    { "properties": { "enabled": { "const": false } } },
                    { "required": ["api_key"] }
                  ]
                }
              }
            },
            "anthropic": { /* similar structure */ },
            "gemini": { /* similar structure */ }
          }
        },
        
        "local_llms": {
          "type": "object",
          "title": "Local LLM Inference",
          "properties": {
            "enabled": { "type": "boolean", "default": false },
            "heavy_models": {
              "type": "array",
              "title": "Heavy Models (one active at a time)",
              "items": {
                "type": "string",
                "enum": ["gpt-oss-20b", "gpt-oss-120b", "qwen3-235b"]
              },
              "default": ["gpt-oss-20b"],
              "x-ui-widget": "checkboxes"
            },
            "task_models": {
              "type": "array",
              "title": "Task Models (always loaded)",
              "items": {
                "type": "string",
                "enum": ["qwen3-0.6b", "qwen3-4b"]
              },
              "default": ["qwen3-0.6b", "qwen3-4b"]
            },
            "gpu_acceleration": {
              "type": "string",
              "enum": ["auto", "vulkan", "cpu"],
              "default": "auto"
            }
          }
        },
        
        "routing": {
          "type": "object",
          "properties": {
            "default_model": { 
              "type": "string",
              "x-ui-widget": "model-selector"  // Custom widget
            },
            "fallback_chain": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    },
    
    "knowledge": {
      "type": "object",
      "title": "Knowledge & Memory",
      "properties": {
        "rag": {
          "type": "object",
          "title": "Document Understanding (RAG)",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            
            "document_processing": {
              "type": "object",
              "properties": {
                "engine": {
                  "type": "string",
                  "enum": ["tika", "docling", "mistral_ocr"],
                  "default": "tika"
                },
                "chunk_size": { "type": "integer", "default": 1500 },
                "chunk_overlap": { "type": "integer", "default": 100 }
              }
            },
            
            "embeddings": {
              "type": "object",
              "properties": {
                "model": {
                  "type": "string",
                  "enum": [
                    "qwen3-embedding-8b",
                    "nomic-embed-text-v1.5",
                    "voyage-3-large",
                    "openai/text-embedding-3-small"
                  ],
                  "default": "qwen3-embedding-8b"
                },
                "vector_db": {
                  "type": "string",
                  "enum": ["pgvector", "qdrant", "chroma", "pinecone"],
                  "default": "pgvector"
                }
              }
            },
            
            "retrieval": {
              "type": "object",
              "properties": {
                "top_k": { "type": "integer", "default": 3 },
                "enable_reranking": { "type": "boolean", "default": false },
                "enable_hybrid_search": { "type": "boolean", "default": false }
              }
            }
          }
        },
        
        "web_search": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "engine": {
              "type": "string",
              "enum": ["searxng", "tavily", "brave", "perplexity"],
              "default": "searxng"
            },
            "result_count": { "type": "integer", "default": 3 }
          },
          "dependencies": {
            "engine": {
              "oneOf": [
                {
                  "properties": {
                    "engine": { "const": "tavily" },
                    "tavily_api_key": { 
                      "type": "string",
                      "x-secret": true
                    }
                  },
                  "required": ["tavily_api_key"]
                },
                { "properties": { "engine": { "const": "searxng" } } }
              ]
            }
          }
        }
      }
    },
    
    "multimodal": {
      "type": "object",
      "title": "Multimodal Capabilities",
      "properties": {
        "speech_to_text": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "engine": {
              "type": "string",
              "enum": ["whisper-local", "openai", "deepgram"],
              "default": "whisper-local"
            },
            "language": {
              "type": "string",
              "enum": ["auto", "en", "es", "fr", "de"],
              "default": "auto"
            }
          }
        },
        
        "text_to_speech": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "engine": {
              "type": "string",
              "enum": ["edge-tts", "openai", "elevenlabs"],
              "default": "edge-tts"
            },
            "default_voice": {
              "type": "string",
              "default": "en-AU-NatashaNeural"
            }
          }
        },
        
        "image_generation": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": false },
            "engine": {
              "type": "string",
              "enum": ["openai", "stability", "comfyui"],
              "default": "openai"
            }
          }
        }
      }
    },
    
    "actions": {
      "type": "object",
      "title": "Actions & Tools",
      "properties": {
        "code_execution": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "engine": {
              "type": "string",
              "enum": ["jupyter", "pyodide"],
              "default": "jupyter"
            }
          }
        },
        
        "file_access": {
          "type": "object",
          "properties": {
            "google_drive": { "type": "boolean", "default": false },
            "onedrive": { "type": "boolean", "default": false }
          }
        }
      }
    },
    
    "intelligence": {
      "type": "object",
      "title": "Intelligence Configuration",
      "properties": {
        "task_models": {
          "type": "object",
          "properties": {
            "title_generation": { 
              "type": "string",
              "default": "qwen3-0.6b",
              "x-model-type": "text-generation"
            },
            "tags_generation": {
              "type": "string",
              "default": "qwen3-4b"
            },
            "query_rewriting": {
              "type": "string",
              "default": "qwen3-4b"
            }
          }
        }
      }
    }
  },
  
  "required": ["project", "conversation"]
}
```

---

## 🎨 UI Schema (RJSF)

```json
{
  "ui:order": [
    "project",
    "identity",
    "conversation",
    "knowledge",
    "multimodal",
    "actions",
    "intelligence",
    "*"
  ],
  
  "project": {
    "ui:collapsed": false,
    "ui:help": "Basic information about your LLM stack"
  },
  
  "conversation": {
    "ui:collapsed": false,
    "cloud_llms": {
      "ui:widget": "provider-cards",  // Custom widget
      "openai": {
        "api_key": {
          "ui:widget": "password",
          "ui:help": "Get your API key from platform.openai.com",
          "ui:options": {
            "testConnection": true
          }
        },
        "models": {
          "ui:widget": "model-checklist",
          "ui:options": {
            "showPricing": true,
            "showCapabilities": true
          }
        }
      }
    },
    
    "local_llms": {
      "heavy_models": {
        "ui:widget": "model-cards",
        "ui:help": "Heavy models swap - only one runs at a time"
      },
      "task_models": {
        "ui:widget": "model-cards",
        "ui:help": "Task models stay loaded for instant response"
      }
    }
  },
  
  "knowledge": {
    "rag": {
      "enabled": {
        "ui:widget": "switch",
        "ui:help": "Enable document understanding and search"
      },
      "embeddings": {
        "model": {
          "ui:widget": "select-with-preview",
          "ui:options": {
            "showPerformance": true,
            "showMemoryRequirement": true
          }
        },
        "vector_db": {
          "ui:widget": "radio-cards",
          "ui:options": {
            "showDiagram": true
          }
        }
      }
    }
  }
}
```

---

## 🧩 Sidebar Navigation (Final)

```
📋 Project

🔐 Identity & Access
├─ Authentication
├─ Network
└─ Secrets

💬 Conversation
├─ Cloud LLMs
├─ Local LLMs
└─ Routing

🧠 Knowledge & Memory
├─ Document Understanding (RAG)
├─ Web Search
└─ Storage

🎨 Multimodal
├─ Vision
├─ Audio Input
└─ Audio Output

⚡ Actions & Tools
├─ Code Execution
├─ File Access
└─ Custom Integrations

🧩 Intelligence
├─ Task Models
├─ Context Management
└─ Reasoning Control

⚙️ Advanced
├─ System Services (auto)
├─ Networking (auto)
└─ Resource Limits

📦 Export & Deploy
├─ Preview
├─ Validate
└─ Download
```

---

## 💡 Key UX Innovations

### 1. **Progressive Disclosure**
- Start with "What do you want your AI to do?"
- Only show configuration details when feature is enabled
- Advanced/auto-managed sections collapsed by default

### 2. **Smart Defaults**
```javascript
// Backend auto-derives services from capabilities
if (knowledge.rag.enabled && knowledge.rag.document_processing.engine === "tika") {
  infrastructure.services.tika = {
    enabled: true,
    image: "apache/tika:latest-full",
    // ... auto-generated
  }
}
```

### 3. **Dependency Visualization**
```
[RAG Enabled] ✓
  ↓
[Document Processor] → Tika
  ↓
[Embeddings] → Qwen3 8B
  ↓
[Vector DB] → PGVector
  ↓
[Services Auto-Enabled]
  • tika.container
  • openwebui-postgres (pgvector)
```

### 4. **Validation Rules**
```json
{
  "if": {
    "properties": { 
      "knowledge": { 
        "properties": { 
          "web_search": { 
            "properties": { 
              "engine": { "const": "tavily" } 
            } 
          } 
        } 
      } 
    }
  },
  "then": {
    "properties": {
      "knowledge": {
        "properties": {
          "web_search": {
            "required": ["tavily_api_key"]
          }
        }
      }
    }
  }
}
```

---

## 🎯 What This Achieves

1. **User thinks in capabilities**, not services
2. **Automatic service derivation** (tika, qdrant, jupyter enabled based on choices)
3. **Conditional forms** (only show tavily_api_key if tavily selected)
4. **Visual hierarchy** matches mental model
5. **Opinionated but flexible** (sensible defaults, advanced override)

This is a **capability manifest** that **generates infrastructure**, not an infrastructure config that enables capabilities.

Want me to flesh out specific sections or tackle the secrets management UX next?
