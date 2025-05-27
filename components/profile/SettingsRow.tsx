import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme/theme';

type SettingsRowProps = {
  icon: string;
  title: string;
  onPress: () => void;
  isDestructive?: boolean;
  value?: string;
  showChevron?: boolean;
};

const SettingsRow: React.FC<SettingsRowProps> = ({
  icon,
  title,
  onPress,
  isDestructive = false,
  value,
  showChevron = true
}) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
    >
      <Ionicons 
        name={icon as any} 
        size={22} 
        color={isDestructive ? colors.feedback.error : colors.primary.main} 
      />
      <Text style={[
        styles.title, 
        isDestructive && styles.destructiveText
      ]}>
        {title}
      </Text>
      {value && (
        <Text style={styles.value}>{value}</Text>
      )}
      {showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    marginLeft: spacing.sm,
    color: colors.text.primary,
    fontWeight: '500',
  },
  value: {
    color: colors.text.secondary,
    marginRight: spacing.sm,
  },
  destructiveText: {
    color: colors.feedback.error,
  }
});

export default SettingsRow; 