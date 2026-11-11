import { createRoom, sendMessage } from "../social/social";

export const ROOM_MESSAGE_RE = /Arena room ([A-Z2-9]{6})/;

/**
 * Creates a private arena room and drops the join code into the chat, so the
 * friend can join the same match with one tap.
 */
export async function challengeUser(
  me: { uid: string; name: string; avatar: string | null },
  otherUid: string,
  exercise = "Classic Push-ups",
): Promise<string> {
  const code = await createRoom(
    { uid: me.uid, name: me.name, avatarUrl: me.avatar },
    { exercise, mode: "time", target: 45, visibility: "private" },
  );
  await sendMessage(me.uid, otherUid, `Arena challenge: ${exercise}, 45s. Join Arena room ${code}`);
  return code;
}
