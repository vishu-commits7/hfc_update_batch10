import React, { useState, useEffect, useRef } from "react";
import {
  X,
  ArrowLeft,
  Send,
  Swords,
  UserPlus,
  Users,
  CheckCircle2,
  MessageCircle,
  Sparkles,
  Flame,
  Search,
  Check,
} from "lucide-react";
import { tapFeedback } from "../lib/haptics";
import { audio } from "../lib/audio";
import { getCreators, Creator } from "../lib/socialFeed";

export interface FriendProfile {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  verified: boolean;
  status: "online" | "training" | "away";
  statusText: string;
  specialty: string;
  ratingElo: number;
  isCoach: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isUser: boolean;
}

interface FriendsAndChatHubProps {
  isOpen: boolean;
  onClose: () => void;
  initialChatFriendId?: string | null;
  onChallengeFriend?: (friend: FriendProfile) => void;
}

const DEFAULT_FRIENDS: FriendProfile[] = [
  {
    id: "f_alex",
    name: "Alex Rivera",
    handle: "@alex_calisthenics",
    avatar: "/assets/coaches/coach-cardio-male.jpg",
    verified: false,
    status: "training",
    statusText: "In workout · Set 3/5",
    specialty: "Calisthenics & Muscle-ups",
    ratingElo: 1420,
    isCoach: false,
  },
  {
    id: "f_jordan",
    name: "Jordan Blake",
    handle: "@jordan_powerlift",
    avatar: "/assets/coaches/coach-lower-male.jpg",
    verified: false,
    status: "online",
    statusText: "Online · Ready for Duel",
    specialty: "Powerlifting & PR Attempts",
    ratingElo: 1510,
    isCoach: false,
  },
];

const COACH_RESPONSES: Record<string, (msg: string) => string> = {
  c_marcus: (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("pushup") || lower.includes("chest") || lower.includes("form")) {
      return "For maximum sternocostal pectoral recruitment, keep your elbows tucked at a 45-degree angle. Control the eccentric descent for 2 full seconds—that is where 70% of myofibrillar micro-tears happen!";
    }
    if (lower.includes("duel") || lower.includes("challenge")) {
      return "You want to test your mettle on push-ups? Tap the ⚔️ Challenge button up top—let's see if you can hold strict 90-degree depth under the camera!";
    }
    return "Discipline beats motivation every day. Keep your core tight, lock out each rep, and don't let fatigue break your kinetic chain!";
  },
  c_chloe: (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("jump") || lower.includes("squat") || lower.includes("explosive")) {
      return "Focus on the stretch-shortening cycle! Minimize your ground contact time at the bottom of the squat—rebound instantly using elastic recoil through your Achilles and patellar tendons!";
    }
    if (lower.includes("duel") || lower.includes("challenge")) {
      return "Game on! Hit the ⚔️ Challenge button and match my 45-second jump squat pace. Let's see your rate of force development!";
    }
    return "Great energy! Remember that vertical power comes from triple extension: ankles, knees, and hips exploding in sync.";
  },
  c_viktor: (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("diamond") || lower.includes("tricep") || lower.includes("arm")) {
      return "Diamond push-ups shift 78% of the mechanical torque directly to the lateral and medial heads of the triceps. Lock your thumbs together and don't let your hips sag!";
    }
    return "High tension builds armor. Embrace the lactic burn—your metabolic threshold only expands when you train right on the edge.";
  },
  c_elena: (msg: string) => {
    const lower = msg.toLowerCase();
    if (lower.includes("core") || lower.includes("abs") || lower.includes("plank")) {
      return "Engage your transverse abdominis by drawing your navel toward your spine before each rep. True core power is anti-rotation stability, not just flexing!";
    }
    return "Mobility and recovery are what enable you to push max intensity tomorrow. Keep breathing diaphragmatically!";
  },
};

export default function FriendsAndChatHub({
  isOpen,
  onClose,
  initialChatFriendId,
  onChallengeFriend,
}: FriendsAndChatHubProps) {
  const [activeTab, setActiveTab] = useState<"friends" | "coaches">("coaches");
  const [selectedFriend, setSelectedFriend] = useState<FriendProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [addFriendModalOpen, setAddFriendModalOpen] = useState(false);
  const [newFriendHandle, setNewFriendHandle] = useState("");
  const [addedSuccess, setAddedSuccess] = useState(false);

  // Load custom friends
  const [friendsList, setFriendsList] = useState<FriendProfile[]>(() => {
    try {
      const saved = localStorage.getItem("kinetic_custom_friends");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_FRIENDS;
  });

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Map master instructors into FriendProfile format
  const creators = getCreators();
  const coachProfiles: FriendProfile[] = creators.map((c) => ({
    id: c.id,
    name: c.name,
    handle: c.handle,
    avatar: c.avatar,
    verified: true,
    status: "online",
    statusText: "Master Coach · Online",
    specialty: c.specialtyExercise,
    ratingElo: c.ratingElo,
    isCoach: true,
  }));

  const allProfiles = [...coachProfiles, ...friendsList];

  // Open initial friend chat if requested
  useEffect(() => {
    if (isOpen && initialChatFriendId) {
      const match = allProfiles.find((p) => p.id === initialChatFriendId);
      if (match) {
        setSelectedFriend(match);
      }
    }
  }, [isOpen, initialChatFriendId]);

  // Load messages for selected friend
  useEffect(() => {
    if (selectedFriend) {
      const key = `kinetic_chat_${selectedFriend.id}`;
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setMessages(parsed);
            return;
          }
        }
      } catch {}

      // Initial friendly greeting from coach or friend
      const greeting: ChatMessage = {
        id: `msg_init_${selectedFriend.id}`,
        senderId: selectedFriend.id,
        senderName: selectedFriend.name,
        text: selectedFriend.isCoach
          ? `Hey athlete! Coach ${selectedFriend.name.split(" ")[0]} here. Ask me anything about ${selectedFriend.specialty} or biomechanics!`
          : `Hey! Let's hit a workout together or do a 1v1 duel anytime.`,
        timestamp: "Just now",
        isUser: false,
      };
      setMessages([greeting]);
      try {
        localStorage.setItem(key, JSON.stringify([greeting]));
      } catch {}
    }
  }, [selectedFriend]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (selectedFriend && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [messages, selectedFriend]);

  if (!isOpen) return null;

  const handleSendMessage = (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !selectedFriend) return;
    tapFeedback();
    audio.playBeastClick();

    const userMsg: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: "user",
      senderName: "You",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isUser: true,
    };

    const nextList = [...messages, userMsg];
    setMessages(nextList);
    setInputText("");

    const key = `kinetic_chat_${selectedFriend.id}`;
    try {
      localStorage.setItem(key, JSON.stringify(nextList));
    } catch {}

    // Smart coach reply
    if (selectedFriend.isCoach && COACH_RESPONSES[selectedFriend.id]) {
      setTimeout(() => {
        const responder = COACH_RESPONSES[selectedFriend.id];
        const replyText = responder(text);
        const coachMsg: ChatMessage = {
          id: `msg_reply_${Date.now()}`,
          senderId: selectedFriend.id,
          senderName: selectedFriend.name,
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isUser: false,
        };
        const updatedWithReply = [...nextList, coachMsg];
        setMessages(updatedWithReply);
        try {
          localStorage.setItem(key, JSON.stringify(updatedWithReply));
        } catch {}
      }, 750);
    } else if (!selectedFriend.isCoach) {
      // Peer friend response
      setTimeout(() => {
        const peerResponses = [
          "Let's get it! Ready for the next PR session.",
          "Awesome work. Check my latest reel when you get a chance!",
          "Challenge accepted! Catch me in the Arena later today.",
        ];
        const randomReply = peerResponses[Math.floor(Math.random() * peerResponses.length)];
        const peerMsg: ChatMessage = {
          id: `msg_peer_${Date.now()}`,
          senderId: selectedFriend.id,
          senderName: selectedFriend.name,
          text: randomReply,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          isUser: false,
        };
        const updatedWithReply = [...nextList, peerMsg];
        setMessages(updatedWithReply);
        try {
          localStorage.setItem(key, JSON.stringify(updatedWithReply));
        } catch {}
      }, 900);
    }
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendHandle.trim()) return;
    tapFeedback();

    const cleanHandle = newFriendHandle.startsWith("@") ? newFriendHandle : `@${newFriendHandle}`;
    const newFriend: FriendProfile = {
      id: `f_${Date.now()}`,
      name: newFriendHandle.replace(/[@_]/g, " ").trim() || "Gym Athlete",
      handle: cleanHandle.toLowerCase(),
      avatar: "/assets/coaches/coach-mobility-male.jpg",
      verified: false,
      status: "online",
      statusText: "Added just now",
      specialty: "High-Intensity Training",
      ratingElo: 1350,
      isCoach: false,
    };

    const updated = [newFriend, ...friendsList];
    setFriendsList(updated);
    try {
      localStorage.setItem("kinetic_custom_friends", JSON.stringify(updated));
    } catch {}

    setAddedSuccess(true);
    setTimeout(() => {
      setAddedSuccess(false);
      setAddFriendModalOpen(false);
      setNewFriendHandle("");
      setSelectedFriend(newFriend);
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 backdrop-blur-xl p-0 sm:p-4 animate-fade-in select-none">
      <div className="relative h-full w-full max-w-[480px] bg-zinc-950 flex flex-col justify-between overflow-hidden sm:rounded-[36px] border sm:border-white/15 shadow-2xl">
        
        {/* ================= VIEW 1: DIRECT CHAT WINDOW ================= */}
        {selectedFriend ? (
          <div className="flex flex-col h-full justify-between">
            {/* Chat Top Bar */}
            <div className="flex items-center justify-between px-4 py-3 bg-black/75 backdrop-blur-xl border-b border-white/10 z-20">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setSelectedFriend(null);
                  }}
                  className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>

                <div className="relative">
                  <img
                    src={selectedFriend.avatar}
                    alt={selectedFriend.name}
                    className="h-10 w-10 rounded-full object-cover border border-white/20"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/assets/coaches/coach-beast-male.jpg";
                    }}
                  />
                  <span
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-black ${
                      selectedFriend.status === "online" ? "bg-emerald-500" : "bg-amber-500"
                    }`}
                  />
                </div>

                <div>
                  <div className="flex items-center gap-1">
                    <h3 className="text-xs font-black text-white">{selectedFriend.name}</h3>
                    {selectedFriend.verified && (
                      <CheckCircle2 className="h-3.5 w-3.5 fill-cyan-400 text-black" />
                    )}
                  </div>
                  <p className="text-[10px] text-white/50">{selectedFriend.statusText}</p>
                </div>
              </div>

              {/* Direct 1v1 Challenge in Header */}
              {onChallengeFriend && (
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    onChallengeFriend(selectedFriend);
                    onClose();
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-black bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 active:scale-95 shadow-md transition"
                >
                  <Swords className="h-3.5 w-3.5 fill-slate-950" />
                  <span>Challenge</span>
                </button>
              )}
            </div>

            {/* Chat Messages List */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar"
            >
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`flex flex-col ${m.isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-lg ${
                      m.isUser
                        ? "bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-br-none"
                        : "bg-zinc-900 border border-white/10 text-slate-200 rounded-bl-none"
                    }`}
                  >
                    <p>{m.text}</p>
                  </div>
                  <span className="text-[9px] text-white/40 mt-1 px-1">
                    {m.timestamp}
                  </span>
                </div>
              ))}
            </div>

            {/* Quick Interactive Prompt Chips */}
            <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-black/40 border-t border-white/5">
              {[
                "Can you check my pushup tempo?",
                "What's your advice for vertical jump?",
                "Challenge: 45s rep battle!",
                "Technique tips for progressive overload?",
              ].map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => handleSendMessage(chip)}
                  className="shrink-0 text-[10px] font-bold rounded-lg bg-white/5 hover:bg-white/15 border border-white/10 text-cyan-300 px-2.5 py-1 active:scale-95 transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-black/90 border-t border-white/10 flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${selectedFriend.handle}...`}
                className="flex-1 rounded-2xl bg-white/10 border border-white/15 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`p-2.5 rounded-2xl transition active:scale-90 ${
                  inputText.trim()
                    ? "bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/30"
                    : "bg-white/10 text-white/30 cursor-not-allowed"
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        ) : (
          /* ================= VIEW 2: FRIENDS & COACHES DIRECTORY ================= */
          <div className="flex flex-col h-full justify-between">
            {/* Top Bar */}
            <div className="p-4 border-b border-white/10 bg-black/60 backdrop-blur sticky top-0 z-20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-400">
                    <MessageCircle className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white">Direct Messages & Friends</h2>
                    <p className="text-[10px] text-white/50">Chat with Master Coaches & Gym Partners</p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      setAddFriendModalOpen(true);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-xs font-bold text-white transition active:scale-95"
                    title="Add Friend"
                  >
                    <UserPlus className="h-3.5 w-3.5 text-cyan-400" />
                    <span>Add</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      tapFeedback();
                      onClose();
                    }}
                    className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Sub-tabs: Master Coaches vs Friends */}
              <div className="grid grid-cols-2 p-1 bg-white/5 rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setActiveTab("coaches");
                  }}
                  className={`py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeTab === "coaches"
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Master Coaches ({coachProfiles.length})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    tapFeedback();
                    setActiveTab("friends");
                  }}
                  className={`py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition ${
                    activeTab === "friends"
                      ? "bg-cyan-500 text-slate-950 shadow-md"
                      : "text-white/60 hover:text-white"
                  }`}
                >
                  Friends ({friendsList.length})
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search coach or friend..."
                  className="w-full rounded-xl bg-white/5 border border-white/10 pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5 no-scrollbar">
              {(activeTab === "coaches" ? coachProfiles : friendsList)
                .filter(
                  (f) =>
                    f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    f.handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    f.specialty.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((friend) => (
                  <div
                    key={friend.id}
                    className="flex items-center justify-between p-3 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-white/20 transition shadow-lg"
                  >
                    <div
                      onClick={() => {
                        tapFeedback();
                        setSelectedFriend(friend);
                      }}
                      className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                    >
                      <div className="relative shrink-0">
                        <img
                          src={friend.avatar}
                          alt={friend.name}
                          className="h-12 w-12 rounded-2xl object-cover border border-white/20"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/assets/coaches/coach-beast-male.jpg";
                          }}
                        />
                        <span
                          className={`absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-black ${
                            friend.status === "online" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <h4 className="text-xs font-black text-white truncate">{friend.name}</h4>
                          {friend.verified && (
                            <CheckCircle2 className="h-3.5 w-3.5 fill-cyan-400 text-black shrink-0" />
                          )}
                        </div>
                        <p className="text-[11px] text-cyan-300 font-bold truncate">
                          {friend.handle}
                        </p>
                        <p className="text-[10px] text-white/50 truncate">
                          {friend.specialty} · {friend.ratingElo} ELO
                        </p>
                      </div>
                    </div>

                    {/* Action Buttons: Message & 1v1 Challenge */}
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <button
                        type="button"
                        onClick={() => {
                          tapFeedback();
                          setSelectedFriend(friend);
                        }}
                        className="p-2 rounded-xl bg-white/10 hover:bg-cyan-500 hover:text-slate-950 text-white transition active:scale-95"
                        title="Chat / Message"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </button>

                      {onChallengeFriend && (
                        <button
                          type="button"
                          onClick={() => {
                            tapFeedback();
                            onChallengeFriend(friend);
                            onClose();
                          }}
                          className="p-2 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 hover:bg-amber-400 hover:text-slate-950 transition active:scale-95"
                          title="1v1 Live Challenge"
                        >
                          <Swords className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>

            {/* Add Friend Floating Modal */}
            {addFriendModalOpen && (
              <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
                <div className="w-full max-w-sm rounded-3xl bg-zinc-900 border border-white/20 p-5 space-y-4 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-white">Add Workout Partner</h3>
                    <button
                      type="button"
                      onClick={() => setAddFriendModalOpen(false)}
                      className="text-white/60 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <form onSubmit={handleAddFriend} className="space-y-3">
                    <p className="text-xs text-white/70">
                      Enter athlete's username or gym handle to connect and duel:
                    </p>
                    <input
                      type="text"
                      value={newFriendHandle}
                      onChange={(e) => setNewFriendHandle(e.target.value)}
                      placeholder="@username (e.g. @beast_mode)"
                      className="w-full rounded-xl bg-white/10 border border-white/15 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                      autoFocus
                    />
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setAddFriendModalOpen(false)}
                        className="px-3 py-1.5 rounded-xl text-xs text-white/60 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={!newFriendHandle.trim() || addedSuccess}
                        className="px-4 py-1.5 rounded-xl bg-cyan-500 text-slate-950 font-black text-xs hover:bg-cyan-400 active:scale-95 transition"
                      >
                        {addedSuccess ? "✓ Connected!" : "Add Friend"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
