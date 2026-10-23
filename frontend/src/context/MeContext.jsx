import { createContext, useContext } from "react";
import { useData } from "@/lib/api";

const MeContext = createContext(null);

export const MeProvider = ({ children }) => {
  const { data, error, reload } = useData("/me");
  if (error) return <div className="p-10 text-rose-300" data-testid="me-error">Could not load your profile: {error}</div>;
  if (!data) return <div className="min-h-screen grid place-items-center eyebrow" data-testid="me-loading">Loading workspace…</div>;
  const can = (cap) => data.caps.includes(cap);
  return <MeContext.Provider value={{ me: data, can, reload }}>{children}</MeContext.Provider>;
};

export const useMe = () => useContext(MeContext);
