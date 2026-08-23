import { ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

export function Screen({
  title,
  children,
  onRefresh,
  refreshing,
  right,
  back,
  headerShown = true,
}: {
  title: string;
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  right?: ReactNode;
  back?: boolean;
  headerShown?: boolean;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {headerShown && (
        <View style={styles.header}>
          {back ? (
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>رجوع</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.backBtn} />
          )}
          <Text style={styles.title}>{title}</Text>
          <View style={styles.right}>{right}</View>
        </View>
      )}
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined
        }
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export const ui = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontWeight: '600', marginBottom: 6, textAlign: 'right', color: '#334155' },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 10,
    backgroundColor: '#fff',
    textAlign: 'right',
  },
  button: { backgroundColor: '#2563eb', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '700' },
  outline: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  outlineText: { color: '#0f172a', fontWeight: '600' },
  danger: { backgroundColor: '#dc2626', borderRadius: 8, padding: 12, alignItems: 'center' },
  muted: { color: '#64748b', textAlign: 'right' },
  empty: { textAlign: 'center', color: '#64748b', padding: 24 },
  error: { backgroundColor: '#fee2e2', color: '#b91c1c', padding: 10, borderRadius: 8, marginBottom: 10, textAlign: 'center' },
  success: { backgroundColor: '#dcfce7', color: '#166534', padding: 10, borderRadius: 8, marginBottom: 10, textAlign: 'center' },
  chip: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  chipText: { fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#fff' },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '800', color: '#2563eb' },
  statLabel: { color: '#64748b', fontSize: 12, marginTop: 4, textAlign: 'center' },
  name: { fontWeight: '700', fontSize: 16, textAlign: 'right' },
  meta: { color: '#64748b', marginTop: 2, textAlign: 'right', fontSize: 13 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f1f5f9' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#fff',
  },
  title: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '800', color: '#0f172a' },
  backBtn: { minWidth: 52 },
  backText: { color: '#2563eb', fontWeight: '700' },
  right: { minWidth: 52, alignItems: 'flex-end' },
  content: { padding: 16, paddingBottom: 40 },
});
