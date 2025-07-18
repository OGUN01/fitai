/// <reference types="react" />
/// <reference types="react-native" />
/// <reference types="expo" />

declare module '*.svg' {
  import React from 'react';
  import { SvgProps } from 'react-native-svg';
  const content: React.FC<SvgProps>;
  export default content;
}

declare module '*.png';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.gif';
declare module '*.bmp';
declare module '*.tiff';

// Declare window for web platform
interface Window {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
  removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
  localStorage: Storage;
}

// Fix for EventRegister type issues
declare module 'react-native-event-listeners' {
  export class EventRegister {
    static addEventListener(eventName: string, callback: (data: any) => void): string;
    static removeEventListener(id: string): void;
    static removeAllListeners(): void;
    static emit(eventName: string, data: any): void;
  }
}
