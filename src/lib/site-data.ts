import { normalizePublicUrl } from "./links";
export { getVideoEmbed } from "./links";

export type Release = {
  id: string;
  title: string;
  artist: string;
  genre: string;
  image: string;
  videoUrl: string;
  year: string;
  featured: boolean;
};
export type WebsiteFile = { id: string; title: string; filename: string; url: string; mime: string; size: number };
export type GalleryItem = { id: string; title: string; category: string; image: string };
export type SiteContent = {
  brandName: string; brandTagline: string; logoUrl: string;
  accentColor: string; backgroundColor: string;
  heroEyebrow: string; heroTitle: string; heroAccent: string; heroDescription: string; heroImage: string;
  heroNotes: string[]; musicTitle: string; musicDescription: string; videoTitle: string;
  aboutTitle: string; aboutText: string; aboutImage: string;
  galleryTitle: string; contactTitle: string; contactDescription: string;
  address: string; mapQuery: string; email: string; phone: string; whatsapp: string;
  youtubeUrl: string; instagramUrl: string; facebookUrl: string; officeHours: string;
  footerText: string; releases: Release[]; gallery: GalleryItem[]; files: WebsiteFile[];
};

export const defaultContent: SiteContent = {
  brandName: "Hansa Music",
  brandTagline: "MUSIC THAT CONNECTS.",
  logoUrl: "/images/hansa-logo.svg",
  accentColor: "#FFD43B",
  backgroundColor: "#101010",
  heroEyebrow: "INDEPENDENT MUSIC. UNLIMITED SOUL.",
  heroTitle: "Desi roots.",
  heroAccent: "Global rhythms.",
  heroDescription: "From the heart of Delhi to wherever you are.\nDiscover fresh voices, feel-good beats, and music that stays with you.",
  heroImage: "/images/hansa-hero.jpg",
  heroNotes: ["Original music", "Independent spirit", "Made in Delhi"],
  musicTitle: "Fresh off the studio.",
  musicDescription: "New sounds. Real stories. Find your next favourite.",
  videoTitle: "Good music. Great stories.",
  aboutTitle: "More than a label.\nA home for your sound.",
  aboutText: "Music is where our stories come alive. Based in the heart of East Delhi, Hansa Music brings together passionate artists, authentic voices, and a love for our roots.\n\nFrom soulful melodies to beats that move you, we’re here to create, collaborate, and take independent Indian music a little further. Got a song in your heart? You’re in the right place.",
  aboutImage: "/images/studio.jpg",
  galleryTitle: "Behind the sound.",
  contactTitle: "Let’s make\nsomething unforgettable.",
  contactDescription: "An artist with a vision? A creator with an idea? Or just someone who loves good music? We’d love to hear from you.",
  address: "Pandav Nagar, near Mother Dairy\nLaxmi Nagar, Delhi, India",
  mapQuery: "Mother Dairy, Pandav Nagar, Delhi, India",
  email: "",
  phone: "",
  whatsapp: "",
  youtubeUrl: "https://www.youtube.com/results?search_query=Hansa+Music+official",
  instagramUrl: "",
  facebookUrl: "",
  officeHours: "Studio visits by appointment",
  footerText: "Rooted in culture. Connected by music.",
  files: [],
  releases: [
    { id: "desi-vibes", title: "Desi Vibes", artist: "Hansa Music · Sample collection", genre: "Haryanvi", image: "/images/desi-vibes.jpg", videoUrl: "", year: "2026", featured: true },
    { id: "tere-naal", title: "Tere Naal", artist: "Hansa Music · Sample collection", genre: "Punjabi", image: "/images/tere-naal.jpg", videoUrl: "", year: "2026", featured: true },
    { id: "ishq-adhoora", title: "Ishq Adhoora", artist: "Hansa Music · Sample collection", genre: "Hindi", image: "/images/ishq-adhoora.jpg", videoUrl: "", year: "2026", featured: true },
    { id: "shiv-shambhu", title: "Shiv Shambhu", artist: "Hansa Music · Sample collection", genre: "Devotional", image: "/images/shiv-shambhu.jpg", videoUrl: "", year: "2026", featured: false },
  ],
  gallery: [
    { id: "studio", title: "Where the sound comes to life", category: "Our studio", image: "/images/studio.jpg" },
    { id: "sessions", title: "One voice. A thousand feelings.", category: "Behind the scenes", image: "/images/hansa-hero.jpg" },
    { id: "poster-desi", title: "Desi Vibes — cover concept", category: "Posters", image: "/images/desi-vibes.jpg" },
    { id: "poster-naal", title: "Tere Naal — cover concept", category: "Posters", image: "/images/tere-naal.jpg" },
  ],
};

const stringFields = ["brandName", "brandTagline", "logoUrl", "accentColor", "backgroundColor", "heroEyebrow", "heroTitle", "heroAccent", "heroDescription", "heroImage", "musicTitle", "musicDescription", "videoTitle", "aboutTitle", "aboutText", "aboutImage", "galleryTitle", "contactTitle", "contactDescription", "address", "mapQuery", "email", "phone", "whatsapp", "youtubeUrl", "instagramUrl", "facebookUrl", "officeHours", "footerText"] as const;
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function text(v: unknown, label: string, max = 3000): string {
  if (typeof v !== "string" || v.length > max) throw new Error(`${label}: please enter text under ${max} characters.`);
  return v.trim();
}
function checkedLink(value: string, image: boolean, label: string) {
  try { return normalizePublicUrl(value, image); }
  catch (error) { throw new Error(`${label}: ${error instanceof Error ? error.message : "Please check this link."}`); }
}
export function validateContent(value: unknown): SiteContent {
  if (!isObject(value)) throw new Error("Invalid website content.");
  const result: Record<string, unknown> = {};
  for (const key of stringFields) result[key] = text(value[key], key);
  for (const key of ["accentColor", "backgroundColor"]) if (!/^#[a-fA-F0-9]{6}$/.test(result[key] as string)) throw new Error("Please choose a valid colour.");
  for (const key of ["logoUrl", "heroImage", "aboutImage"]) result[key] = checkedLink(result[key] as string, true, key === "logoUrl" ? "Brand & colours → Company logo" : "Homepage & story → Image link");
  for (const key of ["youtubeUrl", "instagramUrl", "facebookUrl"]) result[key] = checkedLink(result[key] as string, false, `Contact & location → ${key.replace("Url", "")} link`);
  if (!(result.brandName as string) || !(result.heroTitle as string)) throw new Error("Your brand name and headline cannot be empty.");
  if (result.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email as string)) throw new Error("Please check your contact email address.");
  if (result.whatsapp && !/^\+?[\d\s()-]{7,20}$/.test(result.whatsapp as string)) throw new Error("WhatsApp number must include the country code and digits only.");
  if (!Array.isArray(value.heroNotes) || value.heroNotes.length !== 3) throw new Error("Please include three homepage highlights.");
  result.heroNotes = value.heroNotes.map(v => text(v, "Highlight", 100));
  if (!Array.isArray(value.releases) || value.releases.length > 100) throw new Error("You can add up to 100 releases.");
  const ids = new Set<string>();
  result.releases = value.releases.map(v => {
    if (!isObject(v)) throw new Error("Invalid release.");
    const release: Record<string, unknown> = {};
    for (const k of ["id", "title", "artist", "genre", "image", "videoUrl", "year"]) release[k] = text(v[k], k, k === "videoUrl" || k === "image" ? 4096 : 200);
    if (!release.id || !release.title || !release.genre || ids.has(release.id as string)) throw new Error("Each release needs a unique ID, title and genre.");
    ids.add(release.id as string);
    release.image = checkedLink(release.image as string, true, `Music & videos → ${release.title} → Cover`);
    release.videoUrl = checkedLink(release.videoUrl as string, false, `Music & videos → ${release.title} → Video link`);
    release.featured = v.featured === true;
    return release;
  });
  if (!Array.isArray(value.gallery) || value.gallery.length > 100) throw new Error("You can add up to 100 gallery images.");
  const galleryIds = new Set<string>();
  result.gallery = value.gallery.map(v => {
    if (!isObject(v)) throw new Error("Invalid gallery photo.");
    const item: Record<string, string> = {};
    for (const k of ["id", "title", "category", "image"]) item[k] = text(v[k], k, k === "image" ? 4096 : 200);
    if (!item.id || !item.title || !item.category || !item.image || galleryIds.has(item.id)) throw new Error("Each photo needs a unique ID, title, category and image.");
    galleryIds.add(item.id);
    item.image = checkedLink(item.image, true, `Photos & posters → ${item.title}`);
    return item;
  });
  const files = value.files ?? [];
  if (!Array.isArray(files) || files.length > 300) throw new Error("Files & downloads: you can publish up to 300 files.");
  const fileIds = new Set<string>();
  result.files = files.map(v => {
    if (!isObject(v)) throw new Error("Invalid file entry.");
    const item = { id: text(v.id, "File ID", 200), title: text(v.title, "File title", 300), filename: text(v.filename, "Filename", 300), url: checkedLink(text(v.url, "File link", 4096), false, "Files & downloads"), mime: text(v.mime, "File type", 200), size: v.size };
    if (!item.id || !item.title || !item.url || fileIds.has(item.id) || typeof item.size !== "number" || !Number.isSafeInteger(item.size) || item.size < 0) throw new Error("Each published file needs a unique ID, title, valid link and file size.");
    fileIds.add(item.id);
    return item;
  });
  return result as unknown as SiteContent;
}
