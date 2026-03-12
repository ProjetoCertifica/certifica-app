import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase";
import type { Notification } from "./database.types";

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      const { data, error: err } = await supabase
        .from("notifications")
        .select("*")
        .eq("lida", false)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(30);

      if (err) throw err;
      setNotifications(data ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao carregar notificações");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 30_000);
    return () => clearInterval(interval);
  }, [fetch]);

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const markAsRead = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from("notifications")
      .update({ lida: true })
      .eq("id", id);
    if (!err) {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.lida).map((n) => n.id);
    if (unreadIds.length === 0) return;

    const { error: err } = await supabase
      .from("notifications")
      .update({ lida: true })
      .in("id", unreadIds);

    if (!err) {
      setNotifications([]);
    }
  }, [notifications]);

  return { notifications, unreadCount, loading, error, markAsRead, markAllAsRead, refresh: fetch };
}
