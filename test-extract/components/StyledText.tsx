import { Text, TextProps } from 'react-native';
import { StyleSheet } from 'react-native';

interface StyledTextProps extends TextProps {
  variant?: 'body' | 'title' | 'subtitle' | 'caption';
}

export function StyledText({ style, variant = 'body', ...props }: StyledTextProps) {
  return (
    <Text 
      style={[styles[variant], style]} 
      {...props} 
    />
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 16,
    fontFamily: 'System',
    color: '#000',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: 'System',
    color: '#000',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'System',
    color: '#000',
  },
  caption: {
    fontSize: 14,
    fontFamily: 'System',
    color: '#666',
  },
}); 