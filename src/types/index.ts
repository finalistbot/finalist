export type RoomDetailsField = {
  name: string;
  value: string;
  slug: string;
};
export type ScrimSettings = {
  maxTeams: number;
  minPlayersPerTeam: number;
  maxPlayersPerTeam: number;
  maxSubstitutePerTeam: number;
  autoSlotList: boolean;
  autoCloseRegistration: boolean;
  captainAddMembers: boolean;
};
