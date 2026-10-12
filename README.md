# OmniDesk

> High-performance, full-stack real-time customer support platform built with **React (Vite)**, **Node.js (Express)**, **Socket.IO**, **PostgreSQL**, and **Drizzle ORM**. Fully containerized using **Docker** and **Nginx**.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v20+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue.svg)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED.svg)](https://www.docker.com/)

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Key Engineering Implementations](#key-engineering-implementations)
  - [1. Atomic Queue & Race-Free Claiming](#1-atomic-queue--race-free-claiming)
  - [2. Idempotent Message Delivery](#2-idempotent-message-delivery)
  - [3. Persistence-First Broadcast Guarantee](#3-persistence-first-broadcast-guarantee)
  - [4. Multi-Tab Presence Engine](#4-multi-tab-presence-engine)
  - [5. Message Lifecycle Tracking (Sent, Delivered, Read)](#5-message-lifecycle-tracking-sent-delivered-read)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-recommended)
  - [Method 2: Local Development Setup](#method-2-local-development-setup)
- [Environment Variables](#environment-variables)
- [API & WebSocket Protocol Specification](#api--websocket-protocol-specification)
  - [REST API](#rest-api)
  - [Socket.IO Events](#socketio-events)
- [Automated Testing](#automated-testing)
- [License](#license)

---

## Overview

OmniDesk is an end-to-end customer support platform designed around real-time synchronization, strict database concurrency, and clean separation of roles between customers and support agents:

- **Customer Workflow**: Self-service registration, instant ticket generation, real-time bidirectional messaging, live agent presence detection, typing indicators, and delivery/read receipts.
- **Agent Workflow**: Real-time queue of unassigned tickets, atomic ticket claiming without race conditions, multi-conversation management, and lifecycle controls (`open`, `resolved`, `closed`).

---

## System Architecture

```mermaid
flowchart TB
    subgraph Clients["Clients (React 18 + Vite)"]
        CustomerClient["Customer UI\n(Multi-Tab Support)"]
        AgentClient["Agent Dashboard\n(Queue & Active Chats)"]
    end

    subgraph Gateway["Reverse Proxy & Web Server"]
        Nginx["Nginx Reverse Proxy\n(Port :5173 / SPA Routing)"]
    end

    subgraph BackendApp["Application Server (Node.js 20)"]
        ExpressRouter["Express REST API\n(/api/auth, /api/conversations)"]
        SocketEngine["Socket.IO Engine\n(Auth Handshake, Rooms, Events)"]
        PresenceRegistry["Presence Registry\nMap<userId, Set<socketId>>"]
        Services["Service Layer\n(Auth, Conversation, Message)"]
    end

    subgraph Persistence["Storage Tier"]
        Postgres[("PostgreSQL 16\nDrizzle ORM")]
        Volume[("Persistent Docker Volume\npgdata")]
    end

    CustomerClient -->|"HTTP / WS"| Nginx
    AgentClient -->|"HTTP / WS"| Nginx
    Nginx -->|"Proxy: /api"| ExpressRouter
    Nginx -->|"Proxy: /socket.io (WS Upgrade)"| SocketEngine

    ExpressRouter --> Services
    SocketEngine --> Services
    SocketEngine --> PresenceRegistry

    Services --> Postgres
    Postgres --> Volume
```

---

## Key Engineering Implementations

### 1. Atomic Queue & Race-Free Claiming
In multi-agent environments, two agents can attempt to claim an open ticket at the exact same millisecond. Traditional application-level checks (`SELECT` then `UPDATE`) are vulnerable to race conditions (Time-of-Check to Time-of-Use).

OmniDesk prevents this at the database engine level by using an atomic conditional update query:

```sql
UPDATE conversations
SET assigned_agent_id = $1, updated_at = NOW()
WHERE id = $2 AND assigned_agent_id IS NULL AND status = 'open'
RETURNING *;
```

PostgreSQL acquires a row-level write lock during execution. Exactly one transaction succeeds and returns the updated row. Any competing transaction returns zero rows, allowing the backend to immediately reject the request with `409 Conflict`.

### 2. Idempotent Message Delivery
On unstable network connections, client retries or duplicate clicks can lead to duplicate message rows.

To guarantee idempotency, messages carry a client-generated UUID (`clientMessageId`). The database schema enforces uniqueness across sender and client message IDs:

```sql
CREATE UNIQUE INDEX idx_messages_sender_client_id ON messages (sender_id, client_message_id);
```

If a retry occurs, the repository safely captures the conflict and returns the existing canonical record rather than creating a duplicate.

### 3. Persistence-First Broadcast Guarantee
A frequent issue in real-time architectures is broadcasting messages to rooms before confirming database persistence. If the database crashes or schema validation fails, clients receive "ghost messages" that disappear on page reload.

OmniDesk guarantees data integrity by strictly isolating Socket.IO broadcasts until the transaction commits:

```javascript
// Database transaction commit executes first
const canonicalMessage = await db.transaction(async (tx) => {
  return await messageRepository.create({ ...payload }, tx);
});

// Broadcast occurs only after successful commit
io.to(`conversation:${conversationId}`).emit('message:new', canonicalMessage);
```

### 4. Multi-Tab Presence Engine
Users commonly maintain multiple browser tabs open simultaneously. A naive socket-per-user tracking system marks users offline as soon as one tab closes.

OmniDesk utilizes a reference-counted in-memory registry:

```javascript
// Map<userId, Set<socketId>>
class PresenceRegistry {
  addSocket(userId, socketId) {
    // Transition to online only on 0 -> 1
  }
  removeSocket(userId, socketId) {
    // Transition to offline only on 1 -> 0
  }
}
```

This ensures presence status reliably reflects whether the user has at least one active connection.

### 5. Message Lifecycle Tracking (Sent, Delivered, Read)
Messages transition through three distinct lifecycle states:
- **Sent (`✓`)**: Written to PostgreSQL and committed to the database.
- **Delivered (`✓✓`)**: Target participant's active client receives the `message:new` event and emits an acknowledgment back to the server (`message:delivered`).
- **Read (`✓✓` Colored)**: Target participant opens the conversation viewport, firing the `message:read` event.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, React Router 6, Socket.IO Client, Lucide Icons, Plain CSS |
| **Backend** | Node.js (v20+), Express 4 (ES Modules), Socket.IO 4 |
| **Database & ORM** | PostgreSQL 16, Drizzle ORM, Drizzle Kit, `pg` driver |
| **Authentication & Validation** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, `zod` |
| **Infrastructure & Web Server** | Docker, Docker Compose, Nginx (Alpine) |
| **Testing** | Vitest, Supertest |

---

## Project Structure

```
omnidesk/
├── backend/
│   ├── drizzle/                     # Versioned PostgreSQL migration SQL files
│   ├── scripts/
│   │   ├── seed-agent.js            # Initial support agent seed script
│   │   └── wait-for-db.js           # Database readiness check with retry logic
│   ├── src/
│   │   ├── config/                  # Environment variable schema validation (Zod)
│   │   ├── controllers/             # REST controllers
│   │   ├── db/                      # Connection pool, Drizzle schemas & relations
│   │   ├── middleware/              # JWT auth, role guard, error & rate-limit middleware
│   │   ├── repositories/            # Database query layers
│   │   ├── routes/                  # Express route declarations
│   │   ├── services/                # Business logic & transactional operations
│   │   ├── sockets/                 # Socket.IO handlers & presence registry
│   │   └── validators/              # Zod input request schemas
│   ├── tests/                       # Automated test suite (Vitest)
│   ├── Dockerfile
│   └── docker-entrypoint.sh
│
├── frontend/
│   ├── src/
│   │   ├── components/              # Shared UI components (MessageItem, Navbar, etc.)
│   │   ├── context/                 # AuthContext & SocketContext state providers
│   │   ├── pages/                   # Views (AgentDashboard, CustomerDashboard, ChatPage)
│   │   └── services/                # API client wrapper with JWT injection
│   ├── nginx.conf                   # SPA routing & WebSocket reverse proxy config
│   └── Dockerfile
│
├── docker-compose.yml               # Multi-container orchestration (DB, API, Frontend)
└── .dockerignore / .gitignore
```

---

## Getting Started

### Method 1: Docker Compose (Recommended)

The entire platform (PostgreSQL, Backend API, and Frontend SPA) is fully containerized with automated health checks, schema migrations, and agent account seeding.

1. **Clone the repository:**
   ```bash
   git clone https://github.com/iamabdullahzubair/omnidesk.git
   cd omnidesk
   ```

2. **Start all services:**
   ```bash
   docker compose up --build -d
   ```

3. **Access the application:**
   - **Frontend UI**: [http://localhost:5173](http://localhost:5173)
   - **Backend API**: [http://localhost:5000/api/health](http://localhost:5000/api/health)
   - **Default Support Agent Account**:
     - Email: `agent@support.com`
     - Password: `AgentPassword123!`

4. **Service management commands:**
   ```bash
   # View container status
   docker compose ps

   # View live logs
   docker compose logs -f

   # Stop all services
   docker compose down
   ```

---

### Method 2: Local Development Setup

#### Prerequisites
- Node.js `v18+` or `v20+`
- PostgreSQL 16 running locally (or via Docker)

#### 1. Backend Setup
```bash
cd backend
npm install

# Copy and configure environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Seed initial support agent
npm run db:seed

# Start backend server
npm run dev
```

#### 2. Frontend Setup
```bash
cd ../frontend
npm install

# Copy environment variables
cp .env.example .env

# Start frontend dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Description | Default |
|---|---|---|
| `PORT` | HTTP & WebSocket server port | `5000` |
| `NODE_ENV` | Environment (`development` / `production`) | `development` |
| `CLIENT_URL` | Allowed CORS origin | `http://localhost:5173` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://admin:admin123@localhost:5432/support_chat` |
| `JWT_SECRET` | Secret key for signing tokens | Minimum 16 characters |
| `JWT_EXPIRES_IN`| Token validity period | `7d` |
| `AGENT_EMAIL` | Default seeded support agent email | `agent@support.com` |
| `AGENT_INITIAL_PASSWORD` | Default seeded agent password | `AgentPassword123!` |
| `AGENT_NAME` | Default agent display name | `Alex Support` |

### Frontend Configuration (`frontend/.env`)

| Variable | Description | Default |
|---|---|---|
| `VITE_API_URL` | Base URL for REST API endpoints | `http://localhost:5000` |
| `VITE_SOCKET_URL` | Base URL for Socket.IO connection | `http://localhost:5000` |

---

## API & WebSocket Protocol Specification

### REST API

#### Authentication
- `POST /api/auth/register` — Register a customer account (public registration for `agent` role is strictly rejected).
- `POST /api/auth/login` — Authenticate and receive JWT.
- `GET /api/auth/me` — Retrieve authenticated user profile.

#### Conversations
- `POST /api/conversations` — Create support conversation (Customer only).
- `GET /api/conversations?type=unassigned|assigned&status=open|resolved|closed` — Retrieve authorized conversations.
- `GET /api/conversations/:id` — Retrieve conversation details and participant metadata.
- `PATCH /api/conversations/:id/assign` — Atomically claim an unassigned conversation (Agent only).
- `PATCH /api/conversations/:id/status` — Transition conversation status (`open`, `resolved`, `closed`).

#### Messages
- `GET /api/conversations/:id/messages` — Paginated message history for a conversation.
- `POST /api/conversations/:id/messages` — Fallback HTTP message dispatch.
- `PATCH /api/conversations/:id/messages/read` — Mark unread messages as read.

---

### Socket.IO Events

All Socket.IO connections authenticate on handshake via `{ auth: { token: "<JWT>" } }`.

```mermaid
sequenceDiagram
    autonumber
    actor Customer as Customer
    participant Server as Socket.IO Server
    participant DB as PostgreSQL
    actor Agent as Support Agent

    Customer->>Server: Handshake with JWT
    Server->>Customer: Connected (joins user:customerId)
    Agent->>Server: Handshake with JWT
    Server->>Agent: Connected (joins user:agentId)

    Customer->>Server: conversation:join { conversationId }
    Agent->>Server: conversation:join { conversationId }

    Customer->>Server: typing:start { conversationId }
    Server->>Agent: typing:update { isTyping: true }

    Customer->>Server: message:send { conversationId, clientMessageId, content }
    Server->>DB: INSERT message (Transaction)
    DB-->>Server: Commit Successful
    Server-->>Customer: Acknowledgment callback
    Server->>Agent: message:new (Canonical Message)

    Agent->>Server: message:delivered { messageId }
    Server->>Customer: message:delivered { messageId, deliveredAt }

    Agent->>Server: message:read { conversationId }
    Server->>Customer: message:read { messageIds, readAt }
```

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `conversation:join` | Client -> Server | `{ conversationId }` | Authorizes membership and joins socket room `conversation:<id>`. |
| `message:send` | Client -> Server | `{ conversationId, clientMessageId, content }` | Submits message with idempotency key. Persists before broadcast. |
| `message:new` | Server -> Client | `Message` | Broadcast to conversation room after DB commit. |
| `message:delivered` | Bidirectional | `{ conversationId, messageId }` | Acknowledges message receipt by client. |
| `message:read` | Bidirectional | `{ conversationId, messageIds, readAt }` | Marks messages read when viewed in the viewport. |
| `typing:start` / `stop` | Client -> Server | `{ conversationId }` | Emits typing state indicator. |
| `typing:update` | Server -> Client | `{ userId, userName, isTyping }` | Broadcasts typing state to conversation counterpart. |
| `user:presence` | Server -> Client | `{ userId, status: 'online' \| 'offline' }` | Broadcasts online/offline transitions based on socket registry. |

---

## Automated Testing

The backend includes a comprehensive test suite covering validation rules, role isolation, multi-tab presence tracking, and concurrency simulations:

```bash
cd backend
npm test
```

Test coverage includes:
- **Zod Validation**: Email normalization, password policies, input bounds.
- **Role Isolation**: Enforcing customer and agent permission boundaries.
- **Presence Registry**: State transition testing across multi-socket instances.
- **Concurrency & Idempotency**: Parallel ticket claims and duplicate message idempotency.

---

## License

This project is licensed under the [MIT License](LICENSE).
