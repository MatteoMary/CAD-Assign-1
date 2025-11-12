import { APIGatewayProxyHandlerV2 } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv();
const isValidBodyParams = ajv.compile(schema.definitions["Movie"] || {});

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  {
    marshallOptions: { convertEmptyValues: true, removeUndefinedValues: true, convertClassInstanceToMap: true },
    unmarshallOptions: { wrapNumbers: false },
  }
);

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const body = event.body ? JSON.parse(event.body) : undefined;
    if (!body) return json(400, { message: "Missing request body" });

    if (!isValidBodyParams(body)) {
      return json(400, {
        message: "Incorrect type. Must match Movie schema",
        errors: isValidBodyParams.errors ?? [],
      });
    }

    if (typeof body.id !== "number") {
      return json(400, { message: "Movie 'id' must be a number" });
    }

    await ddb.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: body,
        ConditionExpression: "attribute_not_exists(#id)",
        ExpressionAttributeNames: { "#id": "id" },
      })
    );

    return json(201, { message: "Movie added" });
  } catch (err: any) {
    console.error("addMovie error:", err);
    const msg =
      err?.name === "ConditionalCheckFailedException"
        ? "Movie with this id already exists"
        : "Failed to add movie";
    return json(500, { message: msg });
  }
};

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
