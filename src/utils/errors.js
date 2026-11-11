export function niceError(e) {
  const c = e?.code || "";
  if (c.includes("email-already-in-use")) return "That email is already registered. Log in instead.";
  if (c.includes("weak-password")) return "Password must be at least 6 characters.";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "Email or password is wrong.";
  if (c.includes("invalid-email")) return "That email address is not valid.";
  if (c.includes("requires-recent-login")) return "For security, please log out, log in again and retry.";
  if (c.includes("permission-denied")) return "You don't have permission for that.";
  if (c.includes("too-many-requests")) return "Too many attempts. Wait a minute and try again.";
  if (c.includes("network-request-failed")) return "No internet connection. Check your network and retry.";
  return e?.message || "Something went wrong.";
}
