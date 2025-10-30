# Leger Schema v0.0.1 - Design Decisions Handoff

**Date**: 2025-01-15  
**Context**: Architectural discussion for schema.json design  
**Status**: Key decisions extracted, ready for architecture refinement with new context

---

## Critical User Decisions Made

### 1. Repository Structure Confirmed

**Decision**: Option A - Leger Schema Repo structure
```
leger-schema/
├── releases/
│   └── v0.0.1/
│       ├── schema.json      # Single source of truth
│       ├── templates/        # All .njk templates
│       └── RELEASE.md
```

**Note**: Currently working from `leger-labs-schema/` directory with templates in service folders.

---

### 2. Service Definition Architecture: Full Topology Model (Option C)

**CHOSEN**: Full Topology Model

**Rationale Given**:
> "your C full topology model makes more sense; i prefer to have a dedicated rubrick for 'docker container versions' that is separate from what published port etc. it also gives nice presets that the user can override."

**Key insight**: Separation between version registry and infrastructure configuration is desired, but...

**RETRACTED**: Release catalog concept rejected as redundant
> "the release catalog is redundant with the simplicity of the njk files.. i just make sure that the version in the njk file is hardcoded and correct (not latest)."

**Implication**: Versions are hardcoded directly in .njk templates, not in schema.json.

---

### 3. Schema.json Role Clarification

**CRITICAL DISTINCTION**:

```
┌─────────────────────────────────────────────────────┐
│ schema.json                                         │
│ - Validation rules (types, enums, patterns)         │
│ - UI metadata (x-* extensions for RJSF/uischema)   │
│ - Default values                                    │
│ - Cascade logic (x-depends-on, x-affects-services) │
│ - THE CONTRACT between user and templates           │
└─────────────────────────────────────────────────────┘
                     ≠
┌─────────────────────────────────────────────────────┐
│ *.njk templates                                     │
│ - Rendering logic                                   │
│ - Hardcoded versions                                │
│ - Actual file generation                            │
└─────────────────────────────────────────────────────┘
```

**User quote**:
> "your topology services structure is NOT a replacement to the njk files right? because that is undesired."

**Confirmed**: .njk templates remain separate, consume schema for user decisions.

---

### 4. Extensibility Requirement: Caddy Subdomain Example

**User scenario**:
> "what if i want to add a `caddy` service that exposes all my webapp containers on a specific subdomain url in tailnet (example: ai.my.tailnet or litellm.my.tailnet); this would be configured in the same single source of truth right below what port we want to output this podman webapp at."

**Key requirement**: Schema must be receptive to new fields that emerge during specification completion.

**Example new fields**:
- `external_subdomain` (for Caddy routing)
- `tailnet_domain` (global network config)
- Other networking/routing metadata

**Critical constraint**:
> "there are some env variables that are interlinked/cascade into others; and that we must at once define the data entry form UI and the variables themselves."

---

### 5. Release Version: v0.0.1 (NOT v1.0.0)

**Confirmed**: This is release `v0.0.1`

**Services in scope** (from directory structure):
- ✅ openwebui (+ postgres, redis)
- ✅ litellm (+ postgres, redis)
- ✅ caddy
- ✅ searxng (+ redis)
- ✅ qdrant
- ✅ jupyter
- ✅ tika
- ✅ whisper
- ✅ llama-swap
- ✅ cockpit
- ✅ mcp-context-forge (+ postgres)
- ✅ comfyui
- ❌ edgetts (ICEBOX - excluded from v0.0.1)

**Templates confirmed ready**: Assume all .njk templates for included services are complete.

---

### 6. Model Store Integration

**Decision**: Model store is separate and complete.
> "yes the model store is complete. i'll focus on that separately it's not so difficult"

**Implication**: Schema only needs to define model reference structure, not full model definitions.

---

### 7. Environment Variables: HOW vs WHAT

**Critical clarification**:
> "we will eventually map all 370 variables but this is not our job for now. we aim to start with a strong baseline and most crucially a complete design decision as to how the schema.json behaves. then adding a few variables will be super trivial."

**Goal**: Maximum completeness on **HOW**, not **WHAT**

**Translation**: 
- Design the architecture/rules/patterns for variable cascading
- Don't exhaustively list all 370+ OpenWebUI env vars
- Create a system where adding variables is trivial once rules are defined

**User intent**:
> "our goal here is not to implement the resolution logic together. it is to come up with a comprehensive design guideline that has all the rules and definitions needed to send many research agents to consolidate the actual tedious config decisions."

---

### 8. Schema-First Approach

**Confirmed**: Schema-first, then cross-check with templates
> "together we decide what the structure must look like. so to answer your question 11: my answer is A Schema first, but i'll follow with cross checks to make sure it's complete."

**Process**:
1. Design schema.json structure completely
2. Define all rules, validation, x-* extensions
3. Cross-check against existing .njk templates
4. Iterate if mismatches found

---

### 9. Validation Acceptance (Despite Redundancy Concern)

**User acknowledgment**:
> "i also find the topology file to be incredibly redundant, having to define each variable's type is a bit overkill. i can accept this because it is crucial to the rjsf and uischema parts (for validation)"

**Implication**: Full JSON Schema typing is necessary evil for RJSF form generation, even if feels verbose.

---

### 10. Single Source of Truth Insistence

**User requirement**:
> "i insist that should have it all in a single source of truth manifest file for a given schema release."

**Confirmed**: Everything in one `schema.json` per release version.

---

## What Was Rejected

### ❌ Release Catalog Section
- Originally proposed: Separate `release.container_images` section with versions
- Rejected as redundant
- Versions are hardcoded in .njk templates instead

### ❌ Most of Proposed Architecture
User quote:
> "so in short most of what you proposed is bad."

**Specifically rejected**:
- Split between release catalog and topology for infrastructure
- Template metadata section (may still be useful, but not as proposed)
- Cascade rules as separate top-level section
- Over-engineered separation of concerns

---

## Open Questions for Next Architect

### 1. Schema.json Top-Level Structure
If release catalog is gone, what remains at top level?
```json
{
  "$schema": "...",
  "schema_version": "0.0.1",
  
  "topology": {
    // What goes here?
    // How is it structured?
  },
  
  // What else?
}
```

### 2. Service Definition Pattern
User chose "Full Topology Model" but rejected the three-block pattern.

**What they want**:
- Infrastructure settings (port, published_port, bind_address, etc.)
- Configuration settings (env vars with cascade logic)
- Metadata (subdomain, websocket, etc.)

**How should these be organized in JSON Schema?**

### 3. Cascade Logic Representation
User confirmed cascade/interdependency is critical:
> "there are some env variables that are interlinked/cascade into others"

**How to represent**:
- x-depends-on (field visibility)
- x-affects-services (service enablement)
- x-provider-fields (dynamic field sets)
- Other cascade patterns?

### 4. RJSF/uischema Integration
Research provided shows another project's approach (`research-uischema.md`).

**Key patterns from that research**:
- x-extensions in OpenAPI spec
- Conversion script generates separate JSON Schema + uiSchema
- Widget mapping logic

**Should this schema.json**:
- Embed all x-* for direct RJSF consumption?
- Generate separate uiSchema via script?
- Hybrid approach?

### 5. Template Contract Definition
How does schema.json communicate to templates what data is available?

**Templates need to access**:
- `{{ services.openwebui.infrastructure.published_port }}`
- `{{ services.openwebui.configuration.ENABLE_RAG }}`
- `{{ services.openwebui.metadata.external_subdomain }}`

**But schema.json is validation-focused** (types, enums, defaults).

**Gap**: How to document the template contract without redundancy?

---

## Key Constraints to Remember

1. **No version registry in schema** - hardcoded in templates
2. **Single file** - everything in one schema.json
3. **Extensible** - easy to add new fields as they come up
4. **Cascade-aware** - variables affect each other
5. **RJSF-ready** - x-* extensions for form generation
6. **Not redundant** - each piece of information lives in ONE place
7. **HOW over WHAT** - architecture/patterns, not exhaustive listings

---

## Referenced Documentation

The next architect should have access to:
- `NEWEST-specification.md` - Original comprehensive spec
- `docs/schema-design/architecture.md` - Architectural overview
- `docs/schema-design/schema-documentation.md` - Detailed schema spec
- `docs/schema-design/schema-skeleton.json` - Starting point (but outdated after these decisions)
- `docs/schema-design/research-uischema.md` - RJSF/uischema patterns from another project
- `docs/schema-design/revisions.md` - Previous design revisions
- Current directory structure (document index="11")

---

## Next Steps

1. **Redesign schema.json structure** based on these decisions
2. **Define complete field taxonomy** (infrastructure vs configuration vs metadata)
3. **Specify x-* extension system** for RJSF without redundancy
4. **Document cascade patterns** that templates can rely on
5. **Create template contract** specification
6. **Validate against existing .njk templates** for completeness

---

**End of Handoff**
