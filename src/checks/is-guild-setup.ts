import { prisma } from "@/lib/prisma";
import { GuildConfig } from "@prisma/client";
import { Guild } from "discord.js";

type ValidGuildConfig = GuildConfig & {
  adminRoleId: string;
};

type IsGuildSetupReturn =
  | {
      valid: false;
      message: string;
    }
  | {
      valid: true;
      config: ValidGuildConfig;
    };

function isValidGuildConfig(
  config: GuildConfig | null,
): config is ValidGuildConfig {
  return !!config?.adminRoleId;
}

const errors = {
  noConfig: "Guild is not configured. Please run /setup.",
  noAdminRole: "Please set an admin role using /setup.",
  noUpdatesChannel: "Please set an updates channel using /setup.",
  missingAdminRole: "Configured admin role does not exist anymore.",
  missingUpdatesChannel: "Configured updates channel does not exist anymore.",
  invalidConfig: "Guild configuration is invalid. Please run /setup.",
};

const fail = (message: string): IsGuildSetupReturn => ({
  valid: false,
  message,
});

export async function checkIsGuildSetup(
  guild: Guild,
): Promise<IsGuildSetupReturn> {
  const guildConfig = await prisma.guildConfig.findUnique({
    where: { guildId: guild.id },
  });

  if (!guildConfig) return fail(errors.noConfig);
  if (!guildConfig.adminRoleId) return fail(errors.noAdminRole);
  if (!guild.roles.cache.has(guildConfig.adminRoleId))
    return fail(errors.missingAdminRole);

  if (!isValidGuildConfig(guildConfig)) return fail(errors.invalidConfig);

  return { valid: true, config: guildConfig };
}
