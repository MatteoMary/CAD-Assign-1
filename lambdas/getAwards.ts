import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({ region: process.env.REGION }), {
  marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
  unmarshallOptions: { wrapNumbers: false },
});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {

  try {
    const qs = event.queryStringParameters ?? {};
    const movie = qs.movie ? Number(qs.movie) : undefined;
    const actor = qs.actor ? Number(qs.actor) : undefined;
    const awardBody = qs.awardBody;

    if (!movie && !actor) {
      return json(400, { message: "Provide 'movie' or 'actor' query parameter" });
    }

    let input: QueryCommandInput;

    if (movie) {
      if (awardBody) {
        input = {
          TableName: process.env.AWARDS_TABLE_NAME,
          KeyConditionExpression: "entityId = :e AND awardBody = :b",
          ExpressionAttributeValues: { ":e": movie, ":b": awardBody },
          FilterExpression: actor ? "actorId = :a" : undefined,
          ...(actor ? { ExpressionAttributeValuesAdditional: { ":a": actor } as any } : {}),
        } as any;
      } else {
        input = {
          TableName: process.env.AWARDS_TABLE_NAME,
          KeyConditionExpression: "entityId = :e",
          ExpressionAttributeValues: { ":e": movie, ...(actor ? { ":a": actor } : {}) },
          FilterExpression: actor ? "actorId = :a" : undefined,
        };
      }
    } else {
      if (awardBody) {
        input = {
          TableName: process.env.AWARDS_TABLE_NAME,
          KeyConditionExpression: "entityId = :e AND awardBody = :b",
          ExpressionAttributeValues: { ":e": actor!, ":b": awardBody },
          FilterExpression: movie ? "movieId = :m" : undefined,
          ...(movie ? { ExpressionAttributeValuesAdditional: { ":m": movie } as any } : {}),
        } as any;
      } else {
        input = {
          TableName: process.env.AWARDS_TABLE_NAME,
          KeyConditionExpression: "entityId = :e",
          ExpressionAttributeValues: { ":e": actor!, ...(movie ? { ":m": movie } : {}) },
          FilterExpression: movie ? "movieId = :m" : undefined,
        };
      }
    }

    if ((input as any).ExpressionAttributeValuesAdditional) {
      input.ExpressionAttributeValues = {
        ...(input.ExpressionAttributeValues || {}),
        ...(input as any).ExpressionAttributeValuesAdditional,
      };
      delete (input as any).ExpressionAttributeValuesAdditional;
    }

    const out = await ddb.send(new QueryCommand(input));
    return json(200, { data: out.Items ?? [] });
  } catch (err) {
    console.error("getAwards error:", err);
    return json(500, { error: "Internal Server Error" });
  }
};

function json(statusCode: number, body: unknown) {
  return { statusCode, headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
}
