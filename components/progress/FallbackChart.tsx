import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { colors, spacing, borderRadius } from '../../theme/theme';
import StyledText from '../ui/StyledText';

interface FallbackChartProps {
  data: number[];
  labels: string[];
  title: string;
  maxValue?: number;
  color?: string;
  height?: number;
}

/**
 * A simple fallback chart component that doesn't rely on Skia
 * Uses basic React Native Views to create bar charts
 */
const FallbackChart: React.FC<FallbackChartProps> = ({
  data,
  labels,
  title,
  maxValue,
  color = colors.primary.main,
  height = 200
}) => {
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - (spacing.md * 4); // Account for card padding
  const barAreaHeight = height - 60; // Leave space for labels
  const barAreaWidth = chartWidth - 40; // Leave space for Y-axis
  
  // Calculate max value for scaling
  const calculatedMaxValue = maxValue || Math.max(...data, 1);
  
  return (
    <View style={[styles.container, { height }]}>
      {/* Title */}
      <StyledText variant="bodyMedium" style={styles.title}>
        {title}
      </StyledText>
      
      {/* Chart Area */}
      <View style={styles.chartArea}>
        {/* Y-axis */}
        <View style={styles.yAxis}>
          <StyledText variant="bodySmall" style={styles.yAxisLabel}>
            {calculatedMaxValue}
          </StyledText>
          <View style={styles.yAxisLine} />
          <StyledText variant="bodySmall" style={styles.yAxisLabel}>
            0
          </StyledText>
        </View>
        
        {/* Bars Container */}
        <View style={[styles.barsContainer, { width: barAreaWidth, height: barAreaHeight }]}>
          {/* X-axis line */}
          <View style={styles.xAxisLine} />
          
          {/* Bars */}
          {data.map((value, index) => {
            const barWidth = (barAreaWidth / data.length) * 0.6;
            const barHeight = calculatedMaxValue > 0 ? (value / calculatedMaxValue) * barAreaHeight : 0;
            const barLeft = (index * barAreaWidth / data.length) + ((barAreaWidth / data.length) - barWidth) / 2;
            
            return (
              <View
                key={`bar-${index}`}
                style={[
                  styles.bar,
                  {
                    left: barLeft,
                    width: barWidth,
                    height: Math.max(barHeight, 2), // Minimum height for visibility
                    backgroundColor: color,
                    bottom: 0,
                  }
                ]}
              />
            );
          })}
        </View>
      </View>
      
      {/* X-axis Labels */}
      <View style={[styles.xAxisLabels, { width: barAreaWidth, marginLeft: 40 }]}>
        {labels.map((label, index) => (
          <View key={`label-${index}`} style={styles.labelContainer}>
            <StyledText variant="bodySmall" style={styles.xAxisLabel}>
              {label}
            </StyledText>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: spacing.sm,
    backgroundColor: colors.surface.main,
    borderRadius: borderRadius.md,
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
    color: colors.text.primary,
    fontWeight: '600',
  },
  chartArea: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flex: 1,
  },
  yAxis: {
    width: 40,
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingRight: spacing.xs,
  },
  yAxisLabel: {
    color: colors.text.muted,
    fontSize: 10,
  },
  yAxisLine: {
    width: 1,
    flex: 1,
    backgroundColor: colors.border.light,
    marginVertical: spacing.xs,
  },
  barsContainer: {
    position: 'relative',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border.light,
  },
  xAxisLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: colors.border.light,
  },
  bar: {
    position: 'absolute',
    borderRadius: 2,
    minHeight: 2,
  },
  xAxisLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xs,
  },
  labelContainer: {
    flex: 1,
    alignItems: 'center',
  },
  xAxisLabel: {
    color: colors.text.muted,
    fontSize: 10,
    textAlign: 'center',
  },
});

export default FallbackChart;
