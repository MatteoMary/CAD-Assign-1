import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }));

export const handler: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  try {
    console.log("[AWARDS EVENT]", JSON.stringify(event));
    const qs = event.queryStringParameters ?? {};

    const movie = qs.movie?.trim();
    const actor = qs.actor?.trim();
    const awardBody = qs.awardBody?.trim();

    if (!movie && !actor) {
      return json(400, { message: "Provide ?movie or ?actor" });
    }

    const pkId = movie ?? actor!;
    if (!/^\d+$/.test(pkId)) {
      return json(400, { message: "movie/actor must be numeric" });
    }

    const params: any = {
      TableName: process.env.TABLE_NAME,
      KeyConditionExpression: "PK = :pk",
      ExpressionAttributeValues: { ":pk": `w${pkId}` },
    };

    if (awardBody) {
      params.KeyConditionExpression += " AND SK = :ab";
      params.ExpressionAttributeValues[":ab"] = awardBody;
    }

    const out = await ddb.send(new QueryCommand(params));
    logRequester(event, `/awards?${new URLSearchParams(qs as Record<string, string>).toString()}`);

    return json(200, { data: out.Items ?? [] });
  } catch (error) {
    console.error("[AWARDS ERROR]", error);
    return json(500, { error: "Failed to fetch awards" });
  }
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": "true",
    },
    body: JSON.stringify(body),
  };
}

function logRequester(event: any, path: string) {
  const u =
    event.requestContext?.authorizer?.context?.username ??
    event.requestContext?.authorizer?.claims?.["cognito:username"] ??
    "unknown";
  console.log(`${u} ${path}`);
}
