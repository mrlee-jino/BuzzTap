export const DEFAULT_PROFILE_COLOR = "#F5C400"
export const PROFILE_COLORS = [
  ["BuzzTap gold", "#F5C400"], ["Green", "#16A34A"], ["Blue", "#2563EB"],
  ["Purple", "#9333EA"], ["Rose", "#E11D48"], ["Teal", "#0D9488"],
]

export function profileTheme(value) {
  const color = /^#[0-9a-f]{6}$/i.test(value || "") ? value.toUpperCase() : DEFAULT_PROFILE_COLOR
  const rgb = [1, 3, 5].map((index) => parseInt(color.slice(index, index + 2), 16))
  const luminance = rgb.map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0)
  return {
    color,
    foreground: luminance > 0.179 ? "#000000" : "#FFFFFF",
    onWhite: `#${rgb.map((channel) => Math.round(channel * 0.45).toString(16).padStart(2, "0")).join("")}`,
    tint: `${color}12`,
  }
}
