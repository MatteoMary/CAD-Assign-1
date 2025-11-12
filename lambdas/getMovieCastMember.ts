import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }), {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  unmarshallOptions: { wrapNumbers: false },
});

function json(status: number, body: unknown) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[GET CAST MEMBER] event", JSON.stringify(event));

    const movieIdStr = event.pathParameters?.movieId ?? event.queryStringParameters?.movieId ?? null;
    const actorIdStr = event.pathParameters?.actorId ?? event.queryStringParameters?.actorId ?? null;

    if (!movieIdStr || !actorIdStr) return json(400, { message: "Missing movieId or actorId" });

    const movieId = Number(movieIdStr);
    const actorId = Number(actorIdStr);
    if (!Number.isFinite(movieId) || !Number.isFinite(actorId)) return json(400, { message: "Invalid movieId or actorId" });

    const out = await ddb.send(new GetCommand({
      TableName: process.env.CAST_TABLE_NAME!,
      Key: { movieId, actorId },
    }));

    if (!out.Item) return json(404, { message: "Cast member not found" });

    return json(200, { data: out.Item });
  } catch (err) {
    console.error("getMovieCastMember error", err);
    return json(500, { error: "Internal Server Error" });
  }
};
