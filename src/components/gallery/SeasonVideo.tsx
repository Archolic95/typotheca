'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import type { VideoSegment } from '@/lib/supabase/types';

// ── Static video map ───────────────────────────────────────────────────
// Maps season → video metadata. Once brand_videos table is populated,
// replace with a Supabase query.

export interface LocalVideo {
  filename: string;
  title: string;
  season: string;
  vimeo_url: string;
  duration: number;
  director?: string;
  performers?: string[];
  segments?: VideoSegment[];
}

const LOCAL_VIDEOS: LocalVideo[] = [
  { filename: 'acr-fw-0405_[realmadhectic] (480p).mp4', title: 'ACR-FW-0405 [realmadHECTIC]', season: 'FW04', vimeo_url: 'https://vimeo.com/37657451', duration: 472, director: 'Yoshifumi Egawa', performers: ['Errolson Hugh'], segments: [
    { start_s: 25, end_s: 90, model_code: 'S-J1', label: 'S-J1' },
    { start_s: 90, end_s: 155, model_code: 'S-J2', label: 'S-J2' },
    { start_s: 90, end_s: 155, model_code: 'DS-J3', label: 'DS-J3' },
    { start_s: 155, end_s: 210, model_code: 'S-J4', label: 'S-J4' },
    { start_s: 210, end_s: 235, model_code: 'DS-J5', label: 'DS-J5' },
    { start_s: 235, end_s: 280, model_code: 'S-J6', label: 'S-J6' },
    { start_s: 280, end_s: 300, model_code: 'GT-J1', label: 'GT-J1' },
    { start_s: 420, end_s: 440, model_code: 'GT-J2', label: 'GT-J2' },
  ] },
  { filename: 'acr-fw-1011 (720p).mp4', title: 'Acronymjutsu [FW-1011]', season: 'FW10', vimeo_url: 'https://vimeo.com/15670873', duration: 230, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh'] },
  { filename: 'acr-fw-1112-f (720p).mp4', title: 'ACR-FW-1112-F', season: 'FW11', vimeo_url: 'https://vimeo.com/19922910', duration: 192, director: 'Ken-Tonio Yamamoto', performers: ['Jenny Buka'], segments: [
    { start_s: 5, end_s: 17, model_code: 'GT-J18', label: 'GT-J18' },
    { start_s: 55, end_s: 64, model_code: '3A-3TS', label: '3A-3TS' },
    { start_s: 110, end_s: 134, model_code: 'SS-JF', label: 'SS-JF' },
  ] },
  { filename: 'acr-fw-1112-m (720p).mp4', title: 'ACR-FW-1112-M', season: 'FW11', vimeo_url: 'https://vimeo.com/19940049', duration: 208, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh'], segments: [
    { start_s: 60, end_s: 90, model_code: '3A-1', label: '3A-1' },
  ] },
  { filename: 'acronym®_acronymjutsu_[fw-1213] (720p).mp4', title: 'Acronymjutsu [FW-1213]', season: 'FW12', vimeo_url: 'https://vimeo.com/50626032', duration: 238, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh', 'Sarnai Manschuk'], segments: [
    { start_s: 8, end_s: 14, model_code: '3A-MP2TS', label: '3A-MP2TS' },
    { start_s: 15, end_s: 17, model_code: 'DS-J12TS', label: 'DS-J12TS' },
    { start_s: 18, end_s: 32, model_code: 'DS-HD2', label: 'DS-HD2' },
    { start_s: 33, end_s: 52, model_code: 'DS-J5', label: 'DS-J5' },
    { start_s: 53, end_s: 62, model_code: 'GT-J29', label: 'GT-J29' },
    { start_s: 63, end_s: 77, model_code: 'S-J30', label: 'S-J30' },
    { start_s: 78, end_s: 97, model_code: 'GT-J27PL', label: 'GT-J27PL' },
    { start_s: 98, end_s: 102, model_code: '3A-3TS', label: '3A-3TS' },
    { start_s: 103, end_s: 122, model_code: 'GT-J28', label: 'GT-J28' },
    { start_s: 123, end_s: 137, model_code: 'SS-J25', label: 'SS-J25' },
    { start_s: 138, end_s: 142, model_code: '3A-1', label: '3A-1' },
    { start_s: 143, end_s: 162, model_code: 'S-CP2', label: 'S-CP2' },
    { start_s: 163, end_s: 187, model_code: 'SS-JF1B', label: 'SS-JF1B' },
    { start_s: 188, end_s: 217, model_code: 'SS-CP2F', label: 'SS-CP2F' },
    { start_s: 188, end_s: 217, model_code: '3A-12TS', label: '3A-12TS' },
    { start_s: 218, end_s: 227, model_code: 'NTS-NG1', label: 'NTS-NG1' },
  ] },
  { filename: 'acronym®_acronymjutsu_[fw-1314] (720p).mp4', title: 'Acronymjutsu [FW-1314]', season: 'FW13', vimeo_url: 'https://vimeo.com/60772746', duration: 289, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh', 'Ken-Tonio Yamamoto'], segments: [
    { start_s: 37, end_s: 46, model_code: 'J25-SS', label: 'J25-SS' },
    { start_s: 47, end_s: 74, model_code: 'J36-GT', label: 'J36-GT' },
    { start_s: 75, end_s: 99, model_code: 'J34-GTPL', label: 'J34-GTPL' },
    { start_s: 100, end_s: 124, model_code: 'J32-GT', label: 'J32-GT' },
    { start_s: 125, end_s: 149, model_code: 'J38-S', label: 'J38-S' },
    { start_s: 150, end_s: 174, model_code: 'J38-LP', label: 'J38-LP' },
    { start_s: 175, end_s: 199, model_code: 'J1A-S', label: 'J1A-S' },
    { start_s: 200, end_s: 224, model_code: 'NTS-NG1', label: 'NTS-NG1' },
    { start_s: 225, end_s: 249, model_code: 'CP2-SS', label: 'CP2-SS' },
  ] },
  { filename: 'acronym®_acronymjutsu_[fw-1415] (720p).mp4', title: 'Acronymjutsu [FW-1415]', season: 'FW14', vimeo_url: 'https://vimeo.com/85738008', duration: 268, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh'], segments: [
    { start_s: 30, end_s: 55, model_code: 'P16A-CH', label: 'P16A-CH' },
    { start_s: 55, end_s: 80, model_code: 'J40-CH', label: 'J40-CH' },
    { start_s: 80, end_s: 105, model_code: 'J1A-LP', label: 'J1A-LP' },
    { start_s: 105, end_s: 130, model_code: 'J43-GT', label: 'J43-GT' },
    { start_s: 130, end_s: 150, model_code: 'J41-GT', label: 'J41-GT' },
    { start_s: 150, end_s: 170, model_code: 'S6-C', label: 'S6-C' },
    { start_s: 170, end_s: 190, model_code: 'J39-S', label: 'J39-S' },
    { start_s: 190, end_s: 210, model_code: 'P16-CH', label: 'P16-CH' },
    { start_s: 210, end_s: 230, model_code: 'J40-S', label: 'J40-S' },
  ] },
  { filename: 'acronym®_acronymjutsu_[lfdb] (720p).mp4', title: 'Acronymjutsu [LFDB]', season: 'LFDB', vimeo_url: 'https://vimeo.com/20831985', duration: 331, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh', 'Kensuke Koike'], segments: [
    { start_s: 5, end_s: 145, model_code: 'GT-J28-LF', label: 'GT-J28-LF' },
    { start_s: 5, end_s: 145, model_code: '3A-MF1', label: '3A-MF1' },
    { start_s: 5, end_s: 145, model_code: 'S8-TS', label: 'S8-TS' },
    { start_s: 145, end_s: 160, model_code: 'S14-LS', label: 'S14-LS' },
    { start_s: 145, end_s: 180, model_code: 'P8TS-X', label: 'P8TS-X' },
    { start_s: 180, end_s: 215, model_code: 'X-NG3', label: 'X-NG3' },
    { start_s: 215, end_s: 235, model_code: '3A-5TSR', label: '3A-5TSR' },
    { start_s: 235, end_s: 275, model_code: 'GT-J32-LF', label: 'GT-J32-LF' },
    { start_s: 275, end_s: 325, model_code: '3A-9TS', label: '3A-9TS' },
  ] },
  { filename: 'acronym®_acronymjutsu_[ss-12] (480p).mp4', title: 'Acronymjutsu [SS-12]', season: 'SS12', vimeo_url: 'https://vimeo.com/27203858', duration: 398, director: 'Ken-Tonio Yamamoto', performers: ['Sarnai Manschuk', 'Errolson Hugh'], segments: [
    { start_s: 5, end_s: 55, model_code: 'WS-JF26', label: 'WS-JF26' },
    { start_s: 55, end_s: 110, model_code: 'E-J23', label: 'E-J23' },
    { start_s: 110, end_s: 165, model_code: 'WS-J25', label: 'WS-J25' },
    { start_s: 165, end_s: 220, model_code: 'E-J21', label: 'E-J21' },
    { start_s: 220, end_s: 240, model_code: '3A-3TS', label: '3A-3TS' },
    { start_s: 240, end_s: 310, model_code: 'GT-J27', label: 'GT-J27' },
    { start_s: 310, end_s: 375, model_code: 'GT-J22', label: 'GT-J22' },
  ] },
  { filename: 'acronym®_acronymjutsu_[ss-12]_version_2.0 (720p).mp4', title: 'Acronymjutsu [SS-12] v2.0', season: 'SS12', vimeo_url: 'https://vimeo.com/39120008', duration: 398, director: 'Ken-Tonio Yamamoto', performers: ['Sarnai Manschuk', 'Errolson Hugh'], segments: [
    { start_s: 5, end_s: 55, model_code: 'WS-JF26', label: 'WS-JF26' },
    { start_s: 55, end_s: 110, model_code: 'E-J23', label: 'E-J23' },
    { start_s: 110, end_s: 165, model_code: 'WS-J25', label: 'WS-J25' },
    { start_s: 165, end_s: 220, model_code: 'E-J21', label: 'E-J21' },
    { start_s: 240, end_s: 310, model_code: 'GT-J27', label: 'GT-J27' },
    { start_s: 310, end_s: 375, model_code: 'GT-J22', label: 'GT-J22' },
  ] },
  { filename: 'acronym®_acronymjutsu_[ss-13] (720p).mp4', title: 'Acronymjutsu [SS-13]', season: 'SS13', vimeo_url: 'https://vimeo.com/46818058', duration: 130, director: 'Ken-Tonio Yamamoto', performers: ['Sarnai Manschuk', 'Errolson Hugh'] },
  { filename: 'acronym®_acronymjutsu_[ss-14] (720p).mp4', title: 'Acronymjutsu [SS-14]', season: 'SS14', vimeo_url: 'https://vimeo.com/89358873', duration: 389, director: 'Ken-Tonio Yamamoto', performers: ['Errolson Hugh'], segments: [
    { start_s: 15, end_s: 25, model_code: '3A-1', label: '3A-1' },
    { start_s: 25, end_s: 35, model_code: '3A-2', label: '3A-2' },
    { start_s: 35, end_s: 50, model_code: '3A-3TS', label: '3A-3TS' },
    { start_s: 50, end_s: 65, model_code: '3A-5TS', label: '3A-5TS' },
    { start_s: 65, end_s: 80, model_code: '3A-5B', label: '3A-5B' },
    { start_s: 80, end_s: 110, model_code: 'J36-GT', label: 'J36-GT' },
    { start_s: 110, end_s: 130, model_code: 'J23-CH', label: 'J23-CH' },
    { start_s: 130, end_s: 155, model_code: 'J38-GT', label: 'J38-GT' },
    { start_s: 155, end_s: 175, model_code: 'J25-WS', label: 'J25-WS' },
    { start_s: 175, end_s: 200, model_code: 'J28-E', label: 'J28-E' },
    { start_s: 200, end_s: 220, model_code: 'P10-E', label: 'P10-E' },
    { start_s: 220, end_s: 240, model_code: 'P15-CH', label: 'P15-CH' },
    { start_s: 240, end_s: 260, model_code: 'P14-CH', label: 'P14-CH' },
    { start_s: 260, end_s: 285, model_code: 'J27-E', label: 'J27-E' },
    { start_s: 285, end_s: 310, model_code: 'J29B-WS', label: 'J29B-WS' },
    { start_s: 340, end_s: 370, model_code: 'J28-E', label: 'J28-E' },
  ] },
  { filename: 'acronym®_fw-1718_werkverzeichnis (1080p).mp4', title: 'FW-1718 Werkverzeichnis', season: 'FW17', vimeo_url: 'https://vimeo.com/197756205', duration: 361, director: 'Ken-Tonio Yamamoto & Errolson Hugh', performers: ['Lenny Mueller', 'Ian Wang', 'Delia Boettcher', 'Errolson Hugh'], segments: [
    { start_s: 7, end_s: 23, model_code: 'J56-S', label: 'J56-S' },
    { start_s: 7, end_s: 23, model_code: 'P26-S', label: 'P26-S' },
    { start_s: 23, end_s: 38, model_code: 'J64TS-S', label: 'J64TS-S' },
    { start_s: 38, end_s: 53, model_code: 'J58-WS', label: 'J58-WS' },
    { start_s: 38, end_s: 53, model_code: 'P23A-DS', label: 'P23A-DS' },
    { start_s: 53, end_s: 67, model_code: 'NG4-PS', label: 'NG4-PS' },
    { start_s: 53, end_s: 67, model_code: 'P25H-DS', label: 'P25H-DS' },
    { start_s: 67, end_s: 82, model_code: 'J65-WS', label: 'J65-WS' },
    { start_s: 97, end_s: 113, model_code: 'NG7-AM', label: 'NG7-AM' },
    { start_s: 128, end_s: 142, model_code: 'S14-AM', label: 'S14-AM' },
    { start_s: 142, end_s: 157, model_code: 'J61-GT', label: 'J61-GT' },
    { start_s: 157, end_s: 172, model_code: 'S18-AK', label: 'S18-AK' },
    { start_s: 157, end_s: 172, model_code: 'P23-S', label: 'P23-S' },
    { start_s: 172, end_s: 187, model_code: 'J28-GT', label: 'J28-GT' },
    { start_s: 232, end_s: 247, model_code: 'P10A-CH', label: 'P10A-CH' },
    { start_s: 247, end_s: 262, model_code: 'SM1-AM', label: 'SM1-AM' },
    { start_s: 262, end_s: 277, model_code: 'J62-S', label: 'J62-S' },
    { start_s: 277, end_s: 293, model_code: 'NG7-PS', label: 'NG7-PS' },
    { start_s: 308, end_s: 323, model_code: 'J16-GT', label: 'J16-GT' },
  ] },
  { filename: 'acronym®_set-1_4_[lfdb] (720p).mp4', title: 'SET-1>4 [LFDB]', season: 'LFDB', vimeo_url: 'https://vimeo.com/20827579', duration: 152, director: 'Ken-Tonio Yamamoto' },
  { filename: 'v27-m (1080p).mp4', title: 'V27-M', season: 'SS17', vimeo_url: 'https://vimeo.com/212267977', duration: 229, director: 'Ken-Tonio Yamamoto', performers: ['Uemit Esbulan', 'Melody Yoko Reilly', 'Eskindir Tesfay', 'Ian Wang', 'Errolson Hugh'], segments: [
    { start_s: 5, end_s: 30, model_code: 'J46U-WS', label: 'J46U-WS' },
    { start_s: 30, end_s: 55, model_code: 'J61-WS', label: 'J61-WS' },
    { start_s: 55, end_s: 80, model_code: 'P25-DS', label: 'P25-DS' },
    { start_s: 80, end_s: 120, model_code: 'J1TS-S', label: 'J1TS-S' },
  ] },
];

export function getVideosForSeason(season: string): LocalVideo[] {
  return LOCAL_VIDEOS.filter(v => v.season === season);
}

export interface VideoSegmentMatch {
  video: LocalVideo;
  segment: VideoSegment;
}

// Known textile prefixes for convention flip matching
const TEXTILE_PREFIXES = new Set(['GT', 'SS', 'DS', 'S', 'E', 'WS', 'L', 'LP', 'PL', 'X']);

/** Flip between model-first (J28-GT) and textile-first (GT-J28) conventions */
function flipConvention(code: string): string | null {
  const m = code.match(/^([A-Z]+\d+[A-Z0-9]*)-([A-Z]+)$/);
  if (!m) return null;
  const [, a, b] = m;
  // If b is a textile prefix, it's model-first → flip to textile-first
  if (TEXTILE_PREFIXES.has(b)) return `${b}-${a}`;
  // If a is a textile prefix, it's textile-first → flip to model-first
  if (TEXTILE_PREFIXES.has(a)) return `${b}-${a}`;
  return null;
}

export function getVideoSegmentsForModel(modelCode: string): VideoSegmentMatch[] {
  if (!modelCode) return [];
  const code = modelCode.toUpperCase();
  const flipped = flipConvention(code);
  const matches: VideoSegmentMatch[] = [];
  for (const video of LOCAL_VIDEOS) {
    for (const seg of video.segments || []) {
      const segCode = seg.model_code.toUpperCase();
      if (segCode === code || (flipped && segCode === flipped)) {
        matches.push({ video, segment: seg });
      }
    }
  }
  return matches;
}

export function getAllVideoSeasons(): string[] {
  return [...new Set(LOCAL_VIDEOS.map(v => v.season))];
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ── Video Player Modal ─────────────────────────────────────────────────
// Full-screen overlay player, opened when clicking a video card.

interface VideoPlayerModalProps {
  video: LocalVideo;
  onClose: () => void;
}

function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration);
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const videoSrc = `/videos/${encodeURIComponent(video.filename)}`;

  const togglePlay = useCallback(() => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) { el.play(); setPlaying(true); }
    else { el.pause(); setPlaying(false); }
  }, []);

  const seek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    el.currentTime = pct * el.duration;
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => { if (playing) setShowControls(false); }, 2500);
  }, [playing]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setCurrentTime(el.currentTime);
    const onDur = () => setDuration(el.duration);
    const onEnd = () => setPlaying(false);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onDur);
    el.addEventListener('ended', onEnd);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onDur);
      el.removeEventListener('ended', onEnd);
    };
  }, []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl mx-4"
        onClick={e => e.stopPropagation()}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (playing) setShowControls(false); }}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="w-full aspect-video object-contain bg-black rounded-lg cursor-pointer"
          autoPlay
          playsInline
          onClick={togglePlay}
          preload="auto"
        />

        {/* Controls overlay */}
        <div className={`absolute inset-0 flex flex-col justify-end rounded-lg transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent pointer-events-none rounded-lg" />

          {/* Title */}
          <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 z-10">
            <div className="text-sm text-white/90 font-medium">{video.title}</div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-black/50 text-white/80 hover:text-white hover:bg-black/70 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l8 8M10 2l-8 8" />
              </svg>
            </button>
          </div>

          {/* Center play (when paused) */}
          {!playing && (
            <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
              <button
                onClick={togglePlay}
                className="w-16 h-16 flex items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20 pointer-events-auto hover:bg-white/20 transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 20 20" fill="white">
                  <path d="M5 3l12 7-12 7V3z" />
                </svg>
              </button>
            </div>
          )}

          {/* Bottom bar */}
          <div className="relative z-10 px-4 pb-4">
            <div className="h-1 bg-white/20 rounded-full mb-2 cursor-pointer" onClick={seek}>
              <div className="h-full bg-white rounded-full transition-[width] duration-100" style={{ width: `${progress}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-white/60">
              <div className="flex items-center gap-3">
                <button onClick={togglePlay} className="text-white hover:text-white/80">
                  {playing ? (
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="3" height="10" rx="0.5" /><rect x="7" y="1" width="3" height="10" rx="0.5" /></svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 12 12" fill="currentColor"><path d="M2 1l9 5-9 5V1z" /></svg>
                  )}
                </button>
                <span>{formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}</span>
              </div>
              <div className="flex items-center gap-3 text-white/50">
                {video.director && <span>Dir. {video.director}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Season Video Card ──────────────────────────────────────────────────
// Renders as a card in the object grid. Clicking opens the modal player.

interface SeasonVideoCardProps {
  video: LocalVideo;
}

function SeasonVideoCard({ video }: SeasonVideoCardProps) {
  const [showPlayer, setShowPlayer] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const videoSrc = `/videos/${encodeURIComponent(video.filename)}`;

  return (
    <>
      <button
        onClick={() => setShowPlayer(true)}
        className="group text-left bg-[#141414] rounded-lg border border-neutral-800/50 overflow-hidden hover:border-neutral-700 transition-all hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
      >
        {/* Video thumbnail */}
        <div className="aspect-[4/5] bg-black relative overflow-hidden">
          <video
            ref={videoRef}
            src={videoSrc}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
            preload="metadata"
            muted
            playsInline
            onMouseEnter={() => videoRef.current?.play()}
            onMouseLeave={() => { const v = videoRef.current; if (v) { v.pause(); v.currentTime = 0; } }}
          />
          {/* Play icon */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm border border-white/20 group-hover:bg-black/40 transition-colors">
              <svg width="14" height="14" viewBox="0 0 10 10" fill="white" className="ml-0.5">
                <path d="M2 1l7 4-7 4V1z" />
              </svg>
            </div>
          </div>
          {/* Duration badge */}
          <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white/80 font-mono">
            {formatDuration(video.duration)}
          </div>
        </div>

        {/* Info */}
        <div className="p-2 sm:p-3 space-y-0.5 sm:space-y-1">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-neutral-500 font-medium truncate">
            ACRONYM
            <span className="ml-1.5 sm:ml-2 text-neutral-600">{video.season}</span>
          </p>
          <p className="text-xs sm:text-sm font-medium text-white leading-tight line-clamp-2">{video.title}</p>
          <p className="text-[10px] text-neutral-600 truncate">
            {video.director && `Dir. ${video.director}`}
          </p>
        </div>
      </button>

      {showPlayer && (
        <VideoPlayerModal video={video} onClose={() => setShowPlayer(false)} />
      )}
    </>
  );
}

// ── Season Video Cards ─────────────────────────────────────────────────
// Returns video cards to be inserted at the start of a season's grid.

interface SeasonVideoCardsProps {
  season: string;
}

export function SeasonVideoCards({ season }: SeasonVideoCardsProps) {
  const videos = getVideosForSeason(season);
  if (videos.length === 0) return null;

  return (
    <>
      {videos.map(v => (
        <SeasonVideoCard key={v.filename} video={v} />
      ))}
    </>
  );
}

// Keep the banner export for backwards compat but mark deprecated
export function SeasonVideoBanner({ season }: { season: string }) {
  return null; // Replaced by SeasonVideoCards rendered inline in grid
}
