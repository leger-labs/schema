# Whisper Speech-to-Text

OpenAI Whisper for accurate speech recognition and transcription.

## Overview

Whisper provides speech-to-text capabilities for Open WebUI voice input.

**Container:** `whisper`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 9000
**Published Port:** 9000
**Image:** `docker.io/onerahmet/openai-whisper-asr-webservice:latest`

## Features

- 🎤 **Accurate Transcription** - OpenAI's Whisper model
- 🌍 **Multi-Language** - 99+ languages supported
- 🔊 **Multiple Formats** - WAV, MP3, M4A, etc.
- ⚡ **Fast Processing** - Local inference, no API calls
- 📝 **Timestamps** - Word-level timing information

## Quick Start

```bash
systemctl --user daemon-reload
systemctl --user enable whisper.service
systemctl --user start whisper.service
```

### Test Transcription

```bash
# Transcribe audio file
curl -F "audio_file=@audio.mp3" http://localhost:9000/asr
```

## Integration with Open WebUI

```bash
# In openwebui.env
AUDIO_STT_ENGINE=whisper
AUDIO_STT_API_BASE_URL=http://whisper:9000
ENABLE_AUDIO_INPUT=true
```

## Files

```
whisper/
├── whisper.container.njk     # Quadlet container
├── whisper-cache.volume      # Model cache
└── README.md                 # This file
```

## Documentation

- **Whisper Paper:** https://arxiv.org/abs/2212.04356
- **OpenAI Whisper:** https://github.com/openai/whisper

---

**Built with OpenAI Whisper**
