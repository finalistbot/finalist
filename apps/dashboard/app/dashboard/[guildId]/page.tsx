import GuildConfigForm from "./guild-config-form";

import {
  getGuild,
  getGuildChannels,
  getGuildConfig,
  getGuildRoles,
} from "@/actions/guild";

export default async function Page({
  params,
}: {
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const channels = await getGuildChannels(guildId);
  const roles = await getGuildRoles(guildId);
  const guildConfig = await getGuildConfig(guildId);
  const guild = await getGuild(guildId);
  return (
    <div>
      <GuildConfigForm
        guild={guild}
        roles={roles}
        channels={channels}
        guildConfig={guildConfig}
      />
    </div>
  );
}
