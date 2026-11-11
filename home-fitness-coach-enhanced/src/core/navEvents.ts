/** Lets a deep component (an empty state, say) send the user to a main screen without threading callbacks through every parent. */
export type MainScreen = "dashboard" | "reels" | "beast-duels" | "ai-generator" | "profile-hub" | "programs";
export function goToScreen(view: MainScreen) {
  window.dispatchEvent(new CustomEvent<MainScreen>("apex-nav", { detail: view }));
}
