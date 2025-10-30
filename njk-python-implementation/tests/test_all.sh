#!/usr/bin/env bash
#
# Comprehensive test suite for njk-schema-second tools
#
# Tests:
#   1. Schema validation
#   2. Topology validation
#   3. Quadlet generation
#   4. Documentation generation
#   5. State tracking
#   6. Blueprint migration
#

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCHEMA_DIR="$(cd "$SCRIPT_DIR/../../njk/njk-schema-011CUP2BgHZxsGMrx3Tk7aQk" && pwd)"
TEST_OUTPUT="$SCRIPT_DIR/output"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Cleanup
rm -rf "$TEST_OUTPUT"
mkdir -p "$TEST_OUTPUT"

echo "======================================"
echo "  njk-schema-second Test Suite"
echo "======================================"
echo ""

# Helper functions
run_test() {
    local test_name="$1"
    local command="$2"

    TESTS_RUN=$((TESTS_RUN + 1))
    echo -n "[$TESTS_RUN] Testing $test_name... "

    if eval "$command" > "$TEST_OUTPUT/test_${TESTS_RUN}.log" 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        TESTS_FAILED=$((TESTS_FAILED + 1))
        echo "    Error output:"
        cat "$TEST_OUTPUT/test_${TESTS_RUN}.log" | sed 's/^/    /'
        return 1
    fi
}

# Test 1: Schema Validation
echo "========================================"
echo "Phase 1: Schema Validation"
echo "========================================"
run_test "JSON Schema validation (valid topology)" \
    "python3 $ROOT_DIR/validators/schema_validator.py \
        $SCHEMA_DIR/topology.json \
        --schema $SCHEMA_DIR/topology-schema.json"

# Test 2: Topology Validation
echo ""
echo "========================================"
echo "Phase 2: Topology Validation"
echo "========================================"
run_test "Topology cross-service validation" \
    "python3 $ROOT_DIR/validators/topology_validator.py \
        $SCHEMA_DIR/topology.json"

run_test "Topology validation (verbose)" \
    "python3 $ROOT_DIR/validators/topology_validator.py \
        $SCHEMA_DIR/topology.json --verbose"

# Test 3: Quadlet Generation
echo ""
echo "========================================"
echo "Phase 3: Quadlet Generation"
echo "========================================"
run_test "Generate quadlet files" \
    "python3 $ROOT_DIR/generators/quadlet_generator.py \
        $SCHEMA_DIR/topology.json \
        $TEST_OUTPUT/quadlets"

run_test "Verify network file was generated" \
    "test -f $TEST_OUTPUT/quadlets/llm.network"

run_test "Verify openwebui.container was generated" \
    "test -f $TEST_OUTPUT/quadlets/openwebui.container"

run_test "Verify litellm.container was generated" \
    "test -f $TEST_OUTPUT/quadlets/litellm.container"

# Test 4: Documentation Generation
echo ""
echo "========================================"
echo "Phase 4: Documentation Generation"
echo "========================================"
run_test "Generate documentation" \
    "python3 $ROOT_DIR/generators/doc_generator.py \
        $SCHEMA_DIR/topology.json \
        $TEST_OUTPUT/docs"

run_test "Verify SERVICE-CATALOG.md exists" \
    "test -f $TEST_OUTPUT/docs/SERVICE-CATALOG.md"

run_test "Verify CONFIGURATION-REFERENCE.md exists" \
    "test -f $TEST_OUTPUT/docs/CONFIGURATION-REFERENCE.md"

run_test "Verify DEPENDENCY-GRAPH.md exists" \
    "test -f $TEST_OUTPUT/docs/DEPENDENCY-GRAPH.md"

run_test "Verify PROVIDER-GUIDE.md exists" \
    "test -f $TEST_OUTPUT/docs/PROVIDER-GUIDE.md"

# Test 5: State Tracking
echo ""
echo "========================================"
echo "Phase 5: State Tracking"
echo "========================================"
run_test "Compute configuration state" \
    "python3 $ROOT_DIR/state/state_tracker.py compute \
        $SCHEMA_DIR/topology.json \
        --output $TEST_OUTPUT/state.json"

run_test "Verify state file was created" \
    "test -f $TEST_OUTPUT/state.json"

run_test "Generate state report" \
    "python3 $ROOT_DIR/state/state_tracker.py report \
        $TEST_OUTPUT/state.json \
        --output $TEST_OUTPUT/state-report.md"

# Test 6: Blueprint Migration
echo ""
echo "========================================"
echo "Phase 6: Blueprint Migration"
echo "========================================"
BLUEPRINT_PATH="$ROOT_DIR/../blueprint-config.json"

if [ -f "$BLUEPRINT_PATH" ]; then
    run_test "Migrate blueprint-config.json" \
        "python3 $ROOT_DIR/state/migrate_blueprint.py \
            $BLUEPRINT_PATH \
            $TEST_OUTPUT/migrated-topology.json"

    run_test "Verify migrated topology file exists" \
        "test -f $TEST_OUTPUT/migrated-topology.json"

    run_test "Validate migrated topology" \
        "python3 $ROOT_DIR/validators/topology_validator.py \
            $TEST_OUTPUT/migrated-topology.json"
else
    echo -e "${YELLOW}⚠  Skipping blueprint migration tests (blueprint-config.json not found)${NC}"
fi

# Summary
echo ""
echo "========================================"
echo "  Test Summary"
echo "========================================"
echo "  Tests run:    $TESTS_RUN"
echo -e "  Tests passed: ${GREEN}$TESTS_PASSED${NC}"
if [ $TESTS_FAILED -gt 0 ]; then
    echo -e "  Tests failed: ${RED}$TESTS_FAILED${NC}"
else
    echo -e "  Tests failed: $TESTS_FAILED"
fi
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    echo ""
    echo "Test output available in: $TEST_OUTPUT/"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    echo ""
    echo "Review test logs in: $TEST_OUTPUT/"
    exit 1
fi
