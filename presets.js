// Device presets
// Note: iPhone display resolutions are listed by Apple as "height-by-width" (e.g. 2556-by-1179).
// For wallpapers we output Portrait as width x height, so we flip to min x max.

export const PRESETS = [
  { group: "iPhone", name: "iPhone 12 mini / 13 mini", w: 1080, h: 2340 },
  { group: "iPhone", name: "iPhone 12 / 12 Pro / 13 / 13 Pro / 14", w: 1170, h: 2532 },
  { group: "iPhone", name: "iPhone 14 Pro / 15 / 15 Pro / 16 / 16e", w: 1179, h: 2556 },
  { group: "iPhone", name: "iPhone 12 Pro Max / 13 Pro Max / 14 Plus", w: 1284, h: 2778 },
  { group: "iPhone", name: "iPhone 14 Pro Max / 15 Plus / 15 Pro Max / 16 Plus", w: 1290, h: 2796 },
  { group: "iPhone", name: "iPhone 16 Pro / 17 / 17 Pro", w: 1206, h: 2622 },
  { group: "iPhone", name: "iPhone 16 Pro Max / 17 Pro Max", w: 1320, h: 2868 },

  { group: "MacBook", name: "MacBook Air 13.6 (M2/M3/M4) 2560×1664", w: 2560, h: 1664 },
  { group: "MacBook", name: "MacBook Air 15.3 (M2/M3/M4) 2880×1864", w: 2880, h: 1864 },
  { group: "MacBook", name: "MacBook Pro 14.2 3024×1964", w: 3024, h: 1964 },
  { group: "MacBook", name: "MacBook Pro 16.2 3456×2234", w: 3456, h: 2234 },
];
