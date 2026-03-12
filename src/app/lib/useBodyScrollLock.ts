import { useEffect } from "react";

/**
 * Trava o scroll do body e do container principal quando um modal está aberto.
 * Evita que o conteúdo de fundo role enquanto o modal/overlay está visível.
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Também trava o container principal da app (caso use overflow interno)
    const main = document.getElementById("certifica-main");
    const prevMain = main ? main.style.overflow : "";
    if (main) main.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prev;
      if (main) main.style.overflow = prevMain;
    };
  }, [locked]);
}
