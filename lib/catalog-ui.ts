import { getProductById } from "./catalog";
import { ProductCatalogItem } from "./types";

export interface ProductVisualMeta {
  iconName: string;
  badgeText: string;
  gradient: string;
  accentColor: string;
  defaultReason: string;
}

export const PRODUCT_VISUAL_MAP: Record<string, ProductVisualMeta> = {
  "college-notebook-pack": {
    iconName: "BookOpen",
    badgeText: "Academic Core",
    gradient: "from-blue-500/20 to-indigo-500/20",
    accentColor: "text-blue-400 border-blue-500/30",
    defaultReason: "Essential 300-page 5-subject spiral notebooks for taking lecture notes and tracking course syllabus.",
  },
  "gel-pen-set": {
    iconName: "PenTool",
    badgeText: "High Utility",
    gradient: "from-sky-500/20 to-cyan-500/20",
    accentColor: "text-sky-400 border-sky-500/30",
    defaultReason: "0.5mm smooth flow ink pens for continuous writing during long exams and lectures.",
  },
  "highlighter-pack": {
    iconName: "Highlighter",
    badgeText: "Study Aid",
    gradient: "from-amber-500/20 to-yellow-500/20",
    accentColor: "text-amber-400 border-amber-500/30",
    defaultReason: "Non-bleeding pastel highlighters to mark key concepts and prepare quick revision guides.",
  },
  "sticky-notes-pad": {
    iconName: "StickyNote",
    badgeText: "Organization",
    gradient: "from-pink-500/20 to-rose-500/20",
    accentColor: "text-pink-400 border-pink-500/30",
    defaultReason: "Self-adhesive page flags and quick reminder notes for textbooks and dorm desks.",
  },
  "stainless-water-bottle": {
    iconName: "Droplets",
    badgeText: "Daily Essential",
    gradient: "from-emerald-500/20 to-teal-500/20",
    accentColor: "text-emerald-400 border-emerald-500/30",
    defaultReason: "24-hour insulated hydration flask to keep water cold and reduce single-use plastic on campus.",
  },
  "energy-bar-box": {
    iconName: "Zap",
    badgeText: "Sustained Energy",
    gradient: "from-orange-500/20 to-amber-500/20",
    accentColor: "text-orange-400 border-orange-500/30",
    defaultReason: "Healthy oat & almond energy bars to fuel through back-to-back presentations and multi-day events.",
  },
  "power-bank-10000": {
    iconName: "BatteryCharging",
    badgeText: "Tech Priority",
    gradient: "from-violet-500/20 to-purple-500/20",
    accentColor: "text-violet-400 border-violet-500/30",
    defaultReason: "10,000mAh slim fast-charging battery pack ensuring smartphones and accessories stay charged all day.",
  },
  "usb-flash-drive-64gb": {
    iconName: "HardDrive",
    badgeText: "Data Storage",
    gradient: "from-indigo-500/20 to-cyan-500/20",
    accentColor: "text-indigo-400 border-indigo-500/30",
    defaultReason: "High-speed USB 3.2 metal flash drive for transferring laboratory data, slide decks, and project code.",
  },
  "college-backpack": {
    iconName: "Briefcase",
    badgeText: "Campus Heavyweight",
    gradient: "from-slate-500/20 to-zinc-500/20",
    accentColor: "text-slate-300 border-slate-500/30",
    defaultReason: "Water-resistant 24L daypack with padded laptop compartment and organized dividers.",
  },
  "hand-sanitizer-pocket": {
    iconName: "ShieldAlert",
    badgeText: "Hygiene",
    gradient: "from-teal-500/20 to-emerald-500/20",
    accentColor: "text-teal-400 border-teal-500/30",
    defaultReason: "Compact pocket spray with 70% alcohol and moisturizing aloe vera for public venue hygiene.",
  },
  "mini-first-aid-kit": {
    iconName: "HeartPulse",
    badgeText: "Preparedness",
    gradient: "from-rose-500/20 to-red-500/20",
    accentColor: "text-rose-400 border-rose-500/30",
    defaultReason: "20-piece medical kit with bandages, antiseptic wipes, and burn gel for travel and active events.",
  },
  "electrolyte-hydration-powder": {
    iconName: "Sparkles",
    badgeText: "Rehydration",
    gradient: "from-lime-500/20 to-emerald-500/20",
    accentColor: "text-lime-400 border-lime-500/30",
    defaultReason: "Lemon-flavored electrolyte packets restoring vital minerals during outdoor campus activities.",
  },
  "wired-earphones": {
    iconName: "Headphones",
    badgeText: "Audio / Focus",
    gradient: "from-cyan-500/20 to-blue-500/20",
    accentColor: "text-cyan-400 border-cyan-500/30",
    defaultReason: "Zero-latency 3.5mm earbuds with in-line microphone for lecture recordings, online calls, and focused study.",
  },
  "id-card-lanyard-holder": {
    iconName: "BadgeCheck",
    badgeText: "Access & Security",
    gradient: "from-blue-500/20 to-slate-500/20",
    accentColor: "text-blue-400 border-blue-500/30",
    defaultReason: "Waterproof transparent sleeve with breakaway lanyard to keep institutional badges accessible.",
  },
  "discontinued-usb-fan": {
    iconName: "Wind",
    badgeText: "Sold Out",
    gradient: "from-gray-500/10 to-zinc-500/10",
    accentColor: "text-gray-400 border-gray-600/30",
    defaultReason: "Compact desk fan for personal cooling (currently out of stock).",
  },
};

export function getProductVisual(productId: string): ProductVisualMeta {
  return (
    PRODUCT_VISUAL_MAP[productId] || {
      iconName: "Package",
      badgeText: "Catalog Item",
      gradient: "from-primary/10 to-primary/5",
      accentColor: "text-primary border-primary/30",
      defaultReason: "Catalog-verified item selected to fit situation requirements within budget.",
    }
  );
}

export function getProductRecommendationReason(
  productId: string,
  userSituation?: string
): string {
  const meta = getProductVisual(productId);
  if (!userSituation) return meta.defaultReason;

  const sit = userSituation.toLowerCase();
  if (sit.includes("kolkata") || sit.includes("humid") || sit.includes("heat")) {
    if (productId === "stainless-water-bottle" || productId === "electrolyte-hydration-powder") {
      return "Critical for warm, humid climates like Kolkata to maintain continuous electrolyte hydration.";
    }
  }
  if (sit.includes("three-day") || sit.includes("3-day") || sit.includes("event") || sit.includes("fest")) {
    if (productId === "power-bank-10000") {
      return "Essential for multi-day events with limited access to charging wall outlets.";
    }
    if (productId === "mini-first-aid-kit") {
      return "Recommended travel safety item for emergencies over a 3-day active schedule.";
    }
    if (productId === "energy-bar-box") {
      return "Nutritious quick snacks between scheduled conference and festival activities.";
    }
  }
  if (sit.includes("exam") || sit.includes("study") || sit.includes("semester")) {
    if (productId === "college-notebook-pack" || productId === "gel-pen-set" || productId === "highlighter-pack") {
      return "Core academic stationery bundle optimized for note-taking and revision schedules.";
    }
  }

  return meta.defaultReason;
}
