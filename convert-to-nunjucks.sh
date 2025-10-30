#!/bin/bash
# ═════════════════════════════════════════════════════════════════════════════
# AUTOMATED CHEZMOI → NUNJUCKS CONVERSION SCRIPT
# Converts Go template syntax to Nunjucks syntax
# ═════════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Counters
TOTAL=0
CONVERTED=0
FAILED=0

echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Chezmoi → Nunjucks Automated Converter${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo ""

# Function to convert a single file
convert_file() {
    local input_file="$1"
    local output_file="${input_file%.tmpl}.njk"
    
    TOTAL=$((TOTAL + 1))
    
    echo -ne "${YELLOW}Converting:${NC} $input_file... "
    
    # Create backup
    cp "$input_file" "$input_file.backup"
    
    # Perform conversion
    sed -e '
        # ═════════════════════════════════════════════════════════════════════
        # STEP 1: Convert comments
        # {{- /* comment */ -}} → {# comment #}
        # ═════════════════════════════════════════════════════════════════════
        s/{{- \/\* /{# /g
        s/{{- \/\*/{# /g
        s/\*\/ -}}/ #}/g
        s/\*\/ }}/ #}/g
        s/\*\/-}}/#}/g
        
        # ═════════════════════════════════════════════════════════════════════
        # STEP 2: Convert control structures FIRST (before variables)
        # {{- if → {% if, etc.
        # ═════════════════════════════════════════════════════════════════════
        
        # if statements with comparisons
        s/{{- if eq \([^ ]*\) "\([^"]*\)" }}/{% if \1 == "\2" %}/g
        s/{{- if ne \([^ ]*\) "\([^"]*\)" }}/{% if \1 != "\2" %}/g
        s/{{- if eq \([^ ]*\) \([^ ]*\) }}/{% if \1 == \2 %}/g
        s/{{- if ne \([^ ]*\) \([^ ]*\) }}/{% if \1 != \2 %}/g
        
        # if with and/or
        s/{{- if and /{% if /g
        s/{{- if or /{% if /g
        s/ and / and /g
        s/ or / or /g
        
        # Simple if
        s/{{- if /{% if /g
        
        # else if → elif
        s/{{- else if eq \([^ ]*\) "\([^"]*\)" }}/{% elif \1 == "\2" %}/g
        s/{{- else if /{% elif /g
        
        # else
        s/{{- else }}/{% else %}/g
        
        # end → endif (for if statements)
        s/{{- end }}$/{% endif %}/g
        
        # range → for
        s/{{- range \$\([^,]*\), \$\([^ ]*\) := \.\([^ ]*\) }}/{% for \1, \2 in \3 %}/g
        s/{{- range \$\([^ ]*\) := \.\([^ ]*\) }}/{% for \1 in \2 %}/g
        s/{{- range \.\([^ ]*\) }}/{% for item in \1 %}/g
        s/{{- range /{% for item in /g
        
        # ═════════════════════════════════════════════════════════════════════
        # STEP 3: Convert variables (after control structures)
        # Remove leading dots from variables
        # ═════════════════════════════════════════════════════════════════════
        
        # In variable references: {{ .variable }} → {{ variable }}
        s/{{ \.\([a-zA-Z_][a-zA-Z0-9_]*\)/{{ \1/g
        s/{{- \.\([a-zA-Z_][a-zA-Z0-9_]*\)/{{- \1/g
        
        # In nested variables: .a.b.c → a.b.c
        s/\.\$\./\$/g
        s/{{ \./{{ /g
        s/{{- \./{{- /g
        
        # ═════════════════════════════════════════════════════════════════════
        # STEP 4: Clean up remaining Go template artifacts
        # ═════════════════════════════════════════════════════════════════════
        
        # Remove $ from loop variables
        s/\$\([a-zA-Z_][a-zA-Z0-9_]*\)/\1/g
        
        # Fix filters: | default → | default(
        s/| default "/| default("/g
        s/" }}/") }}/g
        
        # ═════════════════════════════════════════════════════════════════════
        # STEP 5: Final cleanup
        # ═════════════════════════════════════════════════════════════════════
        
        # Ensure proper spacing
        s/{%-/%}/g
        s/-%}/ -%}/g
        s/{%  /{% /g
        
    ' "$input_file" > "$output_file"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC}"
        CONVERTED=$((CONVERTED + 1))
    else
        echo -e "${RED}✗${NC}"
        FAILED=$((FAILED + 1))
    fi
}

# Function to convert all .tmpl files recursively
convert_directory() {
    local dir="$1"
    
    echo -e "${BLUE}Scanning directory:${NC} $dir"
    echo ""
    
    # Find all .tmpl files
    while IFS= read -r -d '' file; do
        convert_file "$file"
    done < <(find "$dir" -name "*.tmpl" -type f -print0)
}

# Main script
if [ $# -eq 0 ]; then
    echo "Usage: $0 <directory|file>"
    echo ""
    echo "Examples:"
    echo "  $0 home/                    # Convert all .tmpl files in home/"
    echo "  $0 file.tmpl                # Convert single file"
    echo "  $0 home/dot_config/         # Convert specific directory"
    exit 1
fi

TARGET="$1"

if [ -f "$TARGET" ]; then
    # Single file
    convert_file "$TARGET"
elif [ -d "$TARGET" ]; then
    # Directory
    convert_directory "$TARGET"
else
    echo -e "${RED}Error:${NC} '$TARGET' is not a file or directory"
    exit 1
fi

# Summary
echo ""
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Conversion Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════${NC}"
echo -e "Total files:      ${TOTAL}"
echo -e "${GREEN}Converted:        ${CONVERTED}${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed:           ${FAILED}${NC}"
fi
echo ""
echo -e "${YELLOW}Note:${NC} Backups saved with .backup extension"
echo -e "${YELLOW}Important:${NC} Manual review required for:"
echo "  - Complex nested logic"
echo "  - Custom Go template functions"
echo "  - Edge cases with special characters"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "  1. Review converted files"
echo "  2. Test rendering with Nunjucks"
echo "  3. Remove .backup files when satisfied"
echo ""

# Show some examples of what might need manual review
if [ $CONVERTED -gt 0 ]; then
    echo -e "${YELLOW}Files that may need manual review:${NC}"
    find . -name "*.njk" -type f | while read -r file; do
        # Check for potential issues
        if grep -q '\$' "$file" || grep -q 'index ' "$file"; then
            echo "  - $file (contains \$ or index - check loop variables)"
        fi
    done
fi

exit 0
