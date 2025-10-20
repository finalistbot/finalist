import { Guild, GuildBasedChannel, Role } from 'discord.js'

export function serializeRole(role: Role) {
  return {
    id: role.id,
    name: role.name,
    color: role.colors.primaryColor,
    hoist: role.hoist,
    position: role.position,
    permissions: role.permissions.bitfield,
  }
}

export function serializeChannel(channel: GuildBasedChannel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
  }
}

export function serializeGuild(guild: Guild) {
  return {
    id: guild.id,
    name: guild.name,
    icon: guild.iconURL(),
    memberCount: guild.memberCount,
  }
}
