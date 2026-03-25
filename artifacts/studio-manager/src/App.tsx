import { useEffect } from "react";
import { useAppStore } from "./store";
import { Layout } from "./components/Layout";
import { VanillaEngine } from "./components/VanillaEngine";

export default function App() {
  const lightMode = useAppStore((s) => s.lightMode);

  useEffect(() => {
    if (lightMode) document.body.classList.add("light-mode");
    else document.body.classList.remove("light-mode");
  }, [lightMode]);

  return (
    <>
      <VanillaEngine />
      <Layout />
    </>
  );
}
