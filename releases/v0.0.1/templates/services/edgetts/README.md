# Edge TTS

Microsoft Edge text-to-speech service for natural voice synthesis.

## Overview

Edge TTS provides high-quality text-to-speech using Microsoft's Edge browser voices.

**Container:** `edgetts`
**Network:** `llm.network` (10.89.0.0/24)
**Internal Port:** 8000
**Published Port:** 5050
**Image:** `docker.io/travisvn/edge-tts-api:latest`

## Features

- 🗣️ **Natural Voices** - Microsoft's neural TTS
- 🌍 **Multi-Language** - 100+ voices in 60+ languages
- 🎵 **Voice Styles** - Adjust pitch, rate, volume
- ⚡ **Fast Synthesis** - Real-time voice generation
- 📝 **SSML Support** - Advanced speech markup

## Quick Start

```bash
systemctl --user daemon-reload
systemctl --user enable edgetts.service
systemctl --user start edgetts.service
```

### Test TTS

```bash
# Generate speech
curl -X POST http://localhost:5050/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "voice": "en-US-AriaNeural"}' \
  --output speech.mp3
```

## Integration with Open WebUI

```bash
# In openwebui.env
AUDIO_TTS_ENGINE=edge
AUDIO_TTS_API_BASE_URL=http://edgetts:8000
ENABLE_AUDIO_OUTPUT=true
```

## Files

```
edgetts/
├── edgetts.container.njk     # Quadlet container
├── edgetts-cache.volume      # Voice cache
├── edgetts.caddy.njk         # Caddy config
└── README.md                 # This file
```

## Available Voices

```bash
# List all voices
curl http://localhost:5050/voices
```

Popular voices:
- `en-US-AriaNeural` - Female, American English
- `en-US-GuyNeural` - Male, American English
- `en-GB-SoniaNeural` - Female, British English

## Documentation

- **Edge TTS:** https://github.com/rany2/edge-tts

---

**Built with Microsoft Edge TTS**
