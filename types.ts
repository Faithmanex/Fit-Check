
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export type GarmentCategory = 'tops' | 'bottoms' | 'outerwear' | 'dresses' | 'accessories';

export interface WardrobeItem {
  id: string;
  name: string;
  url: string;
  category: GarmentCategory;
}

export interface OutfitLayer {
  garment: WardrobeItem | null; // null represents the base model layer
  poseImages: Record<string, string>; // Maps pose instruction to image URL
}

export type SubscriptionPlan = 'free' | 'pro';

export interface SavedOutfit {
  id: string;
  imageUrl: string;
  date: string;
  garmentNames: string[];
}

export interface User {
  id: string;
  email: string;
  name: string;
  plan: SubscriptionPlan;
  subscriptionStatus: 'active' | 'inactive' | 'cancelled';
  generationsUsed: number;
  avatar?: string;
  savedOutfits?: SavedOutfit[];
  modelImage?: string | null; // Persist the user's base model
}

export interface ShoppingResult {
    title: string;
    uri: string;
    source?: string;
}

export interface GenerationEntry {
    key: string; // Composite key: e.g., "tryon_garmentID_poseIndex"
    data: string; // Base64 image
    timestamp: number;
}
