/**
 * Live video between the two players of an arena room (WebRTC).
 * Signalling goes through Firestore: rooms/{code}/rtc/{offer|answer} and
 * rooms/{code}/rtc/{host|guest}/cands/*. Media flows peer-to-peer.
 * STUN only: on some strict mobile networks a TURN relay would be needed.
 */
import { useEffect, useRef, useState } from "react";
import { addDoc, collection, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../../core/firebase";

export type DuelVideoState = "off" | "starting" | "waiting" | "connecting" | "live" | "error";

const ICE = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

export function useDuelVideo(code: string, role: "host" | "guest" | null, otherPresent: boolean, enabled: boolean) {
  const [local, setLocal] = useState<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [state, setState] = useState<DuelVideoState>("off");
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  useEffect(() => {
    if (!enabled || !role) { setState("off"); return; }
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    let stream: MediaStream | null = null;
    const other = role === "host" ? "guest" : "host";

    (async () => {
      try {
        setState("starting"); setError(null);
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("Camera isn't available on this device.");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 640 } }, audio: false });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
        setLocal(stream);
        if (role === "host" && !otherPresent) { setState("waiting"); return; }
        setState("connecting");

        const pc = new RTCPeerConnection(ICE);
        pcRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream!));
        const inbound = new MediaStream();
        pc.ontrack = e => { e.streams[0]?.getTracks().forEach(t => inbound.addTrack(t)); setRemote(new MediaStream(inbound.getTracks())); };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setState("live");
          else if (pc.connectionState === "failed") { setState("error"); setError("Couldn't connect video. Your networks may block peer-to-peer."); }
        };
        pc.onicecandidate = e => {
          if (e.candidate) void addDoc(collection(db, "rooms", code, "rtc", role, "cands"), e.candidate.toJSON()).catch(() => {});
        };

        const pending: RTCIceCandidateInit[] = [];
        let remoteSet = false;
        const flush = () => { while (pending.length) void pc.addIceCandidate(pending.shift()!).catch(() => {}); };
        unsubs.push(onSnapshot(collection(db, "rooms", code, "rtc", other, "cands"), snap => {
          snap.docChanges().forEach(c => {
            if (c.type !== "added") return;
            if (remoteSet) void pc.addIceCandidate(c.doc.data() as RTCIceCandidateInit).catch(() => {});
            else pending.push(c.doc.data() as RTCIceCandidateInit);
          });
        }, () => {}));

        if (role === "host") {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await setDoc(doc(db, "rooms", code, "rtc", "offer"), { type: offer.type, sdp: offer.sdp, at: Date.now() });
          unsubs.push(onSnapshot(doc(db, "rooms", code, "rtc", "answer"), async snap => {
            const d = snap.data() as RTCSessionDescriptionInit | undefined;
            if (!d || remoteSet || pc.signalingState !== "have-local-offer") return;
            await pc.setRemoteDescription({ type: d.type, sdp: d.sdp });
            remoteSet = true; flush();
          }, () => {}));
        } else {
          unsubs.push(onSnapshot(doc(db, "rooms", code, "rtc", "offer"), async snap => {
            const d = snap.data() as RTCSessionDescriptionInit | undefined;
            if (!d || remoteSet) return;
            await pc.setRemoteDescription({ type: d.type, sdp: d.sdp });
            remoteSet = true; flush();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await setDoc(doc(db, "rooms", code, "rtc", "answer"), { type: answer.type, sdp: answer.sdp, at: Date.now() });
          }, () => {}));
        }
      } catch (e: any) {
        if (cancelled) return;
        setState("error");
        setError(e?.name === "NotAllowedError" ? "Allow camera access to use video." : e?.message || "Video failed to start.");
      }
    })();

    return () => {
      cancelled = true;
      unsubs.forEach(u => u());
      pcRef.current?.close(); pcRef.current = null;
      stream?.getTracks().forEach(t => t.stop());
      setLocal(null); setRemote(null);
    };
  }, [code, role, enabled, role === "host" ? otherPresent : false]); // host re-runs once the guest joins

  return { local, remote, state, error };
}
