# Hansa Music — bina coding daily use aur public launch

## Sabse pehle: preview aur public live alag hain

Is project ka working preview public production hosting ka proof nahi hai. Protected chat/sandbox URLs temporary ya access-restricted ho sakte hain. **Server verified** ka matlab current app ke database mein content saved aur read-back verified hai. Isse domain ya hosting automatically deploy nahi hoti.

Daily editing/uploading ke liye coding nahi chahiye. First public launch ke liye hosting, persistent database, owner password aur optionally domain/DNS setup chahiye. Is repository mein Render Blueprint aur deployment preparation ready hai; kisi hosting account mein paid resources create nahi kiye gaye hain.

## 1. Website ko roz kaise manage karein

1. Website ke **Edit / upload** button se editor kholein.
2. Existing editor password se sign in karein.
3. **Your studio → Upload & show on website** se files choose karein.
4. JPG/JPEG/PNG posters **Gallery** mein, videos **Music** mein, aur audio/PDF/ZIP/documents/other files **Downloads** mein jayengi.
5. Upload ke baad **Server verified** confirmation ka intezaar karein. File upload 100% hona publish complete hone ka proof nahi.
6. **Website par dekhein / View website** se saved result same-screen preview mein check karein.
7. **Brand & colours**: company name, logo, colours.
8. **Homepage & story**: large headline, introduction, hero/office photos.
9. **Music & videos**: release title, artist, genre, cover and public video link. YouTube/Vimeo videos embed ho sakte hain; other platforms apne original page par khulte hain.
10. **Photos & posters**: photo title, category, replacement and removal.
11. **Media library**: upload destination choose karein. Library-only files website par nahi dikhti jab tak **Add to website** na dabayein.
12. **Contact & location**: exact office address, phone, email, WhatsApp and social links. Default map Mother Dairy/Pandav Nagar area ko dikhata hai, exact building ka proof nahi.
13. **Enquiries**: visitor messages padhein. Reply by email aapka configured mail app kholta hai; automatic email notifications is project mein configured nahi hain.
14. Changes auto-save hote hain. **Save changes** manually bhi use kar sakte hain.

If a save fails: error banner padhein, **Retry save** ya **Sign in again** use karein. Unsaved draft restore ka option aaye toh restore karein. Upload chal raha ho toh tab close na karein; pause/resume available hai.

## 2. Supported files aur systems

- **JPG, JPEG, PNG**, including transparent PNG: supported poster/photo formats.
- WebP, GIF, BMP and AVIF: modern-browser support. Maximum compatibility ke liye JPG/PNG choose karein.
- iPhone HEIC: client tries JPEG conversion. Unsupported variant ke liye Photos se JPEG/PNG export karein.
- Videos: MP4 with H.264 video/AAC audio is the broadly compatible recommendation. Browser/codec differences still apply.
- Audio: compatible MP3/WAV and other supported formats can play; download remains available.
- PDF, ZIP, DOC/DOCX and arbitrary other non-empty file types: can be stored and offered as downloads. Not every type is previewable in the browser; active files are not executed by the app.
- **Application limit: 2 GB per file.** This is not unlimited storage. Hosting/database capacity, bandwidth, request limits and device memory apply. The included production Blueprint starts with 5 GB of database storage; large videos should normally use YouTube/Vimeo links instead of database uploads.
- Windows PC: current Chrome, Edge or Firefox.
- macOS: current Safari, Chrome or Firefox.
- Linux: current Chrome/Chromium or Firefox.
- iPhone/iPad: current Safari. Android: current Chrome or Firefox.
- Internet and a supported browser are required. Your personal device does not need Node.js, PostgreSQL or coding software for normal site management. Very old browsers and every unusual codec are not guaranteed.

## 3. One-time recommended public deployment: Render Blueprint

If the current builder has a Publish/Deploy feature, first verify it supports this full Next.js backend, a persistent PostgreSQL database and durable uploaded files. A static-site-only export is insufficient. Button names and plan features depend on the builder; they are not visible from this project.

For a portable deployment:

1. Export the complete project into a GitHub repository. If using browser file upload, extract the project first; do not upload only a ZIP. `package.json`, `package-lock.json`, `render.yaml`, `src/`, `public/`, `scripts/` and `drizzle/` belong in the repo. Exclude `.env`, `node_modules/`, `.next/`, `artifacts/` and local backups. The added `.gitignore` helps Git-based exports, but manual web uploads must still avoid secrets.
2. Sign in to [Render](https://dashboard.render.com) and connect the GitHub repository. Private repositories are supported with access granted to Render.
3. Choose **New → Blueprint**, select the repo and branch. The prepared `render.yaml` is at the repository root.
4. Set the requested private **HANSA_OWNER_PASSWORD** to a unique **12–128 character** password. Store it safely. Do not put the value in source files or website text. This password is used to create the first production owner before the web service starts.
5. Review the **paid web service + paid PostgreSQL** compute/storage prices and approve only after understanding the charges. Current costs are set by Render, not by this project. The database initially has 5 GB storage. Free Render databases have expiration/storage limitations and are not recommended for a permanent business website.
6. Deploy the Blueprint. It installs/builds the app, runs recorded Drizzle migrations, creates the first owner safely and checks `/api/health`. Production setup refuses to adopt an unrelated/untracked existing database automatically. Use a new database or get authorised migration help.
7. Wait until the web service is Live/healthy. Open its actual **https://…onrender.com** URL in an incognito/private window and on another device. A public visitor should see the landing page without an editor password. Editing at **/studio** requires the owner password.
8. Add your actual content on this new site's editor. **A fresh production database does not automatically contain your preview's edits, credentials or uploaded files.** The simplest approach is to launch first and then upload original media. If you need to keep an existing dataset, use content backup plus media re-upload, or ask an authorised technical person for a full, safe database migration.
9. Share the verified public URL. A custom domain is optional; the assigned public hosting URL can already be shared while the service is active.

### What the prepared files do

- `render.yaml`: public Node web service, persistent private-network PostgreSQL and environment references. It does not contain passwords.
- `drizzle.deploy.config.ts` and `drizzle/`: environment-based, versioned database migrations for a new production database.
- `scripts/prepare-production.ts`: runs migrations and creates a salted/scrypt-hashed first owner from the private environment variable. It preserves an existing owner's password on later deploys. It refuses to operate without the explicit public-site flag and refuses untracked existing app tables.
- `HANSA_PUBLIC_SITE=true`: production mode used by the Blueprint. Public first-come owner registration is disabled in this mode.
- `DATABASE_URL`: supplied automatically from the Render database. Do not copy the local preview database credentials into public deployment.
- `HANSA_OWNER_PASSWORD`: first-time owner secret, set only in the hosting dashboard. Changing this variable later **does not reset** an existing owner password. Change a known password in the editor's Settings & security; lost-password recovery requires authorised administrator help.
- `SITE_URL` (optional): after custom-domain verification, set this to the full HTTPS custom URL if you want the help page to display that instead of the default Render URL. A configured URL is not proof of external reachability.

## 4. Optional custom domain

1. Register an available domain with a registrar you trust. Availability or ownership of any particular Hansa Music domain is not assumed.
2. In Render, open the web service → **Settings → Custom Domains → Add Custom Domain**.
3. In the registrar's DNS dashboard, enter **exactly the records Render provides**. Do not guess addresses or delete unrelated email/MX records.
4. Return to Render and verify the domain. Allow time for DNS propagation and HTTPS/TLS certificate issuance.
5. Open the HTTPS domain in incognito and from a different network. Only then share it as the final address.
6. Domain registration is normally a separate yearly cost; hosting/database/storage are separate recurring costs.

## 5. Before launch checklist

- Public HTTPS main URL opens without login in incognito and on another person's phone.
- `/studio` and write APIs do not permit editing without the owner password/session.
- Original logo and real posters/photos replace sample artwork.
- Company name, exact office address, phone, email and map are checked.
- Upload a test JPG/PNG and verify it is visible after reloading the public URL.
- Test a video link and a download on mobile.
- Send a test enquiry and check the owner inbox.
- Check hosting/database bills, available storage, backup retention and restore options.
- Keep original files locally or in a separate backup. The editor's JSON backup includes text/settings/file links, **not** original media binaries or enquiries. Use database backups for the complete database-backed site.
- Public availability and Google search indexing are separate. Google Search Console ownership verification/indexing requests can help; instant listing or ranking is not guaranteed.

## Helpful official documentation

- Render Blueprint setup: https://render.com/docs/infrastructure-as-code
- Next.js dynamic deployment: https://render.com/docs/deploy-nextjs-app
- Custom domains: https://render.com/docs/custom-domains
- Free-service limitations: https://render.com/docs/free

Daily management is no-code within the supplied editor. First hosting setup, a new custom feature, a complete redesign or a full database migration can require one-time technical assistance. Hosting must remain active and within quota; the site does not depend on your personal PC staying switched on once properly deployed to cloud hosting.
