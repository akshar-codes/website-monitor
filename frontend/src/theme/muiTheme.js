import { createTheme, alpha } from "@mui/material/styles";

const emerald = {
  50: "#ecfdf5",
  100: "#d1fae5",
  200: "#a7f3d0",
  300: "#6ee7b7",
  400: "#34d399",
  500: "#10b981",
  600: "#059669",
  700: "#047857",
  800: "#065f46",
  900: "#064e3b",
  950: "#022c22",
};

const neutral = {
  0: "#ffffff",
  50: "#f6f7f8",
  100: "#eceef1",
  200: "#d8dce2",
  300: "#b4bac4",
  400: "#8890a0",
  500: "#626b7d",
  600: "#454e60",
  700: "#2e3542",
  800: "#1c212b",
  850: "#151920",
  900: "#10131a",
  925: "#0c0e13",
  950: "#08090d",
  1000: "#000000",
};

const red = {
  50: "#fef2f2",
  400: "#f87171",
  500: "#ef4444",
  600: "#dc2626",
  700: "#b91c1c",
};
const amber = { 50: "#fffbeb", 400: "#fbbf24", 500: "#f59e0b", 600: "#d97706" };
const blue = { 50: "#eff6ff", 400: "#60a5fa", 500: "#3b82f6", 600: "#2563eb" };

const FONT_FAMILY = "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif";
const SHAPE = { borderRadius: 8 };

/**
 * Build the MUI palette object for a given color mode.
 * @param {'light'|'dark'} mode
 */
const buildPalette = (mode) => {
  const isDark = mode === "dark";

  return {
    mode,
    primary: {
      main: isDark ? emerald[500] : emerald[600],
      light: isDark ? emerald[400] : emerald[500],
      dark: isDark ? emerald[700] : emerald[800],
      contrastText: isDark ? neutral[1000] : neutral[0],
    },
    secondary: {
      main: isDark ? neutral[400] : neutral[600],
      light: isDark ? neutral[300] : neutral[500],
      dark: isDark ? neutral[600] : neutral[800],
      contrastText: isDark ? neutral[1000] : neutral[0],
    },
    error: {
      main: isDark ? red[500] : red[600],
      light: red[400],
      dark: red[700],
    },
    warning: {
      main: isDark ? amber[500] : amber[600],
      light: amber[400],
      dark: amber[600],
    },
    info: {
      main: isDark ? blue[500] : blue[600],
      light: blue[400],
      dark: blue[600],
    },
    success: {
      main: isDark ? emerald[400] : emerald[600],
      light: emerald[300],
      dark: emerald[700],
    },
    background: {
      default: isDark ? neutral[950] : neutral[50],
      paper: isDark ? neutral[900] : neutral[0],
    },
    text: {
      primary: isDark ? neutral[50] : neutral[900],
      secondary: isDark ? neutral[400] : neutral[600],
      disabled: isDark ? neutral[600] : neutral[300],
    },
    divider: isDark ? neutral[800] : neutral[200],
    action: {
      hover: isDark ? alpha(neutral[0], 0.04) : alpha(neutral[1000], 0.04),
      selected: isDark ? alpha(emerald[500], 0.14) : alpha(emerald[600], 0.08),
      disabled: isDark ? neutral[700] : neutral[300],
      disabledBackground: isDark ? neutral[850] : neutral[100],
      focus: isDark ? alpha(emerald[500], 0.3) : alpha(emerald[600], 0.25),
    },
  };
};

const buildShadows = (mode) => {
  const isDark = mode === "dark";
  const base = isDark
    ? [
        "none",
        "0 1px 2px rgba(0,0,0,0.4)",
        "0 1px 3px rgba(0,0,0,0.45)",
        "0 2px 6px -2px rgba(0,0,0,0.4)",
        "0 4px 10px -2px rgba(0,0,0,0.5)",
      ]
    : [
        "none",
        "0 1px 2px rgba(16,24,40,0.05)",
        "0 1px 3px rgba(16,24,40,0.08)",
        "0 2px 4px -2px rgba(16,24,40,0.06)",
        "0 4px 8px -2px rgba(16,24,40,0.08)",
      ];
  const strongest = base[base.length - 1];
  return [...base, ...Array(25 - base.length).fill(strongest)];
};

/**
 * Build the application's MUI theme for a given color mode.
 * @param {'light'|'dark'} [mode='dark']
 */
export const getAppTheme = (mode = "dark") => {
  const palette = buildPalette(mode);

  return createTheme({
    palette,
    shape: SHAPE,
    typography: {
      fontFamily: FONT_FAMILY,
      h1: { fontWeight: 800, letterSpacing: "-0.02em" },
      h2: { fontWeight: 700, letterSpacing: "-0.015em" },
      h3: { fontWeight: 700, letterSpacing: "-0.01em" },
      h4: { fontWeight: 600 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      button: { fontWeight: 600, textTransform: "none" },
    },
    shadows: buildShadows(mode),
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: palette.background.default,
            colorScheme: mode,
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 8, fontWeight: 600, textTransform: "none" },
          sizeMedium: { height: 38 },
          sizeSmall: { height: 32 },
          sizeLarge: { height: 46 },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            border: `1px solid ${palette.divider}`,
          },
        },
      },
      MuiCard: {
        styleOverrides: { root: { borderRadius: 16 } },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 600, borderRadius: 9999 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: palette.divider,
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: mode === "dark" ? neutral[700] : neutral[300],
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: palette.primary.main,
              borderWidth: 1,
            },
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: palette.divider },
          head: {
            fontWeight: 600,
            color: palette.text.secondary,
            textTransform: "uppercase",
            fontSize: "0.75rem",
            letterSpacing: "0.04em",
          },
        },
      },
      MuiTooltip: {
        styleOverrides: {
          tooltip: {
            backgroundColor: mode === "dark" ? neutral[900] : neutral[0],
            color: palette.text.primary,
            border: `1px solid ${palette.divider}`,
            fontSize: "0.75rem",
            fontWeight: 500,
            boxShadow:
              mode === "dark"
                ? "0 10px 15px -3px rgba(0,0,0,0.5)"
                : "0 10px 15px -3px rgba(16,24,40,0.1)",
          },
          arrow: { color: mode === "dark" ? neutral[900] : neutral[0] },
        },
      },
      MuiDialog: {
        styleOverrides: { paper: { borderRadius: 16 } },
      },
      MuiSwitch: {
        styleOverrides: {
          switchBase: {
            "&.Mui-checked": { color: emerald[500] },
            "&.Mui-checked + .MuiSwitch-track": {
              backgroundColor: emerald[500],
              opacity: 1,
            },
          },
        },
      },
    },
  });
};

export default getAppTheme;
