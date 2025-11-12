import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }), {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  unmarshallOptions: { wrapNumbers: false },
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[GET MOVIE EVENT]", JSON.stringify(event));

    const movieIdStr = event.pathParameters?.movieId;
    if (!movieIdStr || !/^\d+$/.test(movieIdStr)) return json(400, { message: "Invalid or missing movieId" });

    const out = await ddb.send(
      new GetCommand({
        TableName: process.env.TABLE_NAME,
        Key: { PK: `m${movieIdStr}`, SK: "xxxx" },
      })
    );

    logRequester(event, `/movies/${movieIdStr}`);

    if (!out.Item) return json(404, { message: "Movie not found" });
    return json(200, { data: out.Item });
  } catch (err) {
    console.error("[GET MOVIE ERROR]", err);
    return json(500, { error: "Internal Server Error" });
  }
};

function json(status: number, body: any) {
  return {
    statusCode: status,
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
