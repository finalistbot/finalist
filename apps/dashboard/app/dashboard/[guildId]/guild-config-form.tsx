"use client";

import { upsertGuildConfig } from "@/actions/guild";
import { GuildConfig } from "@repo/db";
import { APIGuild, APIGuildChannel, APIRole } from "discord-api-types/v10";
import React from "react";

export default function GuildConfigForm({
  guild,
  roles,
  channels,
  guildConfig,
}: {
  guild: APIGuild;
  roles: APIRole[];
  channels: APIGuildChannel[];
  guildConfig: GuildConfig | null;
}) {
  console.log(guildConfig);
  console.log(roles);
  const filteredRoles = roles.filter(
    (role) => role.name !== "@everyone" && !role.managed,
  );
  const [adminRoleId, setAdminRoleId] = React.useState(
    guildConfig?.adminRoleId || "",
  );
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        await upsertGuildConfig(guild.id, adminRoleId);
        alert("Configuration saved!");
      }}
    >
      <h2>Guild Configuration</h2>
      <div>
        <label htmlFor="adminRole">Admin Role</label>
        <select
          id="adminRole"
          name="adminRole"
          value={adminRoleId}
          onChange={(e) => setAdminRoleId(e.target.value)}
        >
          <option value="">Select a role</option>
          {filteredRoles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit">Save Configuration</button>
    </form>
  );
}
