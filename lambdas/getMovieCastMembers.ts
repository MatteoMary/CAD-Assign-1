import { APIGatewayProxyHandlerV2, APIGatewayProxyResultV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }), {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  unmarshallOptions: { wrapNumbers: false },
});

export const handler: APIGatewayProxyHandlerV2 = async (event): Promise<APIGatewayProxyResultV2> => {
  try {
    console.log("[GET MOVIE ACTORS EVENT]", JSON.stringify(event));

    const movieIdStr = event.pathParameters?.movieId ?? event.queryStringParameters?.movieId;
    if (!movieIdStr || !/^\d+$/.test(movieIdStr)) return json(400, { message: "Invalid or missing movieId" });

    const castOut = await ddb.send(
      new QueryCommand({
        TableName: process.env.TABLE_NAME,
        KeyConditionExpression: "PK = :pk",
        ExpressionAttributeValues: { ":pk": `c${movieIdStr}` },
      })
    );

    const response: any = { data: castOut.Items ?? [] };

    const includeFacts = (event.queryStringParameters?.facts ?? "").toLowerCase() === "true";
    if (includeFacts) {
      const movieOut = await ddb.send(
        new GetCommand({
          TableName: process.env.TABLE_NAME,
          Key: { PK: `m${movieIdStr}`, SK: "xxxx" },
        })
      );
      response.facts = movieOut.Item ?? null;
    }

    logRequester(event, `/movies/${movieIdStr}/actors${includeFacts ? "?facts=true" : ""}`);
    return json(200, response);
  } catch (err) {
    console.error("[GET MOVIE ACTORS ERROR]", err);
    return json(500, { error: "Internal Server Error" });
  }
};

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Credentials": "true" },
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
