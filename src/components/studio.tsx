"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { Modal } from "./modal";
import { defaultContent, validateContent, type GalleryItem, type Release, type SiteContent } from "@/lib/site-data";
import { requestJson, storeSession, makeId } from "@/lib/api-client";
import { useSiteEditor } from "@/lib/use-site-editor";
import { getActiveUploads, type Asset } from "@/lib/media-upload";
import { UploadButton, ImageUpload } from "./media-fields";
import { SessionUnlock } from "./session-unlock";
import { EditorPreview } from "./editor-preview";
import { UploadLibrary } from "./upload-library";
import { mediaKind } from "@/lib/media-policy";
import { HelpGuide } from "./help-guide";
import type { DeploymentInfo } from "@/lib/deployment-info";

type Tab = "overview" | "brand" | "homepage" | "music" | "gallery" | "contact" | "library" | "inquiries" | "settings" | "help";
type Inquiry = { id: string; name: string; email: string; phone: string; interest: string; message: string; isRead: boolean; createdAt: string };
type Notice = { kind: "success" | "error"; text: string };
const tabs: { id: Tab; name: string; icon: IconName; description: string }[] = [
  { id: "overview", name: "Your studio", icon: "layout", description: "A little overview of your creative world." },
  { id: "brand", name: "Brand & colours", icon: "palette", description: "Make a first impression that feels like you." },
  { id: "homepage", name: "Homepage & story", icon: "home", description: "Your headline, your photos, your story." },
  { id: "music", name: "Music & videos", icon: "disc", description: "Give every new sound a place to shine." },
  { id: "gallery", name: "Photos & posters", icon: "image", description: "Let people into your world, one frame at a time." },
  { id: "contact", name: "Contact & location", icon: "pin", description: "Help your next collaborator find you." },
  { id: "library", name: "Media library", icon: "upload", description: "All your uploaded photos and videos, in one place." },
  { id: "inquiries", name: "Enquiries", icon: "inbox", description: "Good conversations start right here." },
  { id: "settings", name: "Settings & security", icon: "settings", description: "Keep your website safe and make a backup." },
  { id: "help", name: "Help & go live", icon: "globe", description: "Bina coding use karein. Public launch ke steps samjhein." },
];

function downloadFile(name: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }));
  const link = document.createElement("a"); link.href = url; link.download = name; link.rel = "noopener"; link.style.display = "none"; document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function TextField({ label, value, onChange, hint, multiline = false, placeholder = "", type = "text" }: { label: string; value: string; onChange: (value: string) => void; hint?: string; multiline?: boolean; placeholder?: string; type?: string }) {
  return <label className="studio-field"><span>{label}</span>{multiline ? <textarea value={value} onChange={e => onChange(e.target.value)} rows={4} placeholder={placeholder} maxLength={3000} /> : <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} maxLength={3000} />}{hint && <small>{hint}</small>}</label>;
}
function Panel({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return <section className={`studio-panel ${className}`}><div className="studio-panel-heading"><h3>{title}</h3>{description && <p>{description}</p>}</div>{children}</section>;
}
function AuthScreen({ configured, onSuccess, onConfigured }: { configured: boolean; onSuccess: () => void; onConfigured: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!configured && password !== confirm) { setError("Passwords don’t match. Dono jagah ek jaisa password likhein."); return; }
    setBusy(true);
    try { await requestJson("/api/auth", "POST", { mode: configured ? "login" : "setup", password }); onSuccess(); }
    catch (e) { const message = e instanceof Error ? e.message : "Please try again."; setError(message); if (message.includes("already set")) onConfigured(); }
    finally { setBusy(false); }
  }
  return <div className="studio-auth"><div className="auth-visual"><img src="/images/hansa-hero.jpg" alt="A creative moment in the recording studio" /><div className="auth-visual-shade" /><Link className="brand" href="/"><img src="/images/hansa-logo.svg" alt="Hansa Music" /><span><strong>Hansa Music</strong><small>THE CREATOR’S STUDIO</small></span></Link><div className="auth-visual-copy"><span className="section-label">NO CODE. JUST YOU.</span><h1>Your website.<br /><span>Your rules.</span></h1><p>Your music, your colours, your story.<br />Make it all yours, one simple edit at a time.</p></div><span className="auth-bottom">BUILT FOR CREATORS, NOT CODERS.</span></div><div className="auth-form-side"><Link href="/" className="auth-back"><Icon name="arrowLeft" size={15} />Back to website</Link><div className="auth-form-card"><span className="auth-lock"><Icon name={configured ? "lock" : "sparkle"} size={25} /></span><p className="section-label">WELCOME TO YOUR STUDIO</p><h2>{configured ? "Let’s make something great." : "Make it yours."}</h2><p className="auth-description">{configured ? "Apna password daalein aur apni website edit karein. No coding needed." : "Pehle apna editor password banayein. Phir naam, colours, photos aur videos — sab kuch khud badal sakte hain."}</p><form onSubmit={submit}><label className="studio-field"><span>{configured ? "Your password" : "Create your password"}</span><div className="password-field"><input type={show ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} maxLength={128} placeholder="At least 8 characters" autoComplete={configured ? "current-password" : "new-password"} /><button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}><Icon name="eye" size={17} /></button></div></label>{!configured && <label className="studio-field"><span>Confirm password</span><input type={show ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} maxLength={128} placeholder="Enter your password again" autoComplete="new-password" /></label>}{error && <p className="form-error" role="alert">{error}</p>}<button type="submit" className="button button-primary auth-submit" disabled={busy}>{busy ? "Opening your studio…" : configured ? "Enter your studio" : "Create password & get started"}<Icon name="arrowRight" size={18} /></button></form><p className="auth-security"><Icon name="shield" size={16} />{configured ? "Your editor is private. Your creativity is unlimited." : "Keep this password safe. Only people with it can edit your website."}</p></div><span className="auth-footer">Aapki website. Aapke control mein.</span></div></div>;
}

export default function Studio({ initialContent, deployment }: { initialContent: SiteContent; deployment: DeploymentInfo }) {
  const [auth, setAuth] = useState({ loading: true, configured: false, authenticated: false });
  const editor = useSiteEditor(initialContent, auth.authenticated);
  const { draft, setDraft, dirty, setDirty, saving, lastSaved, setLastSaved } = editor;
  const [activeUploads, setActiveUploads] = useState(0);
  const [reauth, setReauth] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [authError, setAuthError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedRelease, setExpandedRelease] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [inboxError, setInboxError] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetsError, setAssetsError] = useState("");
  const [preview, setPreview] = useState<{ section: string } | null>(null);
  const [openingPreview, setOpeningPreview] = useState(false);
  const [recentUpload, setRecentUpload] = useState<{ filename: string; url: string; section: string } | null>(null);
  const closePreview = useCallback(() => setPreview(null), []);
  const [mapPreview, setMapPreview] = useState(initialContent.mapQuery);
  const [confirmation, setConfirmation] = useState<{ title: string; message: string; action: () => void } | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const backupRef = useRef<HTMLInputElement>(null);
  const activeTab = tabs.find(t => t.id === tab)!;
  const unread = inquiries.filter(i => !i.isRead).length;
  const closeConfirmation = useCallback(() => setConfirmation(null), []);
  const toast = (text: string, kind: "success" | "error" = "success") => setNotice({ text, kind });
  function update<K extends keyof SiteContent>(key: K, value: SiteContent[K]) { setDraft(current => ({ ...current, [key]: value })); setDirty(true); }
  function textField(key: keyof SiteContent, label: string, hint?: string, multiline = false, placeholder = "") {
    return <TextField label={label} value={String(draft[key])} onChange={value => update(key, value as never)} hint={hint} multiline={multiline} placeholder={placeholder} />;
  }
  function navigate(id: Tab) { if (getActiveUploads() > 0) { toast("Upload chal raha hai. Please wait, or pause the upload before switching sections."); return; } setTab(id); setSidebarOpen(false); setNotice(null); window.scrollTo({ top: 0, behavior: "smooth" }); }
  const checkAuth = useCallback(async () => {
    setAuthError("");
    try { const result = await requestJson<{ configured: boolean; authenticated: boolean }>("/api/auth"); setAuth({ ...result, loading: false }); }
    catch (e) { setAuthError(e instanceof Error ? e.message : "The editor couldn’t load."); setAuth(current => ({ ...current, loading: false })); }
  }, []);
  useEffect(() => { checkAuth(); }, [checkAuth]);
  useEffect(() => {
    const activity = () => setActiveUploads(getActiveUploads());
    const expired = () => setReauth(true);
    activity();
    window.addEventListener("hansa-upload-activity", activity);
    window.addEventListener("hansa-session-expired", expired);
    return () => { window.removeEventListener("hansa-upload-activity", activity); window.removeEventListener("hansa-session-expired", expired); };
  }, []);
  useEffect(() => { if (editor.errorStatus === 401) setReauth(true); }, [editor.errorStatus]);
  useEffect(() => {
    if (!activeUploads) return;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [activeUploads]);
  const loadInquiries = useCallback(async () => {
    setInboxLoading(true); setInboxError("");
    try { setInquiries(await requestJson<Inquiry[]>("/api/inquiries")); }
    catch (e) { setInboxError(e instanceof Error ? e.message : "Couldn’t load enquiries."); }
    finally { setInboxLoading(false); }
  }, []);
  const loadAssets = useCallback(async () => {
    setAssetsLoading(true); setAssetsError("");
    try { setAssets(await requestJson<Asset[]>("/api/media")); }
    catch (e) { setAssetsError(e instanceof Error ? e.message : "Couldn’t load media."); }
    finally { setAssetsLoading(false); }
  }, []);
  useEffect(() => { if (auth.authenticated) loadInquiries(); }, [auth.authenticated, loadInquiries]);
  useEffect(() => { if (auth.authenticated && tab === "library") loadAssets(); }, [auth.authenticated, tab, loadAssets]);
  async function save() {
    setNotice(null);
    const ok = await editor.save(true);
    if (ok) toast("Server par save aur verify ho gaya. View website se isi screen par dekhein.");
    return ok;
  }
  async function viewWebsite(section = "home") {
    setOpeningPreview(true);
    try {
      const ok = dirty ? await editor.save() : true;
      if (ok) await editor.refreshPublished();
      setPreview({ section });
      if (!ok) toast("Kuch changes publish nahi hue. Preview mein last saved version dikh raha hai; draft bhi dekh sakte hain.", "error");
    } catch (reason) { toast(reason instanceof Error ? reason.message : "Live preview could not load. Your draft is safe.", "error"); }
    finally { setOpeningPreview(false); }
  }
  function rememberAsset(asset: Asset) {
    setAssets(list => [{ ...asset, createdAt: asset.createdAt || new Date().toISOString() }, ...list.filter(item => item.id !== asset.id)]);
  }
  function publishAsset(asset: Asset) {
    const kind = mediaKind(asset.mime);
    const title = asset.filename.replace(/\.[^.]+$/, "").replace(/[_-]/g, " ").trim().slice(0, 190) || "New upload";
    setDraft(current => {
      if (kind === "image") {
        if (current.gallery.some(item => item.image === asset.url)) return current;
        return { ...current, gallery: [{ id: makeId(), title, category: "Posters", image: asset.url }, ...current.gallery] };
      }
      if (kind === "video") {
        if (current.releases.some(item => item.videoUrl === asset.url)) return current;
        return { ...current, releases: [{ id: makeId(), title, artist: current.brandName, genre: "Music video", image: current.heroImage, videoUrl: asset.url, year: String(new Date().getFullYear()), featured: true }, ...current.releases] };
      }
      if ((current.files || []).some(item => item.url === asset.url)) return current;
      return { ...current, files: [{ id: makeId(), title, filename: asset.filename, url: asset.url, mime: asset.mime, size: asset.size || 0 }, ...(current.files || [])] };
    });
    setRecentUpload({ filename: asset.filename, url: asset.url, section: kind === "image" ? "gallery" : kind === "video" ? "music" : "downloads" });
    toast(`${asset.filename}: upload complete. Website par publish aur verify kiya ja raha hai.`);
  }
  function acceptAsset(asset: Asset, publish = true) { rememberAsset(asset); if (publish) publishAsset(asset); else toast(`${asset.filename} library mein saved hai. Website par dikhane ke liye Add to website dabayein.`); }
  function fileIsPublished(url: string) {
    const content = editor.published;
    return content.gallery.some(item => item.image === url) || content.releases.some(item => item.videoUrl === url || item.image === url) || (content.files || []).some(item => item.url === url) || [content.logoUrl, content.heroImage, content.aboutImage].includes(url);
  }
  function renameFile(id: string, title: string) { setDraft(current => ({ ...current, files: (current.files || []).map(file => file.id === id ? { ...file, title } : file) })); }
  function removeFile(id: string) { setDraft(current => ({ ...current, files: (current.files || []).filter(file => file.id !== id) })); }
  async function logout() {
    try { await requestJson("/api/auth", "POST", { mode: "logout" }); storeSession(null); setDirty(false); editor.loadContent(initialContent); setTab("overview"); setSidebarOpen(false); setLastSaved(""); setInquiries([]); setAssets([]); setAuth({ configured: true, authenticated: false, loading: false }); setNotice(null); }
    catch { toast("Couldn’t sign out. Please try again.", "error"); }
  }
  function updateRelease(id: string, values: Partial<Release>) { setDraft(current => ({ ...current, releases: current.releases.map(r => r.id === id ? { ...r, ...values } : r) })); setDirty(true); }
  function addRelease() {
    const id = makeId();
    setDraft(current => ({ ...current, releases: [{ id, title: "Your new release", artist: current.brandName, genre: "Hindi", image: current.heroImage, videoUrl: "", year: String(new Date().getFullYear()), featured: true }, ...current.releases] }));
    setExpandedRelease(id); setTab("music");
  }
  function moveRelease(index: number, direction: number) { const releases = [...draft.releases]; const destination = index + direction; if (destination < 0 || destination >= releases.length) return; [releases[index], releases[destination]] = [releases[destination], releases[index]]; update("releases", releases); }
  function updatePhoto(id: string, values: Partial<GalleryItem>) { setDraft(current => ({ ...current, gallery: current.gallery.map(p => p.id === id ? { ...p, ...values } : p) })); setDirty(true); }
  function addPhoto(asset?: Asset) {
    if (asset) { acceptAsset(asset); return; }
    setDraft(current => ({ ...current, gallery: [{ id: makeId(), title: "A new moment", category: "Posters", image: current.aboutImage }, ...current.gallery] }));
  }
  async function toggleRead(inquiry: Inquiry) {
    try { await requestJson("/api/inquiries", "PATCH", { id: inquiry.id, isRead: !inquiry.isRead }); setInquiries(list => list.map(i => i.id === inquiry.id ? { ...i, isRead: !i.isRead } : i)); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn’t update enquiry.", "error"); }
  }
  async function deleteInquiry(id: string) {
    try { await requestJson("/api/inquiries", "DELETE", { id }); setInquiries(list => list.filter(i => i.id !== id)); toast("Enquiry deleted."); }
    catch (e) { toast(e instanceof Error ? e.message : "Couldn’t delete enquiry.", "error"); }
  }
  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) { toast("Your new passwords don’t match.", "error"); return; }
    setChangingPassword(true);
    try { await requestJson("/api/auth", "POST", { mode: "change", password: currentPassword, newPassword }); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); toast("Password updated. Other sessions have been signed out."); }
    catch (error) { toast(error instanceof Error ? error.message : "Couldn’t change password.", "error"); }
    finally { setChangingPassword(false); }
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try { if (file.size > 2 * 1024 * 1024) throw new Error("Choose a website backup under 2 MB."); const content = validateContent(JSON.parse(await file.text())); setDraft(content); setDirty(true); toast("Backup restored. Your website is updating automatically."); }
    catch (e) { toast(e instanceof Error ? e.message : "This backup could not be opened.", "error"); }
    if (backupRef.current) backupRef.current.value = "";
  }
  if (auth.loading) return <div className="studio-loading"><img src="/images/hansa-logo.svg" alt="Hansa Music" /><span className="loader" /><p>Opening your creative space…</p></div>;
  if (authError) return <div className="studio-loading"><Icon name="refresh" size={36} /><h2>Your studio needs a moment.</h2><p role="alert">{authError}</p><button className="button button-primary" onClick={checkAuth}>Try again</button><Link href="/" className="text-link">Back to website<Icon name="arrowLeft" size={16} /></Link></div>;
  if (!auth.authenticated) return <AuthScreen configured={auth.configured} onConfigured={() => setAuth(current => ({ ...current, configured: true }))} onSuccess={async () => { setAuth({ configured: true, authenticated: true, loading: false }); try { editor.loadContent(await requestJson<SiteContent>("/api/site")); } catch { /* initial content remains available */ } }} />;

  return <div className="studio-app" style={{ "--accent": draft.accentColor } as CSSProperties}>
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setSidebarOpen(false)} />}
    <aside className={`studio-sidebar ${sidebarOpen ? "open" : ""}`}><button className="brand brand-preview-button" onClick={() => viewWebsite()}><img src={draft.logoUrl || "/images/hansa-logo.svg"} alt={draft.brandName} /><span><strong>{draft.brandName}</strong><small>YOUR CREATOR STUDIO</small></span></button><p className="sidebar-group-title">MAKE IT YOURS</p><nav aria-label="Editor navigation">{tabs.slice(0, 6).map(t => <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => navigate(t.id)}><Icon name={t.icon} size={18} />{t.name}{tab === t.id && <span className="nav-active-dot" />}</button>)}</nav><p className="sidebar-group-title">MANAGE YOUR WORLD</p><nav aria-label="Manage website">{tabs.slice(6).map(t => <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => navigate(t.id)}><Icon name={t.icon} size={18} />{t.name}{t.id === "inquiries" && unread > 0 && <span className="inbox-count">{unread}</span>}</button>)}</nav><div className="sidebar-help"><Icon name="sparkle" size={20} /><strong>No code. No limits.</strong><p>Badlein. Upload karein.<br />Apni website ko apna banayein.</p><button className="button button-outline help-entry-button" onClick={() => navigate("help")}><Icon name="globe" size={15} />Step-by-step help</button></div><button className="logout-button" onClick={() => dirty ? setConfirmation({ title: "Leave without saving?", message: "Your unpublished changes will be lost. You can save them first using Save changes.", action: () => { logout(); setConfirmation(null); } }) : logout()}><Icon name="logout" size={17} />Sign out</button></aside>
    <div className="studio-workspace"><header className="studio-topbar"><div className="studio-breadcrumb"><button className="icon-button studio-menu-button" aria-label="Open editor navigation" onClick={() => setSidebarOpen(true)}><Icon name="menu" /></button><span>Your website</span><Icon name="chevronRight" size={13} /><strong>{activeTab.name}</strong></div><div className="studio-topbar-actions"><span className={editor.error ? "save-indicator save-failed" : dirty ? "save-indicator unsaved" : "save-indicator"} role="status"><i />{saving ? "Saving changes…" : editor.error ? "Not saved · retry below" : dirty ? "Auto-saving shortly…" : lastSaved ? `Saved & verified · ${lastSaved}` : "Auto-save is on"}</span><button className="button button-outline preview-button" onClick={() => viewWebsite()} disabled={openingPreview}><Icon name="eye" size={15} />{openingPreview ? "Opening…" : "View website"}</button><button className="button button-primary" disabled={saving} onClick={save}><Icon name="check" size={16} />{saving ? "Saving…" : "Save changes"}</button></div></header>
    <main className="studio-main"><div className="studio-page-title"><div><p className="section-label">YOUR CREATIVE CONTROL ROOM</p><h1>{tab === "overview" ? "Welcome to your studio." : activeTab.name}</h1><p>{tab === "overview" ? "Naam, rang, photo ya video — sab kuch yahin se badlein." : activeTab.description}</p></div><span className={`live-site-badge ${deployment.productionConfigured ? "" : "preview"}`} title="This is deployment configuration, not an external public-access test."><i />{deployment.productionConfigured ? "Hosting configured" : "Preview mode"}</span></div>
      <div className={`autosave-banner ${editor.error ? "has-error" : ""}`}>
        <Icon name={editor.error ? "message" : saving || dirty ? "refresh" : "checkCircle"} size={18} />
        <div><strong>{editor.error ? "Changes not saved yet" : saving ? "Saving your latest changes…" : dirty ? "Changes ready to save" : "Auto-save is on"}</strong><p>{editor.error || (activeUploads ? "Upload complete hote hi photo/video automatically save ho jayega." : dirty ? "Ek second rukhein—naam, colour aur media automatically save honge." : "Badlav is app mein save honge. Public launch ke steps Help & go live mein hain.")}</p>{lastSaved && !dirty && !saving && !editor.error && <small className="autosave-confirmed"><Icon name="check" size={13} />Server verified · Saved at {lastSaved}</small>}</div>
        {editor.error && <button className="button button-outline" onClick={() => editor.errorStatus === 401 ? setReauth(true) : editor.retry()}>{editor.errorStatus === 401 ? "Sign in again" : "Retry save"}</button>}
        <button className="inline-preview-link" onClick={() => viewWebsite()}><Icon name="eye" size={17} /><span>Preview yahin dekhein</span></button>
      </div>
      {editor.recovered && <div className="draft-recovery" role="status"><p>Unsaved changes from your previous visit are available on this device.</p><button className="button button-primary" onClick={editor.restoreDraft}>Restore my changes</button><button className="text-link" onClick={editor.discardRecovery}>Discard old draft</button></div>}
      {notice && <div className={`studio-notice ${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"}><Icon name={notice.kind === "error" ? "message" : "checkCircle"} size={18} /><p>{notice.text}</p><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><Icon name="x" size={16} /></button></div>}

      {recentUpload && <div className={`recent-upload-confirmation ${fileIsPublished(recentUpload.url) ? "verified" : "pending"}`} role="status"><Icon name={fileIsPublished(recentUpload.url) ? "checkCircle" : "upload"} size={22} /><div><strong>{recentUpload.filename}</strong><p>{fileIsPublished(recentUpload.url) ? "Server verified — website par dikh raha hai." : editor.error ? "File uploaded, lekin website changes abhi publish nahi hue. Upar error dekhein aur Retry save dabayein." : dirty || saving ? "File uploaded. Website par publish kiya ja raha hai…" : "File library mein saved hai. Website par dikhane ke liye Add to website use karein."}</p></div><button className="button button-primary" onClick={() => viewWebsite(recentUpload.section)} disabled={openingPreview || saving}>{openingPreview ? "Opening…" : "Website par dekhein"}<Icon name="arrowRight" size={15} /></button></div>}
      {tab === "overview" && <>
        <section className="quick-publish-panel"><div><span className="section-label">SABSE AASAN TAREEKA</span><h2>Upload karein. Website par dekhein.</h2><p>Photo/poster gallery mein, video music section mein, aur PDF/audio/other files downloads mein—automatically.</p></div><div className="quick-publish-actions"><UploadButton multiple all onUpload={asset => acceptAsset(asset)}>Upload & show on website</UploadButton><button className="button button-outline" onClick={() => navigate("gallery")}><Icon name="image" size={16} />Manage posters</button></div><div className="quick-identity-fields">{textField("brandName", "Website / company name")}{textField("heroTitle", "Main headline")}</div></section>
        <div className="studio-welcome-banner"><div><span>LET’S MAKE THIS FEEL LIKE YOU.</span><h2>Big ideas.<br /><em>Simple edits.</em></h2><p>Everything you need to manage your website.<br />No coding, no complicated tools.</p><button className="button button-primary" onClick={() => navigate("brand")}>Start with your brand<Icon name="arrowUpRight" size={17} /></button></div><div className="welcome-record"><div className="vinyl-disc"><img src={draft.logoUrl} alt={draft.brandName} /></div><span>YOUR NEXT CHAPTER<br />STARTS HERE.</span></div></div>
        <div className="studio-stats"><button onClick={() => navigate("music")}><span className="stat-icon"><Icon name="disc" size={22} /></span><span><strong>{draft.releases.length.toString().padStart(2, "0")}</strong><small>Music releases</small></span><Icon name="arrowUpRight" size={18} /></button><button onClick={() => navigate("gallery")}><span className="stat-icon"><Icon name="image" size={22} /></span><span><strong>{draft.gallery.length.toString().padStart(2, "0")}</strong><small>Gallery moments</small></span><Icon name="arrowUpRight" size={18} /></button><button onClick={() => navigate("inquiries")}><span className="stat-icon"><Icon name="inbox" size={22} /></span><span><strong>{unread.toString().padStart(2, "0")}</strong><small>Unread enquiries</small></span><Icon name="arrowUpRight" size={18} /></button></div>
        <div className="overview-columns"><Panel title="What would you like to create?" description="Choose a section to start editing."><div className="quick-edit-grid">{tabs.slice(1, 6).map(t => <button key={t.id} onClick={() => navigate(t.id)}><Icon name={t.icon} size={21} /><span><strong>{t.name}</strong><small>{t.description}</small></span><Icon name="chevronRight" size={15} /></button>)}</div></Panel><Panel title="Three steps. All yours." description="It really is this simple."><ol className="getting-started"><li><span>01</span><div><strong>Make a change</strong><p>Text likhein, colour chunein, ya apni photo upload karein.</p></div></li><li><span>02</span><div><strong>It saves automatically</strong><p>Server verified ka wait karein. Yeh current app mein save hai; public launch ke steps Help & go live mein hain.</p></div></li><li><span>03</span><div><strong>Check the live result</strong><p>“View website” dabayein. Naya tab nahi khulega—saved website yahin dikhegi.</p></div></li></ol><div className="starter-note"><Icon name="image" size={19} /><p>Sample artwork is included to get you started. Replace it with your own logo, release covers and studio photos before sharing.</p></div></Panel></div>
      </>}

      {tab === "brand" && <div className="editor-two-columns"><div><Panel title="The name behind the music" description="Aapka naam aur tagline, website par har jagah.">{textField("brandName", "Brand name")}{textField("brandTagline", "Brand tagline", "Keep it short. This appears below your name.")}{textField("footerText", "Footer message")}</Panel><Panel title="Your signature colours" description="Choose a colour. Make it instantly yours."><div className="colour-setting"><label htmlFor="accent-colour">Accent colour</label><div className="colour-control"><input id="accent-colour" type="color" value={draft.accentColor} onChange={e => update("accentColor", e.target.value)} /><span>{draft.accentColor.toUpperCase()}</span></div><div className="colour-swatches">{["#f5d44b", "#ef9d65", "#f58e8e", "#b8a0f4", "#96d8b3", "#8cc6eb"].map(colour => <button key={colour} aria-label={`Use ${colour} accent`} aria-pressed={draft.accentColor === colour} style={{ background: colour }} onClick={() => update("accentColor", colour)}>{draft.accentColor === colour && <Icon name="check" size={17} />}</button>)}</div></div><div className="colour-setting"><label htmlFor="background-colour">Page background</label><div className="colour-control"><input id="background-colour" type="color" value={draft.backgroundColor} onChange={e => update("backgroundColor", e.target.value)} /><span>{draft.backgroundColor.toUpperCase()}</span></div><small>Dark backgrounds work best with this website’s light text.</small></div><div className="brand-live-preview" style={{ background: draft.backgroundColor }}><span style={{ color: draft.accentColor }}>A LITTLE PREVIEW</span><h3>{draft.brandName}</h3><p>{draft.footerText}</p><span className="preview-colour-button" style={{ background: draft.accentColor }}>Your signature style <Icon name="arrowUpRight" size={16} /></span></div></Panel></div><Panel title="Your logo" description="Apna original logo upload karein. A square PNG works beautifully."><ImageUpload label="Company logo" value={draft.logoUrl} onChange={value => update("logoUrl", value)} /><p className="editor-tip"><Icon name="sparkle" size={16} />Tip: use a clear, high-resolution version of your logo. The starter swan logo can be replaced here.</p></Panel></div>}

      {tab === "homepage" && <><div className="editor-two-columns"><Panel title="Your first impression" description="This is the first thing visitors see.">{textField("heroEyebrow", "Small intro line")}{textField("heroTitle", "Main headline")}{textField("heroAccent", "Highlighted headline", "This line uses your accent colour.")}{textField("heroDescription", "Homepage introduction", "Line breaks are supported.", true)}<div className="studio-field-group"><h4>Three little highlights</h4>{draft.heroNotes.map((note, index) => <TextField key={index} label={`Highlight ${index + 1}`} value={note} onChange={value => update("heroNotes", draft.heroNotes.map((text, i) => i === index ? value : text))} />)}</div></Panel><Panel title="The hero visual" description="A wide, landscape image works best. Keep the main subject on the right."><ImageUpload label="Homepage cover photo" value={draft.heroImage} onChange={value => update("heroImage", value)} /><p className="editor-tip"><Icon name="image" size={16} />Recommended: at least 1600 × 900 px. A dark photo keeps your headline easy to read.</p></Panel></div><div className="editor-two-columns"><Panel title="Your story" description="Tell visitors about the people and passion behind your music.">{textField("aboutTitle", "About section headline", undefined, true)}{textField("aboutText", "Your company story", "Leave a blank line to create a new paragraph.", true)}</Panel><Panel title="Your creative space"><ImageUpload label="About / office photo" value={draft.aboutImage} onChange={value => update("aboutImage", value)} /></Panel></div><Panel title="Section headlines" description="Give each part of your website its own personality."><div className="field-grid">{textField("musicTitle", "Music section title")}{textField("musicDescription", "Music section description")}{textField("videoTitle", "Video section title")}{textField("galleryTitle", "Gallery section title")}</div></Panel></>}

      {tab === "music" && <><div className="editor-action-bar"><p><strong>{draft.releases.length} releases</strong> · Covers, titles, video links — everything is editable.</p><button className="button button-primary" onClick={addRelease}><Icon name="plus" size={17} />Add a release</button></div><div className="editor-info-strip"><Icon name="video" size={19} /><p>Paste a YouTube, Vimeo, Instagram or other public video link, or upload a video. Large files upload in resumable parts. The first three featured releases appear in the video section. Use the arrows to change their order.</p></div><div className="release-editor-list">{draft.releases.map((release, index) => <section className={`release-editor-card ${expandedRelease === release.id ? "expanded" : ""}`} key={release.id}><div className="release-editor-top"><button className="release-expand" onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)} aria-expanded={expandedRelease === release.id}><img src={release.image || draft.heroImage} alt={release.title} /><span><strong>{release.title || "Untitled release"}</strong><small>{release.genre} · {release.year}{release.featured ? " · Featured" : ""}</small></span><span className={`video-status ${release.videoUrl ? "ready" : ""}`}>{release.videoUrl ? "Video linked" : "Add your video"}</span></button><div className="release-row-actions"><button className="icon-button" aria-label={`Move ${release.title} up`} disabled={index === 0} onClick={() => moveRelease(index, -1)}><Icon name="arrowUp" size={14} /></button><button className="icon-button" aria-label={`Move ${release.title} down`} disabled={index === draft.releases.length - 1} onClick={() => moveRelease(index, 1)}><Icon name="arrowUp" size={14} style={{ transform: "rotate(180deg)" }} /></button><button className="icon-button danger-icon" aria-label={`Delete ${release.title}`} onClick={() => setConfirmation({ title: `Remove “${release.title}”?`, message: "This release will be removed from your draft. Changes will save automatically on confirmation. Uploaded files stay in your media library.", action: () => { update("releases", draft.releases.filter(r => r.id !== release.id)); setConfirmation(null); } })}><Icon name="trash" size={15} /></button><button className="icon-button" aria-label={`Edit ${release.title}`} onClick={() => setExpandedRelease(expandedRelease === release.id ? null : release.id)}><Icon name="chevronDown" size={17} /></button></div></div>{expandedRelease === release.id && <div className="release-editor-body"><ImageUpload label="Release cover" value={release.image} onChange={value => updateRelease(release.id, { image: value })} /><div><div className="field-grid"><TextField label="Release title" value={release.title} onChange={value => updateRelease(release.id, { title: value })} /><TextField label="Artist / credits" value={release.artist} onChange={value => updateRelease(release.id, { artist: value })} /><label className="studio-field"><span>Genre / language</span><input list="music-genres" value={release.genre} onChange={e => updateRelease(release.id, { genre: e.target.value })} /></label><TextField label="Release year" value={release.year} onChange={value => updateRelease(release.id, { year: value })} /></div><TextField label="Video / website link" value={release.videoUrl} onChange={value => updateRelease(release.id, { videoUrl: value })} placeholder="https://www.youtube.com/watch?v=…" hint="YouTube/Vimeo videos play here. Other links open on their original platform. Links without https:// are accepted." /><div className="video-upload-row"><UploadButton video onUpload={asset => updateRelease(release.id, { videoUrl: asset.url })}>Or upload a video</UploadButton><small>MP4 / MOV / WebM · resumable uploads up to 2 GB</small></div><label className="checkbox-field"><input type="checkbox" checked={release.featured} onChange={e => updateRelease(release.id, { featured: e.target.checked })} /><span>Feature in the video section</span></label></div></div>}</section>)}</div><datalist id="music-genres"><option value="Haryanvi" /><option value="Punjabi" /><option value="Hindi" /><option value="Devotional" /><option value="Folk" /><option value="Indie" /></datalist>{draft.releases.length === 0 && <div className="empty-state"><Icon name="disc" size={35} /><h3>Your first release belongs here.</h3><p>Add a title, upload a cover and paste your video link.</p><button className="button button-primary" onClick={addRelease}><Icon name="plus" size={17} />Add a release</button></div>}</>}

      {tab === "gallery" && <><div className="editor-action-bar"><p><strong>{draft.gallery.length} moments</strong> · Your studio, your team, your latest posters.</p><div><UploadButton multiple onUpload={asset => addPhoto(asset)}>Upload photos</UploadButton><button className="button button-primary" onClick={() => addPhoto()}><Icon name="plus" size={16} />Add by link</button></div></div><div className="editor-info-strip"><Icon name="image" size={19} /><p>JPG/PNG posters aur photos upload karein. Naya poster gallery mein sabse pehle dikhai dega. PDF, audio ya other file ke liye Your studio ka “Upload & show on website” use karein.</p></div><div className="gallery-editor-grid">{draft.gallery.map((photo, index) => <section className="studio-panel gallery-editor-card" key={photo.id}><div className="gallery-editor-top"><span>PHOTO {String(index + 1).padStart(2, "0")}</span><button className="icon-button danger-icon" aria-label={`Remove ${photo.title}`} onClick={() => setConfirmation({ title: "Remove this photo?", message: "It will be removed from your gallery and saved automatically. The uploaded original stays in your media library.", action: () => { update("gallery", draft.gallery.filter(p => p.id !== photo.id)); setConfirmation(null); } })}><Icon name="trash" size={15} /></button></div><ImageUpload compact label="Gallery image" value={photo.image} onChange={value => updatePhoto(photo.id, { image: value })} /><TextField label="Photo title" value={photo.title} onChange={value => updatePhoto(photo.id, { title: value })} /><label className="studio-field"><span>Category</span><input list="gallery-categories" value={photo.category} onChange={e => updatePhoto(photo.id, { category: e.target.value })} /></label></section>)}</div><datalist id="gallery-categories"><option value="Our studio" /><option value="Behind the scenes" /><option value="Posters" /><option value="Our team" /><option value="Events" /></datalist>{draft.gallery.length === 0 && <div className="empty-state"><Icon name="image" size={35} /><h3>A blank canvas for your moments.</h3><p>Upload your first photo to get started.</p></div>}</>}

      {tab === "contact" && <><div className="editor-two-columns"><Panel title="Say hello, your way" description="Keep your contact details up to date.">{textField("contactTitle", "Contact section headline", undefined, true)}{textField("contactDescription", "A welcome message", undefined, true)}{textField("email", "Public email address", "Optional. Leave blank to hide it.", false, "hello@yourcompany.com")}{textField("phone", "Phone number", "Optional. Include your country code.", false, "+91 …")}{textField("whatsapp", "WhatsApp number", "Include country code, e.g. 91 followed by your 10-digit number. Leave blank to hide the chat button.")}{textField("officeHours", "Studio hours / visiting note")}</Panel><div><Panel title="Put your studio on the map" description="Address aur location, bina kisi coding ke.">{textField("address", "Studio address", "Use a new line for each part of your address.", true)}{textField("mapQuery", "Map location", "Enter your full address or a recognisable landmark.")}<button className="button button-outline" onClick={() => setMapPreview(draft.mapQuery)}><Icon name="pin" size={16} />Preview map</button><div className="studio-map-preview"><iframe title="Preview studio location" src={`https://maps.google.com/maps?q=${encodeURIComponent(mapPreview)}&z=15&output=embed`} loading="lazy" /></div><p className="editor-tip">The default map shows the Mother Dairy / Pandav Nagar area. Add your exact address for more precise directions.</p></Panel><Panel title="Stay connected" description="Paste your own profiles. Leave blank to hide a social icon.">{textField("youtubeUrl", "YouTube channel link", undefined, false, "https://www.youtube.com/@yourchannel")}{textField("instagramUrl", "Instagram profile link", undefined, false, "https://www.instagram.com/yourprofile")}{textField("facebookUrl", "Facebook page link", undefined, false, "https://www.facebook.com/yourpage")}</Panel></div></div></>}

      {tab === "library" && <UploadLibrary assets={assets} loading={assetsLoading} error={assetsError} content={draft} onUpload={acceptAsset} onPublish={publishAsset} onHero={url => { update("heroImage", url); setRecentUpload({ filename: "Homepage photo", url, section: "home" }); }} onReload={loadAssets} onFileChange={renameFile} onRemoveFile={id => setConfirmation({ title: "Remove this download from the website?", message: "The file stays in your library. Only its public website card will be removed.", action: () => { removeFile(id); setConfirmation(null); } })} onView={section => { void viewWebsite(section); }} />}

      {tab === "inquiries" && <><div className="editor-action-bar"><p><strong>{inquiries.length} conversations</strong> · {unread} unread</p><div><button className="button button-outline" onClick={loadInquiries} disabled={inboxLoading}><Icon name="refresh" size={15} />Refresh</button><button className="button button-outline" disabled={!inquiries.length} onClick={() => { const rows = [["Name", "Email", "Phone", "Interest", "Message", "Date"], ...inquiries.map(i => [i.name, i.email, i.phone, i.interest, i.message, i.createdAt])]; downloadFile("hansa-enquiries.csv", rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv;charset=utf-8"); }}><Icon name="download" size={15} />Export</button></div></div>{inboxError && <p className="form-error" role="alert">{inboxError}</p>}{inboxLoading ? <div className="studio-inline-loading"><span className="loader" />Checking your inbox…</div> : <div className="inquiries-list">{inquiries.map(inquiry => <article className={`inquiry-card ${inquiry.isRead ? "" : "unread"}`} key={inquiry.id}><div className="inquiry-top"><span className="inquiry-avatar">{inquiry.name.charAt(0).toUpperCase()}</span><div><h3>{inquiry.name}{!inquiry.isRead && <span>NEW</span>}</h3><a href={`mailto:${inquiry.email}`}>{inquiry.email}</a>{inquiry.phone && <a href={`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`}>{inquiry.phone}</a>}</div><time dateTime={inquiry.createdAt}>{new Date(inquiry.createdAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</time></div><span className="inquiry-interest">{inquiry.interest}</span><p className="inquiry-message">{inquiry.message}</p><div className="inquiry-actions"><a className="button button-outline" href={`mailto:${inquiry.email}?subject=${encodeURIComponent(`Re: Your ${draft.brandName} enquiry`)}`}><Icon name="mail" size={14} />Reply by email</a><button className="text-link" onClick={() => toggleRead(inquiry)}><Icon name={inquiry.isRead ? "inbox" : "checkCircle"} size={16} />{inquiry.isRead ? "Mark unread" : "Mark as read"}</button><button className="icon-button danger-icon" aria-label={`Delete enquiry from ${inquiry.name}`} onClick={() => setConfirmation({ title: "Delete this enquiry?", message: "This permanently removes the message from your inbox. This action cannot be undone.", action: () => { deleteInquiry(inquiry.id); setConfirmation(null); } })}><Icon name="trash" size={15} /></button></div></article>)}</div>}{!inboxLoading && !inquiries.length && <div className="empty-state"><Icon name="inbox" size={36} /><h3>Good conversations are on their way.</h3><p>Messages sent from your website’s contact form appear here.<br />Share your website to get the conversation started.</p><button className="button button-outline" onClick={() => viewWebsite("contact")}>View contact form<Icon name="eye" size={16} /></button></div>}</>}

      {tab === "settings" && <div className="editor-two-columns"><Panel title="Keep your studio secure" description="Change the password you use to edit your website."><form onSubmit={changePassword}><label className="studio-field"><span>Current password</span><input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="current-password" /></label><label className="studio-field"><span>New password</span><input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /><small>At least 8 characters. Use something unique.</small></label><label className="studio-field"><span>Confirm new password</span><input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required minLength={8} maxLength={128} autoComplete="new-password" /></label><button className="button button-primary" disabled={changingPassword} type="submit"><Icon name="lock" size={15} />{changingPassword ? "Updating…" : "Update password"}</button></form><p className="editor-tip"><Icon name="shield" size={17} />Changing your password signs out other devices. Your current session stays active.</p></Panel><div><Panel title="A backup for peace of mind" description="Download your website text, settings and media links."><p className="panel-body-text">Keep a content backup on your device. To restore it, choose your backup file. Restored content saves automatically, so download a current backup first.</p><div className="backup-actions"><button className="button button-outline" onClick={() => { downloadFile(`hansa-website-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(draft, null, 2), "application/json"); toast("Your content backup has been downloaded."); }}><Icon name="download" size={16} />Download backup</button><button className="button button-outline" onClick={() => backupRef.current?.click()}><Icon name="upload" size={16} />Restore backup</button><input type="file" hidden ref={backupRef} accept="application/json,.json" onChange={e => importBackup(e.target.files?.[0])} /></div><p className="editor-tip">Backups include content and file links, not original media files or enquiries. Keep your original photos and videos too.</p></Panel><Panel title="Start fresh" description="Want to go back to the original design?"><p className="panel-body-text">Restore the starter content in your editor. Your media library, password and enquiries will not be deleted.</p><button className="button button-outline" onClick={() => setConfirmation({ title: "Restore the starter content?", message: "This restores the original sample content and saves it automatically to your live website. Download a backup first if needed.", action: () => { setDraft(JSON.parse(JSON.stringify(defaultContent)) as SiteContent); setDirty(true); setConfirmation(null); toast("Starter content restored. Your live website is updating automatically."); } })}><Icon name="refresh" size={15} />Restore starter content</button></Panel></div></div>}
      {tab === "help" && <HelpGuide deployment={deployment} onNavigate={navigate} />}
      <p className="upload-storage-note">Any non-empty file can be uploaded, up to 2 GB per file on this host. Photos/videos/audio can be previewed; PDF, documents, ZIP and other formats are safe downloads. Device memory and available hosting storage still apply.</p>
      <div className="studio-bottom-note"><Icon name="heart" size={13} /><span>Made for your music. Managed by you.</span><span>HANSA CREATOR STUDIO</span></div>
    </main></div>
    {preview && <EditorPreview published={editor.published} draft={draft} dirty={dirty} revision={editor.receipt} section={preview.section} onClose={closePreview} onRefresh={editor.refreshPublished} />}
    {reauth && <Modal label="Sign in to save your changes" onClose={() => setReauth(false)} className="session-modal"><SessionUnlock onSuccess={() => { setReauth(false); editor.retry(); }} /></Modal>}
    {confirmation && <Modal label={confirmation.title} onClose={closeConfirmation} className="confirmation-modal"><span className="confirmation-icon"><Icon name="message" size={27} /></span><h2>{confirmation.title}</h2><p>{confirmation.message}</p><div><button className="button button-outline" onClick={closeConfirmation}>Cancel</button><button className="button button-primary" onClick={confirmation.action}>Yes, continue<Icon name="arrowRight" size={16} /></button></div></Modal>}
  </div>;
}
