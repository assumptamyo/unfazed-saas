// Unfazed's commission on each online payment, by subscription tier (percent).
// Higher plans pay a lower commission. Gateway charges are not included here.
export const PLATFORM_FEE_PERCENT = {
  starter: 5,
  professional: 3,
  practice: 2,
};

export const DEFAULT_PLATFORM_FEE_PERCENT = 5;

export const platformFeePercentFor = (tierKey) => PLATFORM_FEE_PERCENT[tierKey] ?? DEFAULT_PLATFORM_FEE_PERCENT;

// Split an amount (paise) into the platform fee and what the therapist receives
export const splitAmount = (amount, percent) => {
  const platformFee = Math.round((amount * percent) / 100);
  return { platformFee, netAmount: amount - platformFee };
};
