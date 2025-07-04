import express, { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Define types based on the provided documentation
interface SessionVariables {
  [key: string]: string;
}

interface Session {
  role: string;
  variables: SessionVariables;
}

interface NdcRequest {
  request_arguments?: {
    [key: string]: any;
  };
  [key: string]: any;
}

interface WebhookRequest {
  session: Session;
  ndcRequest: NdcRequest;
  dataConnectorName: string;
  operationType: "query" | "queryExplain" | "mutation" | "mutationExplain";
  ndcVersion: string;
}

// JWT claims interface
interface HasuraClaims {
  "x-hasura-default-role": string;
  "x-hasura-allowed-roles": string[];
  [key: string]: any;
}

interface JwtPayload {
  "claims.jwt.hasura.io"?: HasuraClaims;
  [key: string]: any;
}

// Auth webhook response interface
interface AuthResponse {
  "X-Hasura-Role": string;
  [key: string]: any;
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3033;
const HOST = process.env.HOST || "0.0.0.0";

// Make JWT_SECRET mandatory
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("JWT_SECRET environment variable is required");
  process.exit(1);
}

// Middleware for parsing JSON
app.use(express.json());

// Ping endpoint
app.get("/ping", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// Global counter for round-robin selection
let currentFollowerIndex = 0;
const followerConnections = ["follower1", "follower2", "follower3"];

// Main webhook endpoint
app.post("/pre/ndc", (req: Request<{}, {}, WebhookRequest>, res: Response) => {
  try {
    console.log("Incoming request headers:", req.headers);
    console.log("Received webhook request:", JSON.stringify(req.body, null, 2));

    const requestData = req.body;

    if (!requestData.ndcRequest.request_arguments) {
      requestData.ndcRequest.request_arguments = {};
    }

    if (
      requestData.operationType == "mutation" ||
      requestData.operationType == "mutationExplain" ||
      requestData.session.variables["x-hasura-cache-control"] == "no-cache"
      // requestData.session.variables["x-hasura-cache-control"] as String == "no-cache"
    ) {
      requestData.ndcRequest.request_arguments["connection_name"] = "primary";
    } else {
      // Select the current follower
      const selectedFollower = followerConnections[currentFollowerIndex];

      // Increment the index for the next request
      currentFollowerIndex =
        (currentFollowerIndex + 1) % followerConnections.length;

      console.log(`Round-robin selected connection: ${selectedFollower}`);

      requestData.ndcRequest.request_arguments["connection_name"] =
        selectedFollower;
    }

    res.json({
      ndcRequest: requestData.ndcRequest,
    });
  } catch (err) {
    console.error("Error processing request:", err);
    res
      .status(400)
      .json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

// Auth webhook endpoint - POST method
app.post("/authenticate", (req: Request, res: Response) => {
  try {
    console.log(
      "Auth webhook received body:",
      JSON.stringify(req.body, null, 2)
    );

    // Extract headers from request body
    const headers = req.body.headers || {};

    // Check for Authorization header
    const authHeader = headers.Authorization || headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("Missing or invalid Authorization header");
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    try {
      // Verify and decode the JWT
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      console.log("Decoded JWT:", JSON.stringify(decoded, null, 2));

      // Extract Hasura claims from the namespace
      const hasuraClaims = decoded["claims.jwt.hasura.io"];

      if (!hasuraClaims) {
        console.log("No Hasura claims found in JWT");
        return res
          .status(401)
          .json({ message: "Invalid token: missing Hasura claims" });
      }

      // Check for required claims
      if (
        !hasuraClaims["x-hasura-default-role"] ||
        !hasuraClaims["x-hasura-allowed-roles"]
      ) {
        console.log("Missing required Hasura claims");
        return res.status(401).json({
          message: "Invalid token: missing required Hasura claims",
        });
      }

      // Determine the role to use
      let role = hasuraClaims["x-hasura-default-role"];

      // Check if x-hasura-role header is present
      const requestedRole =
        headers["x-hasura-role"] || headers["X-Hasura-Role"];

      if (requestedRole) {
        // Check if the requested role is in the allowed roles
        if (hasuraClaims["x-hasura-allowed-roles"].includes(requestedRole)) {
          role = requestedRole;
        } else {
          console.log(`Requested role ${requestedRole} not in allowed roles`);
          return res.status(401).json({
            message: `Requested role ${requestedRole} not in allowed roles`,
          });
        }
      }

      // Prepare the response with session variables
      const authResponse: AuthResponse = {
        "X-Hasura-Role": role,
      };

      // Add all other Hasura claims to the response
      Object.entries(hasuraClaims).forEach(([key, value]) => {
        // Skip the default role and allowed roles as they're not needed in the response
        if (
          key !== "x-hasura-default-role" &&
          key !== "x-hasura-allowed-roles"
        ) {
          // Convert the key to the expected format (X-Hasura-*)
          const formattedKey = key.replace(/^x-hasura-/, "X-Hasura-");
          authResponse[formattedKey] = value;
        }
      });

      // Check for Cache-Control: no-cache header and add a special claim
      const cacheControl = headers["cache-control"] || headers["Cache-Control"];
      if (cacheControl && cacheControl.includes("no-cache")) {
        authResponse["X-Hasura-Cache-Control"] = "no-cache";
      }

      return res.status(200).json(authResponse);
    } catch (error) {
      console.error("JWT verification error:", error);
      return res.status(401).json({
        message: "Invalid token",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  } catch (err) {
    console.error("Error in auth webhook:", err);
    return res.status(500).json({
      message: "Internal server error",
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// 404 handler
app.use((req: Request, res: Response) => {
  console.log("404 Not Found for:", req.url);
  res.status(404).json({ error: "Not found" });
});

// Start the server
app.listen(PORT, HOST, () => {
  console.log(`Webhook server running at http://${HOST}:${PORT}`);
});
