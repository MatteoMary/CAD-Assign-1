import {
  APIGatewayAuthorizerEvent,
  APIGatewayProxyEvent,
  APIGatewayRequestAuthorizerEvent,
  PolicyDocument,
  StatementEffect,
} from "aws-lambda";
import axios from "axios";
import jwt, { JwtHeader, JwtPayload } from "jsonwebtoken";
import jwkToPem, { JWK } from "jwk-to-pem";

type JwkWithKid = JWK & { kid?: string };

export type CookieMap = { [key: string]: string } | undefined;

export const parseCookies = (
  event: APIGatewayRequestAuthorizerEvent | APIGatewayProxyEvent
): CookieMap => {
  const headers = (event as any).headers || {};
  const cookieHeader: string | undefined =
    headers.cookie || headers.Cookie || headers.COOKIE;
  if (!cookieHeader) return undefined;

  const map: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    map[k] = rest.join("=");
  }
  return map;
};

export type JwtToken = ({ sub?: string; email?: string } & JwtPayload) | null;

export const verifyToken = async (
  token: string,
  userPoolId: string | undefined,
  region: string
): Promise<JwtToken> => {
  try {
    if (!token || !userPoolId || !region) return null;

    const decoded = jwt.decode(token, { complete: true }) as
      | { header: JwtHeader; payload: JwtPayload }
      | null;
    if (!decoded || !decoded.header?.kid) return null;
    const kid = decoded.header.kid;

    const jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
    const { data } = await axios.get<{ keys: JwkWithKid[] }>(jwksUrl);

      const jwk = data.keys.find((k) => k.kid === kid) ?? data.keys[0];
    if (!jwk) return null

    const pem = jwkToPem(jwk);

    const verified = jwt.verify(token, pem, {
      algorithms: ["RS256"],
      issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
    }) as JwtPayload;

    return verified as JwtToken;
  } catch (err) {
    console.error("[verifyToken error]", err);
    return null;
  }
};

export const createPolicy = (
  event: APIGatewayAuthorizerEvent,
  effect: StatementEffect
): PolicyDocument => ({
  Version: "2012-10-17",
  Statement: [
    { Effect: effect, Action: "execute-api:Invoke", Resource: [event.methodArn] }
  ]
});
