"use client";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icons";
import { Modal } from "./modal";
import { ReleasePlayer } from "./release-player";
import { WebsiteFiles } from "./website-files";
import { requestJson } from "@/lib/api-client";
import { type Release, type SiteContent } from "@/lib/site-data";

const navigation = [{ name: "Home", id: "home" }, { name: "Our Music", id: "music" }, { name: "Videos", id: "videos" }, { name: "Gallery", id: "gallery" }, { name: "About Us", id: "about" }];

function SectionLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <p className={`section-label${light ? " light" : ""}`}><span />{children}</p>;
}
function Equalizer({ small = false }: { small?: boolean }) {
  return <span className={`equalizer ${small ? "small" : ""}`} aria-hidden="true">{[35, 65, 45, 100, 65, 85, 40].map((h, i) => <i key={i} style={{ height: `${h}%`, animationDelay: `${i * .13}s` }} />)}</span>;
}
function SocialLinks({ content }: { content: SiteContent }) {
  const links: { name: string; url: string; icon: IconName }[] = [{ name: "YouTube", url: content.youtubeUrl, icon: "youtube" }, { name: "Instagram", url: content.instagramUrl, icon: "instagram" }, { name: "Facebook", url: content.facebookUrl, icon: "facebook" }];
  return <div className="social-links">{links.filter(l => l.url).map(l => <a key={l.name} href={l.url} target="_blank" rel="noopener noreferrer" aria-label={`${content.brandName} on ${l.name}`}><Icon name={l.icon} size={19} /></a>)}</div>;
}
function ContactForm({ preview = false }: { preview?: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (preview) { setError("Yeh preview hai. Enquiry bhejne ke liye main website kholein."); setStatus("error"); return; }
    const data = Object.fromEntries(new FormData(event.currentTarget));
    setStatus("sending");
    try {
      await requestJson("/api/inquiries", "POST", data);
      setStatus("success");
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to send your message."); setStatus("error"); }
  }
  if (status === "success") return <div className="contact-success" role="status"><span className="success-mark"><Icon name="check" size={30} /></span><p className="section-label">MESSAGE RECEIVED</p><h3>You’re on our radar.</h3><p>Thanks for reaching out! Your message is now in our inbox. We’ll use the contact details you shared to get back to you.</p><button className="button button-outline" onClick={() => setStatus("idle")}>Send another message <Icon name="arrowRight" size={17} /></button></div>;
  return <form className="contact-form" onSubmit={send}>
    <div className="form-heading"><h3>Tell us what’s on your mind.</h3><Icon name="arrowUpRight" size={24} /></div>
    <div className="form-row"><label>Your name <span>*</span><input name="name" placeholder="What should we call you?" required minLength={2} maxLength={100} autoComplete="name" /></label><label>Email address <span>*</span><input name="email" type="email" placeholder="you@example.com" required maxLength={254} autoComplete="email" /></label></div>
    <div className="form-row"><label>Phone <span className="optional">(optional)</span><input name="phone" type="tel" placeholder="+91" maxLength={30} autoComplete="tel" /></label><label>I’m interested in<select name="interest" defaultValue="Music collaboration"><option>Music collaboration</option><option>Music production</option><option>Video production</option><option>General enquiry</option></select></label></div>
    <label>Your idea <span>*</span><textarea name="message" placeholder="A song, a collaboration, a big idea… tell us a little about it." rows={4} required minLength={10} maxLength={4000} /></label>
    <div className="honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
    {status === "error" && <p className="form-error" role="alert">{error}</p>}
    <div className="form-bottom"><p>A great collaboration starts<br />with a simple hello.</p><button className="button button-primary" disabled={status === "sending"} type="submit">{status === "sending" ? "Sending…" : "Send your message"}<Icon name="arrowUpRight" size={18} /></button></div>
    <p className="privacy-note"><Icon name="lock" size={11} /> Your details are only used to respond to your enquiry.</p>
  </form>;
}

export default function Website({ content, embeddedPreview = false }: { content: SiteContent; embeddedPreview?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeNav, setActiveNav] = useState("home");
  const [genre, setGenre] = useState("All releases");
  const [showCatalog, setShowCatalog] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("default");
  const [activeRelease, setActiveRelease] = useState<Release | null>(null);
  const [galleryCategory, setGalleryCategory] = useState("All moments");
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const [showAllGallery, setShowAllGallery] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const genres = useMemo(() => ["All releases", ...new Set(content.releases.map(r => r.genre))], [content.releases]);
  const galleryCategories = useMemo(() => ["All moments", ...new Set(content.gallery.map(i => i.category))], [content.gallery]);
  const releases = useMemo(() => {
    const list = content.releases.filter(r => (genre === "All releases" || r.genre === genre) && `${r.title} ${r.artist} ${r.genre}`.toLowerCase().includes(search.toLowerCase()));
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    if (sort === "newest") list.sort((a, b) => b.year.localeCompare(a.year));
    return showCatalog ? list : list.slice(0, 4);
  }, [content.releases, genre, search, sort, showCatalog]);
  const gallery = content.gallery.filter(i => galleryCategory === "All moments" || i.category === galleryCategory);
  const displayedGallery = showAllGallery ? gallery : gallery.slice(0, 4);
  const photo = content.gallery.find(i => i.id === activePhoto);
  const featured = content.releases.filter(r => r.featured).slice(0, 3);
  const featureVideos = featured.length ? featured : content.releases.slice(0, 3);
  const closeRelease = useCallback(() => setActiveRelease(null), []);
  const closePhoto = useCallback(() => setActivePhoto(null), []);
  const movePhoto = useCallback((direction: number) => {
    setActivePhoto(id => {
      const index = gallery.findIndex(i => i.id === id);
      return gallery[(index + direction + gallery.length) % gallery.length]?.id || null;
    });
  }, [gallery]);
  useEffect(() => {
    if (!activePhoto) return;
    const handler = (event: KeyboardEvent) => { if (event.key === "ArrowRight") movePhoto(1); if (event.key === "ArrowLeft") movePhoto(-1); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [activePhoto, movePhoto]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) setActiveNav(entry.target.id); });
    }, { rootMargin: "-15% 0px -65% 0px", threshold: 0 });
    ["home", "music", "videos", "gallery", "about", "contact"].forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);
  function watchLatest() {
    const latest = content.releases.find(r => r.videoUrl) || content.releases[0];
    if (latest) setActiveRelease(latest); else document.getElementById("videos")?.scrollIntoView({ behavior: "smooth" });
  }
  const mapQuery = encodeURIComponent(content.mapQuery || content.address);
  return <div className="website" style={{ "--accent": content.accentColor, "--page-bg": content.backgroundColor } as CSSProperties}>
    <a className="skip-link" href="#music">Skip to content</a>
    <header className="site-header"><div className="container header-inner">
      <a href="#home" className="brand" aria-label={`${content.brandName} home`}><img src={content.logoUrl || "/images/hansa-logo.svg"} alt={`${content.brandName} logo`} width="53" height="53" /><span><strong>{content.brandName}</strong><small>{content.brandTagline}</small></span></a>
      <nav className={menuOpen ? "main-nav open" : "main-nav"} aria-label="Main navigation">{navigation.map(item => <a key={item.id} href={`#${item.id}`} className={activeNav === item.id ? "active" : ""} onClick={() => setMenuOpen(false)}>{item.name}</a>)}<a href="#contact" className="mobile-contact" onClick={() => setMenuOpen(false)}>Contact</a></nav>
      <a className="button button-primary header-cta" href="#contact">Let’s talk <Icon name="arrowUpRight" size={17} /></a>
      <button className="icon-button mobile-menu" aria-label={menuOpen ? "Close menu" : "Open menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><Icon name={menuOpen ? "x" : "menu"} size={24} /></button>
    </div></header>
    <main>
      <section className="hero" id="home">
        <img className="hero-image" src={content.heroImage} alt={`${content.brandName} featured studio cover`} fetchPriority="high" />
        <div className="hero-shade" />
        <div className="container hero-inner"><div className="hero-copy">
          <div className="hero-eyebrow"><span className="live-dot" />{content.heroEyebrow}</div>
          <h1>{content.heroTitle}<br /><span>{content.heroAccent}</span></h1>
          <p className="hero-description">{content.heroDescription}</p>
          <div className="hero-actions"><a className="button button-primary" href="#music">Explore our music<Icon name="arrowUpRight" size={18} /></a><button className="button button-glass" onClick={watchLatest}><Icon name="play" size={16} />Watch latest</button></div>
          <div className="hero-notes">{content.heroNotes.map((note, i) => <span key={i}><Icon name={(["disc", "headphones", "pin"] as IconName[])[i]} size={15} />{note}</span>)}</div>
        </div>
        <div className="hero-side-note"><span>ROOTED IN INDIA</span><span className="side-note-line" /><span>HEARD EVERYWHERE</span></div>
        <button className="sound-card" onClick={watchLatest} aria-label="Discover the sound of Hansa Music"><span className="sound-icon"><Equalizer /></span><span><small>TURN IT UP. FEEL IT ALL.</small><strong>Music. Without limits.</strong></span><Icon name="arrowUpRight" size={18} /></button>
        </div>
      </section>
      <div className="genre-ribbon" aria-label="Our musical world"><div className="ribbon-content">{[...new Set(content.releases.map(r => r.genre.toUpperCase())), "INDEPENDENT & ORIGINAL"].map(g => <span key={g}><b aria-hidden="true">✳</b>{g}</span>)}</div></div>

      <section className="section music-section container" id="music">
        <div className="release-section-heading"><div className="section-heading"><div><SectionLabel>THE LATEST DROPS</SectionLabel><h2>{content.musicTitle}</h2><p>{content.musicDescription}</p></div></div><div className="release-section-actions"><button className="text-link" onClick={() => { setShowCatalog(!showCatalog); setGenre("All releases"); setSearch(""); }}>{showCatalog ? "Back to latest" : "View all releases"}<Icon name={showCatalog ? "arrowLeft" : "arrowUpRight"} size={18} /></button><div className="music-tools"><div className="filter-tabs" role="group" aria-label="Filter music by genre">{genres.map(g => <button className={genre === g ? "selected" : ""} key={g} onClick={() => setGenre(g)} aria-pressed={genre === g}>{g}</button>)}</div></div></div></div>
        {showCatalog && <div className="catalog-search"><label><Icon name="search" size={18} /><input placeholder="Search songs, artists or genres…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search music" /></label><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort releases"><option value="default">Featured order</option><option value="newest">Newest first</option><option value="title">Title A–Z</option></select><span>{releases.length} releases</span></div>}
        <div className="release-grid">{releases.map((release, i) => <button className="release-card" key={release.id} onClick={() => setActiveRelease(release)} aria-label={`Explore ${release.title}`}>
          <div className={`release-art cover-${i % 4}`}><img src={release.image || content.heroImage} alt={`${release.title} cover artwork`} loading="lazy" /><span className="cover-label">{content.brandName.toUpperCase()} PRESENTS</span><span className="genre-tag">{release.genre}</span><span className="cover-title">{release.title}</span><span className="cover-play"><Icon name="play" size={17} /></span></div>
          <div className="release-info"><h3>{release.title}</h3><Icon name="arrowUpRight" size={17} /></div><div className="release-subline"><p>{release.artist}</p><span>{release.year}</span></div>
        </button>)}</div>
        {releases.length === 0 && <div className="empty-state"><Icon name="disc" size={34} /><h3>{search ? "No matching tracks" : "A new sound is on its way."}</h3><p>{search ? "Try a different title, artist or genre." : "Check back soon for our next release."}</p>{search && <button className="button button-outline" onClick={() => { setSearch(""); setGenre("All releases"); }}>Clear filters</button>}</div>}
      </section>

      <section className="video-section section" id="videos"><div className="container">
        <div className="section-heading"><div><SectionLabel>PRESS PLAY. STAY A WHILE.</SectionLabel><h2>{content.videoTitle}</h2><p>The sights, the stories, the soul behind every sound.</p></div>{content.youtubeUrl && <a className="text-link" href={content.youtubeUrl} target="_blank" rel="noopener noreferrer"><Icon name="youtube" size={19} />Find us on YouTube<Icon name="arrowUpRight" size={17} /></a>}</div>
        {featureVideos.length > 0 ? <div className="video-grid">{featureVideos.map((release, i) => <button className={`video-card ${i === 0 ? "video-featured" : ""}`} key={release.id} onClick={() => setActiveRelease(release)} aria-label={`Watch ${release.title}`}><img src={release.image} alt={release.title} loading="lazy" /><span className="video-shade" /><span className="video-category">{release.videoUrl ? "MUSIC VIDEO" : "IN FOCUS"}</span><span className="video-play"><Icon name="play" size={i === 0 ? 27 : 20} /></span><span className="video-caption"><small>{release.genre.toUpperCase()} · {release.year}</small><strong>{release.title}</strong><span>{release.artist}</span></span><Icon name="arrowUpRight" className="video-arrow" size={20} /></button>)}</div> : <div className="empty-state"><Icon name="video" size={32} /><h3>Our next visual story is coming soon.</h3><p>Follow along for new music and behind-the-scenes moments.</p></div>}
        <div className="youtube-strip"><div><Icon name="youtube" size={23} /><p>A little more music in your feed? <span>We’re all for it.</span></p></div>{content.youtubeUrl && <a href={content.youtubeUrl} target="_blank" rel="noopener noreferrer">Join us on YouTube <Icon name="arrowUpRight" size={17} /></a>}</div>
      </div></section>

      <section className="about-section section container" id="about"><div className="about-image-wrap"><img src={content.aboutImage} alt={`${content.brandName} creative studio`} loading="lazy" /><span className="about-image-shade" /><div className="studio-label"><Icon name="pin" size={16} /><span>{content.address.split("\n")[0].toUpperCase()}</span><b>OUR ROOTS. OUR HOME.</b></div><div className="studio-sticker"><Icon name="disc" size={35} /><span>MADE OF<br /><strong>MUSIC.</strong></span></div></div><div className="about-copy"><SectionLabel>THIS IS {content.brandName.toUpperCase()}</SectionLabel><h2>{content.aboutTitle}</h2><div className="about-text">{content.aboutText.split("\n\n").map((p, i) => <p key={i}>{p}</p>)}</div><div className="about-services"><span><Icon name="mic" size={19} />Music production</span><span><Icon name="headphones" size={19} />Artist collaborations</span><span><Icon name="globe" size={19} />Digital releases</span></div><a href="#contact" className="text-link">Let’s create something together<Icon name="arrowUpRight" size={19} /></a></div></section>

      <section className="gallery-section section container" id="gallery"><div className="section-heading"><div><SectionLabel>THE PEOPLE. THE PROCESS. THE PASSION.</SectionLabel><h2>{content.galleryTitle}</h2><p>A few frames from our world of music.</p></div><button className="text-link" onClick={() => { setShowAllGallery(!showAllGallery); setGalleryCategory("All moments"); }}>{showAllGallery ? "Show highlights" : "Explore the gallery"}<Icon name="arrowUpRight" size={18} /></button></div><div className="filter-tabs gallery-filters" role="group" aria-label="Filter gallery">{galleryCategories.map(category => <button key={category} className={galleryCategory === category ? "selected" : ""} onClick={() => setGalleryCategory(category)} aria-pressed={galleryCategory === category}>{category}</button>)}</div><div className="gallery-grid">{displayedGallery.map((item, i) => <button className={`gallery-card gallery-item-${i % 4} ${/poster|पोस्टर/i.test(item.category) ? "poster-card" : ""}`} key={item.id} onClick={() => setActivePhoto(item.id)} aria-label={`View ${item.title}`}><img src={item.image} alt={item.title} loading="lazy" /><span className="gallery-overlay"><span><small>{item.category}</small><strong>{item.title}</strong></span><Icon name="plus" size={22} /></span></button>)}</div>{gallery.length === 0 && <div className="empty-state"><Icon name="image" size={30} /><h3>New moments are on their way.</h3></div>}</section>

      <WebsiteFiles files={content.files || []} />
      <section className="collaboration-banner"><div className="container collaboration-inner"><div><span className="collab-kicker">YOUR VOICE. YOUR VISION. OUR NEXT CHAPTER.</span><h2>Got a sound of your own?</h2><p>Let’s give it a place in the world.</p></div><a className="button button-dark" href="#contact">Create with {content.brandName.split(" ")[0]}<Icon name="arrowUpRight" size={19} /></a><div className="banner-record" aria-hidden="true"><span /><i /></div></div></section>

      <section className="contact-section section container" id="contact"><div className="contact-copy"><SectionLabel>GOOD THINGS START WITH A CONVERSATION.</SectionLabel><h2>{content.contactTitle}</h2><p className="contact-description">{content.contactDescription}</p><div className="contact-details"><div><span className="contact-detail-icon"><Icon name="pin" size={20} /></span><span><strong>Come say hello.</strong><p>{content.address}</p></span></div>{content.email && <div><span className="contact-detail-icon"><Icon name="mail" size={20} /></span><span><strong>Drop us a line.</strong><a href={`mailto:${content.email}`}>{content.email}</a></span></div>}{content.phone && <div><span className="contact-detail-icon"><Icon name="phone" size={20} /></span><span><strong>Let’s talk.</strong><a href={`tel:${content.phone.replace(/[^\d+]/g, "")}`}>{content.phone}</a></span></div>}<div><span className="contact-detail-icon"><Icon name="clock" size={20} /></span><span><strong>Make yourself at home.</strong><p>{content.officeHours}</p></span></div></div>{content.whatsapp && <a className="button button-outline" href={`https://wa.me/${content.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer"><Icon name="whatsapp" size={19} />Chat on WhatsApp<Icon name="arrowUpRight" size={17} /></a>}</div><ContactForm preview={embeddedPreview} /></section>
      <section className="map-section container" aria-label="Visit our Delhi studio"><div className={`map-frame ${mapOpen ? "map-is-open" : ""}`}>{mapOpen ? <iframe title={`${content.brandName} — studio area map`} src={`https://maps.google.com/maps?q=${mapQuery}&t=&z=15&ie=UTF8&iwloc=&output=embed`} referrerPolicy="no-referrer-when-downgrade" allowFullScreen /> : <><div className="map-area-label"><span>OUR LITTLE CORNER OF DELHI</span><strong>{content.address.split("\n")[0]}</strong></div><button className="map-load-button" onClick={() => setMapOpen(true)}><Icon name="pin" size={18} />Load interactive map<Icon name="arrowUpRight" size={15} /></button></>}<div className="map-card"><span className="map-pin"><Icon name="pin" size={23} /></span><div><strong>Find your way to the music.</strong><p>{content.address.split("\n")[0]}</p><span>{mapOpen ? "Area location · Contact us for exact directions" : "Illustrative area preview · Open map for live directions"}</span></div><a href={`https://www.google.com/maps/dir/?api=1&destination=${mapQuery}`} target="_blank" rel="noopener noreferrer" className="button button-primary">Get directions<Icon name="arrowUpRight" size={17} /></a></div></div></section>
    </main>
    <footer className="site-footer"><div className="container"><div className="footer-main"><div className="footer-brand"><a className="brand" href="#home"><img src={content.logoUrl || "/images/hansa-logo.svg"} alt={`${content.brandName} logo`} width="52" height="52" /><span><strong>{content.brandName}</strong><small>{content.brandTagline}</small></span></a><p>{content.footerText}</p><SocialLinks content={content} /></div><div className="footer-links"><span>EXPLORE</span><a href="#music">Our music</a><a href="#videos">Music videos</a><a href="#gallery">The gallery</a></div><div className="footer-links"><span>LET’S CONNECT</span><a href="#about">Our story</a><a href="#contact">Collaborate with us</a><a href="#contact">Visit our studio</a></div><div className="footer-note"><Equalizer /><p>From Delhi,<br /><strong>with a whole lot of soul.</strong></p><span>INDIA → EVERYWHERE</span></div></div><div className="footer-bottom"><p>© {new Date().getFullYear()} {content.brandName}. All rights reserved.</p><span>Made for the love of music. <Icon name="heart" size={12} /></span><a href="#home">Back to top<Icon name="arrowUp" size={15} /></a></div></div></footer>
    {!embeddedPreview && <Link href="/studio" className="edit-site-button"><Icon name="edit" size={15} /><span>Edit / upload</span><span className="editor-dot" /></Link>}
    {activeRelease && <Modal label={activeRelease.title} onClose={closeRelease} className="release-modal"><div className="release-player"><ReleasePlayer key={activeRelease.id + activeRelease.videoUrl} release={activeRelease} /></div><div className="player-caption"><div><h3>{activeRelease.title}</h3><p>{activeRelease.artist} · {activeRelease.genre} · {activeRelease.year}</p></div>{activeRelease.videoUrl && !activeRelease.videoUrl.startsWith("/") ? <a className="text-link" href={activeRelease.videoUrl} target="_blank" rel="noopener noreferrer">Open original<Icon name="arrowUpRight" size={17} /></a> : content.youtubeUrl && <a className="text-link" href={content.youtubeUrl} target="_blank" rel="noopener noreferrer">Find us on YouTube<Icon name="arrowUpRight" size={17} /></a>}</div></Modal>}
    {photo && <Modal label={photo.title} onClose={closePhoto} className="gallery-modal"><img src={photo.image} alt={photo.title} className="lightbox-image" /><div className="lightbox-caption"><div><span>{photo.category}</span><h3>{photo.title}</h3></div><div className="lightbox-navigation"><button className="icon-button" aria-label="Previous photo" onClick={() => movePhoto(-1)}><Icon name="chevronLeft" /></button><span>{gallery.findIndex(i => i.id === photo.id) + 1} / {gallery.length}</span><button className="icon-button" aria-label="Next photo" onClick={() => movePhoto(1)}><Icon name="chevronRight" /></button></div></div></Modal>}
  </div>;
}
