/**
 * Consent Manager Types
 *
 * Defines the shape of consent configuration, storage, and
 * Google Consent Mode v2 type mappings.
 */

/** Built-in consent categories (provided for reference / convenience) */
export type DefaultConsentCategory = 'necessary' | 'analytics' | 'marketing' | 'preferences';

/** Consent category key — any string so users can add custom categories */
export type ConsentCategory = string;

/**
 * Consent enforcement mode
 * - consent_mode_v2: opt-in. Scripts load with denied defaults (cookieless pings)
 *   until the visitor accepts.
 * - strict: opt-in. Scripts don't load at all until the visitor accepts.
 * - opt_out: categories start as `defaultEnabled` says and no banner is shown;
 *   a floating button lets visitors opt out. Visitors in `optInRegions` start
 *   denied and still get the banner, and a Global Privacy Control signal opts
 *   the visitor out.
 */
export type ConsentModeType = 'consent_mode_v2' | 'strict' | 'opt_out';

/**
 * Where opt-in consent is required in `opt_out` mode: the EEA, the UK and
 * Switzerland (ISO 3166-1 alpha-2). Google applies these by the visitor's IP.
 */
export const DEFAULT_OPT_IN_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE',
  'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  'IS', 'LI', 'NO', 'GB', 'CH',
];

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
  categories: Record<string, boolean>;
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
  /** Label shown on the "always on" badge for required categories */
  alwaysOnLabel?: string;
  /** Label for the privacy policy link */
  privacyPolicyLabel?: string;
}

/** Full consent manager configuration */
export interface ConsentConfig {
  /** Bump to force re-consent when categories change */
  version: number;
  /** Enforcement mode */
  mode: ConsentModeType;
  /**
   * `opt_out` mode only: regions (ISO 3166-1 alpha-2, or ISO 3166-2 such as
   * 'US-CA') that still get opt-in consent. Defaults to DEFAULT_OPT_IN_REGIONS.
   */
  optInRegions?: string[];
  /** localStorage key for storing preferences */
  storageKey: string;
  /** Category definitions */
  categories: Record<string, ConsentCategoryConfig>;
  /** UI text strings */
  ui: ConsentUIText;
  /** Milliseconds before banner appears */
  showDelay: number;
}
