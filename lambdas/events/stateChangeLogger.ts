import { DynamoDBStreamHandler, DynamoDBRecord } from "aws-lambda";
import { AttributeValue } from "@aws-sdk/client-dynamodb";
import { unmarshall } from "@aws-sdk/util-dynamodb";


export const handler: DynamoDBStreamHandler = async (event) => {
  for (const rec of event.Records) {
    try {
      if (rec.eventName === "INSERT" && rec.dynamodb?.NewImage) {
        const item = unmarshall(rec.dynamodb.NewImage as Record<string, AttributeValue>);
        console.log(formatInsert(item));
      } else if (rec.eventName === "REMOVE" && rec.dynamodb?.OldImage) {
        const item = unmarshall(rec.dynamodb.OldImage as Record<string, AttributeValue>);
        console.log(formatDelete(item));
      }
    } catch (e) {
      console.error("[STATE LOGGER ERROR]", e, "raw:", JSON.stringify(rec));
    }
  }
};

function formatInsert(item: any): string {
  // PK like m1234 / a6789 / c1234 / w1234
  const pk: string = item.PK || "";
  const sk: string = item.SK || "";

  if (pk.startsWith("m")) {
    // Movie: POST + m1234 | xxxx | Title | releaseDate | overview
    const title = item.title ?? "";
    const releaseDate = item.releaseDate ?? "";
    const overview = item.overview ?? "";
    return `POST + ${pk} | ${sk} | ${title} | ${releaseDate} | ${overview}`;
  }
  if (pk.startsWith("a")) {
    // Actor: POST + a6789 | xxxx | Name | Bio | DOB
    const name = item.name ?? "";
    const bio = item.bio ?? "";
    const dob = item.dob ?? "";
    return `POST + ${pk} | ${sk} | ${name} | ${bio} | ${dob}`;
  }
  if (pk.startsWith("c")) {
    // Cast: POST + c1234 | 6789 | RoleName | RoleDesc | ActorName
    const roleName = item.roleName ?? "";
    const roleDesc = item.roleDesc ?? item.roleDescription ?? "";
    const actorName = item.actorName ?? "";
    return `POST + ${pk} | ${sk} | ${roleName} | ${roleDesc} | ${actorName}`;
  }
  if (pk.startsWith("w")) {
    // Award: POST + w1234 | AwardBody | Category | Year
    const body = sk;
    const category = item.category ?? "";
    const year = item.year ?? "";
    return `POST + ${pk} | ${body} | ${category} | ${year}`;
  }

  // Fallback
  return `POST + ${pk} | ${sk} | ${JSON.stringify(item)}`;
}

function formatDelete(item: any): string {
  const pk: string = item.PK || "";
  const sk: string = item.SK || "";

  if (pk.startsWith("m")) {
    const title = item.title ?? "";
    const releaseDate = item.releaseDate ?? "";
    const overview = item.overview ?? "";
    return `DELETE ${pk} | ${sk} | ${title} | ${releaseDate} | ${overview}`;
  }
  if (pk.startsWith("a")) {
    const name = item.name ?? "";
    const bio = item.bio ?? "";
    const dob = item.dob ?? "";
    return `DELETE ${pk} | ${sk} | ${name} | ${bio} | ${dob}`;
  }
  if (pk.startsWith("c")) {
    const roleName = item.roleName ?? "";
    const roleDesc = item.roleDesc ?? item.roleDescription ?? "";
    const actorName = item.actorName ?? "";
    return `DELETE ${pk} | ${sk} | ${roleName} | ${roleDesc} | ${actorName}`;
  }
  if (pk.startsWith("w")) {
    const body = sk;
    const category = item.category ?? "";
    const year = item.year ?? "";
    return `DELETE ${pk} | ${body} | ${category} | ${year}`;
  }

  return `DELETE ${pk} | ${sk} | ${JSON.stringify(item)}`;
}
