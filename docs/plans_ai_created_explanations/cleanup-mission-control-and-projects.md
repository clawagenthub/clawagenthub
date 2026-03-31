# Cleanup Plan: Remove Mission Control and Find Other Projects

## Projects to Remove

1. Mission Control (openclaw-mission-control)
2. "screws project" (location unknown)
3. Pocketbase backend (location unknown)

## Step 1: Search for Projects

Run these commands to find all instances:

```bash
# Search for 'screws' directories
find / -type d -name "*screws*" 2>/dev/null

# Search for 'pocketbase' directories  
find / -type d -name "*pocketbase*" 2>/dev/null

# Search in common locations
ls -la /root/ | grep -E "screws|pocketbase"
ls -la /home/ | grep -E "screws|pocketbase"
ls -la /opt/ | grep -E "screws|pocketbase"
ls -la /var/www/ | grep -E "screws|pocketbase"

# Search for running processes
ps aux | grep -E "screws|pocketbase"

# Search for Docker containers
docker ps -a | grep -E "screws|pocketbase"
```

## Step 2: Delete Mission Control

### Option A: Delete from .openclaw/workspace

```bash
# Stop Mission Control if running
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env down -v

# Delete the directory
cd ../..
rm -rf .openclaw/workspace/openclaw-mission-control
```

### Option B: Complete removal including Docker volumes

```bash
# Stop and remove everything
cd .openclaw/workspace/openclaw-mission-control
docker compose -f compose.yml --env-file .env down -v --remove-orphans

# Remove Docker images
docker images | grep openclaw-mission-control | awk '{print $3}' | xargs docker rmi -f

# Delete directory
cd ../..
rm -rf .openclaw/workspace/openclaw-mission-control
```

## Step 3: Delete Screws Project

Once located, run:

```bash
# If it's a Docker project
cd /path/to/screws
docker compose down -v --remove-orphans

# Delete directory
rm -rf /path/to/screws
```

## Step 4: Delete Pocketbase Backend

Once located, run:

```bash
# Stop pocketbase if running as service
sudo systemctl stop pocketbase
sudo systemctl disable pocketbase

# Or if running in Docker
cd /path/to/pocketbase
docker compose down -v --remove-orphans

# Delete directory
rm -rf /path/to/pocketbase

# Remove pocketbase binary if installed
sudo rm -f /usr/local/bin/pocketbase
```

## Step 5: Clean Up Docker Resources

```bash
# Remove unused Docker volumes
docker volume prune -f

# Remove unused Docker networks
docker network prune -f

# Remove unused Docker images
docker image prune -a -f

# See disk space freed
docker system df
```

## Step 6: Verify Cleanup

```bash
# Check remaining Docker containers
docker ps -a

# Check remaining Docker volumes
docker volume ls

# Check disk usage
df -h

# Verify directories are gone
ls -la .openclaw/workspace/ | grep mission-control
find / -type d -name "*screws*" 2>/dev/null
find / -type d -name "*pocketbase*" 2>/dev/null
```

## Quick Cleanup Script

Save this as `cleanup.sh`:

```bash
#!/bin/bash

echo "=== Searching for projects ==="
echo "Searching for screws..."
find / -type d -name "*screws*" 2>/dev/null

echo "Searching for pocketbase..."
find / -type d -name "*pocketbase*" 2>/dev/null

echo ""
echo "=== Stopping Mission Control ==="
cd .openclaw/workspace/openclaw-mission-control 2>/dev/null
if [ $? -eq 0 ]; then
    docker compose -f compose.yml --env-file .env down -v --remove-orphans
    cd ../..
    echo "Deleting Mission Control..."
    rm -rf .openclaw/workspace/openclaw-mission-control
    echo "Mission Control deleted"
else
    echo "Mission Control not found"
fi

echo ""
echo "=== Cleaning Docker resources ==="
docker volume prune -f
docker network prune -f
docker image prune -a -f

echo ""
echo "=== Cleanup complete ==="
docker ps -a
docker volume ls
```

Run with:
```bash
chmod +x cleanup.sh
./cleanup.sh
```

## Manual Search Results

After running the find commands, you'll see output like:
```
/root/screws
/opt/pocketbase
/var/www/pocketbase-backend
```

Then delete each one:
```bash
rm -rf /root/screws
rm -rf /opt/pocketbase
rm -rf /var/www/pocketbase-backend
```

## What to Keep

Don't delete these OpenClaw directories:
- `.openclaw/openclaw.json` - Main config
- `.openclaw/agents/` - Agent configurations
- `.openclaw/workspace/` - Agent workspaces (except mission-control)
- `.openclaw/memory/` - Agent memories
- `.openclaw/logs/` - Logs

## After Cleanup

1. Verify OpenClaw still works: `openclaw gateway status`
2. Check available disk space: `df -h`
3. Choose a new task board from the recommendations
4. Set up the new system
