#!/bin/bash
# ============================================================
# Timely Real Estate — API Test Suite
# Tests all 33 endpoints automatically
# Run from server: bash test-api.sh
# ============================================================

BASE="http://localhost:4000"
PASS=0
FAIL=0
TOTAL=0

green='\033[0;32m'
red='\033[0;31m'
yellow='\033[0;33m'
nc='\033[0m'

test_endpoint() {
    TOTAL=$((TOTAL + 1))
    local method=$1
    local endpoint=$2
    local description=$3
    local data=$4
    local expected_status=$5
    local auth=$6

    headers=(-H "Content-Type: application/json")
    if [ "$auth" = "yes" ]; then
        headers+=(-H "Authorization: Bearer $TOKEN")
    fi

    if [ "$method" = "GET" ]; then
        response=$(curl -s -o /tmp/test_body -w "%{http_code}" "${headers[@]}" "$BASE$endpoint")
    else
        response=$(curl -s -o /tmp/test_body -w "%{http_code}" -X "$method" "${headers[@]}" -d "$data" "$BASE$endpoint")
    fi

    body=$(cat /tmp/test_body)

    if [ "$response" = "$expected_status" ]; then
        PASS=$((PASS + 1))
        echo -e "${green}✅ PASS${nc} [$method] $endpoint — $description (HTTP $response)"
    else
        FAIL=$((FAIL + 1))
        echo -e "${red}❌ FAIL${nc} [$method] $endpoint — $description (Expected $expected_status, got $response)"
        echo -e "   ${yellow}Response: ${body:0:200}${nc}"
    fi
}

echo "============================================================"
echo "  Timely Real Estate — API Test Suite"
echo "  Testing $BASE"
echo "============================================================"
echo ""

# ── 1. HEALTH CHECK (no auth) ──
echo "── Health Check ──"
test_endpoint "GET" "/api/health" "Health check" "" "200" "no"

# ── 2. LOGIN (no auth) ──
echo ""
echo "── Authentication ──"
test_endpoint "POST" "/api/login" "Login as admin" '{"email":"fryv@timely.com","password":"admin123"}' "200" "no"

# Get token for remaining tests
TOKEN=$(curl -s -X POST "$BASE/api/login" -H "Content-Type: application/json" -d '{"email":"fryv@timely.com","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo -e "${red}❌ FATAL: Could not get auth token. Aborting.${nc}"
    exit 1
fi
echo -e "${green}   Token acquired${nc}"

test_endpoint "POST" "/api/login" "Login as consultant" '{"email":"gonzalesp@timely.com","password":"$CX@w9dzBh5%"}' "200" "no"
test_endpoint "POST" "/api/login" "Login as client" '{"email":"jacksons@timely.com","password":"L*!3MVbgwRDm"}' "200" "no"
test_endpoint "POST" "/api/login" "Login with wrong password" '{"email":"fryv@timely.com","password":"wrong"}' "401" "no"
test_endpoint "POST" "/api/login" "Login with missing fields" '{"email":""}' "400" "no"

# ── 3. CLIENTS ──
echo ""
echo "── Clients ──"
test_endpoint "GET" "/api/users-report" "List all clients" "" "200" "yes"
test_endpoint "POST" "/api/users-csv" "Create client" '{"firstName":"Test","lastName":"APIUser","email":"apitest@timely.com","tempPassword":"test123"}' "200" "yes"

# Get the new client ID
CLIENT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/users-report" | grep -o '"customerId":"[^"]*"' | tail -1 | cut -d'"' -f4)
echo -e "   ${yellow}Created client ID: $CLIENT_ID${nc}"

test_endpoint "GET" "/api/users-report/csv" "Download clients CSV" "" "200" "yes"
test_endpoint "POST" "/api/users-csv" "Create client missing fields" '{"firstName":""}' "400" "yes"
test_endpoint "POST" "/api/users-csv" "Create duplicate email" '{"firstName":"Dup","lastName":"User","email":"apitest@timely.com","tempPassword":"test"}' "400" "yes"

# ── 4. CONSULTANTS ──
echo ""
echo "── Consultants ──"
test_endpoint "GET" "/api/consultants" "List all consultants" "" "200" "yes"
test_endpoint "POST" "/api/consultants" "Create consultant" '{"firstName":"Test","lastName":"Consultant","email":"testconsultant@timely.com","tempPassword":"cons123"}' "200" "yes"

CONSULTANT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/consultants" | grep -o '"consultantId":"[^"]*"' | tail -1 | cut -d'"' -f4)
echo -e "   ${yellow}Consultant ID: $CONSULTANT_ID${nc}"

test_endpoint "POST" "/api/consultants" "Create consultant missing fields" '{"firstName":""}' "400" "yes"

# ── 5. PROJECTS ──
echo ""
echo "── Projects ──"
test_endpoint "GET" "/api/projects" "List all projects" "" "200" "yes"
test_endpoint "POST" "/api/projects" "Create project" '{"projectName":"Test API Project","status":"Planning","priority":"High"}' "200" "yes"

PROJECT_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/projects" | grep -o '"projectId":"[^"]*"' | tail -1 | cut -d'"' -f4)
echo -e "   ${yellow}Project ID: $PROJECT_ID${nc}"

test_endpoint "POST" "/api/projects" "Create project missing name" '{"projectName":""}' "400" "yes"
test_endpoint "GET" "/api/project-details/$PROJECT_ID" "Get project details" "" "200" "yes"
test_endpoint "POST" "/api/project-details" "Update project details" "{\"projectId\":\"$PROJECT_ID\",\"description\":\"Test description\",\"dateDue\":\"2026-12-31\"}" "200" "yes"

# ── 6. ASSIGNMENTS ──
echo ""
echo "── Assignments ──"
if [ -n "$CLIENT_ID" ] && [ -n "$PROJECT_ID" ]; then
    test_endpoint "POST" "/api/projects/assign" "Assign project to client" "{\"clientId\":\"$CLIENT_ID\",\"projectId\":\"$PROJECT_ID\"}" "200" "yes"
fi

if [ -n "$CLIENT_ID" ] && [ -n "$CONSULTANT_ID" ]; then
    test_endpoint "POST" "/api/client-consultants/assign" "Assign consultant to client" "{\"clientId\":\"$CLIENT_ID\",\"consultantId\":\"$CONSULTANT_ID\"}" "200" "yes"
fi

test_endpoint "GET" "/api/client-consultants" "List client-consultant assignments" "" "200" "yes"
test_endpoint "POST" "/api/projects/assign" "Assign missing fields" '{"clientId":""}' "400" "yes"
test_endpoint "POST" "/api/client-consultants/assign" "Assign missing fields" '{}' "400" "yes"

# ── 7. HOURS ──
echo ""
echo "── Hours Logs ──"
if [ -n "$PROJECT_ID" ] && [ -n "$CONSULTANT_ID" ]; then
    test_endpoint "POST" "/api/hours-logs" "Log hours" "{\"projectId\":\"$PROJECT_ID\",\"consultantId\":\"$CONSULTANT_ID\",\"date\":\"2026-03-12\",\"hours\":2.5,\"description\":\"Test hours\"}" "200" "yes"
fi

test_endpoint "GET" "/api/hours-logs" "List all hours" "" "200" "yes"

if [ -n "$PROJECT_ID" ]; then
    test_endpoint "GET" "/api/hours-logs/$PROJECT_ID" "Hours by project" "" "200" "yes"
fi

test_endpoint "POST" "/api/hours-logs" "Log hours missing fields" '{"projectId":""}' "400" "yes"

# ── 8. COMMENTS ──
echo ""
echo "── Project Comments ──"
if [ -n "$PROJECT_ID" ]; then
    test_endpoint "POST" "/api/project-comments" "Add comment" "{\"projectId\":\"$PROJECT_ID\",\"commentText\":\"Test comment from API\"}" "200" "yes"
    test_endpoint "GET" "/api/project-comments/$PROJECT_ID" "Get comments" "" "200" "yes"
fi
test_endpoint "POST" "/api/project-comments" "Comment missing fields" '{}' "400" "yes"

# ── 9. ATTACHMENTS ──
echo ""
echo "── Project Attachments ──"
if [ -n "$PROJECT_ID" ]; then
    test_endpoint "POST" "/api/project-attachments" "Add attachment" "{\"projectId\":\"$PROJECT_ID\",\"fileName\":\"test.pdf\",\"fileSize\":\"1.2MB\",\"fileType\":\"pdf\"}" "200" "yes"
    test_endpoint "GET" "/api/project-attachments/$PROJECT_ID" "Get attachments" "" "200" "yes"
fi
test_endpoint "POST" "/api/project-attachments" "Attachment missing fields" '{}' "400" "yes"

# ── 10. TEAM FEED ──
echo ""
echo "── Team Feed ──"
test_endpoint "POST" "/api/team-feed" "Create post" '{"content":"Test post from API test suite"}' "200" "yes"

POST_ID=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE/api/team-feed" | grep -o '"postId":"[^"]*"' | head -1 | cut -d'"' -f4)
echo -e "   ${yellow}Post ID: $POST_ID${nc}"

test_endpoint "GET" "/api/team-feed" "List posts" "" "200" "yes"

if [ -n "$POST_ID" ]; then
    test_endpoint "POST" "/api/team-feed/$POST_ID/like" "Like post" '{}' "200" "yes"
    test_endpoint "POST" "/api/team-feed/$POST_ID/unlike" "Unlike post" '{}' "200" "yes"
    test_endpoint "POST" "/api/team-feed/$POST_ID/delete" "Delete post" '{}' "200" "yes"
fi
test_endpoint "POST" "/api/team-feed" "Post missing content" '{}' "400" "yes"

# ── 11. EMAILS ──
echo ""
echo "── Emails ──"
test_endpoint "POST" "/api/emails/send" "Send email" '{"to":"test@test.com","subject":"API Test Email","body":"Testing from test suite"}' "200" "yes"
test_endpoint "GET" "/api/emails/outbox" "List emails" "" "200" "yes"
test_endpoint "GET" "/api/emails/1" "Get email by ID" "" "200" "yes"
test_endpoint "POST" "/api/emails/send" "Email missing fields" '{"to":""}' "400" "yes"

# ── 12. AUDIT LOGS ──
echo ""
echo "── Audit Logs ──"
test_endpoint "GET" "/api/audit-logs/latest?limit=5" "Get recent audit logs" "" "200" "yes"

# ── 13. AUTH PROTECTION ──
echo ""
echo "── Auth Protection ──"
test_endpoint "GET" "/api/users-report" "Access without token" "" "401" "no"
test_endpoint "GET" "/api/consultants" "Access without token" "" "401" "no"
test_endpoint "GET" "/api/projects" "Access without token" "" "401" "no"

# ── CLEANUP ──
echo ""
echo "── Cleanup ──"
if [ -n "$CLIENT_ID" ]; then
    test_endpoint "POST" "/api/users-delete" "Delete test client" "{\"customerId\":\"$CLIENT_ID\"}" "200" "yes"
fi

if [ -n "$CONSULTANT_ID" ]; then
    test_endpoint "POST" "/api/consultants-delete" "Delete test consultant" "{\"consultantId\":\"$CONSULTANT_ID\"}" "200" "yes"
fi

if [ -n "$PROJECT_ID" ]; then
    test_endpoint "POST" "/api/projects-delete" "Delete test project" "{\"projectId\":\"$PROJECT_ID\"}" "200" "yes"
fi

# ── RESULTS ──
echo ""
echo "============================================================"
echo "  TEST RESULTS"
echo "============================================================"
echo -e "  Total:  $TOTAL"
echo -e "  ${green}Passed: $PASS${nc}"
echo -e "  ${red}Failed: $FAIL${nc}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "  ${green}🎉 ALL TESTS PASSED!${nc}"
else
    echo -e "  ${red}⚠️  $FAIL test(s) failed${nc}"
fi
echo "============================================================"

rm -f /tmp/test_body