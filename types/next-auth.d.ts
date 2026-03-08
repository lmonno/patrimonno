import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      ruolo: "ADMIN" | "UTENTE";
      nome: string;
      cognome: string;
    } & DefaultSession["user"];
  }
}
