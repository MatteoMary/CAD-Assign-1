import { APIGatewayProxyHandler } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import Ajv from "ajv";
import schema from "../shared/types.schema.json";

const ajv = new Ajv({ allErrors: true, removeAdditional: "failing" });
const isValidBodyParams = ajv.compile(schema.definitions["Movie"] || {});

const ddb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.REGION }),
  {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
      convertClassInstanceToMap: true,
    },
    unmarshallOptions: { wrapNumbers: false },
  }
);

const json = (statusCode: number, body: unknown) => ({
  statusCode,
  headers: {
    "content-type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Credentials": "true",
  },
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    console.log("[POST MOVIE EVENT]", JSON.stringify(event));
    const adminKeyId =
      event.requestContext?.identity?.apiKeyId ||
      event.headers?.["x-api-key"] ||
      "admin";

    const body = event.body ? JSON.parse(event.body) : undefined;

    if (!body) return json(400, { message: "Missing request body" });
    if (!isValidBodyParams(body)) {
      return json(400, {
        message: "Incorrect type. Must match Movie schema",
        errors: isValidBodyParams.errors ?? [],
      });
    }

    const { id: movieId, title, release_date, overview } = body;

    if (typeof movieId !== "number" || !title) {
      return json(400, {
        message: "Movie 'id':number and 'title':string are required",
      });
    }

    const item = {
      PK: `m${movieId}`,
      SK: "xxxx",
      title: String(title),
      releaseDate: String(release_date ?? ""),
      overview: String(overview ?? ""),
    };

    await ddb.send(
      new PutCommand({
        TableName: process.env.TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(PK)",
      })
    );

    console.log(`admin(${adminKeyId}) /movies POST`);

    return json(201, { message: "Movie added", movieId });
  } catch (error: any) {
    if (error?.name === "ConditionalCheckFailedException") {
      return json(409, { message: "Movie already exists" });
    }
    console.error("[POST MOVIE ERROR]", error);
    return json(500, { message: "Failed to add movie" });
  }
};
