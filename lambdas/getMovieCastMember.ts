import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }), {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  unmarshallOptions: { wrapNumbers: false },
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[GET CAST MEMBER EVENT]", JSON.stringify(event));

    const movieIdStr = event.pathParameters?.movieId;
    const actorIdStr = event.pathParameters?.actorId;
    if (!movieIdStr || !/^\d+$/.test(movieIdStr)) return json(400, { message: "Invalid or missing movieId" });
    if (!actorIdStr || !/^\d+$/.test(actorIdStr)) return json(400, { message: "Invalid or missing actorId" });

    const out = await ddb.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `c${movieIdStr}`, SK: `${actorIdStr}` },
      })
    );

    logRequester(event, `/movies/${movieIdStr}/actors/${actorIdStr}`);

    if (!out.Item) return json(404, { message: "Cast member not found" });
    return json(200, { data: out.Item });
  } catch (error) {
    console.error("[GET CAST MEMBER ERROR]", error);
    return json(500, { error: "Internal Server Error" });
  }
};

function json(statusCode: number, body: unknown) {
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
