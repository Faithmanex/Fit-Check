
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

/** A saved try-on result ("look") stored in its own IndexedDB store. */
export interface LookEntry {
    id: string;
    userId: string;
    imageUrl: string; // data URL of the generated result
    timestamp: number; // epoch ms, used for sorting
    dateLabel?: string; // human-friendly creation date
    garmentNames: string[]; // stack snapshot, e.g. ["Base Model", "Denim Jacket"]
    poseLabel?: string;
    source: 'auto' | 'manual'; // auto-recorded after generation vs. pinned by the user
    favorite?: boolean; // hearted by the user; favorites survive trimming preferentially
}

export interface LookPage {
    items: LookEntry[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
