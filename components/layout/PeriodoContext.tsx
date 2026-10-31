"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";

const STORAGE_KEY = "periodo-selezionato";
const EVENTO_CAMBIO = "periodo-selezionato-cambiato";

interface Periodo {
  anno: number;
  mese: number;
}

interface PeriodoContextValue extends Periodo {
  setPeriodo: (anno: number, mese: number) => void;
  setAnno: (anno: number) => void;
}

const PeriodoContext = createContext<PeriodoContextValue | null>(null);

// Fallback quando localStorage non è disponibile (es. navigazione privata bloccata)
let valoreInMemoria: string | null = null;

function leggiRaw(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? valoreInMemoria;
  } catch {
    return valoreInMemoria;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(EVENTO_CAMBIO, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(EVENTO_CAMBIO, callback);
  };
}

const noopSubscribe = () => () => {};

function periodoCorrente(): Periodo {
  const now = new Date();
  return { anno: now.getFullYear(), mese: now.getMonth() + 1 };
}

function parsePeriodo(raw: string | null): Periodo | null {
  if (!raw) return null;
  try {
    const { anno, mese } = JSON.parse(raw);
    if (Number.isInteger(anno) && Number.isInteger(mese) && mese >= 1 && mese <= 12) {
      return { anno, mese };
    }
  } catch {
    // valore corrotto: si torna al mese corrente
  }
  return null;
}

export function PeriodoProvider({ children }: { children: React.ReactNode }) {
  // Lato server non c'è localStorage: si aspetta il client per non caricare dati col mese sbagliato
  const idratato = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const raw = useSyncExternalStore(subscribe, leggiRaw, () => null);
  const periodo = useMemo(() => parsePeriodo(raw) ?? periodoCorrente(), [raw]);

  const setPeriodo = useCallback((anno: number, mese: number) => {
    const valore = JSON.stringify({ anno, mese });
    valoreInMemoria = valore;
    try {
      localStorage.setItem(STORAGE_KEY, valore);
    } catch {
      // resta valido in memoria per la sessione
    }
    window.dispatchEvent(new Event(EVENTO_CAMBIO));
  }, []);

  const setAnno = useCallback(
    (anno: number) => setPeriodo(anno, periodo.mese),
    [periodo.mese, setPeriodo]
  );

  const value = useMemo(
    () => ({ ...periodo, setPeriodo, setAnno }),
    [periodo, setPeriodo, setAnno]
  );

  if (!idratato) return null;

  return <PeriodoContext.Provider value={value}>{children}</PeriodoContext.Provider>;
}

export function usePeriodo() {
  const ctx = useContext(PeriodoContext);
  if (!ctx) throw new Error("usePeriodo deve essere usato dentro PeriodoProvider");
  return ctx;
}
