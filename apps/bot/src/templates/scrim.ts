const scrimTemplate = [
  {
    name: "PUBG - Squad",
    maxTeams: 25,
    minPlayersPerTeam: 4,
    maxPlayersPerTeam: 4,
    maxSubstitutePerTeam: 1,
    value: "pubg_squad",
  },
  {
    name: "PUBG - Duo",
    maxTeams: 50,
    minPlayersPerTeam: 2,
    maxPlayersPerTeam: 2,
    maxSubstitutePerTeam: 1,
    value: "pubg_duo",
  },
  {
    name: "PUBG - Solo",
    maxTeams: 100,
    minPlayersPerTeam: 1,
    maxPlayersPerTeam: 1,
    maxSubstitutePerTeam: 0,
    value: "pubg_solo",
  },
] as const;

export const scrimTemplateMap = new Map(
  scrimTemplate.map((template) => [template.value, template])
);
