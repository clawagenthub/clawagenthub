# Fix Plan: Agent "Cedric" Stuck in Updating Status

## Problem Summary

Agent "Cedric" (ID: `mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e`) is stuck in "updating" status in Mission Control. This occurs when the queue worker is not processing lifecycle reconciliation tasks.

## Root Cause

According to [`docs/troubleshooting/gateway-agent-provisioning.md`](.openclaw/workspace/openclaw-mission-control/docs/troubleshooting/gateway-agent-provisioning.md):

- Mission Control uses a fast convergence policy for agent provisioning
- When an agent is created/updated, a wake signal is sent
- A lifecycle reconcile task is queued with a 30-second check-in deadline
- The **queue worker** must process this task
- If the worker isn't running, the agent stays stuck in "updating" status

## Diagnostic Steps

### 1. Check Mission Control Stack Status

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env ps
```

**Expected output**: All services should be "Up" and healthy:
- `db` (Postgres)
- `redis`
- `backend`
- `frontend`
- `webhook-worker` ← **This is critical!**

### 2. Check Webhook Worker Logs

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env logs webhook-worker --tail=100
```

**Look for**:
- `queue.worker.batch_started` - Worker is running
- `lifecycle.queue.enqueued` - Lifecycle tasks are being queued
- `queue.worker.success` - Tasks are being processed
- Any error messages

### 3. Check Redis Connectivity

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env exec redis redis-cli ping
```

**Expected**: `PONG`

### 4. Check Backend Logs for Lifecycle Events

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env logs backend --tail=100 | grep -E "lifecycle|agent.*cedric"
```

## Fix Steps

### Step 1: Ensure All Services Are Running

If any service is not running, start the full stack:

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env up -d
```

### Step 2: Verify Webhook Worker Is Running

Check if the webhook-worker container exists and is running:

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env ps webhook-worker
```

If it's not running or doesn't exist, restart it:

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env up -d webhook-worker
```

### Step 3: Monitor Worker Logs

Watch the worker logs in real-time:

```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env logs -f webhook-worker
```

Keep this running in a separate terminal.

### Step 4: Trigger Agent Re-Provisioning

Access Mission Control UI at http://localhost:3000 (or http://YOUR_SERVER_HOST:3000 based on your config):

1. Navigate to the Agents page
2. Find agent "Cedric"
3. Click on the agent to view details
4. Look for an "Update" or "Reprovision" button
5. Click it to trigger a new wake cycle

**Alternative via API** (if you have the agent ID):

```bash
# Get agent details
curl -H "Authorization: Bearer YOUR_API_BEARER_TOKEN" \
  http://YOUR_SERVER_HOST:8000/api/v1/agents/mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e

# Trigger update (if endpoint exists)
curl -X PATCH \
  -H "Authorization: Bearer YOUR_API_BEARER_TOKEN" \
  -H "Content-Type: application/json" \
  http://YOUR_SERVER_HOST:8000/api/v1/agents/mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e
```

### Step 5: Watch for Lifecycle Events

In the webhook-worker logs, you should see:

```
lifecycle.queue.enqueued
queue.worker.success
lifecycle.reconcile.skip_not_stuck (after heartbeat arrives)
```

### Step 6: Verify Agent Status

Check the agent status in Mission Control UI or via API:

```bash
curl -H "Authorization: Bearer YOUR_API_BEARER_TOKEN" \
  http://YOUR_SERVER_HOST:8000/api/v1/agents/mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e | jq '.status'
```

**Expected**: Status should change from "updating" to "online" within 30 seconds

## Common Issues and Solutions

### Issue 1: Webhook Worker Not Running

**Symptom**: `webhook-worker` container is not in the output of `docker compose ps`

**Solution**:
```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env up -d webhook-worker
```

### Issue 2: Redis Connection Failed

**Symptom**: Worker logs show Redis connection errors

**Solution**:
```bash
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env restart redis
docker compose -f compose.yml --env-file .env restart webhook-worker
```

### Issue 3: Agent Stays Offline After 3 Wake Attempts

**Symptom**: Agent status becomes "offline" instead of "online"

**Root Cause**: Agent cannot reach Mission Control API to send heartbeat

**Solution**:
1. Verify the agent can reach `http://YOUR_SERVER_HOST:8000` (your `NEXT_PUBLIC_API_URL`)
2. Check agent token is valid
3. Review agent workspace files for correct configuration
4. Check gateway logs if using a gateway

### Issue 4: Queue Worker Dequeue Errors

**Symptom**: Logs show `queue.worker.dequeue_failed`

**Solution**:
```bash
cd .openclaw/workspace/openclaw-mission-control
# Check Redis is healthy
docker compose -f compose.yml --env-file .env exec redis redis-cli ping

# Restart worker
docker compose -f compose.yml --env-file .env restart webhook-worker
```

## Quick Fix Command Sequence

If you want to run all fixes at once:

```bash
cd .openclaw/workspace/openclaw-mission-control

# Ensure all services are running
docker compose -f compose.yml --env-file .env up -d

# Wait for services to be healthy
sleep 10

# Check status
docker compose -f compose.yml --env-file .env ps

# Watch worker logs
docker compose -f compose.yml --env-file .env logs -f webhook-worker
```

Then trigger agent re-provisioning from the UI.

## Verification Checklist

- [ ] All Docker services are running (db, redis, backend, frontend, webhook-worker)
- [ ] Redis responds to PING
- [ ] Webhook worker logs show `queue.worker.batch_started`
- [ ] Agent re-provisioning triggered
- [ ] Lifecycle events appear in worker logs
- [ ] Agent status changes to "online"
- [ ] Agent can send heartbeats successfully

## Configuration Reference

From your [`openclaw.json`](.openclaw/openclaw.json):
- Agent ID: `mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e`
- Agent Name: `Cedric`
- Workspace: `/root/.openclaw/workspace/workspace-mc-8c24e6e1-abb0-4ced-ac33-0dceae16dd9e`
- Heartbeat Config: Every 10 minutes, target: last

From your [`.env`](.openclaw/workspace/openclaw-mission-control/.env):
- Mission Control API: `http://YOUR_SERVER_HOST:8000`
- Frontend: Port 3000
- Backend: Port 8000
- Auth Token: `YOUR_API_BEARER_TOKEN`

## Additional Resources

- [Gateway Agent Provisioning Troubleshooting](.openclaw/workspace/openclaw-mission-control/docs/troubleshooting/gateway-agent-provisioning.md)
- [Mission Control README](.openclaw/workspace/openclaw-mission-control/README.md)
- [Backend README](.openclaw/workspace/openclaw-mission-control/backend/README.md)
