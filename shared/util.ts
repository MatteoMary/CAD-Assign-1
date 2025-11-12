import { marshall } from "@aws-sdk/util-dynamodb";
import { Movie, MovieCast } from "./types";
import { Award } from "../seed/awards";

type Entity = Movie | MovieCast | Award;  
export const generateItem = (entity: Entity) => {
  return {
    PutRequest: {
      Item: marshall(entity),
 },
 };
};

export const generateBatch = (data: Entity[]) => {
  return data.map((e) => {
    return generateItem(e);
 });
};
