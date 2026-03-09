"use client";

import { useSession, signOut } from "next-auth/react";
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Button,
  Chip,
  Box,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { DRAWER_WIDTH } from "./Sidebar";

interface TopBarProps {
  onMenuToggle: () => void;
}

export default function TopBar({ onMenuToggle }: TopBarProps) {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <AppBar
      position="fixed"
      sx={{
        width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
        ml: { md: `${DRAWER_WIDTH}px` },
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          edge="start"
          onClick={onMenuToggle}
          sx={{ mr: 2, display: { md: "none" } }}
        >
          <MenuIcon />
        </IconButton>
        <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
          Family Wealth Tracker
        </Typography>
        {user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ display: { xs: "none", sm: "block" } }}>
              {user.nome}
            </Typography>
            <Chip
              label={user.ruolo}
              size="small"
              color={user.ruolo === "ADMIN" ? "warning" : "default"}
              variant="outlined"
              sx={{ color: "white", borderColor: "rgba(255,255,255,0.5)" }}
            />
            <Button
              color="inherit"
              startIcon={<LogoutIcon />}
              onClick={() => signOut({ callbackUrl: "/login" })}
              size="small"
            >
              Esci
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
