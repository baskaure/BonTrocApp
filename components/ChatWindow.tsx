import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Send, AlertTriangle } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatId, setChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadChat();
  }, [proposalId, user?.id]);

  useEffect(() => {
    if (chatId) {
      loadMessages();
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
  }, [chatId]);

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

  const handleSend = async () => {
    if (!newMessage.trim() || !chatId || !user) return;

    const messageToSend = newMessage.trim();
    setLoading(true);
    setNewMessage('');

    try {
      const { error } = await supabase.from('chat_messages').insert({
        chat_id: chatId,
        sender_id: user.id,
        body: messageToSend,
      });

      if (error) throw error;
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setNewMessage(messageToSend);
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
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun message pour le moment</Text>
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
                    isOwn ? styles.messageBubbleOwn : styles.messageBubbleOther,
                  ]}
                >
                  {!isOwn && message.sender && (
                    <TouchableOpacity
                      onPress={() => onUserClick?.(message.sender_id)}
                      disabled={!onUserClick}
                    >
                      <Text style={styles.senderName}>{message.sender.display_name}</Text>
                    </TouchableOpacity>
                  )}
                  <Text
                    style={[
                      styles.messageText,
                      isOwn ? styles.messageTextOwn : styles.messageTextOther,
                    ]}
                  >
                    {message.body}
                  </Text>
                  <Text
                    style={[
                      styles.messageTime,
                      isOwn ? styles.messageTimeOwn : styles.messageTimeOther,
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
        <TextInput
          style={styles.input}
          value={newMessage}
          onChangeText={setNewMessage}
          placeholder="Écrivez votre message..."
          placeholderTextColor="#999"
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!newMessage.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!newMessage.trim() || loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <Send size={20} color="#FFF" />
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
    borderTopColor: '#E2E8F0',
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
    color: '#64748B',
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
    backgroundColor: '#19ADFA',
    borderBottomRightRadius: 4,
  },
  messageBubbleOther: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
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
    color: '#1E293B',
  },
  messageTime: {
    fontSize: 11,
    marginTop: 4,
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageTimeOther: {
    color: '#64748B',
  },
  inputContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    backgroundColor: '#19ADFA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});

