import { useCallback, useEffect, useState } from "react";

/** Each notification, including a repeat of the same text, gets five seconds. */
export function useHackMessage() {
  const [message, setMessage] = useState<{ text: string } | null>(null);
  const show = useCallback((text: string) => {
    setMessage(text ? { text } : null);
  }, []);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [message]);
  return [message?.text ?? "", show] as const;
}
