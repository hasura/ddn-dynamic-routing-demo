# Hasura Dynamic Routing Demo

This project demonstrates how to implement dynamic routing with Hasura Data Delivery Network (DDN), enabling read/write splitting and load balancing across multiple database replicas.

## Overview

This demo showcases:

1. **Dynamic Database Routing**: Route read queries to follower databases while directing write operations to the primary database
2. **Load Balancing**: Distribute read queries across multiple follower databases using round-robin selection
3. **Custom Authentication**: Implement JWT-based authentication with role-based access control
4. **Cache Control**: Support cache control headers to bypass follower routing when needed

## Architecture

The project consists of the following components:

- **Hasura DDN**: The core Hasura engine that processes GraphQL requests
- **PostgreSQL Connector**: Connects Hasura to PostgreSQL databases
- **Webhook Server**: Handles authentication and pre-NDC request processing for dynamic routing
- **PostgreSQL Database**: A single PostgreSQL instance with multiple databases simulating primary/follower setup

```
┌─────────────┐     ┌─────────────┐     ┌───────────────────┐
│             │     │             │     │                   │
│  GraphQL    │────▶│   Hasura    │────▶│  Pre-NDC Webhook  │
│  Client     │     │    DDN      │     │                   │
│             │     │             │     └─────────┬─────────┘
└─────────────┘     └──────┬──────┘               │
                           │                      │
                           ▼                      ▼
                    ┌─────────────┐     ┌───────────────────┐
                    │             │     │                   │
                    │ PostgreSQL  │────▶│ Primary Database  │
                    │ Connector   │     │                   │
                    │             │     └───────────────────┘
                    └──────┬──────┘
                           │
                           ▼
                    ┌─────────────────┐
                    │                 │
                    │ Follower DB 1   │
                    │                 │
                    └─────────────────┘
                    ┌─────────────────┐
                    │                 │
                    │ Follower DB 2   │
                    │                 │
                    └─────────────────┘
                    ┌─────────────────┐
                    │                 │
                    │ Follower DB 3   │
                    │                 │
                    └─────────────────┘
```

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Node.js (for local development)

### Setup

1. Clone this repository:

   ```
   git clone https://github.com/yourusername/hasura-dynamic-routing-demo.git
   cd hasura-dynamic-routing-demo
   ```

2. Start the services:

   ```
   docker-compose up -d
   ```

3. Access the Hasura Console:
   ```
   http://localhost:8080/console
   ```

## Environment Configuration

The project uses the following environment variables:

```
# Hasura DDN Configuration
HASURA_GRAPHQL_ADMIN_SECRET=hasura
HASURA_GRAPHQL_ENABLE_CONSOLE=true
HASURA_GRAPHQL_DEV_MODE=true
HASURA_GRAPHQL_ENABLED_LOG_TYPES=startup, http-log, webhook-log, websocket-log, query-log

# Auth Webhook Configuration
AUTH_WEBHOOK_URL=http://webhook:3033/authenticate
JWT_SECRET=a-string-secret-at-least-256-bits-long

# PostgreSQL Connector Configuration
APP_MYPOSTGRES_AUTHORIZATION_HEADER="Bearer 7BMMu8H2y7Mz126BhImyEw=="
APP_MYPOSTGRES_CONNECTION_URI="postgresql://user:password@local.hasura.dev:8241/primary"
APP_MYPOSTGRES_CONNECTION_URI_FOLLOWER1="postgresql://user:password@local.hasura.dev:8241/follower1"
APP_MYPOSTGRES_CONNECTION_URI_FOLLOWER2="postgresql://user:password@local.hasura.dev:8241/follower2"
APP_MYPOSTGRES_CONNECTION_URI_FOLLOWER3="postgresql://user:password@local.hasura.dev:8241/follower3"
APP_MYPOSTGRES_HASURA_CONNECTOR_PORT=5185
APP_MYPOSTGRES_HASURA_SERVICE_TOKEN_SECRET="7BMMu8H2y7Mz126BhImyEw=="
APP_MYPOSTGRES_OTEL_EXPORTER_OTLP_ENDPOINT="http://local.hasura.dev:4317"
APP_MYPOSTGRES_OTEL_SERVICE_NAME="app_mypostgres"
APP_MYPOSTGRES_READ_URL="http://local.hasura.dev:5185"
APP_MYPOSTGRES_WRITE_URL="http://local.hasura.dev:5185"
```

## Authentication

The project uses JWT-based authentication. For testing, you can use this sample JWT token:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3MzU5MTY3MTgsImV4cCI6MTc5NjkxNjY3NywiY2xhaW1zLmp3dC5oYXN1cmEuaW8iOnsieC1oYXN1cmEtZGVmYXVsdC1yb2xlIjoiYWRtaW4iLCJ4LWhhc3VyYS1hbGxvd2VkLXJvbGVzIjpbInVzZXIiLCJhZG1pbiJdLCJ4LWhhc3VyYS11c2VyLWlkIjoxMjM0fX0.gfXsQH0Gv28IqD2mFT3qfe2uQ7RmItCnMZO169xX1T8
```

JWT Secret: `a-string-secret-at-least-256-bits-long`

### Authentication Configuration

The authentication is configured in the Hasura metadata:

```yaml
kind: AuthConfig
version: v4
definition:
  mode:
    webhook:
      url:
        valueFromEnv: AUTH_WEBHOOK_URL
      method: POST
      customHeadersConfig:
        body:
          headers:
            forward:
              - authorization
              - content-type
              - cache-control
        headers:
          additional:
            user-agent: "Hasura DDN"
```

## Dynamic Routing

The dynamic routing is implemented in the webhook server, which processes pre-NDC requests and modifies them to route to the appropriate database.

### How It Works

1. **Read/Write Splitting**:

   - All mutations are routed to the primary database
   - Read queries are distributed across follower databases

2. **Round-Robin Load Balancing**:

   - Read queries are distributed across multiple follower databases in a round-robin fashion
   - This ensures even load distribution across replicas

3. **Cache Control Override**:
   - Adding a `Cache-Control: no-cache` header forces queries to use the primary database
   - Useful for ensuring data consistency when needed

## Testing the Dynamic Routing

### 1. Make a read query without cache control headers

This should be routed to a follower database. Run this query multiple times to see it being distributed across different followers.

```graphql
query {
  users {
    id
    name
    email
  }
}
```

### 2. Make a mutation

This should always be routed to the primary database.

```graphql
mutation {
  insert_users_one(object: { name: "New User", email: "new@example.com" }) {
    id
    name
    email
  }
}
```

### 3. Make a read query with Cache-Control: no-cache header

This should be routed to the primary database, bypassing the followers.

```graphql
# Add this header: Cache-Control: no-cache
query {
  users {
    id
    name
    email
  }
}
```

## Components

### Webhook Server

The webhook server handles:

1. **Authentication**: Verifies JWT tokens and sets Hasura session variables
2. **Pre-NDC Request Processing**: Modifies NDC requests to implement dynamic routing

See the [webhook README](webhook/README.md) for more details.

### PostgreSQL Connector

The PostgreSQL connector connects Hasura to the PostgreSQL databases. It's configured to use the primary database for writes and the follower databases for reads.

### PostgreSQL Database

For this demo, we use a single PostgreSQL instance with multiple databases to simulate a primary/follower setup:

- `primary`: The primary database that handles all write operations
- `follower1`, `follower2`, `follower3`: Follower databases that handle read operations

In a production environment, these would be separate database instances with replication.

## Development

### Webhook Server

To develop the webhook server locally:

```bash
cd webhook
npm install
npm run dev
```

### Hasura Metadata

The Hasura metadata is stored in the `globals/metadata` directory. You can modify it and apply the changes using the Hasura CLI:

```bash
hasura metadata apply
```

## Resources

- [Hasura Documentation](https://hasura.io/docs/latest/index/)
- [Hasura DDN Documentation](https://hasura.io/docs/latest/data-delivery-network/index/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

## License

This project is licensed under the MIT License - see the LICENSE file for details.
