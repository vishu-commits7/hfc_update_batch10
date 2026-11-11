import { useBackClose } from "../../core/backStack";
import { useBlocked } from "../safety/blocks";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, X, Send, Loader2, Swords, UserCheck, MessageCircle, Check, CheckCheck } from "lucide-react";
import OverlayPortal from "../../shared/ui/OverlayPortal";
import Avatar from "../../shared/ui/Avatar";
import {
  subscribeChats, subscribeMessages, sendMessage, chatIdFor, acceptFollow, declineFollow,
  canChatWith, friendlySocialError, subscribeChatReceipts, markChatRead, type ChatSummary, type ChatMessage, type ChatReceipts,
} from "./social";
import { setActiveChat } from "./inbox";
import { useMyIdentity, useFollowEdges } from "./useSocial";
import { ErrorState, EmptyState, EmptyAction, SkeletonRows, SkeletonLines } from "../../shared/ui/StateViews";
import { goToScreen } from "../../core/navEvents";
import { useProfiles } from "./useProfiles";
import { tapFeedback } from "../../core/haptics";
import { ROOM_MESSAGE_RE } from "../arena/challenge";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** open straight into a conversation with this user */
  initialChatUid?: string | null;
  initialTab?: "chats" | "requests";
  onOpenProfile?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
  /** join an arena room shared in chat */
  onJoinRoom?: (code: string) => void;
}

function clock(ms: number) {
  const d = new Date(ms);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function FriendsAndChatHub({ isOpen, onClose, initialChatUid, initialTab, onOpenProfile, onChallenge, onJoinRoom }: Props) {
  useBackClose(isOpen, onClose);
  const me = useMyIdentity();
  const edges = useFollowEdges();
  const [tab, setTab] = useState<"chats" | "requests">("chats");
  const [chats, setChats] = useState<ChatSummary[] | null>(null);
  const [chatsFailed, setChatsFailed] = useState(false);
  const [chatsTry, setChatsTry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [activeUid, setActiveUid] = useState<string | null>(null);

  const blockedSet = useBlocked();
  useEffect(() => { if (isOpen) { setActiveUid(initialChatUid ?? null); setTab(initialTab ?? "chats"); } }, [isOpen, initialChatUid, initialTab]);

  useEffect(() => {
    if (!isOpen || !me.uid) return;
    setChats(null);
    setChatsFailed(false);
    return subscribeChats(
      me.uid,
      list => { setChatsFailed(false); setChats(list.filter(c => !c.members.some(m => m !== me.uid && blockedSet.has(m)))); },
      () => { setChats([]); setChatsFailed(true); },
    );
  }, [isOpen, me.uid, blockedSet, chatsTry]);

  const requests = useMemo(
    () => [...edges.incoming.entries()].filter(([u, s]) => s === "pending" && !blockedSet.has(u)).map(([u]) => u),
    [edges, blockedSet],
  );
  const friends = useMemo(() => {
    const set = new Set<string>();
    edges.outgoing.forEach((s, u) => { if (s === "accepted") set.add(u); });
    edges.incoming.forEach((s, u) => { if (s === "accepted") set.add(u); });
    return [...set];
  }, [edges]);

  const chatOthers = (chats || []).map(c => c.members.find(m => m !== me.uid) || "");
  const profiles = useProfiles([...new Set([...chatOthers, ...requests, ...friends, ...(activeUid ? [activeUid] : [])])].filter(Boolean));

  if (!isOpen) return null;

  const withoutChat = friends.filter(f => !chatOthers.includes(f));

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-[270] flex flex-col bg-void text-ink animate-fade-in">
        {activeUid && me.uid ? (
          <Conversation
            myUid={me.uid}
            otherUid={activeUid}
            other={profiles.get(activeUid) ?? null}
            allowed={canChatWith(edges, activeUid)}
            onBack={() => setActiveUid(null)}
            onOpenProfile={onOpenProfile}
            onChallenge={onChallenge}
            onJoinRoom={onJoinRoom}
          />
        ) : (
          <>
            <div
              className="flex shrink-0 items-center justify-between border-b border-line bg-carbon px-3 pb-2"
              style={{ paddingTop: "max(var(--safe-t), env(safe-area-inset-top, 24px))" }}
            >
              <button onClick={onClose} aria-label="Close" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
              <h1 className="text-sm font-bold">Messages</h1>
              <span className="w-11" />
            </div>

            <div className="flex shrink-0 gap-1.5 px-4 pt-3">
              {(["chats", "requests"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => { void tapFeedback(); setTab(t); }}
                  className={`relative flex-1 rounded-xl py-2.5 text-xs font-bold capitalize transition ${tab === t ? "bg-volt text-void" : "border border-line bg-carbon text-ink-2"}`}
                >
                  {t}
                  {t === "requests" && requests.length > 0 && (
                    <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[11px] font-bold text-white">{requests.length}</span>
                  )}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-3">
              {!me.signedIn ? (
                <p className="rounded-xl border border-line bg-carbon p-4 text-center text-sm text-ink-2">Sign in to message other athletes.</p>
              ) : tab === "requests" ? (
                requests.length === 0 ? (
                  <EmptyState icon={<UserCheck className="h-6 w-6" />} title="No follow requests" body="When someone asks to follow you, it shows up here." action={<EmptyAction label="Find athletes" onClick={() => { onClose(); goToScreen("reels"); }} />} />
                ) : (
                  <ul className="space-y-1">
                    {requests.map(uid => {
                      const p = profiles.get(uid);
                      return (
                        <li key={uid} className="flex items-center gap-3 py-2">
                          <button onClick={() => onOpenProfile?.(uid)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                            <Avatar src={p?.avatarUrl} name={p?.displayName || "Athlete"} size={46} />
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-bold">{p?.displayName || "Athlete"}</span>
                              <span className="block text-xs text-ink-3">wants to follow you</span>
                            </span>
                          </button>
                          <button onClick={() => me.uid && acceptFollow(me.uid, uid).catch(e => setError(friendlySocialError(e)))} className="rounded-full bg-volt px-3.5 py-2 text-xs font-bold text-void active:scale-95">Accept</button>
                          <button onClick={() => me.uid && declineFollow(me.uid, uid).catch(e => setError(friendlySocialError(e)))} aria-label="Decline" className="flex h-9 w-9 items-center justify-center rounded-full bg-graphite text-ink-2 active:scale-95"><X className="h-4 w-4" /></button>
                        </li>
                      );
                    })}
                  </ul>
                )
              ) : chatsFailed ? (
                <ErrorState message="Couldn't load your chats." onRetry={() => setChatsTry(n => n + 1)} />
              ) : chats === null ? (
                <SkeletonRows rows={5} />
              ) : (
                <>
                  {chats.length === 0 && withoutChat.length === 0 && (
                    <EmptyState icon={<MessageCircle className="h-6 w-6" />} title="No conversations yet" body="Follow an athlete. When they accept, you can message each other here." action={<EmptyAction label="Find athletes" onClick={() => { onClose(); goToScreen("reels"); }} />} />
                  )}
                  <ul className="space-y-1">
                    {chats.map((c, i) => {
                      const other = chatOthers[i];
                      const p = profiles.get(other);
                      return (
                        <li key={c.id}>
                          <button onClick={() => setActiveUid(other)} className="flex w-full items-center gap-3 rounded-2xl py-2 text-left active:opacity-70">
                            <Avatar src={p?.avatarUrl} name={p?.displayName || "Athlete"} size={50} />
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline justify-between gap-2">
                                <span className="truncate text-sm font-bold">{p?.displayName || "Athlete"}</span>
                                <span className="shrink-0 text-[11px] text-ink-3">{clock(c.updatedAt)}</span>
                              </span>
                              <span className="block truncate text-xs text-ink-3">{c.lastSender === me.uid ? "You: " : ""}{c.lastMessage}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {withoutChat.length > 0 && (
                    <>
                      <p className="mb-1 mt-5 text-[11px] font-semibold uppercase tracking-wider text-ink-3">Friends</p>
                      <ul className="space-y-1">
                        {withoutChat.map(uid => {
                          const p = profiles.get(uid);
                          return (
                            <li key={uid}>
                              <button onClick={() => setActiveUid(uid)} className="flex w-full items-center gap-3 rounded-2xl py-2 text-left active:opacity-70">
                                <Avatar src={p?.avatarUrl} name={p?.displayName || "Athlete"} size={46} />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-bold">{p?.displayName || "Athlete"}</span>
                                  <span className="flex items-center gap-1 text-xs text-ink-3"><UserCheck className="h-3 w-3" /> Say hi</span>
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </>
                  )}
                </>
              )}
              {error && <p className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2 text-center text-xs text-rose-300">{error}</p>}
            </div>
          </>
        )}
      </div>
    </OverlayPortal>
  );
}

function Ticks({ status }: { status: "pending" | "sent" | "delivered" | "read" }) {
  if (status === "delivered" || status === "read") {
    return <CheckCheck aria-label={status} className={`h-3.5 w-3.5 ${status === "read" ? "text-[color:var(--tick-read)]" : "text-ink-3"}`} />;
  }
  return <Check aria-label={status} className="h-3.5 w-3.5 text-ink-3" />;
}

function Conversation({
  myUid, otherUid, other, allowed, onBack, onOpenProfile, onChallenge, onJoinRoom,
}: {
  myUid: string;
  otherUid: string;
  other: { displayName: string; handle: string; avatarUrl: string | null } | null;
  allowed: boolean;
  onBack: () => void;
  onOpenProfile?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
  onJoinRoom?: (code: string) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [tryN, setTryN] = useState(0);
  const [sending, setSending] = useState(false);
  const [msgMax, setMsgMax] = useState(50); // newest 50 first; "Earlier messages" loads more
  const endRef = useRef<HTMLDivElement>(null);
  const chatId = chatIdFor(myUid, otherUid);

  useEffect(() => {
    setMessages(null);
    setLoadFailed(false);
    return subscribeMessages(
      chatId,
      m => { setLoadFailed(false); setMessages(m); },
      e => { setMessages([]); if ((e as { code?: string })?.code !== "permission-denied") setLoadFailed(true); },
      msgMax,
    );
  }, [chatId, tryN, msgMax]);

  const [receipts, setReceipts] = useState<ChatReceipts>({ deliveredAt: {}, readAt: {} });
  useEffect(() => subscribeChatReceipts(chatId, setReceipts), [chatId]);
  useEffect(() => { setActiveChat(chatId); return () => setActiveChat(null); }, [chatId]);
  // Mark incoming messages as read while this conversation is on screen.
  const lastIncoming = messages ? [...messages].reverse().find(m => m.from !== myUid && !m.pending)?.createdAt ?? 0 : 0;
  useEffect(() => {
    if (!lastIncoming) return;
    if ((receipts.readAt[myUid] ?? 0) >= lastIncoming) return;
    void markChatRead(chatId, myUid);
  }, [lastIncoming, receipts.readAt, chatId, myUid]);
  const statusOf = (m: ChatMessage): "pending" | "sent" | "delivered" | "read" => {
    if (m.pending) return "pending";
    if ((receipts.readAt[otherUid] ?? 0) >= m.createdAt) return "read";
    if ((receipts.deliveredAt[otherUid] ?? 0) >= m.createdAt) return "delivered";
    return "sent";
  };

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages?.length]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || sending) return;
    if (!allowed) { setError("You can message once your follow request is accepted."); return; }
    setSending(true);
    setError(null);
    try {
      void tapFeedback();
      // Queue instantly (works offline: shows a single grey tick until it syncs).
      setText("");
      void sendMessage(myUid, otherUid, v, true);
    } catch (err) {
      setError(friendlySocialError(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div
        className="flex shrink-0 items-center gap-2 border-b border-line bg-carbon px-2 pb-2"
        style={{ paddingTop: "max(var(--safe-t), env(safe-area-inset-top, 24px))" }}
      >
        <button onClick={onBack} aria-label="Back" className="flex h-11 w-11 items-center justify-center rounded-full text-ink-2 active:scale-95"><ArrowLeft className="h-5 w-5" /></button>
        <button onClick={() => onOpenProfile?.(otherUid)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <Avatar src={other?.avatarUrl} name={other?.displayName || "Athlete"} size={38} />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold">{other?.displayName || "Athlete"}</span>
            {other && <span className="block truncate text-[11px] text-ink-3">@{other.handle}</span>}
          </span>
        </button>
        {onChallenge && (
          <button onClick={() => onChallenge(otherUid)} aria-label="Challenge" className="flex min-h-[44px] items-center gap-1.5 rounded-full bg-graphite px-3.5 text-xs font-bold text-ink active:scale-95">
            <Swords className="h-4 w-4" /> Challenge
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loadFailed ? (
          <ErrorState message="Couldn't load this conversation." onRetry={() => setTryN(n => n + 1)} />
        ) : messages === null ? (
          <SkeletonLines rows={5} />
        ) : messages.length === 0 ? (
          <p className="py-16 text-center text-sm text-ink-3">{allowed ? "Say hi 👋 Type below to send the first message." : "Messaging unlocks after your follow request is accepted."}</p>
        ) : (
          <ul className="space-y-1.5">
            {messages.length >= msgMax && msgMax < 500 && (
              <button onClick={() => setMsgMax(n => n + 100)} className="mx-auto mb-2 block min-h-[44px] rounded-full border border-line bg-carbon px-4 text-xs font-bold text-ink-2">Earlier messages</button>
            )}
            {messages.map(m => {
              const mine = m.from === myUid;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-snug ${mine ? "rounded-br-md bg-[var(--bubble-mine)] text-ink" : "rounded-bl-md bg-graphite text-ink"}`}>
                    <p className="break-words">{m.text}</p>
                    {!mine && onJoinRoom && ROOM_MESSAGE_RE.test(m.text) && (
                      <button
                        onClick={() => onJoinRoom(m.text.match(ROOM_MESSAGE_RE)![1])}
                        className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-volt py-1.5 text-xs font-bold text-void active:scale-95"
                      >
                        <Swords className="h-3.5 w-3.5" /> Join match
                      </button>
                    )}
                    <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-ink-3">
                      {clock(m.createdAt)}
                      {mine && <Ticks status={statusOf(m)} />}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="shrink-0 bg-rose-500/10 px-4 py-1.5 text-center text-[11px] text-rose-300">{error}</p>}
      <form
        onSubmit={send}
        className="flex shrink-0 items-center gap-2.5 border-t border-line bg-carbon px-3 pt-2.5"
        style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))" }}
      >
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Message…"
          maxLength={1000}
          enterKeyHint="send"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-full border border-line-strong bg-graphite px-4 py-2.5 text-base text-ink placeholder:text-ink-3 outline-none focus:border-volt"
        />
        <button type="submit" disabled={!text.trim() || sending} aria-label="Send" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-volt text-void active:scale-90 disabled:opacity-40">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </>
  );
}
