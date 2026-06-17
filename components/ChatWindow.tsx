import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Keyboard } from 'react-native';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Send } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { Controller } from 'react-hook-form';
import { chatMessageSchema, ChatMessageFormData } from '@/lib/validations/chat';

type ChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  sender?: {
    display_name: string;
    avatar_url?: string;
  };
};

type ChatWindowProps = {
  proposalId: string;
  onUserClick?: (userId: string) => void;
};

export function ChatWindow({ proposalId, onUserClick }: ChatWindowProps) {
  const { user } = useAuth();
  const { colors, radius } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

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

  useEffect(() => {
    loadChat();
  }, [proposalId, user?.id]);

  useEffect(() => {
    if (chatId && user) {
      loadMessages();
      markMessageNotificationsAsRead();
      
      const subscription = supabase
        .channel(`chat:${chatId}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `chat_id=eq.${chatId}`,
        }, () => {
          loadMessages();
        })
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [chatId, user?.id, proposalId]);

  async function markMessageNotificationsAsRead() {
    if (!user || !proposalId) return;
    
    try {
      const { data: updated, error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('type', 'message_received')
        .eq('related_id', proposalId)
        .is('read_at', null)
        .select();
      
      if (error) {
        // Si la table n'existe pas, on ignore silencieusement
        if (error.code !== 'PGRST205') {
          console.error('Error marking message notifications as read:', error);
        }
      } else if (updated && updated.length > 0) {
        console.log(`Marked ${updated.length} message notifications as read for proposal ${proposalId}`);
      }
    } catch (err: any) {
      // Ignorer les erreurs si la table n'existe pas
      if (err?.code !== 'PGRST205') {
        console.error('Error in markMessageNotificationsAsRead:', err);
      }
    }
  }

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  async function loadChat() {
    const { data } = await supabase
      .from('chats')
      .select('id')
      .eq('proposal_id', proposalId)
      .maybeSingle();

    if (data) {
      setChatId(data.id);
    } else {
      const { data: newChat, error } = await supabase
        .from('chats')
        .insert({ proposal_id: proposalId })
        .select('id')
        .single();

      if (!error && newChat) {
        setChatId(newChat.id);
      }
    }
  }

  async function loadMessages() {
    if (!chatId) return;

    const { data } = await supabase
      .from('chat_messages')
      .select(`
        *,
        sender:users!chat_messages_sender_id_fkey(display_name, avatar_url)
      `)
      .eq('chat_id', chatId)
      .order('created_at', { ascending: true });

    if (data) {
      setMessages(data);
    }
  }

  const onSend = async (data: ChatMessageFormData) => {
    if (!chatId || !user) return;

    const messageToSend = data.message.trim();
    setLoading(true);
    reset({ message: '' });
    Keyboard.dismiss();

    try {
      // Récupérer les infos de la proposition pour connaître l'autre utilisateur
      const { data: chatData } = await supabase
        .from('chats')
        .select('proposal:proposals(id, from_user_id, to_user_id, from_user:users!proposals_from_user_id_fkey(display_name), to_user:users!proposals_to_user_id_fkey(display_name))')
        .eq('id', chatId)
        .single();

      const { error } = await supabase.from('chat_messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        body: messageToSend,
      });

      if (error) throw error;
      
      // Créer une notification pour l'autre utilisateur
      if (chatData?.proposal) {
        const proposal = chatData.proposal as any;
        const otherUserId = proposal.from_user_id === user.id ? proposal.to_user_id : proposal.from_user_id;
        const senderName = user.display_name || user.email || 'Un utilisateur';
        
        try {
          // Vérifier la session avant l'insertion
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError || !sessionData?.session) {
            console.warn('No active session when creating notification:', sessionError);
            // Ne pas bloquer l'envoi du message si la notification échoue
            return;
          }
          
          const { data: notifData, error: notifError } = await supabase
            .from('notifications')
            .insert({
              user_id: otherUserId,
              type: 'message_received',
              message: `${senderName} vous a envoyé un message`,
              related_id: proposal.id || proposalId,
            })
            .select();
          
          if (notifError) {
            if (notifError.code === 'PGRST205') {
              console.warn('Table notifications does not exist. Please run the SQL script.');
            } else if (notifError.code === '42501') {
              // Erreur RLS - essayer avec la fonction Supabase en fallback
              // (Silencieux car c'est un fallback normal)
              
              // Essayer avec la fonction Supabase (si elle existe)
              try {
                const { data: funcData, error: funcError } = await supabase.rpc('create_notification', {
                  p_user_id: otherUserId,
                  p_type: 'message_received',
                  p_message: `${senderName} vous a envoyé un message`,
                  p_related_id: proposal.id || proposalId,
                });
                
                if (funcError) {
                  console.error('Error using create_notification function:', funcError);
                } else {
                  // Notification créée avec succès via la fonction
                  // (Log silencieux en mode production, mais utile pour le debug)
                  if (__DEV__) {
                    console.log('Notification created via function:', funcData);
                  }
                }
              } catch (funcErr) {
                console.error('Exception calling create_notification function:', funcErr);
              }
            } else {
              console.error('Error creating message notification:', notifError);
            }
          } else if (notifData) {
            console.log('Message notification created:', notifData[0]?.id);
          }
        } catch (notifError: any) {
          console.error('Exception creating message notification:', notifError);
        }
      }

      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
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
          messages.map((message) => {
            const isOwn = message.sender_id === user?.id;
            return (
              <View
                key={message.id}
                style={[styles.messageRow, isOwn && styles.messageRowOwn]}
              >
                <View
                  style={[
                    styles.messageBubble,
                    { borderRadius: radius.lg },
                    isOwn
                      ? [styles.messageBubbleOwn, { backgroundColor: colors.primary }]
                      : [styles.messageBubbleOther, { backgroundColor: colors.surfaceContainer, borderColor: colors.border }],
                  ]}
                >
                  {!isOwn && message.sender && (
                    <TouchableOpacity
                      onPress={() => onUserClick?.(message.sender_id)}
                      disabled={!onUserClick}
                    >
                      <Text style={[styles.senderName, { color: colors.textSecondary }]}>{message.sender.display_name}</Text>
                    </TouchableOpacity>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      { color: isOwn ? colors.onPrimary : colors.text },
                    ]}
                  >
                    {message.body}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      { color: isOwn ? 'rgba(255, 255, 255, 0.7)' : colors.textTertiary },
                    ]}
                  >
                    {formatTime(message.created_at)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

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
              maxLength={500}
              returnKeyType="send"
              blurOnSubmit={true}
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
          style={[styles.sendButton, { backgroundColor: colors.primary }, (!message.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSubmit(onSend)}
          disabled={!message.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onPrimary} size="small" />
          ) : (
            <Send size={20} color={colors.onPrimary} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E7EDF3',
    paddingTop: 16,
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
    color: '#3C4856',
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
    backgroundColor: '#2B86CC',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: '#E7EDF3',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3C4856',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFF',
  },
  messageTextOther: {
    color: '#13202E',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeOther: {
    color: '#3C4856',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#EEF2F6',
    borderWidth: 1,
    borderColor: '#E7EDF3',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#13202E',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2B86CC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

