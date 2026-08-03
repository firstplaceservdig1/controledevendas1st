import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGES = [
  "Parabéns {n}! Mais uma venda concluída 🎉",
  "Você é incrível, {n}! Mais uma pra dentro 🔥",
  "Boa, {n}! Você é féra 😎",
  "É isso, {n}! Fechou mais uma 💪",
  "Arrasou, {n}! O placar tá subindo 📈",
  "Show, {n}! Comissão a caminho 💰",
  "Tá voando, {n}! Bora pra próxima 🚀",
  "Que sequência, {n}! Time orgulhoso de você 🏆",
  "Mandou bem, {n}! Mais uma no bolso 🤑",
  "Simplesmente {n}! Vendendo que nem gente grande 😱",
  "Uhul, {n}! Meta chegando mais perto 🎯",
  "Isso sim, {n}! Cliente novo garantido 🤝",
];

export function SaleCelebration({ name, onClose }: { name: string; onClose: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const message = useMemo(
    () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)].replace("{n}", name),
    [name],
  );

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), 4600);
    const t2 = setTimeout(onClose, 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onClose]);

  function dismiss() {
    setLeaving(true);
    setTimeout(onClose, 300);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className={`absolute inset-0 bg-background/80 backdrop-blur-sm ${leaving ? "animate-fade-out" : "animate-fade-in"}`}
        onClick={dismiss}
      />
      <div
        role="status"
        aria-live="polite"
        className={`relative w-full max-w-md rounded-2xl border border-accent/40 bg-card px-6 py-8 text-center shadow-2xl ${leaving ? "animate-scale-out" : "animate-scale-in"}`}
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={dismiss}
          aria-label="Fechar mensagem"
          className="absolute right-2 top-2 text-muted-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
        <div className="text-5xl animate-bounce">🎉</div>
        <p className="mt-4 text-xl font-semibold leading-snug">{message}</p>
        <p className="mt-2 text-sm text-muted-foreground">Venda registrada com sucesso.</p>
        <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-accent" style={{ animation: "celebration-progress 5s linear forwards" }} />
        </div>
      </div>
    </div>
  );
}
