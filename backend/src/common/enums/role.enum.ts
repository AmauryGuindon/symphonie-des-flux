export enum Role {
  CLIENT = 'client',
  ADMIN = 'admin',
}

export enum LoyaltyTier {
  BRONZE = 'bronze',     // 0–4 visites
  SILVER = 'silver',     // 5–14 visites
  GOLD = 'gold',         // 15–29 visites
  PLATINUM = 'platinum', // 30+ visites
}

export function computeTier(visitCount: number): LoyaltyTier {
  if (visitCount >= 30) return LoyaltyTier.PLATINUM;
  if (visitCount >= 15) return LoyaltyTier.GOLD;
  if (visitCount >= 5) return LoyaltyTier.SILVER;
  return LoyaltyTier.BRONZE;
}

export const LOYALTY_POINTS_PER_VISIT = 10;
export const LOYALTY_REFERRAL_BONUS = 20;
export const LOYALTY_BIRTHDAY_BONUS = 15;

/** Bonus de points offerts par palier, en plus des points de base de la prestation */
export const LOYALTY_TIER_BONUS: Record<LoyaltyTier, number> = {
  [LoyaltyTier.BRONZE]:    5,
  [LoyaltyTier.SILVER]:   10,
  [LoyaltyTier.GOLD]:     15,
  [LoyaltyTier.PLATINUM]: 20,
};
