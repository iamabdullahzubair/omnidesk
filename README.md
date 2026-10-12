# 🌟 OmniDesk: Real-Time Customer Support Chat Application

OmniDesk is a complete, production-grade, full-stack real-time customer support platform built with **React (Vite)**, **Node.js (Express)**, **Socket.IO**, **PostgreSQL**, and **Drizzle ORM**.

Designed specifically for developer portfolios and advanced real-time systems education, this project demonstrates end-to-end WebSocket architecture, atomic concurrency control, message idempotency, multi-tab presence tracking, and delivery/read receipts.

---

## 📑 Table of Contents
1. [Architecture Overview & Diagrams](#-architecture-overview--diagrams)
2. [Key Features & Capabilities](#-key-features--capabilities)
3. [Technology Stack](#-technology-stack)
4. [Project Structure](#-project-structure)
5. [Prerequisites & Database Setup](#-prerequisites--database-setup)
6. [Environment Variables](#-environment-variables)
7. [Installation & Quick Start](#-installation--quick-start)
8. [Docker Architecture & Deployment](#-docker-architecture--deployment)
9. [Database Migrations & Agent Seeding](#-database-migrations--agent-seeding)
10. [REST API Documentation](#-rest-api-documentation)
11. [Socket.IO Event Contract](#-socketio-event-contract)
12. [In-Depth Engineering Concepts](#-in-depth-engineering-concepts)
    - [WebSocket vs Socket.IO Handshake](#1-websocket-vs-socketio-handshake)
    - [Atomic Concurrency & Race Condition Elimination](#2-atomic-concurrency--race-condition-elimination)
    - [Idempotent Message Persistence](#3-idempotent-message-persistence)
    - [Sent vs Delivered vs Read Lifecycle](#4-sent-vs-delivered-vs-read-lifecycle)
    - [Multi-Tab Presence Tracking](#5-multi-tab-presence-tracking)
    - [PostgreSQL Transactions & Persistence First](#6-postgresql-transactions--persistence-first)
13. [Automated Testing & Verification](#-automated-testing--verification)
14. [Troubleshooting & Common Errors](#-troubleshooting--common-errors)
15. [Git Repository Setup & Best Practices](#-git-repository-setup--best-practices)
16. [Security Limitations & Future Improvements](#-security-limitations--future-improvements)

---

## 🏛 Architecture Overview & Diagrams

```mermaid
flowchart TB
    subgraph Clients["Frontend Clients (React + Vite)"]
        CustomerUI["Customer Browser\n(Multi-Tab Support)"]
        AgentUI["Support Agent Browser\n(Dashboard & Queues)"]
    end

    subgraph Server["Backend Server (Node.js + Express)"]
        HTTPRouter["Express REST Routes\n/api/auth, /api/conversations"]
        SocketServer["Socket.IO Server\n(Auth Handshake, Rooms, Events)"]
        Services["Service Layer\n(Auth, Conversation, Message)"]
        Presence["In-Memory Presence Registry\nMap<userId, Set<socketId>>"]
    end

    subgraph Database["PostgreSQL Database"]
        Drizzle["Drizzle ORM Engine"]
        UsersTable[("users Table\nUUID, Role Enum")]
        ConvsTable[("conversations Table\nStatus Enum, Atomic Locks")]
        MsgsTable[("messages Table\nUnique (senderId, clientMessageId)")]
    end

    CustomerUI -- HTTP Auth & Fetch --> HTTPRouter
    CustomerUI <== WebSocket Real-Time ==> SocketServer
    AgentUI -- HTTP Auth & Fetch --> HTTPRouter
    AgentUI <== WebSocket Real-Time ==> SocketServer

    HTTPRouter --> Services
    SocketServer --> Services
    SocketServer --> Presence
    Services --> Drizzle
    Drizzle --> UsersTable
    Drizzle --> ConvsTable
    Drizzle --> MsgsTable
```

---

## 🚀 Key Features & Capabilities

### 1. Dual User Roles with Distinct Workflows
- **Customer Role**:
  - Secure self-registration and login.
  - Create support tickets/conversations with optional initial message.
  - Real-time two-way messaging with assigned support agent.
  - Real-time agent presence (Online / Offline status pill).
  - Live typing indicator dots.
  - Message status checks (Sent `✓`, Delivered `✓✓`, Read `✓✓`).
  - Strict isolation: Customers can **never** access or read another customer's conversations.
- **Support Agent Role**:
  - Secure login (Agent accounts cannot be created via public registration; seeded via environment variables).
  - Real-time queue view of unassigned conversations available for claiming.
  - View conversations assigned to the current agent.
  - Atomic, race-condition-free ticket claiming.
  - Mark conversations as **Resolved** or **Closed**, and reopen them.

### 2. Robust Real-Time System Engineering
- **Message Idempotency**:
  - Unique composite index on `(sender_id, client_message_id)`.
  - Network retries or rapid duplicate clicks gracefully return the canonical existing message without creating duplicates.
- **Atomic Conversation Claiming**:
  - Eliminates the classic "two agents click Claim at the exact same millisecond" race condition via an atomic PostgreSQL conditional update:
    `UPDATE conversations SET assigned_agent_id = $1 WHERE id = $2 AND assigned_agent_id IS NULL AND status = 'open' RETURNING *`
  - Losing agent immediately receives HTTP 409 Conflict.
- **Persistence-First Broadcast Guarantee**:
  - Socket.IO broadcasts occur **only after** the PostgreSQL transaction successfully commits.
- **Multi-Tab Presence Tracking**:
  - Users stay marked **Online** if they have multiple browser tabs open, going **Offline** only when their last connection disconnects.

---

## 🛠 Technology Stack

| Layer | Technologies Used |
|---|---|
| **Frontend** | React 18, Vite, React Router 6, Socket.IO Client, Lucide Icons, Plain CSS |
| **Backend** | Node.js, Express 4 (ES Modules), Socket.IO 4 |
| **Database** | PostgreSQL, Drizzle ORM, `pg` (node-postgres), Drizzle Kit |
| **Auth & Validation**| JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `zod` |
| **Testing** | Vitest, Supertest |
| **Security** | Express Rate Limit, CORS, Password Hashing, Input Sanitization |

---

## 📁 Project Structure

```
websocket/
├── backend/
│   ├── drizzle/                        # Committed PostgreSQL migration SQL files
│   │   ├── 0000_initial_schema.sql
│   │   └── meta/_journal.json
│   ├── scripts/
│   │   └── seed-agent.js               # CLI script to seed agent from environment vars
│   ├── src/
│   │   ├── config/
│   │   │   └── env.js                  # Zod environment variable validation
│   │   ├── controllers/                # HTTP request handlers
│   │   │   ├── auth.controller.js
│   │   │   ├── conversation.controller.js
│   │   │   └── message.controller.js
│   │   ├── db/
│   │   │   ├── index.js                # pg.Pool and Drizzle initialization
│   │   │   ├── relations.js            # Drizzle ORM relational navigation
│   │   │   └── schema/                 # Database schema definitions
│   │   │       ├── users.js
│   │   │       ├── conversations.js
│   │   │       └── messages.js
│   │   ├── middleware/                 # Auth, role check, validation, rate limit, errors
│   │   │   ├── auth.middleware.js
│   │   │   ├── error.middleware.js
│   │   │   ├── rate-limit.middleware.js
│   │   │   └── validate.middleware.js
│   │   ├── repositories/               # Pure database operations
│   │   │   ├── conversation.repository.js
│   │   │   ├── message.repository.js
│   │   │   └── user.repository.js
│   │   ├── routes/                     # Express REST routes
│   │   │   ├── auth.routes.js
│   │   │   ├── conversation.routes.js
│   │   │   └── message.routes.js
│   │   ├── services/                   # Business logic and transactions
│   │   │   ├── auth.service.js
│   │   │   ├── conversation.service.js
│   │   │   └── message.service.js
│   │   ├── sockets/                    # Socket.IO connection and handlers
│   │   │   ├── index.js
│   │   │   ├── presence.registry.js    # Multi-tab presence tracking
│   │   │   ├── socket.auth.js          # Handshake JWT authentication
│   │   │   └── socket.handlers.js      # Real-time event dispatchers
│   │   ├── utils/
│   │   │   └── app-error.js
│   │   ├── app.js                      # Express configuration
│   │   └── server.js                   # Server entrypoint with graceful shutdown
│   ├── tests/                          # Automated Vitest test suite
│   │   ├── concurrency.test.js
│   │   ├── presence.test.js
│   │   └── validation.test.js
│   ├── drizzle.config.js
│   ├── package.json
│   ├── postman_collection.json         # Postman collection for manual API testing
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/                 # UI components
│   │   │   ├── MessageItem.jsx
│   │   │   ├── Navbar.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── TypingDots.jsx
│   │   ├── context/                    # Context providers
│   │   │   ├── AuthContext.jsx
│   │   │   └── SocketContext.jsx
│   │   ├── pages/                      # Application views
│   │   │   ├── AgentDashboard.jsx
│   │   │   ├── ChatPage.jsx
│   │   │   ├── CustomerDashboard.jsx
│   │   │   ├── LoginPage.jsx
│   │   │   ├── NotFoundPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── services/
│   │   │   └── api.js                  # Fetch wrapper with JWT injection
│   │   ├── App.jsx                     # Route definitions and ProtectedRoute
│   │   ├── index.css                   # Global design tokens and styling
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example
│
└── README.md
```

---

## 📦 Prerequisites & Database Setup

1. **Node.js**: `v18+` or `v20+` (tested on Node v24).
2. **PostgreSQL**: Install PostgreSQL locally or run via Docker:
   ```bash
   # Using Docker:
   docker run --name postgres-support -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=support_chat -p 5432:5432 -d postgres:16-alpine
   ```
   Or create the database using `psql`:
   ```sql
   CREATE DATABASE support_chat;
   ```

---

## 🔑 Environment Variables

### Backend Configuration (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:
```ini
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/support_chat
JWT_SECRET=super_secret_jwt_key_change_in_production_minimum_32_characters_long
JWT_EXPIRES_IN=7d

# Initial Agent Seed Credentials
AGENT_EMAIL=agent@support.com
AGENT_INITIAL_PASSWORD=AgentPassword123!
AGENT_NAME="Alex Support"
```

### Frontend Configuration (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:
```ini
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

---

## 🏃 Installation & Quick Start

### 1. Install Backend & Frontend Dependencies
```bash
# In backend directory:
cd backend
npm install

# In frontend directory:
cd ../frontend
npm install
```

### 2. Run Database Migrations & Seed Agent
```bash
cd ../backend

# Apply PostgreSQL migrations via Drizzle Kit:
npm run db:push
# or: npm run db:migrate

# Seed initial support agent account:
npm run db:seed
```

### 3. Start Backend & Frontend Dev Servers
```bash
# Terminal 1 (Backend):
cd backend
npm run dev

# Terminal 2 (Frontend):
cd frontend
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 🐳 Docker Architecture & Deployment

OmniDesk provides a production-grade, multi-container Docker architecture via Docker Compose, as well as an optional All-in-One single container option.

### 🏛️ Docker Microservices Architecture

```mermaid
flowchart TB
    subgraph Host["Host Machine (Developer / Browser)"]
        Browser["Web Browser\nhttp://localhost:5173"]
        APIClient["API Client / Postman\nhttp://localhost:5000"]
    end

    subgraph ComposeNetwork["Docker Bridge Network: websocket_default"]
        subgraph FrontendContainer["Frontend Container: omnidesk-frontend"]
            NginxServer["Nginx 1.25 Alpine\nPort :5173"]
            StaticAssets["Compiled Vite Assets\n(React 18 SPA)"]
        end

        subgraph BackendContainer["Backend Container: omnidesk-backend"]
            NodeServer["Node.js 20 Express\nPort :5000"]
            SocketIOServer["Socket.IO Server\n(WebSockets)"]
            WaitScript["wait-for-db.js\n(Health Handshake)"]
            DrizzleKit["Drizzle Migrator & Seeder"]
        end

        subgraph DBContainer["Database Container: omnidesk-db"]
            PostgresEngine["PostgreSQL 16 Alpine\nPort :5432"]
            Healthcheck["pg_isready\nHealth Probes"]
        end
    end

    subgraph Volumes["Persistent Storage"]
        PGData[("Named Volume: pgdata\n/var/lib/postgresql/data")]
    end

    Browser -->|Port :5173| NginxServer
    NginxServer --> StaticAssets
    NginxServer -.->|Reverse Proxy: /api/*| NodeServer
    NginxServer -.->|Reverse Proxy: /socket.io/* (WS Upgrade)| SocketIOServer
    APIClient -->|Port :5000| NodeServer

    WaitScript -->|Check Readiness| PostgresEngine
    DrizzleKit -->|Apply Migrations & Seed| PostgresEngine
    NodeServer -->|Read/Write Pool| PostgresEngine
    PostgresEngine --> PGData
```

### 📦 Component Breakdown

1. **`omnidesk-db` (Database Service)**:
   - **Image**: `postgres:16-alpine`
   - **Persistence**: Backed by a named volume `pgdata:/var/lib/postgresql/data`. Data survives container restarts and upgrades.
   - **Healthcheck**: Uses `pg_isready -U admin -d support_chat` every 3 seconds to guarantee that backend initialization only begins when PostgreSQL is actively accepting queries.

2. **`omnidesk-backend` (REST API & Real-Time WebSocket Engine)**:
   - **Dockerfile**: [`backend/Dockerfile`](backend/Dockerfile) (Node.js 20 Alpine).
   - **Handshake (`backend/scripts/wait-for-db.js`)**: A resilient Node.js check script that verifies database reachability with clear exponential retry logging.
   - **Automatic Schema Migration**: Executes `drizzle-kit migrate` during container startup to apply committed schema definitions.
   - **Automatic Agent Seeding**: Runs `node scripts/seed-agent.js` to initialize the default support agent account (`agent@support.com`).
   - **Server Execution**: Launches the HTTP and Socket.IO server on port 5000.

3. **`omnidesk-frontend` (Single Page Application Web Server)**:
   - **Dockerfile**: [`frontend/Dockerfile`](frontend/Dockerfile) (Multi-stage build).
     - *Build Stage*: Compiles the React + Vite source code into static assets (`dist`).
     - *Production Stage*: Serves static assets using high-performance `nginx:alpine` on port 5173.
   - **Reverse Proxy ([`frontend/nginx.conf`](frontend/nginx.conf))**:
     - Handles React client-side routing (`try_files $uri $uri/ /index.html`) to prevent 404s on page refresh.
     - Transparently reverse-proxies `/api/` and `/socket.io/` requests to `http://backend:5000` with WebSocket connection upgrade headers (`Upgrade`, `Connection`).

---

### 🚀 Starting the Docker Compose Stack (Recommended)

Run the entire application stack (DB, Backend, Frontend) with a single command:

```bash
# Build images and start all containers in detached mode:
docker compose up --build -d
```

Verify service availability:
- **Frontend UI**: [http://localhost:5173](http://localhost:5173)
- **Backend Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
- **Default Support Agent**: `agent@support.com` / `AgentPassword123!`

---

### 📊 Useful Docker Management & Debugging Commands

```bash
# View live status of running containers:
docker compose ps

# Follow logs from all containers:
docker compose logs -f

# Follow logs from a specific container:
docker logs -f omnidesk-backend
docker logs -f omnidesk-db
docker logs -f omnidesk-frontend

# Stop all containers (preserves database data in pgdata volume):
docker compose down

# Clean restart (reset database volume to fresh state):
docker compose down -v
docker compose up --build -d
```

---

### 🌟 Alternative: All-in-One Single Container

If you prefer running everything (PostgreSQL + Backend + Frontend) inside **literally one single container** (e.g. for single-container hosting on Render, Railway, or Cloud Run):

```bash
# 1. Build the all-in-one image:
docker build -t omnidesk-single .

# 2. Run the single container:
docker run -d --name omnidesk-app -p 5173:5173 -p 5000:5000 -p 5432:5432 omnidesk-single
```

---

## 🧪 Automated Testing & Verification

OmniDesk includes automated tests covering:
- Role validation & password security
- Message payload constraints & email normalization
- Multi-tab user presence transitions
- Concurrency simulation (simultaneous claim race conditions)
- Idempotent retries

Run the test suite:
```bash
cd backend
npm test
```

Test Results:
```
 ✓ tests/presence.test.js (1 test)
 ✓ tests/validation.test.js (9 tests)
 ✓ tests/concurrency.test.js (3 tests)

 Test Files  3 passed (3)
      Tests  13 passed (13)
```

---

## 📡 REST API Documentation

### Authentication Endpoints
- `POST /api/auth/register` — Register customer (Rate-limited). Rejects requests with `role: agent`.
- `POST /api/auth/login` — Login customer or agent. Returns JWT.
- `GET /api/auth/me` — Get authenticated user details.

### Conversation Endpoints
- `POST /api/conversations` — Create conversation (Customer only). Accepts optional `initialMessage`.
- `GET /api/conversations?type=unassigned|assigned&status=open|resolved|closed` — List conversations.
- `GET /api/conversations/:id` — Get conversation details with participant info.
- `PATCH /api/conversations/:id/assign` — Claim unassigned ticket (Agent only, atomic).
- `PATCH /api/conversations/:id/status` — Update conversation status (`open`, `resolved`, `closed`).

### Message Endpoints
- `GET /api/conversations/:id/messages?limit=50&cursor=...` — Cursor-paginated message history.
- `POST /api/conversations/:id/messages` — Send message via REST.
- `PATCH /api/conversations/:id/messages/read` — Mark conversation messages as read.

---

## ⚡ Socket.IO Event Contract

All Socket.IO connections authenticate during the handshake using `{ auth: { token: "<JWT>" } }`.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Server as Socket.IO Server
    participant DB as PostgreSQL
    actor Agent as Support Agent

    Customer->>Server: connect with JWT
    Server->>Customer: connected (joins user:customerId)
    Agent->>Server: connect with JWT
    Server->>Agent: connected (joins user:agentId)

    Customer->>Server: conversation:join { conversationId }
    Server-->>Customer: conversation:joined ack

    Agent->>Server: conversation:join { conversationId }
    Server-->>Agent: conversation:joined ack

    Customer->>Server: typing:start { conversationId }
    Server->>Agent: typing:update { isTyping: true }

    Customer->>Server: message:send { conversationId, clientMessageId, content }
    Server->>DB: INSERT message & UPDATE conversation (tx)
    DB-->>Server: Transaction Committed
    Server-->>Customer: ack { success: true, message: canonicalMessage }
    Server->>Agent: message:new canonicalMessage

    Agent->>Server: message:delivered { messageId }
    Server->>Customer: message:delivered { messageId, deliveredAt }

    Agent->>Server: message:read { conversationId }
    Server->>Customer: message:read { messageIds, readAt }
```

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `conversation:join` | Client -> Server | `{ conversationId }` | Authorizes access and joins room `conversation:<id>`. |
| `conversation:joined` | Server -> Client | `{ conversationId }` | Confirms room membership. |
| `message:send` | Client -> Server | `{ conversationId, clientMessageId, content }` | Atomically persists message and broadcasts. Reconciles via ack. |
| `message:new` | Server -> Client | Canonical `Message` object | Emitted to room participants after DB commit. |
| `message:delivered` | Bidirectional | `{ conversationId, messageId }` | Recipient client confirms receipt. |
| `message:read` | Bidirectional | `{ conversationId, messageIds, readAt }` | Recipient client opened the chat view. |
| `typing:start` / `stop` | Client -> Server | `{ conversationId }` | Triggers typing dots on counterpart's client. |
| `typing:update` | Server -> Client | `{ userId, userName, isTyping }` | Broadcast to conversation room. |
| `user:presence` | Server -> Client | `{ userId, status: 'online' | 'offline' }` | Emitted when user's active sockets change. |
| `socket:error` | Server -> Client | `{ event, message }` | Structured error if socket operation fails. |

---

## 🧠 In-Depth Engineering Concepts

### 1. WebSocket vs Socket.IO Handshake
Native WebSockets provide a raw bidirectional TCP stream (`ws://`). Socket.IO builds an abstraction layer over WebSocket and HTTP long-polling with reconnection handling, multiplexed rooms, packet heartbeats, and acknowledgment callbacks.

During connection:
1. Client initiates HTTP GET to `/socket.io/?EIO=4&transport=polling` (or directly upgrades to `websocket`).
2. Handshake data includes `auth: { token }`.
3. Server middleware validates the JWT and queries PostgreSQL to verify the user exists.
4. Server assigns socket ID and registers user in the in-memory presence registry.

### 2. Atomic Concurrency & Race Condition Elimination
**The Problem**:
If two agents click "Claim Conversation" at the exact same moment:
1. Agent A reads `assignedAgentId = null`.
2. Agent B reads `assignedAgentId = null`.
3. Agent A writes `assignedAgentId = A`.
4. Agent B writes `assignedAgentId = B`.
Agent B inadvertently overwrites Agent A.

**The Solution**:
We execute an atomic conditional update at the database engine level:
```sql
UPDATE conversations
SET assigned_agent_id = $1, updated_at = NOW()
WHERE id = $2 AND assigned_agent_id IS NULL AND status = 'open'
RETURNING *;
```
PostgreSQL locks the row during the update. Exactly one agent succeeds (returns the updated row). The second agent updates 0 rows and our service immediately throws an `AppError.conflict` (HTTP 409).

### 3. Idempotent Message Persistence
If a user is on an unstable mobile connection, their first send request might succeed in the database, but the network drops before receiving the server's acknowledgment. When the client retries, a naive backend creates a duplicate message.

OmniDesk enforces idempotency with a unique constraint on `(sender_id, client_message_id)`. If a duplicate is received, the database catches the unique constraint and returns the existing canonical message row.

### 4. Sent vs Delivered vs Read Lifecycle
- **Sent**: Server has written the message to PostgreSQL and committed the transaction.
- **Delivered**: The recipient's active browser client received the `message:new` event and emitted `message:delivered` back to the server.
- **Read**: The recipient currently has the conversation open on screen and triggered `message:read`.

### 5. Multi-Tab Presence Tracking
In a realistic environment, a user might open 3 tabs simultaneously. If they close 1 tab, they are still online.
We track presence using an in-memory Map:
```javascript
userSockets = new Map(); // Map<userId, Set<socketId>>
```
- Transition to `online`: When `Set.size` increases from `0 -> 1`.
- Transition to `offline`: When `Set.size` decreases from `1 -> 0`.

### 6. PostgreSQL Transactions & Persistence First
A common pitfall is broadcasting messages over WebSockets before confirming database storage. If the database crashes or constraint validation fails, other clients see a "ghost message" that disappears upon refresh.
OmniDesk always persists within a `db.transaction()` block and only calls `io.to(...).emit()` **after** the transaction has committed.

---

## 🐙 Git Repository Setup & Best Practices

To push this project cleanly to GitHub / GitLab without leaking secrets or bloating the repository with `node_modules`, proper `.gitignore` files have been configured at the root, backend, and frontend levels.

### 🛡️ What is Protected by `.gitignore`?
- **Secrets & Credentials**: `.env` and `.env.local` files (DB passwords, JWT secrets) are completely ignored. Only `.env.example` templates are tracked.
- **Dependencies**: `node_modules/` across all directories.
- **Build Artifacts**: `frontend/dist/`, compiled caches (`.vite/`), and test coverage folders.
- **Local Databases**: PostgreSQL data files (`pgdata/`) and debug logs (`*.log`).

### 🚀 Pushing to GitHub (Step-by-Step)

```bash
# 1. Initialize git repository (if not already initialized)
git init

# 2. Check status to ensure .env and node_modules are ignored
git status

# 3. Stage all source files
git add .

# 4. Commit changes
git commit -m "feat: complete real-time support chat platform with dockerized architecture"

# 5. Set main branch and link remote repository
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git

# 6. Push to GitHub
git push -u origin main
```

---

## 🔒 Security Limitations & Future Improvements

1. **JWT Storage**: In this educational application, the access token is stored in browser `localStorage` for accessibility. In high-security production environments, storing tokens in `httpOnly`, `SameSite=Strict`, `Secure` cookies prevents Cross-Site Scripting (XSS) extraction.
2. **Horizontal Scaling**: The current presence registry is in-memory on a single Node.js process. In a distributed multi-instance deployment, we would use `@socket.io/redis-adapter` and Redis Hash sets for shared presence across multiple backend nodes.
3. **File Attachments**: Future enhancements could integrate S3/GCS presigned URLs for ticket attachment uploads.

---

## 📄 License
MIT License. Built for portfolio presentation and learning real-time systems.
