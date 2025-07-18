// Type declarations for modules without their own type definitions

// Declare modules that don't have built-in type definitions
declare module "*.svg" {
  import React from "react";
  import { SvgProps } from "react-native-svg";
  const content: React.FC<SvgProps>;
  export default content;
}

declare module "*.png" {
  const content: any;
  export default content;
}

declare module "*.jpg" {
  const content: any;
  export default content;
}

declare module "phoenix" {
  // Phoenix WebSocket type declarations
  export class Socket {
    constructor(endPoint: string, opts?: any);
    connect(): void;
    disconnect(callback?: Function, code?: number, reason?: string): void;
    channel(topic: string, chanParams?: object): Channel;
    push(data: object): void;
    log(kind: string, msg: string, data: object): void;
    onOpen(callback: Function): void;
    onClose(callback: Function): void;
    onError(callback: Function): void;
    onMessage(callback: Function): void;
  }
  
  export class Channel {
    constructor(topic: string, params?: object, socket?: Socket);
    join(timeout?: number): Push;
    leave(timeout?: number): Push;
    push(event: string, payload?: object, timeout?: number): Push;
    onClose(callback: Function): void;
    onError(callback: Function): void;
    onMessage(callback: Function): void;
    on(event: string, callback: Function): void;
    off(event: string): void;
  }
  
  export class Push {
    receive(status: string, callback: Function): Push;
  }
}

declare module "prop-types" {
  // PropTypes type declarations
  export const array: any;
  export const bool: any;
  export const func: any;
  export const number: any;
  export const object: any;
  export const string: any;
  export const symbol: any;
  export const node: any;
  export const element: any;
  export const instanceOf: (expectedClass: any) => any;
  export const oneOf: (types: any[]) => any;
  export const oneOfType: (types: any[]) => any;
  export const arrayOf: (type: any) => any;
  export const objectOf: (type: any) => any;
  export const shape: (shape: any) => any;
  export const exact: (shape: any) => any;
}

declare module "ws" {
  // WebSocket type declarations
  export default class WebSocket {
    constructor(url: string, protocols?: string | string[]);
    readonly readyState: number;
    readonly bufferedAmount: number;
    readonly extensions: string;
    readonly protocol: string;
    readonly url: string;
    readonly CONNECTING: number;
    readonly OPEN: number;
    readonly CLOSING: number;
    readonly CLOSED: number;
    onopen: ((event: any) => void) | null;
    onerror: ((event: any) => void) | null;
    onclose: ((event: any) => void) | null;
    onmessage: ((event: any) => void) | null;
    close(code?: number, reason?: string): void;
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
  }
}

declare module 'react-native-vector-icons/MaterialCommunityIcons';
declare module 'react-native-flash-message';
