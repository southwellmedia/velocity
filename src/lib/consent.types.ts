/**
 * Consent Manager Types
 *
 * Defines the shape of consent configuration, storage, and
 * Google Consent Mode v2 type mappings.
 */

/** Consent categories that users can toggle */
export type ConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

/** Consent enforcement mode */
export type ConsentModeType = 'consent_mode_v2' | 'strict';

/** Google Consent Mode v2 signal types */
export type GCMType =
  | 'ad_storage'
  | 'ad_user_data'
  | 'ad_personalization'
  | 'analytics_storage'
  | 'functionality_storage'
  | 'personalization_storage'
  | 'security_storage';

/** Configuration for a single consent category */
export interface ConsentCategoryConfig {
  /** Display label */
  label: string;
  /** Description shown in settings panel */
  description: string;
  /** If true, cannot be toggled off (e.g. necessary cookies) */
  required: boolean;
  /** Default state when no consent has been given */
  defaultEnabled: boolean;
  /** Google Consent Mode v2 types mapped to this category */
  gcmTypes: GCMType[];
}

/** Stored user consent preferences */
export interface ConsentPreferences {
  /** Config version at time of consent (bump to force re-consent) */
  version: number;
  /** ISO timestamp of when consent was given */
  timestamp: string;
  /** Per-category granted/denied state */
  categories: Record<ConsentCategory, boolean>;
}

/** UI text strings for the consent banner */
export interface ConsentUIText {
  heading: string;
  description: string;
  acceptAll: string;
  declineAll: string;
  customize: string;
  savePreferences: string;
  settingsHeading: string;
}

/** Full consent manager configuration */
export interface ConsentConfig {
  /** Bump to force re-consent when categories change */
  version: number;
  /** Enforcement mode */
  mode: ConsentModeType;
  /** localStorage key for storing preferences */
  storageKey: string;
  /** Category definitions */
  categories: Record<ConsentCategory, ConsentCategoryConfig>;
  /** UI text strings */
  ui: ConsentUIText;
  /** Milliseconds before banner appears */
  showDelay: number;
}
