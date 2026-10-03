// Lets pages tell the dashboard frame (top bar, menu) that the therapist's profile changed
const EVENT = "unfazed:profile-updated";

export const announceProfileUpdate = (therapist) =>
  window.dispatchEvent(new CustomEvent(EVENT, { detail: therapist }));

export const onProfileUpdate = (handler) => {
  const listener = (e) => handler(e.detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};
