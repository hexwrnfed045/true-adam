"use client";
import { SessionProvider } from "./session-provider";
import { ThemeProvider, createTheme } from "@mui/material/styles";
const theme = createTheme({
  palette: { primary: { main: "#171715" }, background: { default: "#f7f7f2", paper: "#f7f7f2" }, text: { primary: "#171715", secondary: "#66665f" } },
  typography: { fontFamily: "Arial, Helvetica, sans-serif", button: { textTransform: "none", fontWeight: 500 } },
  shape: { borderRadius: 0 },
  components: {
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { padding: "12px 24px", minHeight: 48, borderRadius: 0 } } },
    MuiTextField: { defaultProps: { variant: "outlined", fullWidth: true } },
    MuiOutlinedInput: { styleOverrides: { root: { backgroundColor: "transparent", borderRadius: 0 } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 0 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 0 } } },
  },
});
export function Providers({ children }: { children: React.ReactNode }) { return <ThemeProvider theme={theme}><SessionProvider>{children}</SessionProvider></ThemeProvider>; }
