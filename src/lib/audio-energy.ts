/* ==================================================================
 * liveAudio — hot-path audio energy shared object.
 *
 * The music player's analyser writes bass/mid/treble/level here every
 * frame; render loops (hero planets, ambient objects) read it inside
 * their own rAF without any React re-render. Plain mutable singleton =
 * zero allocation, zero subscription cost.
 *
 * Only real Web Audio analyser data is published here. Sources that cannot
 * be analysed (for example a cross-origin Spotify iframe) never fabricate a
 * rhythm: reactive scenes remain idle instead of drifting off-beat.
 * ================================================================== */

export const liveAudio = {
  /** true while real analyser data flows */
  active: false,
  /** normalized 0..1 energy buckets */
  bass: 0,
  mid: 0,
  treble: 0,
  level: 0,
  /** adaptive spectral-flux beat envelope, fast attack / smooth decay */
  beat: 0,
  /** positive spectral change; useful for non-bass rhythmic material */
  flux: 0,
  /** normalized spectral centroid (dark 0 → bright 1) */
  brightness: 0,
  /** retained for telemetry compatibility; real analysis always sets false */
  simulated: false,
};

export function resetLiveAudio() {
  liveAudio.active = false;
  liveAudio.bass = 0;
  liveAudio.mid = 0;
  liveAudio.treble = 0;
  liveAudio.level = 0;
  liveAudio.beat = 0;
  liveAudio.flux = 0;
  liveAudio.brightness = 0;
  liveAudio.simulated = false;
}
