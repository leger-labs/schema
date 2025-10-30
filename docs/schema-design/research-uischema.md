How This Repository Uses uiSchema and RJSF
Based on my exploration, here's a comprehensive explanation of how this repository expects uischema and rjsf variables to exist in the defining single source of truth JSON schema file:

Architecture Overview
The repository uses a three-layer schema architecture:

┌─────────────────────────────────────────┐
│  OpenAPI Spec (Single Source of Truth)  │
│  openwebui-config-schema.json            │
│  Contains: x-extensions for UI metadata │
└──────────────────┬──────────────────────┘
                   │
         ┌─────────┴─────────┐
         │  Conversion Script │
         │  generate-schemas.js
         └─────────┬──────────┘
                   │
      ┌────────────┴───────────┐
      │                        │
┌─────▼─────┐         ┌───────▼────────┐
│JSON Schema│         │   uiSchema     │
│  (Data)   │         │(Presentation)  │
└─────┬─────┘         └───────┬────────┘
      │                        │
      └────────────┬───────────┘
                   │
           ┌───────▼────────┐
           │ RJSF Component │
           │  <Form />      │
           └────────────────┘
1. Single Source of Truth: OpenAPI with x- Extensions
File: schemas/openwebui-config-schema.json

This is an OpenAPI 3.0.0 specification with custom x- extensions that define both validation rules AND UI presentation:

Example Field Definition:
{
  "OPENAI_API_KEY": {
    "type": "string",
    "description": "Sets the OpenAI API key.",
    "x-env-var": "OPENAI_API_KEY",
    "x-persistent-config": true,
    "x-category": "App/Backend - OpenAI",
    "x-display-order": 47,
    "x-sensitive": true,
    "x-depends-on": {
      "ENABLE_OPENAI_API": true
    },
    "x-visibility": "exposed",
    "x-default-handling": "unset",
    "x-rationale": "Only unlocked if user specifies OpenAI API key"
  }
}
Key x- Extensions Used:
| Extension | Purpose | Maps to uiSchema | |-----------|---------|------------------| | x-env-var | Environment variable name | Metadata | | x-category | Groups fields by category | Section hierarchy | | x-display-order | Controls field ordering | ui:order | | x-visibility | Controls visibility (hidden/exposed) | ui:widget: "hidden" | | x-sensitive | Marks password fields | ui:widget: "PasswordWidget" | | x-depends-on | Conditional field logic | dependencies | | x-provider-fields | Groups related fields | Category nesting | | x-rationale | Documentation rationale | ui:help |

2. Conversion to RJSF Schemas
Script: scripts/generate-schemas.js

This script converts the OpenAPI spec into two separate files:

Output 1: JSON Schema (schemas/config-schema.json)
Pure JSON Schema Draft-07 with hierarchical structure:

{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "app": {                          // Category (from x-category)
      "type": "object",
      "title": "App",
      "properties": {
        "backend_general": {          // Subcategory
          "type": "object",
          "title": "Backend General",
          "properties": {
            "OPENAI_API_KEY": {       // Actual field
              "type": "string",
              "description": "Sets the OpenAI API key.",
              "default": "None"
            }
          }
        }
      }
    }
  }
}
Output 2: uiSchema (schemas/ui-schema.json)
RJSF presentation schema with widget mappings:

{
  "$schema": "https://schemas.openwebui.com/ui-schema/v1",
  "ui:title": "OpenWebUI Configuration",
  "app": {
    "ui:title": "App Settings",
    "ui:collapsible": true,
    "backend_general": {
      "ui:title": "Backend General",
      "ui:collapsible": true,
      "OPENAI_API_KEY": {
        "ui:widget": "PasswordWidget",    // From x-sensitive
        "ui:help": "Sets the OpenAI API key."
      }
    }
  }
}
3. Widget Mapping Logic
The conversion script applies these rules to determine which widget to use:

// From x-sensitive → PasswordWidget
if (fieldDef['x-sensitive'] || fieldDef['x-secret']) {
  fieldUi['ui:widget'] = 'PasswordWidget';
}

// From type: boolean → CheckboxWidget
if (fieldDef.type === 'boolean') {
  fieldUi['ui:widget'] = 'CheckboxWidget';
}

// From enum → SelectWidget
if (fieldDef.enum && fieldDef.enum.length > 0) {
  fieldUi['ui:widget'] = 'SelectWidget';
}

// From format: uri → URLWidget
if (fieldDef.format === 'uri' || fieldDef.format === 'url') {
  fieldUi['ui:widget'] = 'URLWidget';
}

// From x-visibility: hidden → hidden widget
if (fieldDef['x-visibility'] === 'hidden') {
  fieldUi['ui:widget'] = 'hidden';
}
4. RJSF Integration in React
File: src/components/config-form-rjsf.tsx

The form component imports the generated schemas and passes them to RJSF:

import { configSchema, uiSchema } from '@/schemas/generated-schemas'
import Form from '@rjsf/core'
import validator from '@rjsf/validator-ajv8'
import { widgets } from '@/form/widgets'

export function ConfigForm() {
  return (
    <Form
      schema={configSchema}       // JSON Schema (validation)
      uiSchema={uiSchema}         // UI Schema (presentation)
      formData={formData}
      widgets={widgets}           // Custom shadcn widgets
      templates={templates}       // Custom field/object templates
      validator={validator}       // AJV validator
      onSubmit={handleSubmit}
    />
  )
}
5. Custom Widget Adapters
File: src/form/widgets.tsx

RJSF widget types are mapped to shadcn components:

// TextWidget → shadcn TextField
function TextWidget(props: WidgetProps) {
  return (
    <TextField
      value={value || ''}
      maxLength={schema.maxLength}
      showCharCount={uiSchema?.['ui:showCharCount']}
      description={uiSchema?.['ui:help']}
    />
  )
}

// PasswordWidget → shadcn SecretField
function PasswordWidget(props: WidgetProps) {
  return (
    <SecretField
      value={value || ''}
      description={uiSchema?.['ui:help']}
    />
  )
}

export const widgets = {
  TextWidget,
  PasswordWidget,
  CheckboxWidget,
  SelectWidget,
  URLWidget,
  // ...etc
}
6. Supported uiSchema Properties
These properties are actively used in the implementation:

| Property | Purpose | Where Used | |----------|---------|------------| | ui:widget | Selects which widget component to render | All widgets | | ui:help | Help text displayed under field | Field template | | ui:title | Display name for sections/categories | Object template | | ui:collapsible | Makes sections collapsible | Object template | | ui:showCharCount | Shows character counter | TextField widget | | ui:enumOptions | Custom labels for select options | SelectWidget | | ui:placeholder | Placeholder text | Text input widgets |

7. Data Flow
The repository handles two data formats:

Flat Environment Variables ↔ Nested RJSF Structure
Transformers: src/form/data-transformers.ts

// Flat format (for .env file):
{
  "OPENAI_API_KEY": "sk-xxx",
  "ENABLE_OPENAI_API": "true"
}

// RJSF nested format (from schema hierarchy):
{
  "app": {
    "backend_general": {
      "OPENAI_API_KEY": "sk-xxx",
      "ENABLE_OPENAI_API": true
    }
  }
}
Summary: How to Define Fields
When adding a new field to the single source of truth (openwebui-config-schema.json):

{
  "MY_NEW_FIELD": {
    // Standard JSON Schema properties
    "type": "string",
    "description": "My field description",
    "default": "default_value",
    "enum": ["option1", "option2"],  // For select fields
    
    // x- extensions for UI metadata
    "x-env-var": "MY_NEW_FIELD",
    "x-category": "App/Backend - General",
    "x-display-order": 100,
    "x-sensitive": false,            // true → PasswordWidget
    "x-visibility": "exposed",       // "hidden" → hidden widget
    "x-depends-on": {                // Conditional logic
      "ENABLE_FEATURE": true
    },
    "x-rationale": "Why this field exists"
  }
}
Then run:

node scripts/generate-schemas.js
This generates:

schemas/config-schema.json - Pure JSON Schema
schemas/ui-schema.json - RJSF presentation schema
src/schemas/generated-schemas.ts - TypeScript module
The RJSF form automatically renders with the appropriate widgets and validation!
