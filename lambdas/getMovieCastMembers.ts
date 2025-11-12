import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }), {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  unmarshallOptions: { wrapNumbers: false },
});

function json(status: number, body: unknown) {
  return { statusCode: status, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    console.log("[GET CAST] event", JSON.stringify(event));

    const movieIdStr =
      event.pathParameters?.movieId ??
      event.queryStringParameters?.movieId ??
      null;

    if (!movieIdStr) return json(400, { message: "Missing movieId" });
    const movieId = Number(movieIdStr);
    if (!Number.isFinite(movieId)) return json(400, { message: "Invalid movieId" });

    const roleName = event.queryStringParameters?.roleName; // optional prefix

    let input: QueryCommandInput = { TableName: process.env.CAST_TABLE_NAME!, KeyConditionExpression: "movieId = :m", ExpressionAttributeValues: { ":m": movieId } };

    if (roleName) {
      input = {
        ...input,
        IndexName: "roleIx",
        KeyConditionExpression: "movieId = :m AND begins_with(roleName, :r)",
        ExpressionAttributeValues: { ":m": movieId, ":r": roleName },
      };
    }

    const out = await ddb.send(new QueryCommand(input));
    return json(200, { data: out.Items ?? [] });
  } catch (err) {
    console.error("getMovieCastMembers error", err);
    return json(500, { error: "Internal Server Error" });
  }
};
