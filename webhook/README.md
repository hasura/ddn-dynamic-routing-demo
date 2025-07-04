# Hasura Pre-NDC Request Webhook Server

This is a TypeScript webhook server that processes pre-NDC requests for Hasura.

## Development

1. Install dependencies:

   ```
   npm install
   ```

2. Run in development mode:

   ```
   npm run dev
   ```

3. Build for production:

   ```
   npm run build
   ```

4. Run in production mode:
   ```
   npm start
   ```

## Docker

The server is packaged as a Docker container and included in the main compose.yaml file.

## Environment Variables

- `PORT`: The port on which the server will run (default: 3033)
- `HOST`: The host on which the server will run (default: 0.0.0.0)
- `JWT_SECRET`: **Required** - The secret key used to verify JWT tokens

## Request Format

The webhook receives requests with the following structure:

```json
{
  "session": {
    "role": "user",
    "variables": {
      "x-hasura-user-id": "1"
    }
  },
  "ndcRequest": {
    /* The NDC request */
  },
  "dataConnectorName": "qualified.connector.name",
  "operationType": "query|queryExplain|mutation|mutationExplain",
  "ndcVersion": "v0.1.x|v0.2.x"
}
```
