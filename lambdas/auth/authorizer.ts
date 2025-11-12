import { APIGatewayRequestAuthorizerHandler } from "aws-lambda";
import { CookieMap, createPolicy, parseCookies, verifyToken } from "../utils";

export const handler: APIGatewayRequestAuthorizerHandler = async (event) => {
  console.log("[AUTHZ EVENT]", JSON.stringify({ path: event?.methodArn, headers: event?.headers }, null, 2));

  const cookies: CookieMap = parseCookies(event);
  if (!cookies || !cookies.token) {
    return {
      principalId: "",
      policyDocument: createPolicy(event, "Deny"),
      context: { username: "" },
    };
  }

  const verified = await verifyToken(
    cookies.token,
    process.env.USER_POOL_ID,
    process.env.REGION!
  );

  const username =
    (verified && (verified as any)["cognito:username"]) ||
    (verified && (verified as any).username) ||
    (verified && (verified as any).email) ||
    "";

  return {
    principalId: verified?.sub ?? "",
    policyDocument: createPolicy(event, verified ? "Allow" : "Deny"),
    context: { username },
  };
};
