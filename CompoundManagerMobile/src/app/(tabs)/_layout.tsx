import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { Brand } from '@/constants/theme';

export default function TabLayout() {
  return (
    <NativeTabs
      tintColor={Brand.primary}
      iconColor={{ default: Brand.muted, selected: Brand.primary }}
      backgroundColor={Brand.surface}
      indicatorColor={Brand.primarySoft}
      labelStyle={{
        default: { color: Brand.muted, fontSize: 11, fontWeight: '600' },
        selected: { color: Brand.primary, fontSize: 11, fontWeight: '700' },
      }}
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md="home"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="bills">
        <NativeTabs.Trigger.Label>الفواتير</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'doc.text', selected: 'doc.text.fill' }}
          md="receipt_long"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="services">
        <NativeTabs.Trigger.Label>الخدمات</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'wrench.and.screwdriver', selected: 'wrench.and.screwdriver.fill' }}
          md="handyman"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="chats">
        <NativeTabs.Trigger.Label>المحادثات</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md="chat"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="contact">
        <NativeTabs.Trigger.Label>تواصل</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'envelope', selected: 'envelope.fill' }}
          md="mail"
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>الملف</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md="person"
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
