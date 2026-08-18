import { Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, ui } from '@/components/screen';
import { useAuth } from '@/context/AuthContext';

type Item = { href: string; label: string; show: boolean };

export default function MoreScreen() {
  const router = useRouter();
  const { isAdmin, isStaff, isOwner, isDependent } = useAuth();
  const isHousehold = isOwner || isDependent;

  const items: Item[] = [
    { href: '/residents', label: 'الوحدات', show: isStaff },
    { href: '/registrations', label: 'طلبات التسجيل', show: isAdmin },
    { href: '/payments', label: 'مستندات الدفع', show: isStaff },
    { href: '/transactions', label: 'المعاملات المالية', show: true },
    { href: '/expenses', label: 'المصاريف', show: isStaff },
    { href: '/services', label: 'الخدمات', show: true },
    { href: '/notifications', label: 'الإشعارات', show: true },
    { href: '/send-notifications', label: 'إرسال إشعارات', show: isStaff },
    { href: '/contact', label: isHousehold ? 'تواصل معنا' : 'الطلبات والشكاوى', show: true },
    { href: '/unit-types', label: 'أنواع الوحدات', show: isStaff },
    { href: '/service-types', label: 'أنواع الخدمات', show: isStaff },
    { href: '/expense-types', label: 'أنواع المصاريف', show: isStaff },
  ];

  return (
    <Screen title="المزيد">
      {items.filter((i) => i.show).map((item) => (
        <TouchableOpacity key={item.href} style={ui.card} onPress={() => router.push(item.href as never)}>
          <View style={ui.row}>
            <Text style={{ color: '#94a3b8' }}>‹</Text>
            <Text style={ui.name}>{item.label}</Text>
          </View>
        </TouchableOpacity>
      ))}
    </Screen>
  );
}
