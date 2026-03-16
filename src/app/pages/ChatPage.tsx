import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Send, Loader2, Search, MessageSquare, Smile, Paperclip, Mic, Square,
  MoreVertical, Check, CheckCheck, Wifi, Phone,
  Image as ImageIcon, FileText, X, Plus, Download,
  Info, Trash2, Archive, Pin, Star, User, Users,
  Play, Pause, Bot, Clock, ArrowLeft, UserPlus, Contact,
  FolderOpen, ChevronRight, Mail,
} from 'lucide-react';
import {
  getZApiStatus, getChats, sendText, sendImage, sendDocument, sendAudio,
  getProfilePicture, modifyChat, normalizePhone,
  type ZApiStatus, type ZApiChat, type ZApiSendResult,
} from '../lib/zapi';
import { supabase } from '../lib/supabase';
import type { WhatsAppMessage, Document } from '../lib/database.types';
import { findContatoByPhone, type ContatoWithEmpresa } from '../lib/useContatos';
import { usePipeline, type PipelineColumn, type PipelineCard } from '../lib/usePipeline';
import { toast } from 'sonner';

/* ── types ───────────────────────────────────────── */

interface StagedFile {
  file: File;
  base64: string;
  type: 'image' | 'document';
  preview?: string;
  caption: string;
}

/* ── helpers ─────────────────────────────────────── */

function chatId(c: ZApiChat) { return c.phone || c.lid || String(c.lastMessageTime) || Math.random().toString(); }
function chatPhone(c: ZApiChat) { return c.phone || c.lid || ''; }

function toDigits(id?: string): string {
  if (!id) return '';
  return id.replace(/@lid$/i, '').replace(/\D/g, '');
}

function canonize(d: string) {
  if (!d) return '';
  if (d.length >= 12 && d.startsWith('55')) return d;
  if (d.length >= 10 && d.length <= 11) return '55' + d;
  return d;
}

function chatLabel(c: ZApiChat) {
  if (c.name && c.name.trim()) return c.name;
  const p = chatPhone(c);
  if (!p || p === '0') return 'Desconhecido';
  const digits = toDigits(p);
  return formatPhone(digits) || digits || 'Desconhecido';
}

function chatInitial(c: ZApiChat) { return chatLabel(c).charAt(0).toUpperCase() || '?'; }

function formatPhone(phone?: string) {
  if (!phone) return '';
  const n = toDigits(phone);
  if (!n) return '';
  if (n.length === 13) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 9)}-${n.slice(9)}`;
  if (n.length === 12) return `+${n.slice(0, 2)} (${n.slice(2, 4)}) ${n.slice(4, 8)}-${n.slice(8)}`;
  if (n.length === 11) return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7)}`;
  if (n.length === 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return n;
}

/** Convert timestamp to Date — handles both seconds and milliseconds */
function tsToDate(ts: number): Date {
  // If > 10 digits it's milliseconds, otherwise seconds
  return new Date(ts > 9999999999 ? ts : ts * 1000);
}

function formatTime(t?: number | string) {
  if (!t) return '';
  const ts = typeof t === 'string' ? Number(t) : t;
  if (!ts || isNaN(ts)) return '';
  const d = tsToDate(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtMsgTime(ts?: number) { return ts ? tsToDate(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; }

function dateSep(ts?: number) {
  if (!ts) return '';
  const d = tsToDate(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Hoje';
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Ontem';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function StatusTicks({ status }: { status?: string | null }) {
  if (!status) return null;
  const s = status.toUpperCase();
  if (s === 'READ' || s === 'PLAYED' || s === 'VIEWED') return <CheckCheck className="h-3.5 w-3.5 text-[#53bdeb]" />;
  if (s === 'RECEIVED' || s === 'DELIVERED') return <CheckCheck className="h-3.5 w-3.5 text-gray-400" />;
  return <Check className="h-3.5 w-3.5 text-gray-400" />;
}

const AVATAR_COLORS = ['bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-500', 'bg-amber-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500'];
function avatarColor(id: string) { let h = 0; for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h); return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]; }

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = rej; r.readAsDataURL(file); });
}

function formatDuration(s: number) { return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; }

/* ── emoji data ──────────────────────────────────── */

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  { label: 'Mais usados', emojis: ['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '👍', '❤️', '🔥', '🎉', '👏', '🙏', '💪', '✅', '👋', '😢', '😱', '🤣', '💯'] },
  { label: 'Rostos', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '😝', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴'] },
  { label: 'Gestos', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '💪'] },
  { label: 'Objetos', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '⭐', '🌟', '✨', '⚡', '🔥', '💥', '🎉', '🎊', '🏆', '📱', '💻', '📷', '🎵', '💰', '📌', '📝', '✅', '❌', '⚠️', '💡', '🔑'] },
];

/* ── component ───────────────────────────────────── */

export default function ChatPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ZApiStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [chats, setChats] = useState<ZApiChat[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [photoCache, setPhotoCache] = useState<Map<string, string | null>>(new Map());
  const photoLoadingRef = useRef<Set<string>>(new Set());
  const [selectedChat, setSelectedChat] = useState<ZApiChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showChatMenu, setShowChatMenu] = useState(false);
  const [deletedChats, setDeletedChats] = useState<Set<string>>(new Set());
  const deletedChatsRef = useRef<Set<string>>(new Set());
  const deletedChatsLoadedRef = useRef(false);

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // File staging
  const [pendingFiles, setPendingFiles] = useState<StagedFile[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(0);

  // Last message preview map
  const [lastMsgMap, setLastMsgMap] = useState<Map<string, { body: string; status: string | null; fromMe: boolean }>>(new Map());

  // Favorites/pinned (localStorage)
  const FAVORITES_KEY = 'certifica-chat-favorites';
  const PINNED_KEY = 'certifica-chat-pinned';
  const initSet = (key: string) => { try { const s = localStorage.getItem(key); return s ? new Set<string>(JSON.parse(s)) : new Set<string>(); } catch { return new Set<string>(); } };
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(() => initSet(FAVORITES_KEY));
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => initSet(PINNED_KEY));

  // Sidebar tab & contacts
  const [sidebarTab, setSidebarTab] = useState<'chats' | 'contacts'>('chats');
  const [contacts, setContacts] = useState<ZApiChat[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const contactsLoadedRef = useRef(false);
  const [showNewContact, setShowNewContact] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactSearch, setContactSearch] = useState('');

  // Platform documents panel
  const [showDocPanel, setShowDocPanel] = useState(false);
  const [platformDocs, setPlatformDocs] = useState<Document[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const docsLoadedRef = useRef(false);
  const docPanelRef = useRef<HTMLDivElement>(null);
  const [docPanelTab, setDocPanelTab] = useState<'todos' | 'empresa'>('todos');

  // Linked contact/empresa
  const [linkedContato, setLinkedContato] = useState<ContatoWithEmpresa | null>(null);
  const [empresaDocs, setEmpresaDocs] = useState<Document[]>([]);
  const linkedContatoRef = useRef<string>('');

  // Sent/received documents for current chat
  const [chatDocHistory, setChatDocHistory] = useState<WhatsAppMessage[]>([]);

  // Profile panel (right side)
  const [showProfile, setShowProfile] = useState(false);

  // Pipeline (kanban)
  const pipeline = usePipeline();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDoneRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const chatsLoadedOnceRef = useRef(false);

  /* ── close popups on outside click ── */
  useEffect(() => {
    function h(e: MouseEvent) {
      if (showEmoji && emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false);
      if (showAttach && attachRef.current && !attachRef.current.contains(e.target as Node)) setShowAttach(false);
      if (showChatMenu && chatMenuRef.current && !chatMenuRef.current.contains(e.target as Node)) setShowChatMenu(false);
      if (showDocPanel && docPanelRef.current && !docPanelRef.current.contains(e.target as Node)) setShowDocPanel(false);
    }
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [showEmoji, showAttach, showChatMenu, showDocPanel]);

  /* ── Escape closes overlays ── */
  useEffect(() => {
    function h(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (pendingFiles.length) { setPendingFiles([]); setActiveFileIdx(0); }
      }
    }
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [pendingFiles.length]);

  /* ── load deleted chats ── */
  useEffect(() => {
    supabase.from('deleted_chats').select('phone').then(({ data, error: err }) => {
      if (!err && data?.length) {
        const s = new Set(data.map((r: { phone: string }) => String(r.phone)));
        setDeletedChats(s);
        deletedChatsRef.current = s;
      }
      deletedChatsLoadedRef.current = true;
    });
  }, []);

  const addDeletedChat = useCallback(async (ph: string) => {
    const digits = toDigits(ph);
    const canon = canonize(digits);
    const variants = [ph, digits, canon].filter(Boolean);
    setDeletedChats(prev => {
      const next = new Set(prev);
      variants.forEach(v => next.add(v));
      deletedChatsRef.current = next;
      return next;
    });
    for (const v of variants) {
      await supabase.from('deleted_chats').upsert({ phone: v }, { onConflict: 'phone' }).catch(() => {});
    }
  }, []);

  /* ── status ── */
  const loadStatus = useCallback(async () => {
    setStatusLoading(true); setError(null);
    try { setStatus(await getZApiStatus()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Erro ao verificar conexão.'); setStatus(null); }
    finally { setStatusLoading(false); }
  }, []);
  useEffect(() => { loadStatus(); }, [loadStatus]);

  /* ── chats ── */
  const loadChats = useCallback(async () => {
    if (!status?.connected) return;
    if (!deletedChatsLoadedRef.current) {
      await new Promise<void>(resolve => {
        const check = () => { if (deletedChatsLoadedRef.current) resolve(); else setTimeout(check, 50); };
        check();
      });
    }
    if (!chatsLoadedOnceRef.current) setChatsLoading(true);
    try {
      const chatList = await getChats(1, 50);
      const rawList = (Array.isArray(chatList) ? chatList : []).filter(c => chatPhone(c) && chatPhone(c) !== '0');

      const seenCanon = new Set<string>();
      const filtered = rawList.filter(c => {
        const raw = chatPhone(c);
        const d = toDigits(raw);
        const canon = canonize(d);
        if (!canon) return false;
        if (seenCanon.has(canon) || deletedChatsRef.current.has(d) || deletedChatsRef.current.has(canon) || deletedChatsRef.current.has(raw)) return false;
        seenCanon.add(canon);
        return true;
      });

      setChats(filtered);
      chatsLoadedOnceRef.current = true;

      // Load last message previews from Supabase
      const phones = filtered.map(c => canonize(toDigits(chatPhone(c)))).filter(Boolean);
      if (phones.length > 0) {
        const { data } = await supabase
          .from('whatsapp_messages')
          .select('phone, body, status, from_me')
          .in('phone', phones)
          .order('timestamp', { ascending: false })
          .limit(phones.length);
        if (data) {
          const map = new Map<string, { body: string; status: string | null; fromMe: boolean }>();
          for (const row of data) {
            if (!map.has(row.phone)) {
              map.set(row.phone, { body: row.body, status: row.status, fromMe: row.from_me });
            }
          }
          setLastMsgMap(map);
        }
      }
    } catch { if (!chatsLoadedOnceRef.current) setChats([]); }
    finally { setChatsLoading(false); }
  }, [status?.connected]);

  useEffect(() => { if (status?.connected) loadChats(); else setChats([]); }, [status?.connected, loadChats]);
  useEffect(() => {
    if (!status?.connected) return;
    const iv = setInterval(loadChats, 20000);
    return () => clearInterval(iv);
  }, [status?.connected, loadChats]);

  /* ── contacts ── */
  const loadContacts = useCallback(async () => {
    if (!status?.connected) return;
    setContactsLoading(true);
    try {
      const res = await fetch('/api/zapi?action=contacts&page=1&pageSize=200');
      if (res.ok) {
        const data = await res.json();
        const list = (Array.isArray(data) ? data : []).filter((c: ZApiChat) => {
          const p = chatPhone(c);
          return p && p !== '0' && !c.isGroup;
        });
        setContacts(list);
        contactsLoadedRef.current = true;
      }
    } catch { /* ignore */ }
    finally { setContactsLoading(false); }
  }, [status?.connected]);

  useEffect(() => {
    if (sidebarTab === 'contacts' && status?.connected && !contactsLoadedRef.current) {
      loadContacts();
    }
  }, [sidebarTab, status?.connected, loadContacts]);

  const handleStartChat = (phone: string, name?: string) => {
    const normalized = normalizePhone(phone);
    // Check if chat already exists
    const existing = chats.find(c => canonize(toDigits(chatPhone(c))) === canonize(toDigits(normalized)));
    if (existing) {
      setSelectedChat(existing);
      setSidebarTab('chats');
      return;
    }
    // Create a virtual chat entry
    const newChat: ZApiChat = { phone: normalized, name: name || formatPhone(normalized) };
    setChats(prev => [newChat, ...prev]);
    setSelectedChat(newChat);
    setSidebarTab('chats');
  };

  const handleAddNewContact = () => {
    const phone = newContactPhone.trim();
    if (!phone) { toast.error('Informe o numero do telefone.'); return; }
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 10) { toast.error('Numero invalido. Use DDD + numero.'); return; }
    handleStartChat(digits, newContactName.trim() || undefined);
    setNewContactName('');
    setNewContactPhone('');
    setShowNewContact(false);
    toast.success('Conversa iniciada!');
  };

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    const q = contactSearch.toLowerCase();
    return contacts.filter(c => chatLabel(c).toLowerCase().includes(q) || chatPhone(c).includes(q));
  }, [contacts, contactSearch]);

  /* ── platform documents ── */
  const loadPlatformDocs = useCallback(async () => {
    if (docsLoadedRef.current) return;
    setDocsLoading(true);
    try {
      const { data } = await supabase
        .from('documents')
        .select('*')
        .order('updated_at', { ascending: false });
      if (data) { setPlatformDocs(data as Document[]); docsLoadedRef.current = true; }
    } catch { /* ignore */ }
    finally { setDocsLoading(false); }
  }, []);

  const toggleDocPanel = () => {
    const next = !showDocPanel;
    setShowDocPanel(next);
    if (next && !docsLoadedRef.current) loadPlatformDocs();
    if (next && linkedContato) setDocPanelTab('empresa');
    else if (next) setDocPanelTab('todos');
  };

  const sendPlatformDoc = async (doc: Document) => {
    if (!selectedChat || sending) return;
    const phone = canonize(toDigits(chatPhone(selectedChat)));
    if (!doc.arquivo_url) { toast.error('Documento sem arquivo.'); return; }
    setSending(true); setShowDocPanel(false);
    const ts = Date.now();
    const label = `${doc.codigo} - ${doc.titulo}`;
    // Optimistic UI
    setMessages(prev => [...prev, {
      id: `temp-${Date.now()}`,
      created_at: new Date().toISOString(),
      message_id: null,
      phone,
      from_me: true,
      timestamp: ts,
      status: 'SENT',
      sender_name: '',
      chat_name: chatLabel(selectedChat),
      body: label,
      message_type: 'document',
      raw: { _fileName: doc.arquivo_nome },
    }]);
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 50);
    try {
      const r = await sendDocument(phone, doc.arquivo_url, doc.arquivo_nome || `${doc.codigo}.pdf`);
      supabase.from('whatsapp_messages').insert({
        message_id: r.messageId || r.zaapId || r.id || null,
        phone,
        from_me: true,
        timestamp: ts,
        status: 'SENT',
        sender_name: '',
        chat_name: chatLabel(selectedChat),
        body: label,
        message_type: 'document',
        raw: { _fileName: doc.arquivo_nome },
      }).then(() => {});
      toast.success(`Documento "${doc.codigo}" enviado!`);
    } catch (e) { toast.error('Falha ao enviar documento.'); }
    finally { setSending(false); }
  };

  const filteredDocs = useMemo(() => {
    if (!docSearch) return platformDocs;
    const q = docSearch.toLowerCase();
    return platformDocs.filter(d =>
      d.titulo.toLowerCase().includes(q) ||
      d.codigo.toLowerCase().includes(q) ||
      (d.norma || '').toLowerCase().includes(q)
    );
  }, [platformDocs, docSearch]);

  /* ── lazy load profile pictures ── */
  const loadPhoto = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (!digits || photoCache.has(digits) || photoLoadingRef.current.has(digits)) return;
    photoLoadingRef.current.add(digits);
    try {
      const link = await getProfilePicture(digits);
      setPhotoCache(prev => new Map(prev).set(digits, link));
    } catch {
      setPhotoCache(prev => new Map(prev).set(digits, null));
    }
    photoLoadingRef.current.delete(digits);
  }, [photoCache]);

  useEffect(() => {
    if (!status?.connected || !chats.length) return;
    chats.slice(0, 20).forEach(c => {
      const p = toDigits(chatPhone(c));
      if (p && !photoCache.has(p)) loadPhoto(p);
    });
  }, [chats, status?.connected, loadPhoto, photoCache]);

  /* ── sync Z-API messages to Supabase (Mimatour pattern) ── */
  const syncZApiMessages = useCallback(async (phone: string, chatName: string) => {
    try {
      const res = await fetch(`/api/zapi?action=messages&phone=${phone}&amount=50`);
      if (!res.ok) return;
      const zapiMsgs = await res.json();
      if (!Array.isArray(zapiMsgs) || zapiMsgs.length === 0) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows = zapiMsgs.filter((m: any) => m.messageId).map((m: any) => {
        const text = m.text;
        let body = '';
        let msgType = 'text';
        if (typeof text === 'object' && text) { body = text.message || ''; }
        else if (typeof text === 'string') { body = text; }
        if (m.image) { msgType = 'image'; body = m.image?.caption || body || ''; }
        else if (m.document) { msgType = 'document'; body = m.document?.fileName ? `[Arquivo] ${m.document.fileName}` : body; }
        else if (m.audio) { msgType = 'audio'; body = body || '[Audio]'; }
        else if (m.video) { msgType = 'video'; body = m.video?.caption || '[Video]'; }
        return {
          message_id: String(m.messageId),
          phone,
          from_me: m.fromMe === true,
          timestamp: Number(m.momment) || Number(m.timestamp) || Date.now(),
          status: m.status || null,
          sender_name: m.senderName || null,
          chat_name: m.chatName || chatName || null,
          body,
          message_type: msgType,
          raw: m,
        };
      });
      if (rows.length > 0) {
        await supabase.from('whatsapp_messages').upsert(rows, { onConflict: 'message_id' });
      }
    } catch { /* sync failed silently */ }
  }, []);

  /* ── load messages: sync Z-API → read Supabase ── */
  const loadMessages = useCallback(async (chat: ZApiChat, silent = false) => {
    const p = canonize(toDigits(chatPhone(chat)));
    if (!p) return;
    if (!silent) { setMessagesLoading(true); }

    // 1) Sync from Z-API to Supabase
    await syncZApiMessages(p, chatLabel(chat));

    // 2) Read from Supabase
    try {
      const { data, error: err } = await supabase
        .from('whatsapp_messages')
        .select('*')
        .eq('phone', p)
        .order('timestamp', { ascending: true })
        .limit(200);
      if (!err && data && data.length > 0) {
        setMessages(data as WhatsAppMessage[]);
      } else {
        if (!silent) setMessages([]);
      }
    } catch {
      if (!silent) setMessages([]);
    }
    if (!silent) setMessagesLoading(false);
  }, [syncZApiMessages]);

  useEffect(() => {
    if (selectedChat) {
      initialScrollDoneRef.current = false;
      userScrolledUpRef.current = false;
      loadMessages(selectedChat);

      // Look up linked contact/empresa
      const phone = canonize(toDigits(chatPhone(selectedChat)));
      if (phone && phone !== linkedContatoRef.current) {
        linkedContatoRef.current = phone;
        findContatoByPhone(phone).then(contato => {
          setLinkedContato(contato);
          if (contato?.empresa_id) {
            supabase.from('documents').select('*')
              .eq('cliente_id', contato.empresa_id)
              .order('updated_at', { ascending: false })
              .then(({ data }) => setEmpresaDocs((data || []) as Document[]));
          } else {
            setEmpresaDocs([]);
          }
        });

        // Load document history for this chat
        supabase.from('whatsapp_messages').select('*')
          .eq('phone', phone)
          .eq('message_type', 'document')
          .order('timestamp', { ascending: false })
          .limit(50)
          .then(({ data }) => setChatDocHistory((data || []) as WhatsAppMessage[]));
      }
    } else {
      setMessages([]);
      setLinkedContato(null);
      setEmpresaDocs([]);
      setShowProfile(false);
      setChatDocHistory([]);
      linkedContatoRef.current = '';
    }
  }, [selectedChat ? chatId(selectedChat) : null]);

  // Poll for new messages
  useEffect(() => {
    if (!selectedChat || !status?.connected) return;
    const iv = setInterval(() => loadMessages(selectedChat, true), 5000);
    return () => clearInterval(iv);
  }, [selectedChat ? chatId(selectedChat) : null, status?.connected, loadMessages]);

  /* ── Supabase Realtime ── */
  useEffect(() => {
    if (!selectedChat) return;
    const p = canonize(toDigits(chatPhone(selectedChat)));
    if (!p) return;
    const ch = supabase.channel('wamsg-' + p)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const row = payload.new as { phone?: string };
        const ph = (row?.phone || '').replace(/\D/g, '');
        if (p === ph || p === canonize(ph)) loadMessages(selectedChat, true);
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [selectedChat ? chatId(selectedChat) : null, loadMessages]);

  /* ── Realtime: global unread ── */
  const selectedChatRef = useRef<ZApiChat | null>(null);
  useEffect(() => { selectedChatRef.current = selectedChat; }, [selectedChat]);
  useEffect(() => {
    const ch = supabase.channel('global-unread-certifica')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, (payload) => {
        const row = payload.new as { phone?: string; from_me?: boolean; body?: string; status?: string };
        if (row.from_me) return;
        const ph = canonize((row?.phone || '').replace(/\D/g, ''));
        if (!ph) return;
        // Update last message
        setLastMsgMap(prev => {
          const n = new Map(prev);
          n.set(ph, { body: row.body || '', status: row.status || null, fromMe: false });
          return n;
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  /* ── scroll management ── */
  const handleMessagesScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    userScrolledUpRef.current = el.scrollTop + el.clientHeight < el.scrollHeight - 150;
  }, []);

  useEffect(() => {
    if (!messages.length) return;
    if (!initialScrollDoneRef.current) {
      initialScrollDoneRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
      return;
    }
    if (!userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    const el = inputRef.current; if (!el) return;
    el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [inputText]);

  /* ── send text ── */
  const handleSend = async () => {
    const text = inputText.trim(); if (!text || !selectedChat || sending) return;
    setSending(true); setError(null);
    const phone = canonize(toDigits(chatPhone(selectedChat)));
    const ts = Date.now();
    const tempId = `local-${ts}-${Math.random().toString(36).slice(2, 8)}`;
    // Optimistic: add to UI immediately
    const tempMsg: WhatsAppMessage = {
      id: tempId,
      created_at: new Date().toISOString(),
      message_id: tempId,
      phone,
      from_me: true,
      timestamp: ts,
      status: 'SENT',
      sender_name: '',
      chat_name: chatLabel(selectedChat),
      body: text,
      message_type: 'text',
      raw: {},
    };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); inputRef.current?.focus(); }, 50);
    try {
      const r = await sendText(phone, text);
      const realId = r.messageId || r.zaapId || r.id || tempId;
      // Save to Supabase — await to ensure it's there before next poll
      await supabase.from('whatsapp_messages').upsert({
        message_id: realId,
        phone,
        from_me: true,
        timestamp: ts,
        status: 'SENT',
        sender_name: '',
        chat_name: chatLabel(selectedChat),
        body: text,
        message_type: 'text',
        raw: {},
      }, { onConflict: 'message_id' });
      // Update temp message with real id
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: realId, message_id: realId } : m));
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao enviar.'); toast.error('Erro ao enviar mensagem.'); }
    finally { setSending(false); }
  };

  /* ── stage files ── */
  const stageFiles = async (files: FileList | File[], type: 'image' | 'document') => {
    const arr = Array.from(files);
    const staged: StagedFile[] = await Promise.all(arr.map(async f => {
      const base64 = await fileToBase64(f);
      const preview = f.type.startsWith('image/') ? base64 : undefined;
      return { file: f, base64, type, preview, caption: '' };
    }));
    setPendingFiles(prev => {
      const next = [...prev, ...staged];
      setActiveFileIdx(prev.length);
      return next;
    });
  };

  const updateCaption = (idx: number, caption: string) => {
    setPendingFiles(prev => prev.map((f, i) => i === idx ? { ...f, caption } : f));
  };

  const removeFile = (idx: number) => {
    setPendingFiles(prev => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) { setActiveFileIdx(0); return []; }
      setActiveFileIdx(i => i >= next.length ? next.length - 1 : i);
      return next;
    });
  };

  /* ── send all files ── */
  const confirmSendAllFiles = async () => {
    if (!pendingFiles.length || !selectedChat || sending) return;
    setSending(true); setError(null);
    try {
      const phone = canonize(toDigits(chatPhone(selectedChat)));
      for (const sf of pendingFiles) {
        let r: ZApiSendResult;
        if (sf.type === 'image') {
          r = await sendImage(phone, sf.base64, sf.caption.trim() || undefined);
        } else {
          r = await sendDocument(phone, sf.base64, sf.file.name, sf.caption.trim() || undefined);
        }
        await supabase.from('whatsapp_messages').insert({
          message_id: r.messageId || r.zaapId || r.id || null,
          phone,
          from_me: true,
          timestamp: Date.now(),
          status: 'SENT',
          sender_name: '',
          chat_name: chatLabel(selectedChat),
          body: sf.caption.trim() || sf.file.name,
          message_type: sf.type,
          raw: { _fileName: sf.file.name, _mimeType: sf.file.type },
        });
      }
      setPendingFiles([]); setActiveFileIdx(0);
      await loadMessages(selectedChat, true);
      setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao enviar.'); }
    finally { setSending(false); }
  };

  /* ── record audio ── */
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.start(); mediaRecorderRef.current = mr; setIsRecording(true); setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch { setError('Não foi possível acessar o microfone.'); }
  };

  const stopRecording = (cancel = false) => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    const rec = mediaRecorderRef.current; if (!rec) { setIsRecording(false); return; }
    if (cancel) { rec.stream.getTracks().forEach(t => t.stop()); rec.stop(); setIsRecording(false); return; }
    rec.onstop = async () => {
      rec.stream.getTracks().forEach(t => t.stop());
      const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setIsRecording(false); if (!blob.size || !selectedChat) return;
      setSending(true);
      try {
        const base64 = await fileToBase64(blob);
        const phone = canonize(toDigits(chatPhone(selectedChat)));
        const r = await sendAudio(phone, base64);
        await supabase.from('whatsapp_messages').insert({
          message_id: r.messageId || r.zaapId || r.id || null,
          phone,
          from_me: true,
          timestamp: Date.now(),
          status: 'SENT',
          sender_name: '',
          chat_name: chatLabel(selectedChat),
          body: `Audio (${formatDuration(recordingTime)})`,
          message_type: 'audio',
          raw: {},
        });
        await loadMessages(selectedChat, true);
      } catch (e) { toast.error('Falha ao enviar audio.'); }
      finally { setSending(false); }
    };
    rec.stop();
  };

  /* ── chat actions ── */
  const handleDeleteChat = async () => {
    setShowChatMenu(false);
    if (!selectedChat) return;
    const ph = toDigits(chatPhone(selectedChat));
    if (!ph) return;
    try {
      const canon = canonize(ph);
      await supabase.from('whatsapp_messages').delete().eq('phone', canon);
      await addDeletedChat(ph);
      setChats(prev => prev.filter(c => toDigits(chatPhone(c)) !== ph));
      setMessages([]);
      setSelectedChat(null);
      toast.success('Conversa apagada.');
    } catch { toast.error('Falha ao apagar conversa.'); }
  };

  const insertEmoji = (emoji: string) => { setInputText(t => t + emoji); inputRef.current?.focus(); };

  const getPhoto = (chat: ZApiChat): string | null => {
    const fromChat = chat.profileThumbnail;
    if (fromChat && fromChat !== 'null' && fromChat.trim()) return fromChat;
    const digits = toDigits(chatPhone(chat));
    const fromCache = photoCache.get(digits);
    return fromCache && fromCache !== 'null' ? fromCache : null;
  };

  const persistToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, key: string, id: string, onMsg: string, offMsg: string) => {
    setter(prev => {
      const next = new Set(prev);
      const removing = next.has(id);
      if (removing) next.delete(id); else next.add(id);
      try { localStorage.setItem(key, JSON.stringify([...next])); } catch { }
      toast.success(removing ? offMsg : onMsg);
      return next;
    });
  };

  /* ── filtered & sorted chats ── */
  const filteredChats = useMemo(() => {
    let list = chats;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(c => chatLabel(c).toLowerCase().includes(q) || chatPhone(c).includes(q));
    }
    list.sort((a, b) => {
      const pa = pinnedIds.has(chatId(a)) ? 1 : 0;
      const pb = pinnedIds.has(chatId(b)) ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return Number(b.lastMessageTime || 0) - Number(a.lastMessageTime || 0);
    });
    return list;
  }, [chats, searchTerm, pinnedIds]);

  const activeFile = pendingFiles[activeFileIdx] || null;

  /* ── render ──────────────────────────────────────── */

  if (statusLoading) return (
    <div className="flex h-full items-center justify-center bg-[#f0f4f8]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-[#2B8EAD]" />
        <p className="text-sm text-gray-500">Conectando ao WhatsApp...</p>
      </div>
    </div>
  );

  if (!status?.connected) return (
    <div className="flex h-full items-center justify-center bg-[#f0f4f8]">
      <div className="flex flex-col items-center gap-4 rounded-2xl bg-white p-10 shadow-sm max-w-md text-center">
        <div className="w-16 h-16 rounded-full bg-[#2B8EAD]/10 flex items-center justify-center">
          <Wifi className="h-8 w-8 text-[#2B8EAD]" />
        </div>
        <h2 className="text-lg font-semibold text-[#0F172A]">WhatsApp Desconectado</h2>
        <p className="text-sm text-gray-500 leading-relaxed">
          Configure as credenciais Z-API (ZAPI_INSTANCE_ID e ZAPI_TOKEN) nas variaveis de ambiente do Vercel e conecte seu WhatsApp.
        </p>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button onClick={loadStatus} className="inline-flex items-center gap-2 rounded-lg bg-[#2B8EAD] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1F7490] transition-colors">
          <Wifi className="h-4 w-4" /> Tentar novamente
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-full w-full bg-[#f0f4f8] overflow-hidden">
      {/* ── SIDEBAR ── */}
      <aside className={`relative flex flex-col border-r border-gray-200 bg-white flex-shrink-0 ${selectedChat ? 'hidden md:flex w-[340px]' : 'w-full md:w-[340px] md:flex'}`}>
        {/* Header */}
        <div className="px-3 py-3 bg-[#f0f2f5] border-b border-gray-200 flex-shrink-0">
          {/* Tabs */}
          <div className="flex rounded-lg bg-white border border-gray-200 overflow-hidden mb-2">
            <button
              onClick={() => setSidebarTab('chats')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${sidebarTab === 'chats' ? 'bg-[#2B8EAD] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <MessageSquare className="w-3.5 h-3.5" /> Conversas
            </button>
            <button
              onClick={() => setSidebarTab('contacts')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${sidebarTab === 'contacts' ? 'bg-[#2B8EAD] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <Contact className="w-3.5 h-3.5" /> Contatos
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={sidebarTab === 'chats' ? 'Pesquisar conversa...' : 'Pesquisar contato...'}
              value={sidebarTab === 'chats' ? searchTerm : contactSearch}
              onChange={e => sidebarTab === 'chats' ? setSearchTerm(e.target.value) : setContactSearch(e.target.value)}
              className="w-full rounded-lg bg-white py-2 pl-10 pr-3 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2B8EAD] border border-gray-200"
            />
          </div>
        </div>

        {/* ── Tab: Conversas ── */}
        {sidebarTab === 'chats' && (
          <div className="flex-1 overflow-y-auto">
            {chatsLoading && !chatsLoadedOnceRef.current && (
              <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversas...
              </div>
            )}
            {!chatsLoading && filteredChats.length === 0 && (
              <div className="flex items-center justify-center py-10 text-sm text-gray-500 px-4 text-center">
                {searchTerm ? 'Nenhuma conversa encontrada.' : 'Nenhuma conversa disponivel.'}
              </div>
            )}
            {filteredChats.map(chat => {
              const id = chatId(chat);
              const active = selectedChat && chatId(selectedChat) === id;
              const photo = getPhoto(chat);
              const label = chatLabel(chat);
              const initial = chatInitial(chat);
              const color = avatarColor(id);
              const phone = canonize(toDigits(chatPhone(chat)));
              const preview = lastMsgMap.get(phone);
              const unread = Number(chat.unread || chat.messagesUnread || 0);
              const isPinned = pinnedIds.has(id);
              const isFav = favoriteIds.has(id);

              return (
                <button
                  key={id}
                  onClick={() => {
                    setSelectedChat(chat);
                    if (unread > 0) {
                      modifyChat(chatPhone(chat), 'read').catch(() => { });
                      setChats(prev => prev.map(c => chatId(c) === id ? { ...c, unread: '0', messagesUnread: 0 } : c));
                    }
                  }}
                  className={`w-full text-left flex items-center gap-3 px-3 py-3 border-b border-gray-100 transition-colors ${active ? 'bg-[#f0f2f5]' : 'hover:bg-[#f5f6f6]'}`}
                >
                  <div className="flex-shrink-0">
                    {photo ? (
                      <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg ${chat.isGroup ? 'bg-[#2B8EAD]' : color}`}>
                        {chat.isGroup ? <Users className="w-5 h-5" /> : initial}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-[#0F172A] truncate flex items-center gap-1">
                        {isPinned && <Pin className="w-3 h-3 text-gray-400 flex-shrink-0" />}
                        {isFav && <Star className="w-3 h-3 text-amber-400 flex-shrink-0 fill-amber-400" />}
                        {label}
                      </span>
                      <span className="text-[11px] text-gray-500 flex-shrink-0">{formatTime(chat.lastMessageTime)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <span className="text-[12px] text-gray-500 truncate">
                        {preview ? (
                          <>
                            {preview.fromMe && <StatusTicks status={preview.status} />}
                            {' '}{preview.body || 'Mensagem'}
                          </>
                        ) : 'Sem mensagens'}
                      </span>
                      {unread > 0 && (
                        <span className="min-w-5 h-5 px-1 rounded-full bg-[#2B8EAD] text-white text-[11px] flex items-center justify-center font-medium">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Tab: Contatos ── */}
        {sidebarTab === 'contacts' && (
          <div className="flex-1 overflow-y-auto">
            {/* Add new contact button */}
            <button
              onClick={() => setShowNewContact(v => !v)}
              className="w-full flex items-center gap-3 px-3 py-3 border-b border-gray-100 hover:bg-[#f5f6f6] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#2B8EAD] flex items-center justify-center flex-shrink-0">
                <UserPlus className="w-5 h-5 text-white" />
              </div>
              <span className="text-[13px] font-semibold text-[#2B8EAD]">Nova conversa</span>
            </button>

            {/* New contact form */}
            {showNewContact && (
              <div className="px-3 py-3 bg-[#f0f2f5] border-b border-gray-200">
                <input
                  type="text"
                  placeholder="Nome (opcional)"
                  value={newContactName}
                  onChange={e => setNewContactName(e.target.value)}
                  className="w-full rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2B8EAD] mb-2"
                />
                <input
                  type="tel"
                  placeholder="Telefone (ex: 11999999999)"
                  value={newContactPhone}
                  onChange={e => setNewContactPhone(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddNewContact(); }}
                  className="w-full rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2B8EAD] mb-2"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleAddNewContact}
                    className="flex-1 rounded-lg bg-[#2B8EAD] text-white text-sm font-medium py-2 hover:bg-[#1F7490] transition-colors"
                  >
                    Iniciar conversa
                  </button>
                  <button
                    onClick={() => { setShowNewContact(false); setNewContactName(''); setNewContactPhone(''); }}
                    className="rounded-lg bg-gray-200 text-gray-600 text-sm font-medium px-3 py-2 hover:bg-gray-300 transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Contacts loading */}
            {contactsLoading && (
              <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando contatos...
              </div>
            )}

            {/* Contacts list */}
            {!contactsLoading && filteredContacts.length === 0 && contactsLoadedRef.current && (
              <div className="flex items-center justify-center py-10 text-sm text-gray-500 px-4 text-center">
                {contactSearch ? 'Nenhum contato encontrado.' : 'Nenhum contato disponivel. Use "Nova conversa" para iniciar.'}
              </div>
            )}

            {filteredContacts.map(contact => {
              const id = chatId(contact);
              const label = chatLabel(contact);
              const initial = chatInitial(contact);
              const color = avatarColor(id);
              const photo = contact.profileThumbnail || null;
              const phone = chatPhone(contact);

              return (
                <button
                  key={id}
                  onClick={() => handleStartChat(phone, contact.name)}
                  className="w-full text-left flex items-center gap-3 px-3 py-3 border-b border-gray-100 hover:bg-[#f5f6f6] transition-colors"
                >
                  <div className="flex-shrink-0">
                    {photo ? (
                      <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                    ) : (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg ${color}`}>
                        {initial}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-semibold text-[#0F172A] truncate block">{label}</span>
                    <span className="text-[11px] text-gray-500">{formatPhone(phone)}</span>
                  </div>
                  <MessageSquare className="w-4 h-4 text-gray-400 flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </aside>

      {/* ── MAIN CHAT AREA ── */}
      <main className={`flex-1 flex flex-col min-w-0 ${!selectedChat ? 'hidden md:flex' : 'flex'}`}>
        {!selectedChat ? (
          <div className="flex-1 flex items-center justify-center bg-[#f0f2f5]">
            <div className="flex flex-col items-center gap-3 text-center max-w-sm">
              <div className="w-20 h-20 rounded-full bg-[#2B8EAD]/10 flex items-center justify-center">
                <MessageSquare className="h-10 w-10 text-[#2B8EAD]" />
              </div>
              <h3 className="text-xl font-light text-gray-600">CERTIFICA WhatsApp</h3>
              <p className="text-sm text-gray-400">Selecione uma conversa para iniciar o atendimento.</p>
            </div>
          </div>
        ) : (
          <>
            {/* ── Chat header ── */}
            <div className="px-4 py-2 bg-[#f0f2f5] border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              {/* Back button (mobile) */}
              <button onClick={() => setSelectedChat(null)} className="md:hidden p-1 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="w-5 h-5" />
              </button>

              {/* Avatar + Name (clickable → opens empresa profile) */}
              {(() => {
                const photo = getPhoto(selectedChat);
                const handleProfileClick = () => setShowProfile(p => !p);
                const canNavigate = true;
                const clickClass = canNavigate ? 'cursor-pointer hover:opacity-80 transition-opacity' : '';
                return (
                  <>
                    <div onClick={handleProfileClick} className={`flex-shrink-0 ${clickClass}`}>
                      {photo ? (
                        <img src={photo} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${selectedChat.isGroup ? 'bg-[#2B8EAD]' : avatarColor(chatId(selectedChat))}`}>
                          {selectedChat.isGroup ? <Users className="w-5 h-5" /> : chatInitial(selectedChat)}
                        </div>
                      )}
                    </div>

                    <div className={`flex-1 min-w-0 ${clickClass}`} onClick={handleProfileClick}>
                      <h3 className="text-sm font-semibold text-[#0F172A] truncate">{chatLabel(selectedChat)}</h3>
                      <div className="flex items-center gap-2">
                        <p className="text-[11px] text-gray-500 truncate">{formatPhone(chatPhone(selectedChat))}</p>
                        {linkedContato && (
                          <span className="text-[9px] bg-[#2B8EAD]/10 text-[#2B8EAD] px-1.5 py-0.5 rounded font-medium truncate max-w-[120px]">
                            {linkedContato.empresa_nome}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Actions */}
              <div className="flex items-center gap-1 relative" ref={chatMenuRef}>
                <button onClick={() => setShowChatMenu(v => !v)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showChatMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 w-52 rounded-lg bg-white shadow-xl border border-gray-200 py-1">
                    <button onClick={() => { persistToggle(setPinnedIds, PINNED_KEY, chatId(selectedChat), 'Conversa fixada.', 'Conversa desafixada.'); setShowChatMenu(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-[#0F172A] hover:bg-gray-50">
                      <Pin className="h-4 w-4 text-gray-500" /> {pinnedIds.has(chatId(selectedChat)) ? 'Desafixar' : 'Fixar conversa'}
                    </button>
                    <button onClick={() => { persistToggle(setFavoriteIds, FAVORITES_KEY, chatId(selectedChat), 'Adicionado aos favoritos.', 'Removido dos favoritos.'); setShowChatMenu(false); }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-[#0F172A] hover:bg-gray-50">
                      <Star className="h-4 w-4 text-gray-500" /> {favoriteIds.has(chatId(selectedChat)) ? 'Remover favorito' : 'Favoritar'}
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button onClick={handleDeleteChat}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-[13px] text-red-600 hover:bg-red-50">
                      <Trash2 className="h-4 w-4" /> Apagar conversa
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Messages area ── */}
            <div
              ref={messagesContainerRef}
              onScroll={handleMessagesScroll}
              className="flex-1 overflow-y-auto px-4 py-3"
              style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'200\' height=\'200\' viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23d5dbd6\' fill-opacity=\'0.15\'%3E%3Ccircle cx=\'3\' cy=\'3\' r=\'1.5\'/%3E%3Ccircle cx=\'53\' cy=\'23\' r=\'1\'/%3E%3Ccircle cx=\'103\' cy=\'13\' r=\'1.5\'/%3E%3Ccircle cx=\'153\' cy=\'33\' r=\'1\'/%3E%3Ccircle cx=\'23\' cy=\'53\' r=\'1\'/%3E%3Ccircle cx=\'73\' cy=\'73\' r=\'1.5\'/%3E%3Ccircle cx=\'123\' cy=\'63\' r=\'1\'/%3E%3Ccircle cx=\'173\' cy=\'83\' r=\'1.5\'/%3E%3Ccircle cx=\'43\' cy=\'103\' r=\'1\'/%3E%3Ccircle cx=\'93\' cy=\'123\' r=\'1.5\'/%3E%3Ccircle cx=\'143\' cy=\'113\' r=\'1\'/%3E%3Ccircle cx=\'13\' cy=\'143\' r=\'1.5\'/%3E%3Ccircle cx=\'63\' cy=\'163\' r=\'1\'/%3E%3Ccircle cx=\'113\' cy=\'153\' r=\'1.5\'/%3E%3Ccircle cx=\'163\' cy=\'173\' r=\'1\'/%3E%3Ccircle cx=\'33\' cy=\'183\' r=\'1\'/%3E%3Ccircle cx=\'183\' cy=\'43\' r=\'1\'/%3E%3C/g%3E%3C/svg%3E")', backgroundColor: '#e8eff5' }}
            >
              {messagesLoading && (
                <div className="flex items-center justify-center py-10 gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando mensagens...
                </div>
              )}

              {!messagesLoading && messages.length === 0 && (
                <div className="flex items-center justify-center py-10 text-sm text-gray-500">
                  Nenhuma mensagem. Envie a primeira!
                </div>
              )}

              {messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const showDateSep = !prevMsg || dateSep(msg.timestamp ?? undefined) !== dateSep(prevMsg.timestamp ?? undefined);
                const fromMe = msg.from_me;
                const raw = (msg.raw || {}) as Record<string, unknown>;

                return (
                  <div key={msg.id}>
                    {showDateSep && msg.timestamp && (
                      <div className="flex justify-center my-3">
                        <span className="text-[11px] text-gray-600 bg-white px-3 py-1 rounded-lg shadow-sm">
                          {dateSep(msg.timestamp)}
                        </span>
                      </div>
                    )}
                    <div className={`flex mb-1 ${fromMe ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[65%] px-2.5 py-1.5 rounded-lg shadow-sm ${fromMe ? 'bg-[#d4eaf5]' : 'bg-white'}`}
                        style={{ minWidth: 80 }}>
                        {/* Sender name for incoming */}
                        {!fromMe && msg.sender_name && (
                          <div className="text-[11px] font-semibold text-[#2B8EAD] mb-0.5">{msg.sender_name}</div>
                        )}

                        {/* Image messages */}
                        {msg.message_type === 'image' && raw._localPreview && (
                          <img src={raw._localPreview as string} alt="" className="rounded-md max-w-full max-h-60 mb-1" />
                        )}

                        {/* Document messages */}
                        {msg.message_type === 'document' && (
                          <div className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1.5 mb-1">
                            <FileText className="w-5 h-5 text-gray-500 flex-shrink-0" />
                            <span className="text-[12px] text-gray-700 truncate">{(raw._fileName as string) || 'Documento'}</span>
                          </div>
                        )}

                        {/* Audio messages */}
                        {msg.message_type === 'audio' && (
                          <div className="flex items-center gap-2 py-0.5">
                            <Mic className="w-4 h-4 text-[#2B8EAD]" />
                            <span className="text-[12px] text-gray-600">{msg.body || 'Audio'}</span>
                          </div>
                        )}

                        {/* Text body */}
                        {msg.message_type !== 'audio' && msg.body && (
                          <p className="text-[13px] text-[#0F172A] whitespace-pre-wrap break-words">{msg.body}</p>
                        )}

                        {/* Timestamp + status */}
                        <div className={`flex items-center justify-end gap-1 mt-0.5 ${fromMe ? 'text-gray-500' : 'text-gray-400'}`}>
                          <span className="text-[10px]">{fmtMsgTime(msg.timestamp ?? undefined)}</span>
                          {fromMe && <StatusTicks status={msg.status} />}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* ── File preview overlay ── */}
            {pendingFiles.length > 0 && (
              <div className="absolute inset-0 z-50 bg-black/80 flex flex-col">
                <div className="flex items-center justify-between px-4 py-3">
                  <button onClick={() => { setPendingFiles([]); setActiveFileIdx(0); }} className="text-white hover:text-gray-300">
                    <X className="w-6 h-6" />
                  </button>
                  <span className="text-white text-sm">{activeFileIdx + 1} / {pendingFiles.length}</span>
                  <div className="w-6" />
                </div>

                <div className="flex-1 flex items-center justify-center px-4">
                  {activeFile?.preview ? (
                    <img src={activeFile.preview} alt="" className="max-w-full max-h-[60vh] object-contain rounded-lg" />
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-white">
                      <FileText className="w-16 h-16 text-gray-400" />
                      <span className="text-sm">{activeFile?.file.name}</span>
                    </div>
                  )}
                </div>

                {/* Thumbnails */}
                {pendingFiles.length > 1 && (
                  <div className="flex items-center justify-center gap-2 px-4 py-2">
                    {pendingFiles.map((f, i) => (
                      <button key={i} onClick={() => setActiveFileIdx(i)}
                        className={`w-14 h-14 rounded-lg overflow-hidden border-2 ${i === activeFileIdx ? 'border-[#2B8EAD]' : 'border-transparent'}`}>
                        {f.preview ? (
                          <img src={f.preview} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                      </button>
                    ))}
                    <label className="w-14 h-14 rounded-lg border-2 border-dashed border-gray-500 flex items-center justify-center cursor-pointer hover:border-gray-300">
                      <Plus className="w-5 h-5 text-gray-400" />
                      <input type="file" multiple className="hidden" onChange={e => e.target.files && stageFiles(e.target.files, 'image')} />
                    </label>
                  </div>
                )}

                {/* Caption + Send */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <input
                    type="text" placeholder="Legenda (opcional)"
                    value={activeFile?.caption || ''}
                    onChange={e => updateCaption(activeFileIdx, e.target.value)}
                    className="flex-1 rounded-full bg-gray-800 text-white px-4 py-2.5 text-sm placeholder:text-gray-400 focus:outline-none"
                  />
                  <button onClick={confirmSendAllFiles} disabled={sending}
                    className="w-12 h-12 rounded-full bg-[#2B8EAD] flex items-center justify-center text-white hover:bg-[#1F7490] disabled:opacity-50">
                    {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* ── Input area ── */}
            <div className="px-3 py-2 bg-[#f0f2f5] border-t border-gray-200 flex-shrink-0">
              {error && (
                <div className="text-[11px] text-red-600 bg-red-50 border border-red-200 rounded px-2.5 py-1.5 mb-2 flex items-center justify-between">
                  <span>{error}</span>
                  <button onClick={() => setError(null)}><X className="w-3.5 h-3.5" /></button>
                </div>
              )}

              {isRecording ? (
                <div className="flex items-center gap-3">
                  <button onClick={() => stopRecording(true)} className="p-2 text-red-500 hover:bg-red-50 rounded-full">
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-sm text-gray-600 font-mono">{formatDuration(recordingTime)}</span>
                    <div className="flex-1 flex items-center gap-0.5 h-8">
                      {[...Array(20)].map((_, i) => (
                        <div key={i} className="flex-1 bg-[#2B8EAD] rounded-full transition-all" style={{ height: `${Math.random() * 80 + 20}%` }} />
                      ))}
                    </div>
                  </div>
                  <button onClick={() => stopRecording(false)} className="w-12 h-12 rounded-full bg-[#2B8EAD] flex items-center justify-center text-white hover:bg-[#1F7490]">
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {/* Emoji button */}
                  <div className="relative" ref={emojiRef}>
                    <button onClick={() => setShowEmoji(v => !v)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                      <Smile className="w-5 h-5" />
                    </button>
                    {showEmoji && (
                      <div className="absolute bottom-12 left-0 z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 max-h-72 overflow-y-auto">
                        {EMOJI_CATEGORIES.map(cat => (
                          <div key={cat.label} className="p-2">
                            <div className="text-[10px] uppercase text-gray-500 font-semibold mb-1">{cat.label}</div>
                            <div className="flex flex-wrap gap-1">
                              {cat.emojis.map(e => (
                                <button key={e} onClick={() => insertEmoji(e)} className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg">
                                  {e}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Attach button */}
                  <div className="relative" ref={attachRef}>
                    <button onClick={() => setShowAttach(v => !v)} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors">
                      <Paperclip className="w-5 h-5" />
                    </button>
                    {showAttach && (
                      <div className="absolute bottom-12 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-200 py-2 w-48">
                        <label className="flex items-center gap-3 px-4 py-2 text-[13px] text-[#0F172A] hover:bg-gray-50 cursor-pointer">
                          <ImageIcon className="w-4 h-4 text-[#2B8EAD]" /> Imagem
                          <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                            onChange={e => { if (e.target.files) { stageFiles(e.target.files, 'image'); setShowAttach(false); } }} />
                        </label>
                        <label className="flex items-center gap-3 px-4 py-2 text-[13px] text-[#0F172A] hover:bg-gray-50 cursor-pointer">
                          <FileText className="w-4 h-4 text-[#7C65C1]" /> Documento
                          <input ref={docInputRef} type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip" className="hidden"
                            onChange={e => { if (e.target.files) { stageFiles(e.target.files, 'document'); setShowAttach(false); } }} />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Platform docs button */}
                  <div className="relative" ref={docPanelRef}>
                    <button onClick={toggleDocPanel} className="p-2 rounded-full text-gray-500 hover:bg-gray-200 transition-colors" title="Documentos da plataforma">
                      <FolderOpen className="w-5 h-5" />
                    </button>
                    {showDocPanel && (
                      <div className="absolute bottom-12 left-0 z-50 w-80 bg-white rounded-xl shadow-xl border border-gray-200 max-h-96 flex flex-col">
                        <div className="px-3 py-2 border-b border-gray-100">
                          {/* Tabs */}
                          {linkedContato ? (
                            <div className="flex rounded-md bg-gray-100 mb-1.5 overflow-hidden">
                              <button onClick={() => setDocPanelTab('empresa')}
                                className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${docPanelTab === 'empresa' ? 'bg-[#2B8EAD] text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                                Docs da Empresa
                              </button>
                              <button onClick={() => setDocPanelTab('todos')}
                                className={`flex-1 text-[10px] py-1.5 font-medium transition-colors ${docPanelTab === 'todos' ? 'bg-[#2B8EAD] text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                                Todos
                              </button>
                            </div>
                          ) : (
                            <div className="text-xs font-semibold text-[#0F172A] mb-1.5">Documentos da Plataforma</div>
                          )}
                          {linkedContato && docPanelTab === 'empresa' && (
                            <div className="text-[10px] text-gray-500 mb-1.5 flex items-center gap-1">
                              <Users className="w-3 h-3" /> {linkedContato.empresa_nome}
                            </div>
                          )}
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                            <input
                              type="text" placeholder="Buscar documento..."
                              value={docSearch} onChange={e => setDocSearch(e.target.value)}
                              className="w-full rounded-md bg-gray-50 py-1.5 pl-8 pr-3 text-xs text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2B8EAD] border border-gray-200"
                            />
                          </div>
                        </div>

                        {/* Documento history for this chat */}
                        {chatDocHistory.length > 0 && (
                          <div className="border-b border-gray-100">
                            <div className="px-3 py-1.5">
                              <div className="text-[9px] uppercase tracking-wider text-gray-400 font-semibold">Historico de documentos</div>
                            </div>
                            <div className="max-h-24 overflow-y-auto">
                              {chatDocHistory.slice(0, 5).map(msg => (
                                <div key={msg.id} className="flex items-center gap-2 px-3 py-1.5 text-[10px]">
                                  <FileText className="w-3 h-3 text-gray-400 flex-shrink-0" />
                                  <span className="truncate text-gray-600 flex-1">{msg.body}</span>
                                  <span className="text-gray-400 flex-shrink-0">
                                    {msg.from_me ? 'Enviado' : 'Recebido'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex-1 overflow-y-auto">
                          {docsLoading && (
                            <div className="flex items-center justify-center py-6 gap-2 text-xs text-gray-500">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
                            </div>
                          )}
                          {(() => {
                            const docsToShow = docPanelTab === 'empresa' && linkedContato
                              ? (docSearch ? empresaDocs.filter(d => d.titulo.toLowerCase().includes(docSearch.toLowerCase()) || d.codigo.toLowerCase().includes(docSearch.toLowerCase())) : empresaDocs)
                              : filteredDocs;
                            if (!docsLoading && docsToShow.length === 0) {
                              return <div className="py-6 text-center text-xs text-gray-500">
                                {docPanelTab === 'empresa' ? 'Nenhum documento desta empresa.' : 'Nenhum documento encontrado.'}
                              </div>;
                            }
                            return docsToShow.map(doc => (
                              <button
                                key={doc.id}
                                onClick={() => sendPlatformDoc(doc)}
                                disabled={!doc.arquivo_url || sending}
                                className="w-full text-left flex items-center gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 disabled:opacity-40 transition-colors"
                              >
                                <div className="w-8 h-8 rounded-lg bg-[#2B8EAD]/10 flex items-center justify-center flex-shrink-0">
                                  <FileText className="w-4 h-4 text-[#2B8EAD]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12px] font-medium text-[#0F172A] truncate">{doc.titulo}</div>
                                  <div className="text-[10px] text-gray-500 truncate">{doc.codigo} · {doc.norma || doc.tipo}</div>
                                </div>
                                <Send className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                              </button>
                            ));
                          })()}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text input */}
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
                    }}
                    placeholder="Mensagem"
                    className="flex-1 rounded-lg bg-white border border-gray-200 px-3 py-2 text-sm text-[#0F172A] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2B8EAD] resize-none min-h-[40px] max-h-[128px]"
                  />

                  {/* Send / Mic button */}
                  {inputText.trim() ? (
                    <button onClick={handleSend} disabled={sending}
                      className="w-11 h-11 rounded-full bg-[#2B8EAD] flex items-center justify-center text-white hover:bg-[#1F7490] disabled:opacity-50 flex-shrink-0 transition-colors">
                      {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                    </button>
                  ) : (
                    <button onClick={startRecording}
                      className="w-11 h-11 rounded-full bg-[#2B8EAD] flex items-center justify-center text-white hover:bg-[#1F7490] flex-shrink-0 transition-colors">
                      <Mic className="w-5 h-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ── PROFILE PANEL (right side) ── */}
      {showProfile && selectedChat && (() => {
        const profilePhoto = getPhoto(selectedChat);
        const profileName = chatLabel(selectedChat);
        const profilePhone = chatPhone(selectedChat);
        const profileSeed = (profilePhone || profileName).split('').reduce((a: number, c: string) => a + c.charCodeAt(0), 0);
        const profileHue = Math.abs(profileSeed) % 360;
        const receivedFiles = chatDocHistory.filter(m => !m.from_me);
        const sentFiles = chatDocHistory.filter(m => m.from_me);

        function renderFileItem(msg: WhatsAppMessage) {
          const isImg = msg.message_type === 'image';
          const isDoc = msg.message_type === 'document';
          const isAudio = msg.message_type === 'audio';
          const isVideo = msg.message_type === 'video';
          const IconEl = isImg ? ImageIcon : isDoc ? FileText : isAudio ? Mic : isVideo ? Play : Paperclip;
          const iconBg = isImg ? 'bg-amber-50 text-amber-500' : isDoc ? 'bg-blue-50 text-blue-500' : 'bg-green-50 text-green-500';
          // Try to extract media URL from raw payload
          const raw = msg.raw as Record<string, any> | undefined;
          const mediaUrl = raw?.image?.imageUrl || raw?.image?.url || raw?.document?.documentUrl || raw?.document?.url || raw?.video?.videoUrl || raw?.audio?.audioUrl || null;

          return (
            <div
              key={msg.id}
              onClick={() => mediaUrl && window.open(mediaUrl, '_blank')}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors ${mediaUrl ? 'cursor-pointer' : ''}`}
            >
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <IconEl className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] text-[#0F172A] truncate font-medium">
                  {msg.body || `[${msg.message_type}]`}
                </p>
                <p className="text-[10px] text-gray-400">
                  {msg.timestamp ? new Date(msg.timestamp).toLocaleDateString('pt-BR') : ''}
                </p>
              </div>
              {mediaUrl && <Download className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
            </div>
          );
        }

        return (
          <aside
            className="w-[400px] flex-shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-y-auto hidden md:flex"
            style={{ animation: 'certificaModalSlideIn 300ms cubic-bezier(0.22, 1, 0.36, 1) both' }}>
            {/* Header */}
            <div className="px-5 py-3 bg-[#f0f2f5] border-b border-gray-200 flex items-center justify-between">
              <span className="text-[14px] font-semibold text-[#0F172A]">Perfil do Contato</span>
              <button onClick={() => setShowProfile(false)} className="p-1.5 rounded-full hover:bg-gray-200 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Avatar + Name */}
            <div className="flex flex-col items-center py-8 px-5 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
              {profilePhoto ? (
                <img src={profilePhoto} alt="" className="w-24 h-24 rounded-full object-cover shadow-lg mb-4 ring-4 ring-white" />
              ) : (
                <div className="w-24 h-24 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-lg mb-4 ring-4 ring-white"
                  style={{ background: `linear-gradient(135deg, hsl(${profileHue}, 60%, 50%), hsl(${(profileHue + 35) % 360}, 50%, 40%))` }}>
                  {chatInitial(selectedChat)}
                </div>
              )}
              <h3 className="text-[18px] font-semibold text-[#0F172A] text-center">{profileName}</h3>
              <p className="text-[13px] text-gray-500 mt-0.5">{formatPhone(toDigits(profilePhone))}</p>
            </div>

            {/* Empresa vinculada */}
            {linkedContato && (
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2.5">Empresa</p>
                <button
                  onClick={() => linkedContato.empresa_id ? navigate(`/clientes/${linkedContato.empresa_id}`) : undefined}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-[#2B8EAD]/10 flex items-center justify-center flex-shrink-0">
                    <FolderOpen className="w-5 h-5 text-[#2B8EAD]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium text-[#0F172A] block truncate">{linkedContato.empresa_nome}</span>
                    <span className="text-[11px] text-gray-400">Cargo não especificado</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            )}

            {/* Contact details */}
            {(() => {
              const emailKey = `certifica-contact-email-${toDigits(profilePhone)}`;
              const notesKey = `certifica-contact-notes-${toDigits(profilePhone)}`;
              const [savedEmail, setSavedEmail] = React.useState(() => localStorage.getItem(emailKey) || '');
              const [savedNotes, setSavedNotes] = React.useState(() => localStorage.getItem(notesKey) || '');
              const [editingEmail, setEditingEmail] = React.useState(false);
              const [editingNotes, setEditingNotes] = React.useState(false);
              const [tempEmail, setTempEmail] = React.useState(savedEmail);
              const [tempNotes, setTempNotes] = React.useState(savedNotes);

              const saveEmail = () => { localStorage.setItem(emailKey, tempEmail); setSavedEmail(tempEmail); setEditingEmail(false); };
              const saveNotes = () => { localStorage.setItem(notesKey, tempNotes); setSavedNotes(tempNotes); setEditingNotes(false); };

              return (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2.5">Informações</p>
                  <div className="space-y-2.5">
                    {/* Telefone */}
                    <div className="flex items-center gap-2.5 text-[12px]">
                      <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-[#0F172A]">{formatPhone(toDigits(profilePhone))}</span>
                    </div>

                    {/* Email editável */}
                    <div className="flex items-center gap-2.5 text-[12px]">
                      <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      {editingEmail ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="email"
                            value={tempEmail}
                            onChange={e => setTempEmail(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && saveEmail()}
                            placeholder="email@exemplo.com"
                            className="flex-1 text-[12px] px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#2B8EAD]"
                            autoFocus
                          />
                          <button onClick={saveEmail} className="text-[#2B8EAD] text-[11px] font-medium hover:underline">Salvar</button>
                          <button onClick={() => { setTempEmail(savedEmail); setEditingEmail(false); }} className="text-gray-400 text-[11px] hover:underline">X</button>
                        </div>
                      ) : savedEmail ? (
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <a href={`mailto:${savedEmail}`} className="text-[#2B8EAD] hover:underline truncate">{savedEmail}</a>
                          <button onClick={() => { setTempEmail(savedEmail); setEditingEmail(true); }} className="text-gray-300 hover:text-gray-500 flex-shrink-0">
                            <Info className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setEditingEmail(true)} className="text-gray-400 hover:text-[#2B8EAD] transition-colors">
                          Adicionar email...
                        </button>
                      )}
                    </div>

                    {/* Observações editáveis */}
                    <div className="flex items-start gap-2.5 text-[12px]">
                      <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                      {editingNotes ? (
                        <div className="flex-1">
                          <textarea
                            value={tempNotes}
                            onChange={e => setTempNotes(e.target.value)}
                            placeholder="Observações sobre o contato..."
                            className="w-full text-[12px] px-2 py-1.5 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#2B8EAD] resize-none"
                            rows={3}
                            autoFocus
                          />
                          <div className="flex gap-1 mt-1">
                            <button onClick={saveNotes} className="text-[#2B8EAD] text-[11px] font-medium hover:underline">Salvar</button>
                            <button onClick={() => { setTempNotes(savedNotes); setEditingNotes(false); }} className="text-gray-400 text-[11px] hover:underline">Cancelar</button>
                          </div>
                        </div>
                      ) : savedNotes ? (
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-600 whitespace-pre-wrap text-[11px] cursor-pointer hover:bg-gray-50 rounded p-1 -m-1" onClick={() => { setTempNotes(savedNotes); setEditingNotes(true); }}>
                            {savedNotes}
                          </p>
                        </div>
                      ) : (
                        <button onClick={() => setEditingNotes(true)} className="text-gray-400 hover:text-[#2B8EAD] transition-colors">
                          Adicionar observações...
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Arquivos RECEBIDOS */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2.5">
                <span className="inline-flex items-center gap-1"><Download className="w-3 h-3" /> Recebidos ({receivedFiles.length})</span>
              </p>
              {receivedFiles.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-3">Nenhum arquivo recebido</p>
              ) : (
                <div className="space-y-1">{receivedFiles.slice(0, 15).map(renderFileItem)}</div>
              )}
            </div>

            {/* Arquivos ENVIADOS */}
            <div className="px-5 py-4 border-b border-gray-100">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2.5">
                <span className="inline-flex items-center gap-1"><Send className="w-3 h-3" /> Enviados ({sentFiles.length})</span>
              </p>
              {sentFiles.length === 0 ? (
                <p className="text-[11px] text-gray-400 text-center py-3">Nenhum arquivo enviado</p>
              ) : (
                <div className="space-y-1">{sentFiles.slice(0, 15).map(renderFileItem)}</div>
              )}
            </div>

            {/* Docs da empresa */}
            {/* Pipeline / Kanban */}
            {(() => {
              const phoneDigits = toDigits(profilePhone);
              const contactName = profileName;
              // Find existing card for this contact
              const existingCard = pipeline.allCards.find((c: PipelineCard) => {
                try {
                  const desc = JSON.parse(c.description || '{}');
                  return desc.phone === phoneDigits || desc.contato_phone === phoneDigits;
                } catch { return false; }
              });
              const currentCol = existingCard
                ? pipeline.columns.find((col) => col.id === existingCard.column_id)
                : null;

              const handleMoveToColumn = async (colId: string) => {
                if (existingCard) {
                  // Move existing card
                  await pipeline.moveCard(existingCard.id, existingCard.column_id, colId);
                } else {
                  // Create new card in selected column
                  await pipeline.createCard({
                    column_id: colId,
                    title: contactName,
                    description: JSON.stringify({ phone: phoneDigits, contato_phone: phoneDigits, source: 'chat' }),
                    position: 0,
                    assigned_to: '',
                    due_date: null,
                    tags: [],
                    sla_days: 7,
                    projeto_id: null,
                  });
                }
                await pipeline.load();
              };

              return (
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2.5">
                    Pipeline
                    {currentCol && (
                      <span className="ml-1.5 text-[9px] normal-case tracking-normal text-[#2B8EAD] font-medium">
                        — {currentCol.title}
                      </span>
                    )}
                  </p>
                  <div className="space-y-1">
                    {pipeline.columns.map((col) => {
                      const isActive = currentCol?.id === col.id;
                      return (
                        <button
                          key={col.id}
                          onClick={() => handleMoveToColumn(col.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-[#2B8EAD]/10 border border-[#2B8EAD]/30'
                              : 'hover:bg-gray-50 border border-transparent'
                          }`}
                        >
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: col.color || '#6B7280' }}
                          />
                          <span className={`text-[12px] flex-1 ${isActive ? 'text-[#2B8EAD] font-semibold' : 'text-[#0F172A] font-medium'}`}>
                            {col.title}
                          </span>
                          {isActive && (
                            <Check className="w-4 h-4 text-[#2B8EAD] flex-shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {empresaDocs.length > 0 && (
              <div className="px-5 py-4">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2.5">
                  Docs da Empresa ({empresaDocs.length})
                </p>
                <div className="space-y-1">
                  {empresaDocs.slice(0, 10).map((doc: any) => (
                    <div
                      key={doc.id}
                      onClick={() => doc.arquivo_url ? window.open(doc.arquivo_url, '_blank') : navigate('/documentos')}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                        <FileText className="w-4 h-4 text-blue-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-[#0F172A] truncate font-medium">{doc.codigo} — {doc.titulo}</p>
                        <p className="text-[10px] text-gray-400">{doc.tipo} · {doc.status}</p>
                      </div>
                      <Download className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </aside>
        );
      })()}
    </div>
  );
}
