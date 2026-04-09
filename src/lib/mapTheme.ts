const LIGHT = {
  bg: 'hsl(38, 30%, 97%)',
  emptyFill: 'hsl(35, 18%, 92%)',
  noDataFill: 'hsl(35, 20%, 86%)',
  stroke: 'hsl(28, 20%, 14%)',
  labelPrimary: 'hsl(28, 20%, 14%)',
  labelSecondary: 'hsl(28, 10%, 46%)',
  tooltipBg: 'rgba(254, 249, 243, 0.95)',
  tooltipBorder: 'hsl(35, 20%, 86%)',
  chartBg: 'hsl(38, 30%, 97%)',
  chartText: 'hsl(28, 20%, 14%)',
  chartMuted: 'hsl(28, 10%, 46%)',
  chartLine: 'hsl(35, 18%, 84%)',
  isDark: false,
};

const DARK = {
  bg: 'hsl(25, 8%, 6%)',
  emptyFill: 'hsl(25, 8%, 14%)',
  noDataFill: 'hsl(25, 8%, 14%)',
  stroke: 'hsl(35, 12%, 93%)',
  labelPrimary: 'hsl(35, 12%, 93%)',
  labelSecondary: 'hsl(30, 8%, 60%)',
  tooltipBg: 'rgba(14, 12, 11, 0.97)',
  tooltipBorder: 'hsl(25, 8%, 14%)',
  chartBg: 'hsl(25, 8%, 6%)',
  chartText: 'hsl(35, 12%, 93%)',
  chartMuted: 'hsl(30, 8%, 60%)',
  chartLine: 'hsl(25, 8%, 16%)',
  isDark: true,
};

export function getMapTheme(darkMode?: boolean) {
  const dark = darkMode !== undefined
    ? darkMode
    : document.documentElement.classList.contains('dark');
  return dark ? DARK : LIGHT;
}
