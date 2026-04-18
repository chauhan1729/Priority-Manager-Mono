import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { supabase } from '../../src/lib/supabase/client';

WebBrowser.maybeCompleteAuthSession();

type Mode = 'landing' | 'signin' | 'signup';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRedirectUri() {
  return AuthSession.makeRedirectUri({ scheme: 'priority-manager' });
}

/**
 * React Native's URL/URLSearchParams polyfill is incomplete — `.get()` is not
 * reliably available. Supabase returns OAuth tokens in the URL hash fragment
 * (e.g. "…#access_token=…&refresh_token=…"), so parse it ourselves.
 */
function parseTokensFromCallbackUrl(url: string): { accessToken?: string; refreshToken?: string } {
  const hashIdx = url.indexOf('#');
  const queryIdx = url.indexOf('?');
  const raw =
    hashIdx >= 0 ? url.slice(hashIdx + 1)
    : queryIdx >= 0 ? url.slice(queryIdx + 1)
    : '';
  const out: { accessToken?: string; refreshToken?: string } = {};
  for (const pair of raw.split('&')) {
    const [k, v] = pair.split('=');
    if (!k || !v) continue;
    const value = decodeURIComponent(v);
    if (k === 'access_token') out.accessToken = value;
    else if (k === 'refresh_token') out.refreshToken = value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('landing');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Dynamically import TextInput to avoid circular issues
  // (We use RN directly here to keep this file self-contained)
  const { TextInput } = require('react-native') as typeof import('react-native');

  const clearError = () => setError(null);

  // ---- Email sign-in -------------------------------------------------------

  async function handleSignIn() {
    clearError();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (authError) setError(authError.message);
    // On success the AuthProvider's onAuthStateChange fires → _layout.tsx redirects
  }

  // ---- Email sign-up -------------------------------------------------------

  async function handleSignUp() {
    clearError();
    if (!name || !email || !password) { setError('Please fill in all fields.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    setLoading(false);
    if (authError) setError(authError.message);
  }

  // ---- Google OAuth --------------------------------------------------------

  async function handleGoogle() {
    clearError();
    setLoading(true);
    try {
      const redirectTo = makeRedirectUri();
      const { data, error: urlError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (urlError || !data.url) { setError(urlError?.message ?? 'Google sign-in failed.'); return; }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const { accessToken, refreshToken } = parseTokensFromCallbackUrl(result.url);
        if (accessToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' });
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  // ---- Apple OAuth ---------------------------------------------------------

  async function handleApple() {
    clearError();
    setLoading(true);
    try {
      const redirectTo = makeRedirectUri();
      const { data, error: urlError } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (urlError || !data.url) { setError(urlError?.message ?? 'Apple sign-in failed.'); return; }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
      if (result.type === 'success' && result.url) {
        const { accessToken, refreshToken } = parseTokensFromCallbackUrl(result.url);
        if (accessToken) {
          await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken ?? '' });
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Apple sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function renderLanding() {
    return (
      <>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.disabled]}
          onPress={() => setMode('signin')}
          disabled={loading}
        >
          <Text style={styles.primaryButtonText}>Continue with Email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, loading && styles.disabled]}
          onPress={handleGoogle}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#1A1A2E" />
          ) : (
            <Text style={styles.secondaryButtonText}>Continue with Google</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, loading && styles.disabled]}
          onPress={handleApple}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>Continue with Apple</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderSignIn() {
    return (
      <>
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={(v: string) => { setEmail(v); clearError(); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={(v: string) => { setPassword(v); clearError(); }}
          secureTextEntry
          autoComplete="current-password"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.disabled]}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.primaryButtonText}>Sign In</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode('signup'); clearError(); }} style={styles.linkRow}>
          <Text style={styles.linkText}>Don't have an account? <Text style={styles.link}>Create one</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode('landing'); clearError(); }} style={styles.linkRow}>
          <Text style={styles.link}>← Back</Text>
        </TouchableOpacity>
      </>
    );
  }

  function renderSignUp() {
    return (
      <>
        <TextInput
          style={styles.input}
          placeholder="Full name"
          placeholderTextColor="#9CA3AF"
          value={name}
          onChangeText={(v: string) => { setName(v); clearError(); }}
          autoCapitalize="words"
          autoComplete="name"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={(v: string) => { setEmail(v); clearError(); }}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password (min 6 characters)"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={(v: string) => { setPassword(v); clearError(); }}
          secureTextEntry
          autoComplete="new-password"
          editable={!loading}
        />

        <TouchableOpacity
          style={[styles.button, styles.primaryButton, loading && styles.disabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.primaryButtonText}>Create Account</Text>}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode('signin'); clearError(); }} style={styles.linkRow}>
          <Text style={styles.linkText}>Already have an account? <Text style={styles.link}>Sign in</Text></Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => { setMode('landing'); clearError(); }} style={styles.linkRow}>
          <Text style={styles.link}>← Back</Text>
        </TouchableOpacity>
      </>
    );
  }

  const subtitles: Record<Mode, string> = {
    landing: 'Sign in to your planner',
    signin: 'Sign in to your account',
    signup: 'Create your account',
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Text style={styles.title}>Priority Manager</Text>
            <Text style={styles.subtitle}>{subtitles[mode]}</Text>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {mode === 'landing' && renderLanding()}
            {mode === 'signin' && renderSignIn()}
            {mode === 'signup' && renderSignUp()}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles — matches original card aesthetic
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  kav: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#1A1A2E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#4A4A6A',
    marginBottom: 32,
  },
  errorText: {
    fontSize: 13,
    color: '#DC2626',
    marginBottom: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1A1A2E',
    marginBottom: 12,
    minHeight: 44,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  secondaryButtonText: {
    color: '#1A1A2E',
    fontSize: 14,
    fontWeight: '500',
  },
  disabled: {
    opacity: 0.5,
  },
  linkRow: {
    alignItems: 'center',
    marginBottom: 8,
  },
  linkText: {
    fontSize: 13,
    color: '#4A4A6A',
  },
  link: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '500',
  },
});
