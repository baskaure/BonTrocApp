import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator, Alert, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/auth-context';
import { useTheme } from '@/lib/theme';
import { supabase } from '@/lib/supabase';
import { BottomNav } from '@/components/BottomNav';
import { Shield, Users, Flag, AlertTriangle, Loader2, Trash2, CheckCircle, XCircle, Eye, BarChart3, Download, Gavel } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Tab = 'reports' | 'users' | 'verification' | 'banned-words' | 'disputes' | 'stats';

type Report = {
  id: string;
  reporter_id: string;
  reported_user_id?: string;
  listing_id?: string;
  reason: string;
  details?: string;
  status: string;
  created_at: string;
  reporter?: { display_name: string };
  reported_user?: { display_name: string };
  listing?: { id: string; title: string; status: string };
};

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const [tab, setTab] = useState<Tab>('reports');
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [bannedWords, setBannedWords] = useState<{ id: string; word: string; severity: string }[]>([]);
  const [bannedWordsLoading, setBannedWordsLoading] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [newSeverity, setNewSeverity] = useState<'warning' | 'block'>('warning');
  const [disputes, setDisputes] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalListings: 0,
    totalProposals: 0,
    totalExchanges: 0,
    acceptedProposals: 0,
    confirmedExchanges: 0,
  });

  useEffect(() => {
    if (tab === 'reports') loadReports();
    if (tab === 'users') loadUsers();
    if (tab === 'verification') loadVerificationRequests();
    if (tab === 'banned-words') loadBannedWords();
    if (tab === 'disputes') loadDisputes();
    if (tab === 'stats') loadStats();
  }, [tab]);

  async function loadStats() {
    setLoading(true);
    const [usersRes, listingsRes, proposalsRes, exchangesRes, acceptedRes, confirmedRes] = await Promise.all([
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('listings').select('*', { count: 'exact', head: true }),
      supabase.from('proposals').select('*', { count: 'exact', head: true }),
      supabase.from('exchanges').select('*', { count: 'exact', head: true }),
      supabase.from('proposals').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
      supabase.from('exchanges').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    ]);
    setStats({
      totalUsers: usersRes.count || 0,
      totalListings: listingsRes.count || 0,
      totalProposals: proposalsRes.count || 0,
      totalExchanges: exchangesRes.count || 0,
      acceptedProposals: acceptedRes.count || 0,
      confirmedExchanges: confirmedRes.count || 0,
    });
    setLoading(false);
  }

  async function loadReports() {
    setLoading(true);
    const { data } = await supabase
      .from('reports')
      .select(`
        *,
        reporter:users!reports_reporter_id_fkey(display_name),
        reported_user:users!reports_reported_user_id_fkey(display_name),
        listing:listings(id, title, status)
      `)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
    setLoading(false);
  }

  async function loadUsers() {
    setLoading(true);
    let query = supabase.from('users').select('*').order('created_at', { ascending: false });
    if (userSearch) {
      query = query.or(`display_name.ilike.%${userSearch}%,email.ilike.%${userSearch}%,username.ilike.%${userSearch}%`);
    }
    const { data } = await query.limit(50);
    if (data) setUsers(data);
    setLoading(false);
  }

  async function loadVerificationRequests() {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: false });
    if (data) setVerificationRequests(data);
    setLoading(false);
  }

  async function loadBannedWords() {
    setBannedWordsLoading(true);
    const { data } = await supabase.from('banned_words').select('*').order('word');
    if (data) setBannedWords(data);
    setBannedWordsLoading(false);
  }

  async function loadDisputes() {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('disputes')
        .select('*')
        .order('created_at', { ascending: false });

      if (data) {
        const enriched = await Promise.all(
          data.map(async (dispute) => {
            const { data: openedBy } = await supabase
              .from('users')
              .select('display_name, email')
              .eq('id', dispute.opened_by)
              .maybeSingle();

            return { ...dispute, opened_by_user: openedBy };
          })
        );
        setDisputes(enriched);
      }
    } catch (err) {
      console.error('Error loading disputes:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleReportStatus(reportId: string, status: 'resolved' | 'dismissed') {
    await supabase.from('reports').update({
      status,
      moderator_id: user?.id,
      resolved_at: new Date().toISOString()
    }).eq('id', reportId);
    loadReports();
  }

  async function handleVerification(userId: string, status: 'verified' | 'rejected') {
    await supabase.from('users').update({
      verification_status: status,
      verification_reviewed_at: new Date().toISOString(),
      is_verified: status === 'verified',
    }).eq('id', userId);
    loadVerificationRequests();
  }

  async function handleUserRole(userId: string, role: 'user' | 'moderator' | 'admin') {
    await supabase.from('users').update({ role }).eq('id', userId);
    loadUsers();
  }

  async function addBannedWord() {
    const value = newWord.toLowerCase().trim();
    if (!value) return;
    setBannedWordsLoading(true);
    const { error } = await supabase.from('banned_words').insert({
      word: value,
      severity: newSeverity === 'block' ? 'block' : 'warning'
    });
    if (!error) {
      setNewWord('');
      setNewSeverity('warning');
      await loadBannedWords();
    }
    setBannedWordsLoading(false);
  }

  async function removeBannedWord(id: string) {
    setBannedWordsLoading(true);
    await supabase.from('banned_words').delete().eq('id', id);
    await loadBannedWords();
    setBannedWordsLoading(false);
  }

  async function handleDisputeStatus(disputeId: string, status: 'open' | 'in_review' | 'resolved' | 'dismissed') {
    if (!user?.id) return;

    const payload: any = { status };
    if (status === 'resolved' || status === 'dismissed') {
      payload.resolved_by = user.id;
      payload.resolved_at = new Date().toISOString();
    }

    await supabase.from('disputes').update(payload).eq('id', disputeId);
    loadDisputes();
  }

  if (!user || !['admin', 'moderator'].includes(user.role)) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerContainer}>
          <Shield size={64} color={colors.border} />
          <Text style={[styles.accessDeniedTitle, { color: colors.text }]}>Accès refusé</Text>
          <Text style={[styles.accessDeniedText, { color: colors.textSecondary }]}>Cette page est réservée aux administrateurs.</Text>
        </View>
        <BottomNav />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTitle}>
          <Shield size={24} color={colors.primary} />
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Administration</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Modération et gestion BonTroc</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsScroll}
        contentContainerStyle={styles.tabsContainer}
      >
        {[
          { id: 'reports', label: 'Signalements', icon: Flag },
          { id: 'verification', label: 'Vérifications', icon: CheckCircle },
          { id: 'users', label: 'Utilisateurs', icon: Users },
          { id: 'banned-words', label: 'Mots bannis', icon: AlertTriangle },
          { id: 'disputes', label: 'Litiges', icon: Gavel },
          { id: 'stats', label: 'Statistiques', icon: BarChart3 },
        ].map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <TouchableOpacity
              key={t.id}
              style={[
                styles.tab,
                { backgroundColor: colors.surface, borderColor: colors.border },
                active && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
              onPress={() => setTab(t.id as Tab)}
            >
              <Icon size={16} color={active ? '#FFF' : colors.textSecondary} />
              <Text style={[styles.tabText, { color: active ? '#FFF' : colors.textSecondary }]}>
                {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#19ADFA" />
        </View>
      ) : (
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {tab === 'reports' && (
            <View style={styles.tabContent}>
              {reports.length === 0 ? (
                <Text style={styles.emptyText}>Aucun signalement</Text>
              ) : (
                reports.map((report) => (
                  <View key={report.id} style={styles.reportCard}>
                    <View style={styles.reportHeader}>
                      <View style={styles.reportBadge}>
                        <Text style={styles.reportBadgeText}>{report.status}</Text>
                      </View>
                      {report.listing_id && (
                        <View style={styles.reportTypeBadge}>
                          <Text style={styles.reportTypeText}>Annonce</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.reportReason}>{report.reason}</Text>
                    {report.details && (
                      <Text style={styles.reportDetails}>{report.details}</Text>
                    )}
                    {report.listing && (
                      <View style={styles.reportListing}>
                        <Text style={styles.reportListingTitle}>
                          Annonce : {report.listing.title}
                        </Text>
                        <Text style={styles.reportListingStatus}>
                          Statut : {report.listing.status}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.reportMeta}>
                      Par {report.reporter?.display_name} • {new Date(report.created_at).toLocaleDateString('fr-FR')}
                    </Text>
                    {report.status === 'pending' && (
                      <View style={styles.reportActions}>
                        <TouchableOpacity
                          style={styles.reportActionButton}
                          onPress={() => handleReportStatus(report.id, 'resolved')}
                        >
                          <CheckCircle size={16} color="#10B981" />
                          <Text style={styles.reportActionText}>Résolu</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.reportActionButton}
                          onPress={() => handleReportStatus(report.id, 'dismissed')}
                        >
                          <XCircle size={16} color="#64748B" />
                          <Text style={styles.reportActionText}>Rejeter</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'verification' && (
            <View style={styles.tabContent}>
              {verificationRequests.length === 0 ? (
                <Text style={styles.emptyText}>Aucune demande de vérification</Text>
              ) : (
                verificationRequests.map((req) => (
                  <View key={req.id} style={styles.verificationCard}>
                    <View style={styles.verificationHeader}>
                      {req.avatar_url ? (
                        <Image source={{ uri: req.avatar_url }} style={styles.verificationAvatar} />
                      ) : (
                        <View style={styles.verificationAvatarPlaceholder}>
                          <Text style={styles.verificationAvatarText}>
                            {req.display_name[0]?.toUpperCase()}
                          </Text>
                        </View>
                      )}
                      <View style={styles.verificationInfo}>
                        <Text style={styles.verificationName}>{req.display_name}</Text>
                        <Text style={styles.verificationEmail}>@{req.username} • {req.email}</Text>
                      </View>
                    </View>
                    <View style={styles.verificationActions}>
                      <TouchableOpacity
                        style={styles.verificationApproveButton}
                        onPress={() => handleVerification(req.id, 'verified')}
                      >
                        <CheckCircle size={20} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.verificationRejectButton}
                        onPress={() => handleVerification(req.id, 'rejected')}
                      >
                        <XCircle size={20} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'users' && (
            <View style={styles.tabContent}>
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Rechercher un utilisateur..."
                  value={userSearch}
                  onChangeText={setUserSearch}
                  onSubmitEditing={loadUsers}
                  placeholderTextColor="#999"
                />
                <TouchableOpacity style={styles.searchButton} onPress={loadUsers}>
                  <Text style={styles.searchButtonText}>Rechercher</Text>
                </TouchableOpacity>
              </View>
              {users.map((u) => (
                <View key={u.id} style={styles.userCard}>
                  <View style={styles.userInfo}>
                    {u.is_verified && <CheckCircle size={16} color="#19ADFA" />}
                    <Text style={styles.userName}>{u.display_name}</Text>
                    <Text style={styles.userUsername}>@{u.username}</Text>
                  </View>
                  <View style={styles.userRoleContainer}>
                    <Text style={styles.userRoleLabel}>Rôle:</Text>
                    <View style={styles.userRoleButtons}>
                      {['user', 'moderator', 'admin'].map((role) => (
                        <TouchableOpacity
                          key={role}
                          style={[
                            styles.userRoleButton,
                            u.role === role && styles.userRoleButtonActive,
                            u.id === user?.id && styles.userRoleButtonDisabled,
                          ]}
                          onPress={() => handleUserRole(u.id, role as any)}
                          disabled={u.id === user?.id}
                        >
                          <Text
                            style={[
                              styles.userRoleButtonText,
                              u.role === role && styles.userRoleButtonTextActive,
                            ]}
                          >
                            {role === 'user' ? 'User' : role === 'moderator' ? 'Mod' : 'Admin'}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

          {tab === 'banned-words' && (
            <View style={styles.tabContent}>
              <View style={styles.addWordContainer}>
                <TextInput
                  style={styles.addWordInput}
                  placeholder="Nouveau mot..."
                  value={newWord}
                  onChangeText={setNewWord}
                  placeholderTextColor="#999"
                />
                <View style={styles.severityButtons}>
                  {['warning', 'block'].map((sev) => (
                    <TouchableOpacity
                      key={sev}
                      style={[
                        styles.severityButton,
                        newSeverity === sev && styles.severityButtonActive,
                      ]}
                      onPress={() => setNewSeverity(sev as any)}
                    >
                      <Text
                        style={[
                          styles.severityButtonText,
                          newSeverity === sev && styles.severityButtonTextActive,
                        ]}
                      >
                        {sev === 'warning' ? 'Warning' : 'Bloquer'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.addWordButton}
                  onPress={addBannedWord}
                  disabled={bannedWordsLoading || !newWord.trim()}
                >
                  {bannedWordsLoading ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.addWordButtonText}>Ajouter</Text>
                  )}
                </TouchableOpacity>
              </View>
              {bannedWords.map((w) => (
                <View key={w.id} style={styles.bannedWordCard}>
                  <View style={styles.bannedWordInfo}>
                    <Text style={styles.bannedWordText}>{w.word}</Text>
                    <View style={[
                      styles.bannedWordSeverity,
                      w.severity === 'block' && styles.bannedWordSeverityBlock,
                    ]}>
                      <Text style={styles.bannedWordSeverityText}>{w.severity}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeWordButton}
                    onPress={() => removeBannedWord(w.id)}
                    disabled={bannedWordsLoading}
                  >
                    <Trash2 size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {tab === 'disputes' && (
            <View style={styles.tabContent}>
              {disputes.length === 0 ? (
                <Text style={styles.emptyText}>Aucun litige</Text>
              ) : (
                disputes.map((dispute) => (
                  <View key={dispute.id} style={styles.disputeCard}>
                    <View style={styles.disputeHeader}>
                      <View style={[
                        styles.disputeStatusBadge,
                        dispute.status === 'resolved' && styles.disputeStatusBadgeResolved,
                        dispute.status === 'open' && styles.disputeStatusBadgeOpen,
                      ]}>
                        <Text style={styles.disputeStatusText}>
                          {dispute.status === 'resolved' ? 'Résolu' :
                           dispute.status === 'open' ? 'Ouvert' :
                           dispute.status === 'in_review' ? 'En cours' : 'Rejeté'}
                        </Text>
                      </View>
                      <Text style={styles.disputeDate}>
                        {new Date(dispute.created_at).toLocaleDateString('fr-FR')}
                      </Text>
                    </View>
                    <Text style={styles.disputeReason}>{dispute.reason}</Text>
                    <Text style={styles.disputeOpenedBy}>
                      Ouvert par {dispute.opened_by_user?.display_name || 'Utilisateur'}
                    </Text>
                    <View style={styles.disputeActions}>
                      {dispute.status === 'open' && (
                        <TouchableOpacity
                          style={styles.disputeActionButton}
                          onPress={() => handleDisputeStatus(dispute.id, 'in_review')}
                        >
                          <Text style={styles.disputeActionText}>Prendre en charge</Text>
                        </TouchableOpacity>
                      )}
                      {dispute.status !== 'resolved' && (
                        <TouchableOpacity
                          style={[styles.disputeActionButton, styles.disputeResolveButton]}
                          onPress={() => handleDisputeStatus(dispute.id, 'resolved')}
                        >
                          <Text style={[styles.disputeActionText, styles.disputeResolveText]}>Résoudre</Text>
                        </TouchableOpacity>
                      )}
                      {dispute.status !== 'dismissed' && (
                        <TouchableOpacity
                          style={[styles.disputeActionButton, styles.disputeDismissButton]}
                          onPress={() => handleDisputeStatus(dispute.id, 'dismissed')}
                        >
                          <Text style={styles.disputeActionText}>Rejeter</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'stats' && (
            <View style={styles.tabContent}>
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.totalUsers}</Text>
                  <Text style={styles.statLabel}>Utilisateurs</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.totalListings}</Text>
                  <Text style={styles.statLabel}>Annonces</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.totalProposals}</Text>
                  <Text style={styles.statLabel}>Propositions</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, styles.statValueSuccess]}>
                    {stats.acceptedProposals}
                  </Text>
                  <Text style={styles.statLabel}>Acceptées</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.totalExchanges}</Text>
                  <Text style={styles.statLabel}>Échanges</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={[styles.statValue, styles.statValueSuccess]}>
                    {stats.confirmedExchanges}
                  </Text>
                  <Text style={styles.statLabel}>Confirmés</Text>
                </View>
              </View>
            </View>
          )}
        </ScrollView>
      )}

      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  header: {
    padding: 16,
    paddingTop: 48,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
  },
  tabsScroll: {
    maxHeight: 60,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  tabActive: {
    backgroundColor: '#19ADFA',
    borderColor: '#19ADFA',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  tabTextActive: {
    color: '#FFF',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 16,
  },
  tabContent: {
    gap: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    paddingVertical: 48,
  },
  reportCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  reportBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
  },
  reportBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
  },
  reportTypeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#E0F2FE',
  },
  reportTypeText: {
    fontSize: 11,
    color: '#19ADFA',
  },
  reportReason: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  reportDetails: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
  },
  reportListing: {
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  reportListingTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  reportListingStatus: {
    fontSize: 12,
    color: '#64748B',
  },
  reportMeta: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  reportActions: {
    flexDirection: 'row',
    gap: 8,
  },
  reportActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  reportActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  verificationCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  verificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  verificationAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  verificationAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F59E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationAvatarText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 20,
  },
  verificationInfo: {
    flex: 1,
  },
  verificationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
  },
  verificationEmail: {
    fontSize: 13,
    color: '#64748B',
  },
  verificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  verificationApproveButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verificationRejectButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 12,
    fontSize: 15,
  },
  searchButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#19ADFA',
    borderRadius: 20,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  userUsername: {
    fontSize: 14,
    color: '#64748B',
  },
  userRoleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userRoleLabel: {
    fontSize: 14,
    color: '#64748B',
  },
  userRoleButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  userRoleButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  userRoleButtonActive: {
    backgroundColor: '#19ADFA',
    borderColor: '#19ADFA',
  },
  userRoleButtonDisabled: {
    opacity: 0.5,
  },
  userRoleButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  userRoleButtonTextActive: {
    color: '#FFF',
  },
  addWordContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  addWordInput: {
    flex: 1,
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    padding: 12,
    fontSize: 15,
  },
  severityButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  severityButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
  },
  severityButtonActive: {
    backgroundColor: '#19ADFA',
    borderColor: '#19ADFA',
  },
  severityButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
  },
  severityButtonTextActive: {
    color: '#FFF',
  },
  addWordButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#19ADFA',
    borderRadius: 20,
  },
  addWordButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  bannedWordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  bannedWordInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  bannedWordText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  bannedWordSeverity: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
  },
  bannedWordSeverityBlock: {
    backgroundColor: '#FEE2E2',
  },
  bannedWordSeverityText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#92400E',
  },
  removeWordButton: {
    padding: 8,
  },
  disputeCard: {
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  disputeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  disputeStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
  },
  disputeStatusBadgeResolved: {
    backgroundColor: '#D1FAE5',
  },
  disputeStatusBadgeOpen: {
    backgroundColor: '#FEE2E2',
  },
  disputeStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#991B1B',
  },
  disputeDate: {
    fontSize: 12,
    color: '#64748B',
  },
  disputeReason: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  disputeOpenedBy: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 12,
  },
  disputeActions: {
    flexDirection: 'row',
    gap: 8,
  },
  disputeActionButton: {
    flex: 1,
    padding: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFF',
    alignItems: 'center',
  },
  disputeResolveButton: {
    backgroundColor: '#D1FAE5',
    borderColor: '#10B981',
  },
  disputeResolveText: {
    color: '#059669',
  },
  disputeDismissButton: {
    backgroundColor: '#F8FAFC',
  },
  disputeActionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#FFF',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#19ADFA',
    marginBottom: 8,
  },
  statValueSuccess: {
    color: '#10B981',
  },
  statLabel: {
    fontSize: 13,
    color: '#64748B',
  },
  accessDeniedTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1E293B',
    marginTop: 16,
    marginBottom: 8,
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
});

