// True only while the Register page is creating an account (so AuthContext doesn't sign the new,
// not-yet-verified user out before their profile is saved).
export const regFlag = { current: false };
