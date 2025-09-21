import { CheckFailure } from "@/base/classes/error";
import { Interaction, PermissionResolvable } from "discord.js";

export const botHasPermissions = (...perms: PermissionResolvable[]) => {
  return async (interaction: Interaction) => {
    if (!interaction.inGuild()) return true;
    if (!interaction.inCachedGuild()) return false;
    const botMember = await interaction.guild.members.fetchMe();
    const missing = botMember.permissions.missing(perms);
    if (missing.length > 0) {
      throw new CheckFailure(
        `I am missing the following permissions to execute this command: ${missing
          .map((p) => `\`${p}\``)
          .join(", ")}`,
      );
    }
    return true;
  };
};
