export type Award = {
  entityId: number;
  awardBody: string;
  category: string;
  year: number;
  movieId?: number;
  actorId?: number;
};

export const awards: Award[] = [
  { entityId: 1234, awardBody: "Academy",     category: "Best Movie",            year: 1995, movieId: 1234 },
  { entityId: 6789, awardBody: "GoldenGlobe", category: "Best Supporting Actor", year: 1995, actorId: 6789 },

  { entityId: 1234, awardBody: "Bafta", category: "Best Film", year: 1995, movieId: 1234 },
  { entityId: 6789, awardBody: "Academy", category: "Best Supporting Actor", year: 1995, actorId: 6789 },
];
