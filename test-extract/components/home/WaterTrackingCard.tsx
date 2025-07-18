import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, ScrollView, Animated, Easing, Modal } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Defs, RadialGradient, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';

// Import theme
import { colors, spacing, borderRadius, shadows } from '../../theme/theme';
import { useProfile } from '../../contexts/ProfileContext';
// Import notification service for water reminders
import NotificationService from '../../services/notifications';

// Add type definition for workout tracking
interface WorkoutTracking {
  water_tracking?: WaterTracking;
  [key: string]: any; // Allow other properties
}

// Default values
const DEFAULT_WATER_GOAL = 3.5; // 3.5 liters
const DEFAULT_INCREMENT = 0.35; // 350ml per tap
const MAX_LOGS_VISIBLE = 5;

// Define a water color since it's not in the theme
const WATER_COLOR = '#3498db';
const WATER_COLOR_LIGHT = '#7ed6df';
const WATER_COLOR_DARK = '#0097e6';

interface WaterLog {
  amount: number; // in liters
  timestamp: string;
}

interface WaterTracking {
  logs: WaterLog[];
  totalToday: number;
  goal: number;
  lastUpdated: string;
}

const WaterTrackingCard = () => {
  const { profile, updateProfile } = useProfile();
  const [waterData, setWaterData] = useState<WaterTracking>({
    logs: [],
    totalToday: 0,
    goal: DEFAULT_WATER_GOAL,
    lastUpdated: new Date().toISOString(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [buttonScale] = useState(new Animated.Value(1));
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Load water tracking data from profile
  useEffect(() => {
    if (profile) {
      // Get water intake goal from profile or use default
      const waterGoal = profile.water_intake_goal || DEFAULT_WATER_GOAL;
      
      // Convert goal if stored in ounces
      const normalizedGoal = profile.water_intake_unit === 'oz' ? waterGoal * 0.0295735 : waterGoal;
      
      // Initialize or get existing water tracking data
      let waterTracking: WaterTracking;
      
      // Check if workout_tracking exists and is an object with water_tracking
      if (profile.workout_tracking && 
          typeof profile.workout_tracking === 'object' && 
          !Array.isArray(profile.workout_tracking) &&
          (profile.workout_tracking as WorkoutTracking).water_tracking) {
        
        waterTracking = (profile.workout_tracking as WorkoutTracking).water_tracking as WaterTracking;
        
        // Update the goal from profile settings if it changed
        if (waterTracking.goal !== normalizedGoal) {
          waterTracking.goal = normalizedGoal;
        }
        
        // Check if we need to reset for a new day
        const lastUpdated = new Date(waterTracking.lastUpdated);
        const today = new Date();
        
        if (lastUpdated.toDateString() !== today.toDateString()) {
          // It's a new day, reset the logs but keep the goal
          waterTracking = {
            logs: [],
            totalToday: 0,
            goal: normalizedGoal,
            lastUpdated: today.toISOString(),
          };
        }
      } else {
        // No previous water tracking data
        waterTracking = {
          logs: [],
          totalToday: 0,
          goal: normalizedGoal,
          lastUpdated: new Date().toISOString(),
        };
      }
      
      setWaterData(waterTracking);
      setIsLoading(false);
    }
  }, [profile]);

  // Save water tracking data to profile
  const saveWaterData = async (newWaterData: WaterTracking) => {
    if (!profile) return;

    try {
      // Create a new object for workout_tracking instead of using the array
      const newWorkoutTracking = {
        // Include any existing data if workout_tracking is an object
        ...(typeof profile.workout_tracking === 'object' && 
           !Array.isArray(profile.workout_tracking) ? 
           profile.workout_tracking : {}),
        // Add the water tracking data
        water_tracking: newWaterData
      };
      
      // Update the profile
      await updateProfile({
        workout_tracking: newWorkoutTracking
      });
      
      // Notify the notification service about the water log
      await NotificationService.updateLastWaterLogTime();
    } catch (error) {
      console.error('Error saving water tracking data:', error);
    }
  };

  // Button press animation
  const animateButtonPress = () => {
    // Scale down
    Animated.timing(buttonScale, {
      toValue: 0.95,
      duration: 100,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.ease),
    }).start(() => {
      // Scale back up
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }).start();
    });
  };

  // Add water log
  const addWaterLog = () => {
    // Calculate increments based on goal
    // For larger goals, use larger increments
    const goalBasedIncrement = waterData.goal >= 5 ? DEFAULT_INCREMENT * 1.5 : 
                               waterData.goal >= 3 ? DEFAULT_INCREMENT : 
                               DEFAULT_INCREMENT * 0.7;
    
    // Don't allow adding more than the goal + 2 increments
    if (waterData.totalToday >= waterData.goal + goalBasedIncrement * 2) {
      // Optionally show a message that they've reached their goal
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    // Add haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    // Animate button
    animateButtonPress();

    const now = new Date();
    const newLog: WaterLog = {
      amount: goalBasedIncrement,
      timestamp: now.toISOString(),
    };

    const newTotalToday = waterData.totalToday + goalBasedIncrement;
    
    const newWaterData = {
      ...waterData,
      logs: [newLog, ...waterData.logs],
      totalToday: newTotalToday,
      lastUpdated: now.toISOString(),
    };
    
    setWaterData(newWaterData);
    saveWaterData(newWaterData);
  };

  // Calculate progress percentage
  const getProgressPercentage = () => {
    if (waterData.goal === 0) return 0;
    let percentage = (waterData.totalToday / waterData.goal) * 100;
    
    // Cap at 100% for the visual indicator
    return Math.min(percentage, 100);
  };

  // Format time to show hour and minutes (e.g. "9:45 AM")
  const formatTime = (dateString: string) => {
    return format(new Date(dateString), 'h:mm a');
  };

  // Render circular progress for water
  const renderWaterProgress = () => {
    const progress = getProgressPercentage() / 100;
    const size = 140;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDashoffset = circumference * (1 - progress);
    
    return (
      <View style={styles.waterProgressContainer}>
        <View style={styles.progressChartContainer}>
          <Svg width={size} height={size}>
            <Defs>
              <RadialGradient id="grad" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
                <Stop offset="0%" stopColor={WATER_COLOR_LIGHT} stopOpacity="0.3" />
                <Stop offset="100%" stopColor={WATER_COLOR} stopOpacity="0.1" />
              </RadialGradient>
              <SvgLinearGradient id="progressGradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor="#36D1DC" />
                <Stop offset="100%" stopColor="#5B86E5" />
              </SvgLinearGradient>
            </Defs>
            
            {/* Background Circle with glowing effect */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius + 5}
              fill="url(#grad)"
            />
            
            {/* Background Circle */}
            <Circle
              stroke="rgba(255, 255, 255, 0.1)"
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
            />
            
            {/* Progress Circle */}
            <Circle
              stroke="url(#progressGradient)"
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
            
            {/* Glow effect for progress circle */}
            <Circle
              stroke="rgba(91, 134, 229, 0.4)"
              fill="none"
              cx={size / 2}
              cy={size / 2}
              r={radius}
              strokeWidth={strokeWidth + 4}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              opacity={0.6}
            />
          </Svg>
          
          <View style={styles.progressTextContainer}>
            <Text style={styles.progressValueText}>
              {waterData.totalToday.toFixed(1)}L
            </Text>
            <Text style={styles.progressLabel}>
              of {waterData.goal}L
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Render logs
  const renderWaterLogs = () => {
    const logsToShow = waterData.logs.slice(0, MAX_LOGS_VISIBLE);
    
    if (logsToShow.length === 0) {
      return (
        <View style={styles.emptyLogsContainer}>
          <Text style={styles.emptyLogsText}>No water logged today</Text>
        </View>
      );
    }
    
    return (
      <ScrollView style={styles.logsScrollContainer} showsVerticalScrollIndicator={false}>        
        {logsToShow.map((log, index) => (
          <View key={index} style={styles.logItem}>
            <View style={styles.logLeftSection}>
              <View style={styles.logIconContainer}>
                <MaterialCommunityIcons name="cup-water" size={14} color={WATER_COLOR} />
              </View>
              <Text style={styles.logText}>
                +{log.amount.toFixed(1)}L
              </Text>
            </View>
            <Text style={styles.logTime}>
              {formatTime(log.timestamp)}
            </Text>
          </View>
        ))}
        
        {waterData.logs.length > MAX_LOGS_VISIBLE && (
          <TouchableOpacity 
            style={styles.viewAllButton} 
            onPress={() => setShowAllLogs(true)}
          >
            <Text style={styles.viewAllButtonText}>
              View all logs
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    );
  };

  // Render all logs modal
  const renderAllLogsModal = () => {
    return (
      <Modal
        animationType="slide"
        transparent={true}
        visible={showAllLogs}
        onRequestClose={() => setShowAllLogs(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['rgba(25, 40, 80, 0.98)', 'rgba(15, 25, 55, 0.95)']}
              style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
            />
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Water Logs</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setShowAllLogs(false)}
              >
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.allLogsScrollContainer}>
              {waterData.logs.length === 0 ? (
                <View style={styles.emptyLogsContainer}>
                  <Text style={styles.emptyLogsText}>No water logged today</Text>
                </View>
              ) : (
                waterData.logs.map((log, index) => (
                  <View key={index} style={styles.allLogsItem}>
                    <View style={styles.logLeftSection}>
                      <View style={styles.logIconContainer}>
                        <MaterialCommunityIcons name="cup-water" size={14} color={WATER_COLOR} />
                      </View>
                      <Text style={styles.logText}>
                        +{log.amount.toFixed(1)}L
                      </Text>
                    </View>
                    <Text style={styles.logTime}>
                      {formatTime(log.timestamp)}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading water tracking...</Text>
      </View>
    );
  }

  const isGoalCompleted = getProgressPercentage() >= 100;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(25, 40, 80, 0.98)', 'rgba(15, 25, 55, 0.95)']}
        style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.lg }]}
      />
      
      {/* Card Header */}
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <MaterialCommunityIcons name="water" size={24} color={WATER_COLOR} />
          <Text style={styles.cardTitle}>Water Tracking</Text>
        </View>
      </View>
      
      {/* Content Container */}
      <View style={styles.horizontalContainer}>
        {/* Main Card - Progress Circle and Add Button */}
        <View style={styles.mainCard}>
          {renderWaterProgress()}
          
          {/* Water percentage completion label */}
          <Text style={[
            styles.percentageLabel, 
            isGoalCompleted && styles.percentageLabelCompleted
          ]}>
            {getProgressPercentage().toFixed(0)}% completed
          </Text>
          
          <Animated.View 
            style={[
              styles.addButtonContainer,
              { transform: [{ scale: buttonScale }] }
            ]}
          >
            <TouchableOpacity 
              style={styles.addButton}
              onPress={addWaterLog}
              activeOpacity={0.9}
            >
              <LinearGradient
                colors={['#36D1DC', '#5B86E5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.addButtonGradient}
                locations={[0.2, 0.8]} // Added for better gradient effect
              >
                <MaterialCommunityIcons 
                  name="cup-water" 
                  size={20} 
                  color="white" 
                  style={styles.addButtonIcon} 
                />
                <Text style={styles.addButtonText}>Add Water</Text>
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
        
        {/* Logs Card */}
        <View style={styles.logsCard}>
          <LinearGradient
            colors={['rgba(30, 50, 100, 0.2)', 'rgba(30, 50, 100, 0.4)']}
            style={[StyleSheet.absoluteFill, { borderRadius: borderRadius.md }]}
          />
          <View style={styles.logsHeader}>
            <Text style={styles.logsTitle}>Today's Logs</Text>
          </View>
          {renderWaterLogs()}
        </View>
      </View>
      
      {/* Render the modal */}
      {renderAllLogsModal()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.lg,
    marginHorizontal: spacing.xs,
    marginBottom: spacing.md,
    padding: spacing.sm,
    ...shadows.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs, // Reduced from spacing.sm to make less gap
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginLeft: spacing.sm,
  },
  horizontalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start', // Changed from center to flex-start to align logs card at top
    height: 230, // Added fixed height to ensure logs card has enough vertical space
  },
  mainCard: {
    width: '62%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs, // Reduced padding
    paddingHorizontal: spacing.xs,
    height: '100%', // Take full height of container
  },
  logsCard: {
    width: '36%',
    borderRadius: borderRadius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(91, 134, 229, 0.2)',
    ...shadows.medium,
    position: 'relative',
    overflow: 'hidden',
    height: '100%', // Take full height of container to be taller
  },
  waterProgressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs, // Reduced margin
  },
  progressChartContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  progressValueText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  percentageLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#36D1DC',
    marginBottom: spacing.xs, // Reduced margin
  },
  percentageLabelCompleted: {
    color: '#4cd137',
  },
  addButtonContainer: {
    width: '85%', // Reduced from 100% to make button smaller
    ...shadows.large,
  },
  addButton: {
    width: '100%',
    height: 44, // Reduced from 50 to make button smaller
    borderRadius: 22, // Half of height for rounded corners
    overflow: 'hidden',
    // Added shadow for glowing effect
    shadowColor: "#36D1DC",
    shadowOffset: {
      width: 0,
      height: 0,
    },
    shadowOpacity: 0.6,
    shadowRadius: 8,
    elevation: 8,
  },
  addButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xs, // Smaller padding
  },
  addButtonIcon: {
    marginRight: spacing.xs,
  },
  addButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 15, // Reduced font size
    letterSpacing: 0.5,
    // Added text shadow for more aesthetic look
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logsHeader: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    paddingBottom: 6, // Reduced padding
    marginBottom: 6, // Reduced margin
    alignItems: 'center',
  },
  logsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: 'white',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  logsScrollContainer: {
    maxHeight: 190, // Increased to make room for more logs
  },
  logItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  logLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(91, 134, 229, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
  logTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 11,
    fontWeight: '500',
  },
  emptyLogsContainer: {
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    height: 120,
  },
  emptyLogsText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontStyle: 'italic',
    fontSize: 12,
    textAlign: 'center',
  },
  viewAllButton: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(91, 134, 229, 0.15)',
    borderRadius: borderRadius.sm,
    alignItems: 'center',
  },
  viewAllButtonText: {
    color: '#36D1DC',
    fontSize: 12,
    fontWeight: '600',
  },
  moreLogsText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.6)',
    fontSize: 10,
    padding: 6,
  },
  loadingText: {
    color: 'white',
    textAlign: 'center',
    padding: spacing.md,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    padding: spacing.md,
  },
  modalContent: {
    width: '85%',
    maxHeight: '80%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.large,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.15)',
    paddingBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  closeButton: {
    padding: 4,
  },
  allLogsScrollContainer: {
    flex: 1,
  },
  allLogsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
});

export default WaterTrackingCard; 