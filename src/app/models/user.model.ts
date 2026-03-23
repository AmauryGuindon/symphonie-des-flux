export type Role = 'client' | 'admin';
export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface User {
  _id?: string;
  id?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: Role;
  loyaltyPoints: number;
  visitCount: number;
  loyaltyTier: LoyaltyTier;
  favoriteStyle?: string;
  preferences?: string;
  birthDate?: string;
  referralCode?: string;
  referredBy?: string;
  referralCount: number;
  lastVisitAt?: string;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export const TIER_CONFIG: Record<LoyaltyTier, { label: string; color: string; next: number | null }> = {
  bronze:   { label: 'Bronze',   color: '#cd7f32', next: 5 },
  silver:   { label: 'Argent',   color: '#c0c0c0', next: 15 },
  gold:     { label: 'Or',       color: '#C9A44A', next: 30 },
  platinum: { label: 'Platine',  color: '#e8f4ff', next: null },
};
