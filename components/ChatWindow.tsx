import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react-native';
import { supabase, ChatMessage, MiniProfile, errorMessage } from '@/lib/supabase';
import { MESSAGE_SELECT } from '@/lib/queries';
import { sendTransactionalEmail } from '@/lib/notifications';
import { checkContent } from '@/lib/moderation';
import { useActivityStore, chatSeenKey } from '@/lib/activity';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { chatMessageSchema, ChatMessageFormData } from '@/lib/validations/chat';

type ChatWindowProps = {
  proposalId: string;
  /** Interlocuteur (profil public), pour l'e-mail « nouveau message ». */
  counterpart?: MiniProfile | null;
  /** Lecture seule (interlocuteur supprimé, par exemple). */
  disabled?: boolean;
  onUserClick?: (userId: string) => void;
};

export function ChatWindow({ proposalId, counterpart, disabled, onUserClick }: ChatWindowProps) {
  const { user } = useAuth();
  const { colors, radius } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const markSeen = useActivityStore((s) => s.markSeen);

  const {
    control,
    handleSubmit,
    reset,
    watch,
  } = useForm<ChatMessageFormData>({
    resolver: zodResolver(chatMessageSchema),
    defaultValues: { message: '' },
  });

  const message = watch('message');

  const markRead = useCallback(() => {
    if (user) void markSeen(user.id, chatSeenKey(proposalId));
  }, [user, proposalId, markSeen]);

  /** Trouve la conversation de la proposition, ou la crée (index unique : une par proposition). */
  const loadChat = useCallback(async () => {
    const { data } = await supabase.from('chats').select('id').eq('proposal_id', proposalId).limit(1);
    if (data && data.length > 0) {
      setChatId(data[0].id);
      return;
    }
    const { data: created, error } = await supabase.from('chats').insert({ proposal_id: proposalId }).select('id').single();
    if (!error && created) {
      setChatId(created.id);
      return;
    }
    // Créée en parallèle par l'autre partie (23505) : on relit.
    const { data: again } = await supabase.from('chats').select('id').eq('proposal_id', proposalId).limit(1);
    if (again && again.length > 0) setChatId(again[0].id);
    else if (error) setNotice(errorMessage(error, 'Conversation indisponible'));
  }, [proposalId]);

  const loadMessages = useCallback(async (id: string) => {
    const { data, error } = await supabase.from('chat_messages').select(MESSAGE_SELECT).eq('chat_id', id).order('created_at', { ascending: true });
    if (!error && data) setMessages(data as unknown as ChatMessage[]);
  }, []);

  useEffect(() => {
    setChatId(null);
    setMessages([]);
    if (user) void loadChat();
  }, [proposalId, user?.id, loadChat]);

  useEffect(() => {
    if (!chatId || !user) return;
    void loadMessages(chatId);
    markRead();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `chat_id=eq.${chatId}` }, async (payload) => {
        const row = payload.new as { id: string };
        const { data } = await supabase.from('chat_messages').select(MESSAGE_SELECT).eq('id', row.id).maybeSingle();
        const inserted = data as unknown as ChatMessage | null;
        if (inserted) setMessages((prev) => (prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]));
        else void loadMessages(chatId);
        // La conversation est ouverte : le message reçu est lu.
        markRead();
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [chatId, user?.id, loadMessages, markRead]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const onSend = async (data: ChatMessageFormData) => {
    if (!chatId || !user) return;

    const messageToSend = data.message.trim();
    setNotice('');

    const moderation = await checkContent(messageToSend, user.id);
    if (moderation.hasBlock) {
      setNotice(`Ce message contient un terme interdit (${moderation.blockWords.join(', ')}). Envoi bloqué.`);
      return;
    }
    if (moderation.hasWarning) {
      setNotice(`Attention : votre message contient des termes sensibles (${moderation.warningWords.join(', ')}). Restez vigilant face aux arnaques.`);
    }

    setLoading(true);
    reset({ message: '' });
    Keyboard.dismiss();

    try {
      const { data: inserted, error } = await supabase
        .from('chat_messages')
        .insert({ chat_id: chatId, sender_id: user.id, body: messageToSend })
        .select(MESSAGE_SELECT)
        .single();
      if (error) throw error;
      const row = inserted as unknown as ChatMessage;
      setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));

      if (counterpart?.id) {
        void sendTransactionalEmail('new_chat_message', counterpart.id, {
          proposal_id: proposalId,
          sender_name: user.display_name,
          recipient_name: counterpart.display_name,
        });
      }
    } catch (error) {
      setNotice(errorMessage(error, 'Message non envoyé'));
      reset({ message: messageToSend });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[styles.container, { borderTopColor: colors.border }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Aucun message pour le moment</Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user?.id;
            return (
              <View key={msg.id} style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
                <View
                  style={[
                    styles.messageBubble,
                    { borderRadius: radius.lg },
                    isOwn
                      ? [styles.messageBubbleOwn, { backgroundColor: colors.primary }]
                      : [styles.messageBubbleOther, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }],
                  ]}
                >
                  {!isOwn && msg.sender && (
                    <TouchableOpacity onPress={() => onUserClick?.(msg.sender_id)} disabled={!onUserClick}>
                      <Text style={[styles.senderName, { color: colors.textSecondary }]}>{msg.sender.display_name}</Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[styles.messageText, { color: isOwn ? colors.onPrimary : colors.text }]}>{msg.body}</Text>
                  <Text style={[styles.messageTime, { color: isOwn ? 'rgba(255, 255, 255, 0.7)' : colors.textTertiary }]}>
                    {formatTime(msg.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {!!notice && (
        <View style={[styles.noticeBox, { backgroundColor: colors.warningLight }]}>
          <Text style={[styles.noticeText, { color: colors.warning }]}>{notice}</Text>
        </View>
      )}

      {disabled ? (
        <Text style={[styles.emptyText, { color: colors.textTertiary, textAlign: 'center' }]}>Cette conversation est fermée.</Text>
      ) : (
        <View style={styles.inputContainer}>
          <Controller
            control={control}
            name="message"
            render={({ field: { onChange, onBlur, value } }) => (
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceContainer, borderColor: colors.border, color: colors.text }]}
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Écrivez votre message..."
                placeholderTextColor={colors.textTertiary}
                multiline
                maxLength={2000}
                returnKeyType="send"
                blurOnSubmit={true}
                editable={!!chatId}
                onSubmitEditing={() => {
                  if (value.trim() && !loading) {
                    handleSubmit(onSend)();
                  } else {
                    Keyboard.dismiss();
                  }
                }}
              />
            )}
          />
          <TouchableOpacity
            style={[styles.sendButton, { backgroundColor: colors.primary }, (!message.trim() || loading || !chatId) && styles.sendButtonDisabled]}
            onPress={handleSubmit(onSend)}
            disabled={!message.trim() || loading || !chatId}
          >
            {loading ? <ActivityIndicator color={colors.onPrimary} size="small" /> : <Send size={20} color={colors.onPrimary} />}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  messagesContainer: {
    maxHeight: 300,
    marginBottom: 12,
  },
  messagesContent: {
    paddingVertical: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
  },
  messageRow: {
    marginBottom: 12,
    alignItems: 'flex-start',
  },
  messageRowOwn: {
    alignItems: 'flex-end',
  },
  messageBubble: {
    maxWidth: '75%',
    padding: 12,
    borderRadius: 16,
  },
  messageBubbleOwn: {
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  noticeBox: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  noticeText: {
    fontSize: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
