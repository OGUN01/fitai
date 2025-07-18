import React from 'react';
import { Platform, View, ViewProps } from 'react-native';

interface TouchableProps extends ViewProps {
  // React Native specific responder props
  onStartShouldSetResponder?: () => boolean;
  onResponderGrant?: () => void;
  onResponderMove?: () => void;
  onResponderRelease?: () => void;
  onResponderTerminate?: () => void;
  onResponderTerminationRequest?: () => boolean;
  children: React.ReactNode;
}

/**
 * A component that conditionally applies touch responder props only on native platforms
 * to avoid warnings when running on web.
 */
const PlatformAwareTouchable: React.FC<TouchableProps> = (props) => {
  const {
    children,
    onStartShouldSetResponder,
    onResponderGrant,
    onResponderMove,
    onResponderRelease,
    onResponderTerminate,
    onResponderTerminationRequest,
    ...otherProps
  } = props;

  // Only apply responder props on native platforms
  const responderProps = Platform.OS !== 'web' 
    ? {
        onStartShouldSetResponder,
        onResponderGrant,
        onResponderMove,
        onResponderRelease,
        onResponderTerminate,
        onResponderTerminationRequest,
      }
    : {};

  return (
    <View {...otherProps} {...responderProps}>
      {children}
    </View>
  );
};

export default PlatformAwareTouchable;
