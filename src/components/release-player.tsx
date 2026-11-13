"use client";
/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { getVideoEmbed, type Release } from "@/lib/site-data";
import { Icon } from "./icons";
export function ReleasePlayer({ release }: { release: Release }) {
  const embed = getVideoEmbed(release.videoUrl);
  const [playbackError, setPlaybackError] = useState(false);
  if (embed?.kind === "file") return <div className="uploaded-video-player"><video key={embed.url} src={embed.url} controls autoPlay playsInline preload="metadata" poster={release.image} onError={() => setPlaybackError(true)} /><div className="video-browser-help">{playbackError ? <p>This browser cannot play this file/codec. Try an MP4 encoded with H.264/AAC, or open the original video.</p> : <span>Tap play if your browser pauses autoplay.</span>}<a href={embed.url} target="_blank" rel="noopener noreferrer">Open / download video<Icon name="arrowUpRight" size={14} /></a></div></div>;
  if (embed?.kind === "youtube" || embed?.kind === "vimeo") return <iframe src={embed.url} title={release.title} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />;
  if (embed?.kind === "external") return <div className="release-preview"><img src={release.image} alt={release.title} /><div><span className="section-label">WATCH ON THE ORIGINAL PLATFORM</span><h3>{release.title}</h3><p>This link opens on its original website. Some platforms require their own app or sign-in and do not allow embedded playback.</p><a className="button button-primary" href={embed.url} target="_blank" rel="noopener noreferrer">Open video link<Icon name="arrowUpRight" size={17} /></a></div></div>;
  return <div className="release-preview"><img src={release.image} alt={release.title} /><div><span className="section-label">YOUR NEXT RELEASE STARTS HERE</span><h3>{release.title}</h3><p>This is a sample cover concept. Add a video link or upload your own video in the editor.</p><Link className="button button-primary" href="/studio"><Icon name="edit" size={16} />Make it your own</Link></div></div>;
}
