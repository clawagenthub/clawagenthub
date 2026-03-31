# Task Board Alternatives for Clawdbot Integration

## Overview

Simpler alternatives to Mission Control for managing tasks with clawdbot. These are popular open-source Kanban/task board systems with REST APIs that clawdbot can integrate with.

## Top Recommendations

### 1. Planka (Trello Alternative)

**Best for**: Simple, clean Trello-like experience

- **GitHub**: https://github.com/plankanban/planka
- **Tech Stack**: Node.js, React, PostgreSQL
- **Deployment**: Docker Compose (very easy)
- **API**: REST API available
- **Features**:
  - Kanban boards with drag-and-drop
  - Cards, lists, labels, due dates
  - File attachments
  - Real-time updates
  - User management
  - Clean, modern UI

**Docker Setup**:
```bash
git clone https://github.com/plankanban/planka.git
cd planka
docker-compose up -d
```

**Clawdbot Integration**: Use REST API to create/update cards, move between lists

---

### 2. Focalboard (by Mattermost)

**Best for**: Feature-rich project management

- **GitHub**: https://github.com/mattermost/focalboard
- **Tech Stack**: Go, React, SQLite/PostgreSQL
- **Deployment**: Docker, standalone binary
- **API**: REST API + WebSocket
- **Features**:
  - Multiple view types (Board, Table, Gallery, Calendar)
  - Custom properties
  - Templates
  - Filtering and sorting
  - Comments and mentions
  - Can integrate with Mattermost

**Docker Setup**:
```bash
docker run -d \
  --name focalboard \
  -p 8000:8000 \
  -v focalboard-data:/data \
  mattermost/focalboard
```

**Clawdbot Integration**: REST API for board/card operations

---

### 3. Wekan

**Best for**: Mature, stable Kanban solution

- **GitHub**: https://github.com/wekan/wekan
- **Tech Stack**: Meteor, MongoDB
- **Deployment**: Docker, Snap
- **API**: REST API
- **Features**:
  - Traditional Kanban boards
  - Swimlanes
  - Custom fields
  - Calendar view
  - Import/export
  - Webhooks
  - LDAP/OAuth support

**Docker Compose Setup**:
```yaml
version: '3'
services:
  wekan:
    image: quay.io/wekan/wekan
    ports:
      - "3000:8080"
    environment:
      - MONGO_URL=mongodb://wekandb:27017/wekan
      - ROOT_URL=http://localhost:3000
    depends_on:
      - wekandb
  wekandb:
    image: mongo:6
    volumes:
      - wekan-db:/data/db
volumes:
  wekan-db:
```

**Clawdbot Integration**: REST API + webhooks for automation

---

### 4. Taiga

**Best for**: Full project management with Agile support

- **GitHub**: https://github.com/taigaio/taiga
- **Tech Stack**: Python (Django), Angular, PostgreSQL
- **Deployment**: Docker Compose
- **API**: Comprehensive REST API
- **Features**:
  - Kanban boards
  - Scrum support (sprints, backlog)
  - Issues tracking
  - Wiki
  - Custom fields
  - Time tracking
  - Webhooks
  - Rich API

**Docker Setup**:
```bash
git clone https://github.com/taigaio/taiga-docker.git
cd taiga-docker
docker-compose up -d
```

**Clawdbot Integration**: Excellent REST API with Python SDK available

---

### 5. Vikunja

**Best for**: Lightweight task management

- **GitHub**: https://github.com/go-vikunja/vikunja
- **Tech Stack**: Go, Vue.js
- **Deployment**: Docker, binary
- **API**: REST API
- **Features**:
  - Lists and Kanban boards
  - Tasks with subtasks
  - Labels and priorities
  - Reminders
  - Filters
  - CalDAV support
  - Very lightweight

**Docker Setup**:
```bash
docker run -d \
  --name vikunja \
  -p 3456:3456 \
  -v vikunja-data:/app/vikunja/files \
  vikunja/vikunja
```

**Clawdbot Integration**: REST API for task operations

---

### 6. Kanboard

**Best for**: Minimalist Kanban

- **GitHub**: https://github.com/kanboard/kanboard
- **Tech Stack**: PHP, SQLite/MySQL/PostgreSQL
- **Deployment**: Docker, PHP hosting
- **API**: JSON-RPC API
- **Features**:
  - Simple Kanban boards
  - Swimlanes
  - Analytics
  - Time tracking
  - Plugins
  - Very lightweight

**Docker Setup**:
```bash
docker run -d \
  --name kanboard \
  -p 80:80 \
  -v kanboard-data:/var/www/app/data \
  kanboard/kanboard
```

**Clawdbot Integration**: JSON-RPC API

---

## Comparison Matrix

| Feature | Planka | Focalboard | Wekan | Taiga | Vikunja | Kanboard |
|---------|--------|------------|-------|-------|---------|----------|
| Ease of Setup | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| UI/UX | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| API Quality | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Features | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Performance | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| Active Dev | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## My Top 3 Recommendations for Clawdbot

### 🥇 1. Planka
**Why**: Simplest to set up, beautiful UI, good API, perfect Trello alternative
- Best for: Quick start, simple task management
- Setup time: 5 minutes
- Clawdbot can easily create cards, move them between lists, add comments

### 🥈 2. Focalboard  
**Why**: Most feature-rich, excellent API, multiple view types
- Best for: Teams needing flexibility
- Setup time: 5 minutes
- Clawdbot can manage boards, cards, properties, and use different views

### 🥉 3. Taiga
**Why**: Full project management, excellent API, Python SDK
- Best for: Agile teams, complex projects
- Setup time: 10 minutes
- Clawdbot can manage sprints, user stories, tasks, issues

---

## Clawdbot Integration Pattern

For any of these systems, clawdbot can:

1. **Create Tasks**: POST to API when user requests new task
2. **Update Status**: Move cards between lists/columns
3. **Add Comments**: Post updates and progress
4. **Query Tasks**: Fetch current state, filter by status
5. **Webhooks**: React to changes (if supported)

### Example Integration Code Structure

```python
# Example for Planka API
import requests

class TaskBoardClient:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {"Authorization": f"Bearer {token}"}
    
    def create_card(self, list_id, title, description):
        return requests.post(
            f"{self.base_url}/api/cards",
            headers=self.headers,
            json={"listId": list_id, "name": title, "description": description}
        )
    
    def move_card(self, card_id, new_list_id):
        return requests.patch(
            f"{self.base_url}/api/cards/{card_id}",
            headers=self.headers,
            json={"listId": new_list_id}
        )
    
    def add_comment(self, card_id, text):
        return requests.post(
            f"{self.base_url}/api/cards/{card_id}/comments",
            headers=self.headers,
            json={"text": text}
        )
```

---

## Quick Start: Planka Setup

```bash
# 1. Create directory
mkdir planka && cd planka

# 2. Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3'
services:
  planka:
    image: ghcr.io/plankanban/planka:latest
    restart: unless-stopped
    ports:
      - "3000:1337"
    environment:
      - BASE_URL=http://localhost:3000
      - DATABASE_URL=postgresql://postgres:postgres@postgres:5432/planka
      - SECRET_KEY=your-secret-key-change-this
    depends_on:
      - postgres
  postgres:
    image: postgres:14-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_DB=planka
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - planka-db:/var/lib/postgresql/data
volumes:
  planka-db:
EOF

# 3. Start
docker-compose up -d

# 4. Access at http://localhost:3000
```

---

## Alternative: Use Existing Services

If you don't want to self-host:

1. **Trello** - Free tier, excellent API, widely used
2. **Notion** - Free tier, powerful API, flexible
3. **Linear** - Modern, great API, free for small teams
4. **ClickUp** - Feature-rich, API available
5. **Asana** - Popular, good API

All have REST APIs that clawdbot can integrate with.

---

## Next Steps

1. Choose a system based on your needs
2. Deploy using Docker Compose
3. Create API credentials
4. Configure clawdbot to use the API
5. Test basic operations (create task, update status, add comment)

Let me know which one you'd like to try, and I can help with the setup!
