import React from 'react';
import { Redirect } from 'expo-router';

// This redirects to the new login screen at /login
export default function AuthLogin() {
  return <Redirect href="/login" />;
}
