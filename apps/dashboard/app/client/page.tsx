"use client";

import { authClient } from "@/lib/auth-client";
import { getUserToken } from "@/lib/user";

export default function Page() {
  const session = authClient.useSession();
  if (!session || !session.data) {
    return <p>Loading...</p>;
  }
  return (
    <button onClick={() => getUserToken(session.data!.user.id)}>
      Refresh Token
    </button>
  );
}
