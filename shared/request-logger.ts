import type { APIGatewayProxyEventV2, APIGatewayProxyEvent } from "aws-lambda";

/**
 * Logs: "<username> <path and query>"
 * Works with both REST (v1) and HTTP API (v2) events.
 */
export function logRequest(event: APIGatewayProxyEvent | APIGatewayProxyEventV2) {
  const username =
    (event as any)?.requestContext?.authorizer?.username ||
    (event as any)?.requestContext?.authorizer?.claims?.["cognito:username"] ||
    (event as any)?.requestContext?.authorizer?.claims?.username ||
    ((event as any)?.requestContext?.identity?.apiKeyId ? "admin" : "") ||
    "unknown";

  const path =
    (event as any)?.requestContext?.path ||
    (event as any)?.rawPath ||
    (event as any)?.path ||
    "/";
  const qs =
    (event as any)?.rawQueryString ||
    (event as any)?.queryStringParameters
      ? "?" +
        new URLSearchParams(
          (event as any)?.queryStringParameters || {}
        ).toString()
      : "";

  console.log(`${username} ${path}${qs}`);
}
