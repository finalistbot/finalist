import { getUserGuilds } from "@/actions/guild";
import { auth } from "@/lib/auth";
import { APIGuild } from "discord-api-types/v10";
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  let guilds: APIGuild[] = [];

  if (session) {
    guilds = await getUserGuilds(session.user.id);
  }
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Your Discord Guilds</h1>
      {session ? (
        guilds.length > 0 ? (
          <ul>
            {guilds.map((guild) => (
              <li key={guild.id} className="mb-2">
                <strong>{guild.name}</strong> (ID: {guild.id})
              </li>
            ))}
          </ul>
        ) : (
          <p>You are not a member of any guilds.</p>
        )
      ) : (
        <p>Please log in to see your guilds.</p>
      )}
    </div>
  );
}
