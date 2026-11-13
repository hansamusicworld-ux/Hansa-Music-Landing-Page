export type DeploymentInfo = { productionConfigured: boolean; publicUrl: string | null };
export function getDeploymentInfo(): DeploymentInfo {
  const productionConfigured = process.env.HANSA_PUBLIC_SITE === "true";
  const raw = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") || process.env.RENDER_EXTERNAL_URL || (process.env.RENDER_EXTERNAL_HOSTNAME ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` : "");
  let publicUrl: string | null = null;
  if (productionConfigured && raw) {
    try {
      const url = new URL(raw);
      if (url.protocol === "https:" && !url.username && !url.password && !/^(localhost|127\.)/i.test(url.hostname)) publicUrl = url.origin;
    } catch { /* Never display a guessed or invalid public URL. */ }
  }
  return { productionConfigured, publicUrl };
}
