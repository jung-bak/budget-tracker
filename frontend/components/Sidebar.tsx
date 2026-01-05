import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, spacing, fontSize, borderRadius } from '../lib/theme';

export function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();

  const menuItems = [
    { label: 'Transactions', path: '/' },
    { label: 'Spending', path: '/breakdown' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.logo}>Budget</Text>
      </View>
      
      <View style={styles.nav}>
        {menuItems.map((item) => {
          const isActive = pathname === item.path || (item.path !== '/' && pathname.startsWith(item.path));
          
          return (
            <Pressable
              key={item.path}
              onPress={() => router.push(item.path)}
              style={({ pressed }) => [
                styles.item,
                isActive && styles.activeItem,
                pressed && styles.pressedItem,
              ]}
            >
              <Text style={[styles.label, isActive && styles.activeLabel]}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 240,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  header: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.sm,
  },
  logo: {
    color: colors.text,
    fontSize: fontSize.xl,
    fontWeight: '700',
    letterSpacing: 1,
  },
  nav: {
    gap: spacing.sm,
  },
  item: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  activeItem: {
    backgroundColor: colors.surfaceHighlight,
  },
  pressedItem: {
    opacity: 0.7,
  },
  label: {
    color: colors.textSecondary,
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  activeLabel: {
    color: colors.primary,
    fontWeight: '600',
  },
});
